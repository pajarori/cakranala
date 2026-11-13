import type { Dataset } from "../schema";
import type { Embedder, Reasoner } from "../ports";
import { centered, kmeans, plain } from "../text";
import { rng } from "../util";
import { LAYERS, LAYER_DEFAULTS, runLayers, type LayerId, type LayerOptions } from "./layers";
import { detect, type Cluster, type Edge } from "./graph";
import { forensics, type Forensics } from "./forensics";
import { narratives, type HeldOut, type Narrative } from "./consensus";

export interface AnalyzeOptions extends LayerOptions {
  layers: LayerId[];
  families: LayerId[][];
  minFamilies: number;
  edgeAlphas: number[];
  fdr: number;
  clusterAlpha: number;
  minClusterSize: number;
  minDegree: number;
  minClusterRho: number;
  minSupporters: number;
  verdictAlpha: number;
  syncSec: number;
  verdictFolds: 1 | 2;
  embedder?: Embedder;
  reasoner?: Reasoner;
}

export interface ClusterReport extends Cluster {
  forensics: Forensics;
  brief?: string;
}

export interface Report {
  generatedAt: number;
  stats: { actors: number; events: number; flaggedActors: number; layersRun: LayerId[] };
  tests: Partial<Record<LayerId, { candidates: number; nominal: number; dispersion: number }>>;
  null: { replicates: number; alpha: number; decoyFdr: number };
  edges: Edge[];
  clusters: ClusterReport[];
  narratives: Narrative[];
  scores: Record<string, number>;
}

export const DEFAULTS: AnalyzeOptions = {
  ...LAYER_DEFAULTS,
  layers: LAYERS,
  families: [["coaction"], ["rhythm"], ["copypasta", "coframing"], ["lifecycle"]],
  minFamilies: 1,
  edgeAlphas: [0.05, 0.01, 0.001, 0.0001],
  fdr: 0.05,
  clusterAlpha: 0.05,
  minClusterSize: 3,
  minDegree: 2,
  minClusterRho: 0.05,
  minSupporters: 5,
  verdictAlpha: 0.001,
  syncSec: 1800,
  verdictFolds: 2,
};

async function frameEvents(ds: Dataset, seed: number, embedder?: Embedder) {
  if (!embedder) return undefined;
  const idx = ds.events.flatMap((e, i) => ((e.text ?? "").trim().length > 15 ? [i] : []));
  if (idx.length < 10) return undefined;
  const vecs = centered(await embedder.embed(idx.map((i) => ds.events[i].text!)));
  const k = Math.max(4, Math.min(80, Math.round(Math.sqrt(vecs.length / 2))));
  const assign = kmeans(vecs, k, rng(seed));
  return new Map(idx.map((i, j) => [i, assign[j]]));
}

async function brief(c: ClusterReport, reasoner: Reasoner) {
  const prompt = [
    `Sebuah klaster ${c.members.length} akun menunjukkan pola terkoordinasi (dependensi ρ=${c.rho.toFixed(2)}, ${c.forensics.waves} gelombang).`,
    `Contoh pesan:\n${c.forensics.talkingPoints.map((t) => `- ${t}`).join("\n")}`,
    "Rekonstruksikan dalam 2-3 kalimat Bahasa Indonesia: inti pesan (talking point) yang kemungkinan dibagikan koordinator kepada tim, dan tujuan persuasinya. Gunakan bahasa indikatif, jangan menuduh individu.",
  ].join("\n\n");
  return plain(await reasoner.complete(prompt));
}

function evidence(results: ReturnType<typeof runLayers>) {
  const out = new Map<string, number>();
  for (const r of results) for (const [k, s] of r.pairs) if (s.p < 1) out.set(k, (out.get(k) ?? 1) * s.p);
  return out;
}

