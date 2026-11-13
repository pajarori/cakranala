import type { Event } from "../schema";
import type { Cluster } from "./graph";
import { jaccard, nearDuplicateGroups, shingles } from "../text";
import { binomialTail, groupBy, quantile, randomPairQuantile, rng, uuidFrom } from "../util";

export interface Sie {
  value: number;
  ci: [number, number];
}

export interface Narrative {
  id: string;
  sample: string;
  tags: string[];
  supporters: number;
  events: number;
  sie: Sie;
  iks: number;
  coordinated: number;
  verdict: "manufactured" | "organic";
  p: number;
  clusters: { id: string; actors: number; p: number }[];
  counterfactual: { binSec: number; start: number; all: number[]; organic: number[] };
}

export function sie(supporters: string[], membership: Map<string, Cluster>): number {
  const counts = new Map<Cluster, number>();
  let organic = 0;
  for (const a of supporters) {
    const c = membership.get(a);
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    else organic++;
  }
  let v = organic;
  for (const [c, n] of counts) v += n / (1 + (n - 1) * c.rho);
  return v;
}

function bootstrap(supporters: string[], membership: Map<string, Cluster>, seed: number, b = 200): [number, number] {
  const units = [...groupBy(supporters, (a) => membership.get(a)?.id ?? a).values()];
  const r = rng(seed);
  const xs: number[] = [];
  for (let k = 0; k < b; k++) xs.push(sie(Array.from(units, () => units[Math.floor(r() * units.length)]).flat(), membership));
  return [quantile(xs, 0.025), quantile(xs, 0.975)];
}

function groupEvents(events: Event[], frames: Map<number, number> | undefined, seed: number) {
  if (frames?.size) return events.map((_, i) => frames.get(i) ?? -1);
  const texts = events.map((e) => e.text ?? "");
  const sets = texts.map((t) => shingles(t));
  const t = randomPairQuantile(sets.length, (i, j) => jaccard(sets[i], sets[j]), 0.98, rng(seed));
  return nearDuplicateGroups(texts, Math.max(0.2, t));
}

function synchronized(events: Event[], membership: Map<string, Cluster>, window: number) {
  const out = new Set<string>();
  for (const evs of groupBy(events.filter((e) => membership.has(e.actor)), (e) => membership.get(e.actor)!.id).values()) {
    const sorted = [...evs].sort((a, b) => a.ts - b.ts);
    for (let i = 0, j = 0; i < sorted.length; i++) {
      while (sorted[i].ts - sorted[j].ts > window) j++;
      const inWave = new Set(sorted.slice(j, i + 1).map((e) => e.actor));
      if (inWave.size >= 3) inWave.forEach((a) => out.add(a));
    }
  }
  return out;
}

export function narratives(
  events: Event[],
  clusters: Cluster[],
  frames: Map<number, number> | undefined,
  opts: { minSupporters: number; seed: number; alpha: number; syncSec: number },
): Narrative[] {
  const totalActors = new Set(events.map((e) => e.actor)).size;
  const membership = new Map<string, Cluster>();
  for (const c of clusters) for (const m of c.members) membership.set(m, c);
  const groups = groupEvents(events, frames, opts.seed);
  const byGroup = groupBy(
    events.map((e, i) => ({ e, g: groups[i] })).filter((x) => x.g >= 0),
    (x) => x.g,
  );
  const t0 = Math.min(...events.map((e) => e.ts));
  const t1 = Math.max(...events.map((e) => e.ts));
  const binMs = Math.max(60000, Math.ceil((t1 - t0 + 1) / 48 / 60000) * 60000);
  const bins = Math.floor((t1 - t0) / binMs) + 1;
  const out: Narrative[] = [];
  for (const items of byGroup.values()) {
    const ev = items.map((x) => x.e);
    const supporters = [...new Set(ev.map((e) => e.actor))];
    if (supporters.length < opts.minSupporters) continue;
    const value = sie(supporters, membership);
    const all = new Array(bins).fill(0);
    const organic = new Array(bins).fill(0);
    for (const e of ev) {
      const b = Math.floor((e.ts - t0) / binMs);
      all[b]++;
      if (!membership.has(e.actor)) organic[b]++;
    }
    const synced = synchronized(ev, membership, opts.syncSec * 1000);
    const perCluster = groupBy([...synced], (a) => membership.get(a)!.id);
    const flagged = clusters.reduce((s, c) => s + c.members.length, 0);
    const coordinated = synced.size;
    const p = binomialTail(coordinated, supporters.length, flagged / Math.max(1, totalActors));
    const sizes = new Map(clusters.map((c) => [c.id, c.members.length]));
    const tags = [...groupBy(ev.flatMap((e) => e.tags ?? []).map((t) => t.toLowerCase()), (t) => t)]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .map(([t]) => t);
    out.push({
      id: uuidFrom(`narrative:${ev.map((e) => e.id).sort().join(",")}`),
      sample: (ev.find((e) => synced.has(e.actor) && (e.text ?? "").length > 30) ?? ev.find((e) => (e.text ?? "").length > 30) ?? ev[0]).text ?? "",
      tags,
      supporters: supporters.length,
      events: ev.length,
      sie: { value, ci: bootstrap(supporters, membership, opts.seed) },
      iks: 1 - value / supporters.length,
      coordinated,
      verdict: p < opts.alpha ? "manufactured" : "organic",
      p,
      clusters: [...perCluster]
        .map(([id, a]) => ({ id, actors: a.length, p: binomialTail(a.length, supporters.length, sizes.get(id)! / Math.max(1, totalActors)) }))
        .filter((c) => c.p < opts.alpha)
        .sort((a, b) => b.actors - a.actors),
      counterfactual: { binSec: binMs / 1000, start: t0, all, organic },
    });
  }
  return out.sort((a, b) => b.supporters * b.iks - a.supporters * a.iks);
}
