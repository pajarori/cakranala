import type { Dataset } from "../schema";
import type { Embedder, Reasoner } from "../ports";
import { centered, kmeans, plain } from "../text";
import { rng } from "../util";
import { LAYERS, LAYER_DEFAULTS, runLayers, type LayerId, type LayerOptions } from "./layers";
import { cluster, combine, type Cluster, type Edge } from "./graph";
import { forensics, type Forensics } from "./forensics";
import { narratives, type Narrative } from "./consensus";

export interface AnalyzeOptions extends LayerOptions {
  layers: LayerId[];
  minLayers: number;
  minClusterSize: number;
  minClusterRho: number;
  minSupporters: number;
  verdictAlpha: number;
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
  tests: Partial<Record<LayerId, { candidates: number; significant: number }>>;
  edges: Edge[];
  clusters: ClusterReport[];
  narratives: Narrative[];
}

export const DEFAULTS: AnalyzeOptions = {
  ...LAYER_DEFAULTS,
  layers: LAYERS,
  minLayers: 2,
  minClusterSize: 3,
  minClusterRho: 0.05,
  minSupporters: 5,
  verdictAlpha: 0.001,
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

export async function analyze(ds: Dataset, options: Partial<AnalyzeOptions> = {}): Promise<Report> {
  const given = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) as Partial<AnalyzeOptions>;
  const o: AnalyzeOptions = { ...DEFAULTS, ...given, windowSec: { ...DEFAULTS.windowSec, ...given.windowSec } };
  const frames = await frameEvents(ds, o.seed, o.embedder);
  const results = runLayers(ds, o, o.layers, frames);
  const edges = combine(results, Math.min(o.minLayers, results.length));
  const clusters = cluster(edges, o.minClusterSize, o.seed).filter((c) => c.rho >= o.minClusterRho);
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
    tests: Object.fromEntries(results.map((r) => [r.id, { candidates: r.candidates, significant: r.pairs.size }])),
    edges,
    clusters: reports,
    narratives: narratives(ds.events, clusters, frames, { minSupporters: o.minSupporters, seed: o.seed, alpha: o.verdictAlpha }),
  };
}
