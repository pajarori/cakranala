import type { Actor, Dataset, Event } from "../schema";
import { jaccard, nearDuplicateGroups, shingles } from "../text";
import { groupBy, nbTail, pairKey, poissonTail, quantile, randomPairQuantile, rng } from "../util";

export type LayerId = "coaction" | "coframing" | "rhythm" | "copypasta" | "lifecycle";
export const LAYERS: LayerId[] = ["coaction", "coframing", "rhythm", "copypasta", "lifecycle"];

export interface LayerOptions {
  windowSec: Partial<Record<LayerId, number>>;
  similarityQuantile: number;
  copypastaFloor: number;
  minEpisodes: number;
  maxGroup: number;
  groupQuantile: number;
  nullReplicates: number;
  shiftMax: number;
  strataWindows: number;
  seed: number;
}

export const LAYER_DEFAULTS: LayerOptions = {
  windowSec: { coaction: 900, coframing: 1800, rhythm: 600, copypasta: 3600 },
  similarityQuantile: 0.995,
  copypastaFloor: 0,
  minEpisodes: 2,
  maxGroup: 400,
  groupQuantile: 0.99,
  nullReplicates: 19,
  shiftMax: 7,
  strataWindows: 2,
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
  dispersion: number;
  pairs: Map<string, PairStat>;
  replicates: Map<string, number>[];
}

interface Occ {
  o: number;
  actor: string;
  ts: number;
}

interface Acc {
  x: number;
  w: number;
  episodes: number;
  last: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const unit = (span: number) => (span >= 3 * DAY ? DAY : HOUR);

function shifts(actors: string[], span: number, replicates: number, shiftMax: number, seed: number) {
  const k = Math.min(shiftMax, Math.floor(span / unit(span) / 2));
  if (k < 1) return [];
  return Array.from({ length: replicates }, (_, b) => {
    const r = rng(seed * 7919 + b + 1);
    return new Map([...actors].sort().map((a) => [a, (1 + Math.floor(r() * k)) * (r() < 0.5 ? -1 : 1) * unit(span)]));
  });
}

function sweep(occ: Occ[], objects: number, window: number, gap: number, idf: number[]) {
  const buffers: Occ[][] = Array.from({ length: objects }, () => []);
  const heads = new Array<number>(objects).fill(0);
  const out = new Map<string, Acc>();
  for (const e of occ) {
    const buf = buffers[e.o];
    let h = heads[e.o];
    while (h < buf.length && e.ts - buf[h].ts > window) h++;
    if (h > 512) {
      buf.splice(0, h);
      h = 0;
    }
    heads[e.o] = h;
    for (let j = h; j < buf.length; j++) {
      const other = buf[j];
      if (other.actor === e.actor) continue;
      const k = pairKey(e.actor, other.actor);
      let acc = out.get(k);
      if (!acc) out.set(k, (acc = { x: 0, w: 0, episodes: 0, last: -Infinity }));
      acc.x++;
      acc.w += idf[e.o] * Math.exp(-(e.ts - other.ts) / window);
      if (e.ts - acc.last > gap) acc.episodes++;
      acc.last = e.ts;
    }
    buf.push(e);
  }
  return out;
}

function permuted(occ: Occ[], strata: number, seed: number) {
  const r = rng(seed);
  const out = occ.map((e) => ({ ...e }));
  for (let i = 0; i < out.length; ) {
    let j = i;
    const bucket = Math.floor(out[i].ts / strata);
    while (j < out.length && Math.floor(out[j].ts / strata) === bucket) j++;
    for (let k = j - 1; k > i; k--) {
      const m = i + Math.floor(r() * (k - i + 1));
      [out[k].o, out[m].o] = [out[m].o, out[k].o];
    }
    i = j;
  }
  return out;
}

function shifted(occ: Occ[], shift: Map<string, number>, t0: number, span: number) {
  return occ
    .map((e) => ({ ...e, ts: t0 + ((((e.ts - t0 + shift.get(e.actor)!) % span) + span) % span) }))
    .sort((a, b) => a.ts - b.ts);
}

function test(real: Map<string, Acc>, reps: Map<string, Acc>[], expected: (k: string) => number, minEpisodes: number, byEpisodes: boolean) {
  const count = (a: Acc) => (byEpisodes ? a.episodes : a.x);
  const keys = new Set(real.keys());
  for (const m of reps) for (const k of m.keys()) keys.add(k);
  const mu = new Map<string, number>();
  let num = 0;
  let den = 0;
  for (const k of keys) {
    const xs = reps.map((m) => { const a = m.get(k); return a ? count(a) : 0; });
    const m = xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
    if (xs.length > 1 && m > 0) {
      num += xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1) - m;
      den += m * m;
    }
    mu.set(k, Math.max(expected(k), m, 1e-9));
  }
  const dispersion = den > 0 ? Math.max(0, num / den) : 0;
  const pOf = (k: string, a: Acc) => (a.episodes >= minEpisodes ? nbTail(count(a), mu.get(k)!, dispersion) : 1);
  const pairs = new Map<string, PairStat>();
  for (const [k, a] of real) pairs.set(k, { w: a.w, observed: count(a), expected: mu.get(k)!, p: pOf(k, a), episodes: a.episodes });
  const replicates = reps.map((m) => {
    const ps = new Map<string, number>();
    for (const [k, a] of m) {
      const p = pOf(k, a);
      if (p < 1) ps.set(k, p);
    }
    return ps;
  });
  return { dispersion, pairs, replicates };
}

