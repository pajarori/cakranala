import type { Actor, Dataset, Event } from "../schema";
import { cosine, jaccard, nearDuplicateGroups, shingles } from "../text";
import { groupBy, pairKey, poissonTail, randomPairQuantile, rng } from "../util";

export type LayerId = "coaction" | "coframing" | "rhythm" | "copypasta" | "lifecycle";
export const LAYERS: LayerId[] = ["coaction", "coframing", "rhythm", "copypasta", "lifecycle"];

export interface LayerOptions {
  windowSec: Partial<Record<LayerId, number>>;
  similarityQuantile: number;
  copypastaFloor: number;
  coframingFloor: number;
  fdr: number;
  minEpisodes: number;
  maxGroup: number;
  seed: number;
}

export const LAYER_DEFAULTS: LayerOptions = {
  windowSec: { coaction: 900, coframing: 1800, rhythm: 600, copypasta: 3600 },
  similarityQuantile: 0.995,
  copypastaFloor: 0.5,
  coframingFloor: 0.35,
  fdr: 0.01,
  minEpisodes: 2,
  maxGroup: 400,
  seed: 7,
};

export interface PairStat {
  w: number;
  observed: number;
  expected: number;
  p: number;
  episodes: number;
}

export interface LayerResult {
  id: LayerId;
  candidates: number;
  pairs: Map<string, PairStat>;
}

interface Acc {
  w: number;
  observed: number;
  expected: number;
  times: number[];
}

type Pairs = Map<string, Acc>;

const slot = (m: Pairs, a: string, b: string) => {
  const k = pairKey(a, b);
  let s = m.get(k);
  if (!s) m.set(k, (s = { w: 0, observed: 0, expected: 0, times: [] }));
  return s;
};

const pWithin = (window: number, span: number) => Math.min(1, (2 * window) / span);

function objectLayer(events: Event[], keys: (e: Event, i: number) => string[], window: number, span: number, n: number, maxGroup: number): Pairs {
  const objects = new Map<string, Map<string, number>>();
  events.forEach((e, i) => {
    for (const k of keys(e, i)) {
      let m = objects.get(k);
      if (!m) objects.set(k, (m = new Map()));
      const prev = m.get(e.actor);
      if (prev === undefined || e.ts < prev) m.set(e.actor, e.ts);
    }
  });
  const out: Pairs = new Map();
  const pw = pWithin(window, span);
  const prior = new Map<string, number>();
  for (const m of objects.values()) for (const a of m.keys()) prior.set(a, (prior.get(a) ?? 0) + (m.size - 1) / Math.max(1, n - 1));
  for (const m of objects.values()) {
    if (m.size < 2 || m.size > maxGroup) continue;
    const idf = Math.log(n / m.size);
    const occ = [...m];
    for (let i = 0; i < occ.length; i++)
      for (let j = i + 1; j < occ.length; j++) {
        const s = slot(out, occ[i][0], occ[j][0]);
        const dt = Math.abs(occ[j][1] - occ[i][1]);
        if (dt <= window) {
          s.observed++;
          s.w += idf * Math.exp(-dt / window);
          s.times.push(Math.min(occ[i][1], occ[j][1]));
        }
      }
  }
  for (const [k, s] of out) {
    const [a, b] = k.split("\u0001");
    s.expected = (pw * (prior.get(a)! + prior.get(b)!)) / 2;
  }
  return out;
}

