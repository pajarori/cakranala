import { analyze, evaluate, plain, SCHEMA_VERSION, type Dataset, type Embedder, type Evaluation, type Report } from "cakranala";
import { createE5Embedder, reasonerFromEnv } from "cakranala-embeder";
import { alerts, cases, monitors, store, type Alert, type CaseRow } from "./db";
import { DEMO_MODE, due, rateState, runMonitor, simulationProgress } from "./monitors";
import { techniques, type Technique } from "./disarm";
import { notifyWatchlist } from "./actors";

export const reasoner = reasonerFromEnv();
const WINDOW = 24 * 3600_000;
export const SEVERITY = { critical: 50, high: 20, medium: 8 };

let embedderPromise: Promise<Embedder> | undefined;
export const embedder = () =>
  (embedderPromise ??= createE5Embedder().then((base) => {
    const cache = new Map<string, Float32Array>();
    return {
      async embed(texts: string[]) {
        const miss = [...new Set(texts.filter((t) => !cache.has(t)))];
        if (miss.length) (await base.embed(miss)).forEach((v, i) => cache.set(miss[i], v));
        return texts.map((t) => cache.get(t)!);
      },
    };
  }));

export type Severity = "critical" | "high" | "medium" | "low";


export type Escalation = "watch" | "alert" | "urgent";

export const ESCALATION = { urgentInflation: 3, alertInflation: 2 };

const escalation = (severity: Severity, apparent: number, independent: number): Escalation => {
  const inflation = apparent / Math.max(independent, 1);
  if (severity === "critical" || (severity === "high" && inflation >= ESCALATION.urgentInflation)) return "urgent";
  if (severity === "high" || (severity === "medium" && inflation >= ESCALATION.alertInflation)) return "alert";
  return "watch";
};

export interface CaseView extends CaseRow {
  active: boolean;
  severity: Severity;
  escalation: Escalation;
  disarm: Technique[];
  narratives: string[];
  clusters: string[];
  apparent: number;
  independent: number;
  monitors: string[];
}

export interface State {
  updatedAt: number | null;
  analyzing: boolean;
  window: { from: number; to: number };
  report: Report | null;
  actors: { id: string; handle?: string; label?: string; followers?: number; createdAt?: number }[];
  cases: CaseView[];
  alerts: Alert[];
  activity: { binSec: number; start: number; total: number[]; coordinated: number[] };
  evaluation: Evaluation | null;
}

let state: State = { updatedAt: null, analyzing: false, window: { from: 0, to: 0 }, report: null, actors: [], cases: [], alerts: [], activity: { binSec: 0, start: 0, total: [], coordinated: [] }, evaluation: null };
let lastCount = -1;

const jaccard = (a: Set<string>, b: Set<string>) => {
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i || 1);
};

const severity = (manufactured: number): Severity => (manufactured >= SEVERITY.critical ? "critical" : manufactured >= SEVERITY.high ? "high" : manufactured >= SEVERITY.medium ? "medium" : "low");

function components(report: Report) {
  const coordinated = report.narratives.filter((n) => n.verdict === "manufactured");
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  for (const n of coordinated) for (const c of n.clusters.slice(1)) parent.set(find(c.id), find(n.clusters[0].id));
  const groups = new Map<string, { narratives: string[]; clusters: string[] }>();
  for (const c of report.clusters) {
    const pushes = coordinated.filter((n) => n.clusters.some((x) => x.id === c.id));
    if (!pushes.length && c.members.length < 8) continue;
    const g = groups.get(find(c.id)) ?? { narratives: [], clusters: [] };
    g.clusters.push(c.id);
    for (const n of pushes) if (!g.narratives.includes(n.id)) g.narratives.push(n.id);
    groups.set(find(c.id), g);
  }
  return [...groups.values()];
}