function objectLayer(events: Event[], keys: (e: Event, i: number) => string[], window: number, n: number, opts: LayerOptions, span: number, replicate: (occ: Occ[]) => Occ[][], period?: number) {
  const raw = new Map<string, { actor: string; ts: number }[]>();
  events.forEach((e, i) => {
    for (const k of keys(e, i)) {
      const list = raw.get(k);
      if (list) list.push({ actor: e.actor, ts: e.ts });
      else raw.set(k, [{ actor: e.actor, ts: e.ts }]);
    }
  });
  const kept: { actor: string; ts: number }[][] = [];
  for (const list of raw.values()) {
    list.sort((a, b) => a.ts - b.ts);
    const last = new Map<string, number>();
    const out = list.filter((x) => {
      const prev = last.get(x.actor);
      if (prev !== undefined && x.ts - prev <= window) return false;
      last.set(x.actor, x.ts);
      return true;
    });
    if (last.size >= 2) kept.push(out);
  }
  const sizes = kept.map((l) => new Set(l.map((x) => x.actor)).size);
  const limit = period === undefined ? Math.min(opts.maxGroup, Math.max(2, Math.ceil(quantile(sizes, opts.groupQuantile)))) : Infinity;
  const objects = kept.filter((_, i) => sizes[i] <= limit);
  const idf = objects.map((l) => Math.log(Math.max(n, 2) / new Set(l.map((x) => x.actor)).size));
  const volume = new Map<string, number>();
  let total = 0;
  let squares = 0;
  for (const l of objects) {
    total += l.length;
    squares += l.length ** 2;
    for (const x of l) volume.set(x.actor, (volume.get(x.actor) ?? 0) + 1);
  }
  const rate = (Math.min(1, (2 * window) / span) * squares) / Math.max(1, total) ** 2;
  const occ: Occ[] = objects.flatMap((l, o) => l.map((x) => ({ o, actor: x.actor, ts: x.ts }))).sort((a, b) => a.ts - b.ts);
  const gap = period ?? 2 * window;
  const real = sweep(occ, objects.length, window, gap, idf);
  const reps = replicate(occ).map((o) => sweep(o, objects.length, window, gap, idf));
  const expected = (k: string) => {
    const [a, b] = k.split("\u0001");
    return (period ? Math.min(1, period / span) : 1) * rate * (volume.get(a) ?? 0) * (volume.get(b) ?? 0);
  };
  return { candidates: real.size, ...test(real, reps, expected, opts.minEpisodes, period !== undefined) };
}