function similarityLayer(events: Event[], similar: (i: number, j: number) => boolean, window: number, span: number, n: number, r: () => number): Pairs {
  const order = events.map((_, i) => i).sort((a, b) => events[a].ts - events[b].ts);
  const byActor = groupBy(order, (i) => events[i].actor);
  const links: [number, number][] = [];
  const density = new Map<number, Set<string>>();
  const touch = (i: number, actor: string) => {
    let d = density.get(i);
    if (!d) density.set(i, (d = new Set()));
    d.add(actor);
  };
  for (let x = 0; x < order.length; x++)
    for (let y = x + 1; y < order.length; y++) {
      const i = order[x];
      const j = order[y];
      if (events[j].ts - events[i].ts > window) break;
      if (events[i].actor === events[j].actor || !similar(i, j)) continue;
      links.push([i, j]);
      touch(i, events[j].actor);
      touch(j, events[i].actor);
    }
  const out: Pairs = new Map();
  for (const [i, j] of links) {
    const s = slot(out, events[i].actor, events[j].actor);
    const dt = Math.abs(events[j].ts - events[i].ts);
    s.observed++;
    s.w += Math.max(0, Math.log(n / (1 + Math.max(density.get(i)!.size, density.get(j)!.size)))) * Math.exp(-dt / window);
    s.times.push(Math.min(events[i].ts, events[j].ts));
  }
  const pw = pWithin(window, span);
  const sample = Array.from({ length: Math.min(600, events.length) }, () => Math.floor(r() * events.length));
  const rate = new Map<string, number>();
  for (const [a, idx] of byActor) {
    let total = 0;
    for (const i of idx) {
      const others = sample.filter((j) => events[j].actor !== a);
      total += others.filter((j) => similar(i, j)).length / Math.max(1, others.length);
    }
    rate.set(a, total);
  }
  for (const [k, s] of out) {
    const [a, b] = k.split("\u0001");
    s.expected = (pw * (rate.get(a)! * byActor.get(b)!.length + rate.get(b)! * byActor.get(a)!.length)) / 2;
  }
  return out;
}

function rhythmLayer(events: Event[], bin: number, t0: number, n: number): Pairs {
  const bins = new Map<string, Set<number>>();
  let total = 1;
  for (const e of events) {
    let s = bins.get(e.actor);
    if (!s) bins.set(e.actor, (s = new Set()));
    const b = Math.floor((e.ts - t0) / bin);
    s.add(b);
    total = Math.max(total, b + 1);
  }
  const activity = new Map<number, string[]>();
  for (const [a, s] of bins) for (const b of s) activity.set(b, [...(activity.get(b) ?? []), a]);
  const out: Pairs = new Map();
  for (const [b, actors] of activity) {
    if (actors.length < 2) continue;
    const idf = Math.log(n / actors.length);
    for (let i = 0; i < actors.length; i++)
      for (let j = i + 1; j < actors.length; j++) {
        const s = slot(out, actors[i], actors[j]);
        s.observed++;
        s.w += idf;
        s.times.push(t0 + b * bin);
      }
  }
  for (const [k, s] of out) {
    const [a, b] = k.split("\u0001");
    s.expected = (bins.get(a)!.size * bins.get(b)!.size) / total;
  }
  return out;
}

function lifecycleLayer(ds: Dataset, n: number, maxGroup: number): Pairs {
  const active = new Set(ds.events.map((e) => e.actor));
  const keys = (a: Actor) => {
    const k: string[] = [];
    if (a.createdAt) k.push(`d:${Math.floor(a.createdAt / 86400000)}`);
    const s = a.handle?.toLowerCase().replace(/[a-z]+/g, "a").replace(/\d+/g, (d) => "9".repeat(Math.min(d.length, 6)));
    if (s && s.includes("9")) k.push(`s:${s}`);
    return k;
  };
  const actors = ds.actors.filter((a) => active.has(a.id));
  const objects = groupBy(actors.flatMap((a) => keys(a).map((k) => ({ k, a: a.id }))), (x) => x.k);
  const prior = new Map(actors.map((a) => [a.id, keys(a).reduce((s, k) => s + (objects.get(k)!.length - 1) / Math.max(1, n - 1), 0)]));
  const out: Pairs = new Map();
  for (const members of objects.values()) {
    if (members.length < 2 || members.length > maxGroup) continue;
    const idf = Math.log(n / members.length);
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const s = slot(out, members[i].a, members[j].a);
        s.observed++;
        s.w += idf;
      }
  }
  for (const [k, s] of out) {
    const [a, b] = k.split("\u0001");
    s.expected = (prior.get(a)! + prior.get(b)!) / 2;
  }
  return out;
}

