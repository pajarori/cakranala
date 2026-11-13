import type { Event } from "../schema";
import { jaccard, tokens } from "../text";
import { groupBy, mean } from "../util";

export interface Forensics {
  onset: { ts: number; actors: number; windowSec: number };
  waves: number;
  seeders: { actor: string; leadScore: number }[];
  rotation: number | null;
  cadence: { medianSec: number; cv: number } | null;
  talkingPoints: string[];
}

function waves(events: Event[], gap: number) {
  const out: Event[][] = [];
  for (const e of events) {
    const last = out.at(-1);
    if (last && e.ts - last.at(-1)!.ts <= gap) last.push(e);
    else out.push([e]);
  }
  return out.filter((w) => new Set(w.map((e) => e.actor)).size >= 3);
}

function kendall(a: string[], b: string[]) {
  const shared = a.filter((x) => b.includes(x));
  if (shared.length < 4) return null;
  const pa = new Map(a.map((x, i) => [x, i]));
  const pb = new Map(b.map((x, i) => [x, i]));
  let c = 0;
  let d = 0;
  for (let i = 0; i < shared.length; i++)
    for (let j = i + 1; j < shared.length; j++) {
      const s = Math.sign(pa.get(shared[i])! - pa.get(shared[j])!) * Math.sign(pb.get(shared[i])! - pb.get(shared[j])!);
      if (s > 0) c++;
      else if (s < 0) d++;
    }
  return c + d ? { tau: (c - d) / (c + d), weight: shared.length } : null;
}

function firstOrder(events: Event[]) {
  const seen = new Set<string>();
  const order: { actor: string; ts: number }[] = [];
  for (const e of events)
    if (!seen.has(e.actor)) {
      seen.add(e.actor);
      order.push({ actor: e.actor, ts: e.ts });
    }
  return order;
}

function talkingPoints(texts: string[], k: number) {
  const uniq = [...new Set(texts.filter((t) => t.length > 20))].slice(0, 300);
  const sets = uniq.map((t) => new Set(tokens(t)));
  const central = sets.map((s, i) => ({ i, c: mean(sets.map((o, j) => (i === j ? 0 : jaccard(s, o)))) })).sort((a, b) => b.c - a.c);
  const chosen: number[] = [];
  for (const { i } of central) {
    if (chosen.every((j) => jaccard(sets[i], sets[j]) < 0.4)) chosen.push(i);
    if (chosen.length === k) break;
  }
  return chosen.map((i) => uniq[i]);
}

export function forensics(members: string[], all: Event[], gapSec = 600): Forensics {
  const set = new Set(members);
  const ev = all.filter((e) => set.has(e.actor)).sort((a, b) => a.ts - b.ts);
  const gap = gapSec * 1000;
  let best = { ts: ev[0]?.ts ?? 0, actors: 0 };
  for (let i = 0, j = 0; i < ev.length; i++) {
    while (ev[i].ts - ev[j].ts > gap) j++;
    const actors = new Set(ev.slice(j, i + 1).map((e) => e.actor)).size;
    if (actors > best.actors) best = { ts: ev[j].ts, actors };
  }
  const ws = waves(ev, gap);
  const everyOrder = ws.map((w) => firstOrder(w));
  const largest = Math.max(0, ...everyOrder.map((o) => o.length));
  const orders = everyOrder.filter((o) => o.length >= largest / 2);
  const taus = orders.flatMap((a, i) =>
    orders.slice(i + 1).flatMap((b) => {
      const t = kendall(a.map((x) => x.actor), b.map((x) => x.actor));
      return t ? [t] : [];
    }),
  );
  const totalWeight = taus.reduce((s, t) => s + t.weight, 0);
  const gaps = orders.flatMap((o) => o.slice(1).map((x, i) => (x.ts - o[i].ts) / 1000));
  const mu = mean(gaps);
  const sd = Math.sqrt(mean(gaps.map((g) => (g - mu) ** 2)));
  const ranks = new Map<string, number[]>();
  for (const evs of groupBy(ev.filter((e) => e.target), (e) => e.target!).values()) {
    const o = firstOrder(evs);
    if (o.length < 3) continue;
    o.forEach((x, i) => ranks.set(x.actor, [...(ranks.get(x.actor) ?? []), i / (o.length - 1)]));
  }
  const seeders = [...ranks]
    .filter(([, r]) => r.length >= 2)
    .map(([actor, r]) => ({ actor, leadScore: 1 - mean(r) }))
    .sort((a, b) => b.leadScore - a.leadScore)
    .slice(0, 3);
  return {
    onset: { ts: best.ts, actors: best.actors, windowSec: gapSec },
    waves: ws.length,
    seeders,
    rotation: totalWeight ? taus.reduce((s, t) => s + t.tau * t.weight, 0) / totalWeight : null,
    cadence: gaps.length >= 5 ? { medianSec: [...gaps].sort((a, b) => a - b)[gaps.length >> 1], cv: mu ? sd / mu : 0 } : null,
    talkingPoints: talkingPoints(ev.map((e) => e.text ?? ""), 3),
  };
}
