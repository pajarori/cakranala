import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import type { LayerId, LayerResult, PairStat } from "./layers";
import { mean, pairKey, quantile, rng, splitPair } from "../util";

export interface Edge {
  a: string;
  b: string;
  rho: number;
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
  layers: LayerEvidence[];
}

export function combine(results: LayerResult[], minLayers: number): Edge[] {
  const scale = new Map(results.map((r) => [r.id, quantile([...r.pairs.values()].map((p) => p.w), 0.5) || 1]));
  const merged = new Map<string, Edge>();
  for (const r of results)
    for (const [k, p] of r.pairs) {
      let e = merged.get(k);
      if (!e) {
        const [a, b] = splitPair(k);
        merged.set(k, (e = { a, b, rho: 0, layers: {} }));
      }
      e.layers[r.id] = p;
    }
  const out: Edge[] = [];
  for (const e of merged.values()) {
    const ids = Object.keys(e.layers) as LayerId[];
    if (ids.length < minLayers) continue;
    e.rho = 1 - ids.reduce((acc, id) => acc * Math.exp(-e.layers[id]!.w / scale.get(id)!), 1);
    out.push(e);
  }
  return out;
}

export function cluster(edges: Edge[], minSize: number, seed: number): Cluster[] {
  const g = new Graph({ type: "undirected" });
  for (const e of edges) {
    if (!g.hasNode(e.a)) g.addNode(e.a);
    if (!g.hasNode(e.b)) g.addNode(e.b);
    g.addEdge(e.a, e.b, { weight: e.rho });
  }
  if (!g.size) return [];
  const community = louvain(g, { getEdgeWeight: "weight", rng: rng(seed) });
  const groups = new Map<number, string[]>();
  for (const [node, c] of Object.entries(community)) groups.set(c, [...(groups.get(c) ?? []), node]);
  const byPair = new Map(edges.map((e) => [pairKey(e.a, e.b), e]));
  const clusters: Cluster[] = [];
  for (const members of groups.values()) {
    if (members.length < minSize) continue;
    const intra: Edge[] = [];
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const e = byPair.get(pairKey(members[i], members[j]));
        if (e) intra.push(e);
      }
    const possible = (members.length * (members.length - 1)) / 2;
    const layerIds = [...new Set(intra.flatMap((e) => Object.keys(e.layers) as LayerId[]))];
    clusters.push({
      id: "",
      members: members.sort(),
      rho: intra.reduce((s, e) => s + e.rho, 0) / possible,
      layers: layerIds.map((layer) => {
        const ps = intra.flatMap((e) => (e.layers[layer] ? [e.layers[layer]!] : []));
        return { layer, pairs: ps.length, meanEpisodes: mean(ps.map((p) => p.episodes)), meanObserved: mean(ps.map((p) => p.observed)), meanExpected: mean(ps.map((p) => p.expected)) };
      }),
    });
  }
  return clusters.sort((x, y) => y.rho * y.members.length - x.rho * x.members.length).map((c, i) => ({ ...c, id: `K${i + 1}` }));
}