function episodes(times: number[], gap: number) {
  const t = [...times].sort((a, b) => a - b);
  let c = t.length ? 1 : 0;
  for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] > gap) c++;
  return c;
}

function significant(raw: Pairs, fdr: number, minEpisodes: number, gap: number | null) {
  const tested = [...raw]
    .filter(([, s]) => s.observed >= 2 && (gap === null || episodes(s.times, gap) >= minEpisodes))
    .map(([k, s]) => ({ k, s, p: poissonTail(s.observed, Math.max(s.expected, 1e-9)) }))
    .sort((a, b) => a.p - b.p);
  const m = tested.length || 1;
  let cut = -1;
  tested.forEach((t, i) => {
    if (t.p <= ((i + 1) / m) * fdr) cut = i;
  });
  return new Map<string, PairStat>(
    tested.slice(0, cut + 1).map(({ k, s, p }) => [
      k,
      { w: s.w, observed: s.observed, expected: s.expected, p, episodes: gap === null ? s.observed : episodes(s.times, gap) },
    ]),
  );
}

export function runLayers(ds: Dataset, opts: LayerOptions, enabled: LayerId[], vectors?: Map<number, Float32Array>): LayerResult[] {
  const ev = ds.events;
  const n = new Set(ev.map((e) => e.actor)).size;
  const t0 = Math.min(...ev.map((e) => e.ts));
  const span = Math.max(...ev.map((e) => e.ts)) - t0 + 1;
  const win = (id: LayerId) => (opts.windowSec[id] ?? 900) * 1000;
  const r = rng(opts.seed);
  const out: LayerResult[] = [];
  const push = (id: LayerId, raw: Pairs, gap: number | null) => out.push({ id, candidates: raw.size, pairs: significant(raw, opts.fdr, opts.minEpisodes, gap) });
  for (const id of enabled) {
    if (id === "coaction") {
      const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
      const keys = (e: Event) => [...(e.target ? [`t:${e.target}`] : []), ...(e.urls ?? []).map((u) => `u:${norm(u)}`), ...(e.tags ?? []).map((h) => `h:${h.toLowerCase()}`)];
      push(id, objectLayer(ev, keys, win(id), span, n, opts.maxGroup), win(id) * 2);
    } else if (id === "copypasta") {
      const texts = ev.map((e) => e.text ?? "");
      const sets = texts.map((t) => shingles(t));
      const tau = Math.max(opts.copypastaFloor, randomPairQuantile(sets.length, (i, j) => jaccard(sets[i], sets[j]), opts.similarityQuantile, r));
      const groups = nearDuplicateGroups(texts, tau);
      push(id, objectLayer(ev, (_, i) => (groups[i] >= 0 ? [`p:${groups[i]}`] : []), win(id), span, n, opts.maxGroup), win(id) * 2);
    } else if (id === "coframing" && vectors?.size) {
      const idx = [...vectors.keys()];
      const tau = Math.max(opts.coframingFloor, randomPairQuantile(idx.length, (a, b) => cosine(vectors.get(idx[a])!, vectors.get(idx[b])!), opts.similarityQuantile, r));
      const similar = (i: number, j: number) => {
        const a = vectors.get(i);
        const b = vectors.get(j);
        return !!a && !!b && cosine(a, b) >= tau;
      };
      push(id, similarityLayer(ev, similar, win(id), span, n, r), win(id) * 2);
    } else if (id === "rhythm") {
      push(id, rhythmLayer(ev, win(id), t0, n), win(id) * 2);
    } else if (id === "lifecycle") {
      push(id, lifecycleLayer(ds, n, opts.maxGroup), null);
    }
  }
  return out;
}