function lifecycleLayer(ds: Dataset, n: number, opts: LayerOptions, replicates: number) {
  const active = new Set(ds.events.map((e) => e.actor));
  const keys = (a: Actor) => {
    const k: string[] = [];
    if (a.createdAt) k.push(`d:${Math.floor(a.createdAt / DAY)}`);
    const s = a.handle?.toLowerCase().replace(/[a-z]+/g, "a").replace(/\d+/g, (d) => "9".repeat(Math.min(d.length, 6)));
    if (s && s.includes("9")) k.push(`s:${s}`);
    return k;
  };
  const actors = ds.actors.filter((a) => active.has(a.id));
  const objects = groupBy(actors.flatMap((a) => keys(a).map((k) => ({ k, a: a.id }))), (x) => x.k);
  const prior = new Map(actors.map((a) => [a.id, keys(a).reduce((s, k) => s + (objects.get(k)!.length - 1) / Math.max(1, n - 1), 0)]));
  const pairs = new Map<string, PairStat>();
  for (const members of objects.values()) {
    if (members.length < 2 || members.length > opts.maxGroup) continue;
    const idf = Math.log(n / members.length);
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const k = pairKey(members[i].a, members[j].a);
        const s = pairs.get(k) ?? { w: 0, observed: 0, expected: (prior.get(members[i].a)! + prior.get(members[j].a)!) / 2, p: 1, episodes: 0 };
        s.observed++;
        s.episodes++;
        s.w += idf;
        pairs.set(k, s);
      }
  }
  for (const s of pairs.values()) s.p = s.observed >= 2 ? poissonTail(s.observed, Math.max(s.expected, 1e-9)) : 1;
  const fixed = new Map([...pairs].filter(([, s]) => s.p < 1).map(([k, s]) => [k, s.p]));
  return { candidates: pairs.size, dispersion: 0, pairs, replicates: Array.from({ length: replicates }, () => fixed) };
}

export function runLayers(ds: Dataset, opts: LayerOptions, enabled: LayerId[], frames?: Map<number, number>): LayerResult[] {
  const ev = ds.events;
  const actors = [...new Set(ev.map((e) => e.actor))];
  const n = actors.length;
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const e of ev) {
    t0 = Math.min(t0, e.ts);
    t1 = Math.max(t1, e.ts);
  }
  const span = t1 - t0 + 1;
  const worlds = shifts(actors, span, opts.nullReplicates, opts.shiftMax, opts.seed);
  const win = (id: LayerId) => (opts.windowSec[id] ?? 900) * 1000;
  const layer = (keys: (e: Event, i: number) => string[], id: LayerId) =>
    objectLayer(ev, keys, win(id), n, opts, span, (occ) => Array.from({ length: opts.nullReplicates }, (_, b) => permuted(occ, opts.strataWindows * win(id), opts.seed * 7919 + b * 31 + LAYERS.indexOf(id) + 1)));
  const out: LayerResult[] = [];
  for (const id of enabled) {
    if (id === "coaction") {
      const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
      const numbers = (t?: string) => (t?.match(/\+?\d[\d\s.-]{7,}\d/g) ?? []).map((m) => `n:${m.replace(/\D/g, "").slice(-9)}`);
      out.push({ id, ...layer((e) => [...(e.target ? [`t:${e.target}`] : []), ...(e.urls ?? []).map((u) => `u:${norm(u)}`), ...(e.tags ?? []).map((h) => `h:${h.toLowerCase()}`), ...numbers(e.text)], id) });
    } else if (id === "copypasta") {
      const idx = ev.flatMap((e, i) => (e.action !== "reshare" && e.text ? [i] : []));
      const texts = idx.map((i) => ev[i].text!);
      const sets = texts.map((t) => shingles(t));
      const tau = Math.max(opts.copypastaFloor, randomPairQuantile(sets.length, (i, j) => jaccard(sets[i], sets[j]), opts.similarityQuantile, rng(opts.seed)));
      const groups = nearDuplicateGroups(texts, tau);
      const group = new Map(idx.map((i, j) => [i, groups[j]]));
      out.push({ id, ...layer((_, i) => ((group.get(i) ?? -1) >= 0 ? [`p:${group.get(i)}`] : []), id) });
    } else if (id === "coframing" && frames?.size) {
      out.push({ id, ...layer((_, i) => (frames.has(i) ? [`f:${frames.get(i)}`] : []), id) });
    } else if (id === "rhythm" && worlds.length) {
      out.push({ id, ...objectLayer(ev, () => ["r"], win(id), n, opts, span, (occ) => worlds.map((w) => shifted(occ, w, t0, span)), unit(span)) });
    } else if (id === "lifecycle") {
      out.push({ id, ...lifecycleLayer(ds, n, opts, opts.nullReplicates) });
    }
  }
  return out;
}