function scores(pairs: Map<string, number>, k: number) {
  const byActor = new Map<string, number[]>();
  for (const [key, p] of pairs)
    for (const a of key.split("\u0001")) {
      const list = byActor.get(a);
      if (list) list.push(-Math.log(Math.max(p, 1e-300)));
      else byActor.set(a, [-Math.log(Math.max(p, 1e-300))]);
    }
  return Object.fromEntries([...byActor].map(([a, ss]) => [a, ss.sort((x, y) => y - x)[k - 1] ?? 0]));
}

function significantClusters(ds: Dataset, o: AnalyzeOptions, frames?: Map<number, number>) {
  return detect(runLayers(ds, o, o.layers, frames), o).clusters.filter((c) => c.p <= o.clusterAlpha && c.rho >= o.minClusterRho);
}

function heldOut(ds: Dataset, o: AnalyzeOptions, frames?: Map<number, number>): HeldOut | undefined {
  if (o.verdictFolds !== 2) return undefined;
  const order = ds.events.map((e, i) => ({ e, i })).sort((a, b) => a.e.ts - b.e.ts);
  const cut = order[Math.floor(order.length / 2)]?.e.ts;
  if (cut === undefined) return undefined;
  const halves = [order.filter((x) => x.e.ts < cut), order.filter((x) => x.e.ts >= cut)];
  if (halves.some((h) => h.length < 2)) return undefined;
  const found = halves.map((h) => {
    const sub: Dataset = { ...ds, events: h.map((x) => x.e) };
    const remapped = frames && new Map(h.flatMap((x, j) => (frames.has(x.i) ? [[j, frames.get(x.i)!] as [number, number]] : [])));
    const membership = new Map<string, Cluster>();
    for (const c of significantClusters(sub, o, remapped)) for (const m of c.members) membership.set(m, c);
    return { membership, actors: new Set(h.map((x) => x.e.actor)).size };
  });
  return {
    clusterOf: (e) => found[e.ts < cut ? 1 : 0].membership.get(e.actor),
    baseRate: (found[0].membership.size + found[1].membership.size) / Math.max(1, found[0].actors + found[1].actors),
  };
}

export async function analyze(ds: Dataset, options: Partial<AnalyzeOptions> = {}): Promise<Report> {
  const given = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) as Partial<AnalyzeOptions>;
  const o: AnalyzeOptions = { ...DEFAULTS, ...given, windowSec: { ...DEFAULTS.windowSec, ...given.windowSec } };
  const frames = await frameEvents(ds, o.seed, o.embedder);
  const results = runLayers(ds, o, o.layers, frames);
  const found = detect(results, o);
  const clusters = found.clusters.filter((c) => c.p <= o.clusterAlpha && c.rho >= o.minClusterRho);
  const kept = new Set(clusters.flatMap((c) => c.members));
  const edges = found.edges.filter((e) => kept.has(e.a) && kept.has(e.b));
  const reports: ClusterReport[] = clusters.map((c) => ({ ...c, forensics: forensics(c.members, ds.events) }));
  if (o.reasoner) await Promise.all(reports.slice(0, 5).map(async (c) => (c.brief = await brief(c, o.reasoner!).catch(() => undefined))));
  return {
    generatedAt: Date.now(),
    stats: {
      actors: ds.actors.length,
      events: ds.events.length,
      flaggedActors: new Set(clusters.flatMap((c) => c.members)).size,
      layersRun: results.map((r) => r.id),
    },
    tests: Object.fromEntries(results.map((r) => [r.id, { candidates: r.candidates, nominal: [...r.pairs.values()].filter((s) => s.p <= 0.01).length, dispersion: r.dispersion }])),
    null: { replicates: results[0]?.replicates.length ?? 0, alpha: found.alpha, decoyFdr: found.decoyFdr },
    edges,
    clusters: reports,
    narratives: narratives(ds.events, clusters, frames, { minSupporters: o.minSupporters, seed: o.seed, alpha: o.verdictAlpha, syncSec: o.syncSec }, heldOut(ds, o, frames)),
    scores: scores(evidence(results), Math.max(1, o.minClusterSize - 1)),
  };
}