async function describe(report: Report, narrativeIds: string[], clusterIds: string[]) {
  const samples = report.narratives.filter((n) => narrativeIds.includes(n.id)).map((n) => n.sample);
  const points = report.clusters.filter((c) => clusterIds.includes(c.id)).flatMap((c) => c.forensics.talkingPoints);
  const fallback = { title: samples[0]?.slice(0, 80) ?? "Narasi terkoordinasi", brief: null as string | null };
  if (!reasoner) return fallback;
  try {
    const raw = await reasoner.complete(
      [
        "Kamu membantu analis siber militer. Sejumlah akun terkoordinasi mendorong narasi berikut di media sosial Indonesia.",
        `Contoh narasi:\n${samples.map((s) => `- ${s}`).join("\n")}`,
        `Pokok pesan dari akun terkoordinasi:\n${points.slice(0, 6).map((s) => `- ${s}`).join("\n")}`,
        'Balas HANYA JSON: {"title": "judul kasus singkat dalam Bahasa Indonesia, maksimal 8 kata, netral dan faktual", "brief": "2 sampai 3 kalimat Bahasa Indonesia: inti pesan yang tampaknya didorong operator dan tujuan persuasinya. Gunakan bahasa indikatif dan jangan menuduh individu."}',
      ].join("\n\n"),
      { json: true },
    );
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const clean = (s: string) => plain(s).replace(/"/g, "");
    return { title: clean(String(j.title || fallback.title)), brief: j.brief ? clean(String(j.brief)) : null };
  } catch {
    return fallback;
  }
}

async function track(report: Report, now: number, monitorOf: Map<string, string>, events: Dataset["events"]) {
  const existing = cases.all();
  const seen = new Set<string>();
  const views: CaseView[] = [];
  for (const g of components(report)) {
    const members = new Set(report.clusters.filter((c) => g.clusters.includes(c.id)).flatMap((c) => c.members));
    const narratives = report.narratives.filter((n) => g.narratives.includes(n.id));
    const apparent = narratives.reduce((s, n) => s + n.supporters, 0);
    const independent = narratives.reduce((s, n) => s + n.sie.value, 0);
    const manufactured = Math.max(Math.round(apparent - independent), members.size);
    const match = existing.filter((c) => !seen.has(c.id)).map((c) => ({ c, j: jaccard(members, new Set(c.members)) })).sort((a, b) => b.j - a.j)[0];
    let row: CaseRow;
    if (match && match.j >= 0.25) {
      row = { ...match.c, members: [...new Set([...match.c.members, ...members])], lastSeen: now, peak: Math.max(match.c.peak, manufactured) };
      if (manufactured >= Math.max(match.c.peak * 1.5, match.c.peak + 5)) alerts.add({ ts: now, kind: "escalated", caseId: row.id, text: `${row.title} membesar menjadi ${apparent} pendukung tampak` });
    } else {
      const d = await describe(report, g.narratives, g.clusters);
      row = { id: crypto.randomUUID(), title: d.title, brief: d.brief, status: "new", members: [...members], firstSeen: now, lastSeen: now, peak: manufactured, createdAt: now };
      alerts.add({ ts: now, kind: "new", caseId: row.id, text: `Operasi terkoordinasi baru: ${row.title}` });
    }
    cases.upsert(row);
    seen.add(row.id);
    const memberSet = new Set(row.members);
    const mons = [...new Set(events.filter((e) => memberSet.has(e.actor)).map((e) => monitorOf.get(e.id)).filter(Boolean) as string[])];
    views.push({ ...row, active: true, severity: severity(manufactured), escalation: escalation(severity(manufactured), apparent, independent), disarm: techniques(report, g.clusters, g.narratives, events), narratives: g.narratives, clusters: g.clusters, apparent, independent, monitors: mons });
  }
  return order([...views, ...dormant(seen)]);
}

const dormant = (seen = new Set<string>()): CaseView[] =>
  cases.all().filter((c) => !seen.has(c.id)).map((c) => ({ ...c, active: false, severity: severity(c.peak), escalation: "watch" as Escalation, disarm: [], narratives: [], clusters: [], apparent: 0, independent: 0, monitors: [] }));

function order(views: CaseView[]) {
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return views.sort((a, b) => Number(b.active) - Number(a.active) || rank[a.severity] - rank[b.severity] || b.lastSeen - a.lastSeen);
}

function activity(report: Report, events: Dataset["events"], from: number, to: number) {
  const flagged = new Set(report.clusters.flatMap((c) => c.members));
  const start = events.length ? Math.min(...events.map((e) => e.ts)) : from;
  const binMs = Math.max(60_000, Math.ceil((to - start) / 60 / 60_000) * 60_000);
  const bins = Math.floor((to - start) / binMs) + 1;
  const total = new Array(bins).fill(0);
  const coordinated = new Array(bins).fill(0);
  for (const e of events) {
    const b = Math.min(bins - 1, Math.floor((e.ts - start) / binMs));
    total[b]++;
    if (flagged.has(e.actor)) coordinated[b]++;
  }
  return { binSec: binMs / 1000, start, total, coordinated };
}

export async function refresh(force = false) {
  if (state.analyzing) return;
  const now = Date.now();
  for (const m of monitors.all()) if (due(m, now)) await runMonitor(m, now);
  const from = now - WINDOW;
  const { actors, events } = store.window(from);
  if (!force && events.length === lastCount) {
    notifyWatchlist(state.cases);
    return;
  }
  lastCount = events.length;
  if (events.length < 30) {
    state = { ...state, updatedAt: now, window: { from, to: now }, report: null, actors: [], cases: order(dormant()), activity: { binSec: 0, start: from, total: [], coordinated: [] }, evaluation: null };
    return;
  }
  state = { ...state, analyzing: true };
  try {
    const truth = Object.fromEntries(actors.flatMap((a: any) => (a.label ? [[a.id, a.label]] : [])));
    const ds: Dataset = { version: SCHEMA_VERSION, actors, events, truth: Object.keys(truth).length ? truth : undefined };
    const report = await analyze(ds, { embedder: await embedder() });
    const involved = new Set([...report.edges.flatMap((e) => [e.a, e.b]), ...report.clusters.flatMap((c) => c.members)]);
    state = {
      updatedAt: now,
      analyzing: false,
      window: { from, to: now },
      report,
      actors: actors.filter((a) => involved.has(a.id)).map((a: any) => ({ id: a.id, handle: a.handle, label: a.label, followers: a.followers, createdAt: a.createdAt })),
      cases: await track(report, now, store.monitorOf(), events),
      alerts: alerts.recent(),
      activity: activity(report, events, from, now),
      evaluation: ds.truth ? evaluate(report, ds.truth) : null,
    };
    notifyWatchlist(state.cases);
    state = { ...state, alerts: alerts.recent() };
  } catch (e) {
    console.error("analysis failed", e);
    state = { ...state, analyzing: false };
  }
}

export const snapshot = () => ({
  ...state,
  alerts: alerts.recent(),
  monitors: monitors.all().filter((m) => DEMO_MODE || m.kind !== "simulation").map((m) => ({ ...m, progress: m.kind === "simulation" ? simulationProgress(m) : null })),
  rate: rateState(),
});

export const caseView = (id: string) => state.cases.find((c) => c.id === id);
