import { mkdir, readdir } from "node:fs/promises";
import { analyze, evaluate, pseudonymize, shield, simulate, LAYERS, type Dataset, type Embedder, type Evaluation, type LayerId, type Report, type Scenario, type ShieldInput } from "cakranala";
import seruni from "cakranala/scenarios/seruni.json";
import { createE5Embedder } from "@cakranala/embed-e5";
import { reasonerFromEnv } from "@cakranala/reasoner-openai";
import { createXCollector, sessionFromEnv } from "@cakranala/collect-x";
import registry from "../../config/registry.json";

const SNAPSHOTS = new URL("../../../../data/snapshots/", import.meta.url).pathname;
const scenario = seruni as Scenario;
const reasoner = reasonerFromEnv();
const secret = process.env.PSEUDONYM_SECRET ?? crypto.randomUUID();

let embedderPromise: Promise<Embedder> | undefined;
const embedder = () => {
  if (!embedderPromise) {
    const cache = new Map<string, Float32Array>();
    embedderPromise = createE5Embedder().then((base) => ({
      async embed(texts: string[]) {
        const miss = [...new Set(texts.filter((t) => !cache.has(t)))];
        if (miss.length) (await base.embed(miss)).forEach((v, i) => cache.set(miss[i], v));
        return texts.map((t) => cache.get(t)!);
      },
    }));
  }
  return embedderPromise;
};

export interface Source {
  kind: "sim" | "x";
  label: string;
  query?: string;
  coverage?: number;
  collectedAt?: number;
}

export interface View {
  source: Source;
  report: Report;
  actors: { id: string; handle?: string; label?: string; followers?: number; createdAt?: number }[];
  evaluation?: ReturnType<typeof evaluate>;
}

let current: { view: View; dataset: Dataset } | undefined;

function toView(ds: Dataset, report: Report, source: Source): View {
  const involved = new Set([...report.edges.flatMap((e) => [e.a, e.b]), ...report.clusters.flatMap((c) => c.members)]);
  return {
    source,
    report,
    actors: ds.actors.filter((a) => involved.has(a.id)).map((a) => ({ id: a.id, handle: a.handle, label: ds.truth?.[a.id], followers: a.followers, createdAt: a.createdAt })),
    evaluation: ds.truth ? evaluate(report, ds.truth) : undefined,
  };
}

export async function runSimulation(seed: number) {
  const ds = simulate(scenario, seed);
  const report = await analyze(ds, { embedder: await embedder(), reasoner, seed });
  current = { dataset: ds, view: toView(ds, report, { kind: "sim", label: `Simulation, ${scenario.name}, seed ${seed}`, coverage: 1 }) };
  return current.view;
}

export async function runLive(query: string, pages: number) {
  const session = sessionFromEnv();
  if (!session) throw new Error("X session is not configured on the server");
  const x = await createXCollector(session);
  const raw = await x.search(query, { pages: Math.min(Math.max(pages, 1), 15), lang: "in" });
  const ds = await pseudonymize(raw, secret);
  const report = await analyze(ds, { embedder: await embedder(), reasoner });
  const view = toView(ds, report, { kind: "x", label: `X search "${query}"`, query, coverage: raw.meta?.coverage, collectedAt: raw.meta?.collectedAt });
  current = { dataset: ds, view };
  await mkdir(SNAPSHOTS, { recursive: true });
  await Bun.write(`${SNAPSHOTS}${Date.now()}.json`, JSON.stringify({ source: view.source, dataset: ds }));
  return { view, rate: x.rate };
}

export async function listSnapshots() {
  const files = await readdir(SNAPSHOTS).catch(() => [] as string[]);
  const out: { id: string; source: Source; events: number }[] = [];
  for (const f of files.filter((f) => f.endsWith(".json")).sort().reverse()) {
    const s = await Bun.file(`${SNAPSHOTS}${f}`).json();
    out.push({ id: f.replace(".json", ""), source: s.source, events: s.dataset.events.length });
  }
  return out;
}

export async function loadSnapshot(id: string) {
  if (!/^\d+$/.test(id)) throw new Error("invalid snapshot");
  const s = await Bun.file(`${SNAPSHOTS}${id}.json`).json();
  const report = await analyze(s.dataset, { embedder: await embedder(), reasoner });
  current = { dataset: s.dataset, view: toView(s.dataset, report, s.source) };
  return current.view;
}

export const currentView = () => current?.view;

export async function runShield(input: ShieldInput) {
  return shield(input, { report: current?.view.report, officialDomains: registry.officialDomains, embedder: await embedder(), reasoner });
}

const ABLATIONS: { name: string; layers: LayerId[] }[] = [
  { name: "Copypasta only", layers: ["copypasta"] },
  { name: "Co-action only", layers: ["coaction"] },
  { name: "Lexical", layers: ["coaction", "copypasta"] },
  { name: "No semantic layer", layers: LAYERS.filter((l) => l !== "coframing") },
  { name: "Full multiplex", layers: LAYERS },
];

let ablation: Promise<unknown> | undefined;
export function runAblation(seeds = [1, 2, 3]) {
  ablation ??= (async () => {
    const e = await embedder();
    const rows = [];
    for (const a of ABLATIONS) {
      const runs: Evaluation[] = [];
      for (const seed of seeds) {
        const ds = simulate(scenario, seed);
        runs.push(evaluate(await analyze(ds, { embedder: e, layers: a.layers, minLayers: Math.min(2, a.layers.length), seed }), ds.truth!));
      }
      const avg = (f: (x: (typeof runs)[number]) => number) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
      const kind = (k: string) => avg((r) => r.operations.find((o) => o.kind === k)?.recall ?? 0);
      rows.push({
        name: a.name,
        precision: avg((r) => r.precision),
        recall: avg((r) => r.recall),
        f1: avg((r) => r.f1),
        paid: kind("paid"),
        botfarm: kind("botfarm"),
        swarm: kind("swarm"),
        organicFP: avg((r) => r.organicFlagRate),
        viralFP: avg((r) => r.viralFlagRate ?? 0),
      });
    }
    return { seeds, rows };
  })().catch((e) => {
    ablation = undefined;
    throw e;
  });
  return ablation;
}

export const capabilities = () => ({ live: !!sessionFromEnv(), reasoner: !!reasoner, scenario: scenario.name });
