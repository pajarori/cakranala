import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import type { LayerId, LayerResult, PairStat } from "./layers";
import { cauchyCombine, mean, pairKey, partialConjunction, quantile, rng, splitPair, uuidFrom } from "../util";

export interface Edge {
  a: string;
  b: string;
  rho: number;
  p: number;
  layers: Partial<Record<LayerId, PairStat>>;
}

export interface LayerEvidence {
  layer: LayerId;
  pairs: number;
  meanEpisodes: number;
  meanObserved: number;
  meanExpected: number;
}

export interface Cluster {
  id: string;
  members: string[];
  rho: number;
  p: number;
  score: number;
  families: { layers: LayerId[]; strength: number }[];
  layers: LayerEvidence[];
}

export interface Fusion {
  families: LayerId[][];
  minFamilies: number;
  edgeAlphas: number[];
  fdr: number;
}

function pairEvidence(results: LayerResult[], get: (r: LayerResult) => Map<string, number>, o: Fusion) {
  const ran = new Map(results.map((r) => [r.id, get(r)]));
  const families = o.families.map((f) => f.filter((l) => ran.has(l))).filter((f) => f.length);
  const keys = new Set<string>();
  for (const m of ran.values()) for (const k of m.keys()) keys.add(k);
  const out = new Map<string, number>();
  for (const k of keys) {
    const p = partialConjunction(families.map((f) => cauchyCombine(f.map((l) => ran.get(l)!.get(k) ?? 1))), o.minFamilies);
    if (p < 1) out.set(k, p);
  }
  return out;
}

const significantPairs = (ps: Map<string, number>, alpha: number) => [...ps].filter(([, p]) => p <= alpha);

const strength = (p: number) => -Math.log(Math.max(p, 1e-300));

function communities(pairs: [string, number][], minSize: number, minDegree: number, seed: number) {
  const g = new Graph({ type: "undirected" });
  for (const [k, p] of pairs) {
    const [a, b] = splitPair(k);
    if (!g.hasNode(a)) g.addNode(a);
    if (!g.hasNode(b)) g.addNode(b);
    g.addEdge(a, b, { weight: strength(p) });
  }
  if (!g.size) return [];
  const community = louvain(g, { getEdgeWeight: "weight", rng: rng(seed) });
  const groups = new Map<number, string[]>();
  for (const [node, c] of Object.entries(community)) {
    const list = groups.get(c);
    if (list) list.push(node);
    else groups.set(c, [node]);
  }
  const ps = new Map(pairs);
  const core = (members: string[]) => {
    let kept = members;
    for (;;) {
      const next = kept.filter((a) => kept.filter((b) => b !== a && ps.has(pairKey(a, b))).length >= minDegree);
      if (next.length === kept.length) return kept;
      kept = next;
    }
  };
  return [...groups.values()]
    .map(core)
    .filter((m) => m.length >= minSize)
    .map((members) => {
      let score = 0;
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++) {
          const p = ps.get(pairKey(members[i], members[j]));
          if (p !== undefined) score += strength(p);
        }
      return { members: members.sort(), score };
    });
}

export function detect(results: LayerResult[], o: Fusion & { minClusterSize: number; minDegree: number; seed: number }) {
  const real = pairEvidence(results, (r) => new Map([...r.pairs].map(([k, s]) => [k, s.p])), o);
  const replicates = results[0]?.replicates.length ?? 0;
  const nulls = Array.from({ length: replicates }, (_, b) => pairEvidence(results, (r) => r.replicates[b], o));
  const decoy = (alpha: number) => {
    const hits = significantPairs(real, alpha).length;
    return hits ? nulls.reduce((s, m) => s + significantPairs(m, alpha).length, 0) / Math.max(1, replicates) / hits : 0;
  };
  const alphas = [...o.edgeAlphas].sort((x, y) => y - x);
  const alpha = (replicates ? alphas.find((a) => decoy(a) <= o.fdr) : undefined) ?? alphas[alphas.length - 1];
  const pairs = significantPairs(real, alpha);
  const nullMax = nulls.map((m) => Math.max(0, ...communities(significantPairs(m, alpha), o.minClusterSize, o.minDegree, o.seed).map((c) => c.score)));
  const scale = new Map(results.map((r) => [r.id, quantile([...r.pairs.values()].filter((s) => s.p < 1).map((s) => s.w), 0.5) || 1]));
  const edges: Edge[] = pairs.map(([k, p]) => {
    const [a, b] = splitPair(k);
    const layers: Partial<Record<LayerId, PairStat>> = {};
    for (const r of results) {
      const s = r.pairs.get(k);
      if (s && s.p < 1) layers[r.id] = s;
    }
    const ids = Object.keys(layers) as LayerId[];
    return { a, b, p, layers, rho: 1 - ids.reduce((acc, id) => acc * Math.exp(-layers[id]!.w / scale.get(id)!), 1) };
  });
  const byPair = new Map(edges.map((e) => [pairKey(e.a, e.b), e]));
  const clusters: Cluster[] = communities(pairs, o.minClusterSize, o.minDegree, o.seed).map(({ members, score }) => {
    const intra: Edge[] = [];
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const e = byPair.get(pairKey(members[i], members[j]));
        if (e) intra.push(e);
      }
    const possible = (members.length * (members.length - 1)) / 2;
    const layerIds = [...new Set(intra.flatMap((e) => Object.keys(e.layers) as LayerId[]))];
    const families = o.families
      .map((f) => ({ layers: f.filter((l) => layerIds.includes(l)), strength: intra.reduce((sum, e) => sum + strength(cauchyCombine(f.map((l) => e.layers[l]?.p ?? 1))), 0) }))
      .filter((f) => f.layers.length && f.strength > 0)
      .sort((a, b) => b.strength - a.strength);
    return {
      families,
      id: uuidFrom(`cluster:${members.join(",")}`),
      members,
      score,
      p: (1 + nullMax.filter((s) => s >= score).length) / (replicates + 1),
      rho: intra.reduce((s, e) => s + e.rho, 0) / possible,
      layers: layerIds.map((layer) => {
        const ps = intra.flatMap((e) => (e.layers[layer] ? [e.layers[layer]!] : []));
        return { layer, pairs: ps.length, meanEpisodes: mean(ps.map((p) => p.episodes)), meanObserved: mean(ps.map((p) => p.observed)), meanExpected: mean(ps.map((p) => p.expected)) };
      }),
    };
  });
  return {
    real,
    edges,
    clusters: clusters.sort((x, y) => y.score - x.score),
    alpha,
    decoyFdr: replicates ? decoy(alpha) : 0,
  };
}
