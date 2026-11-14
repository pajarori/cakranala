import { normalize, type Event } from "cakranala";
import { cases, db } from "./db";

const DAY = 86_400_000;
const TOP = 8;
const SAMPLE = 8;

const handles = (ids: string[]) =>
  new Map(
    (db.query("SELECT id, json FROM actors WHERE id IN (SELECT value FROM json_each(?))").all(JSON.stringify(ids)) as { id: string; json: string }[]).map((r) => [r.id, (JSON.parse(r.json).handle as string) ?? r.id]),
  );

const raw = (id: string) => id.slice(id.indexOf(":x:") >= 0 ? id.indexOf(":x:") + 1 : 0);

function tightest(sorted: Event[], k: number) {
  const count = new Map<string, number>();
  let distinct = 0;
  let best: [number, number] = [0, sorted.length - 1];
  for (let lo = 0, hi = 0; hi < sorted.length; hi++) {
    const a = sorted[hi].actor;
    count.set(a, (count.get(a) ?? 0) + 1);
    if (count.get(a) === 1) distinct++;
    while (distinct >= k) {
      if (sorted[hi].ts - sorted[lo].ts < sorted[best[1]].ts - sorted[best[0]].ts) best = [lo, hi];
      const b = sorted[lo++].actor;
      count.set(b, count.get(b)! - 1);
      if (!count.get(b)) distinct--;
    }
  }
  const seen = new Set<string>();
  return sorted.slice(best[0], best[1] + 1).filter((e) => !seen.has(e.actor) && seen.add(e.actor));
}

function groups(events: Event[], key: (e: Event) => string[], name: Map<string, string>) {
  const by = new Map<string, Event[]>();
  for (const e of events)
    for (const k of key(e)) {
      if (!k) continue;
      const list = by.get(k);
      if (list) list.push(e);
      else by.set(k, [e]);
    }
  return [...by.entries()]
    .map(([k, es]) => ({ k, es, accounts: new Set(es.map((e) => e.actor)).size }))
    .filter((g) => g.accounts >= 2)
    .sort((a, b) => b.accounts - a.accounts || b.es.length - a.es.length)
    .slice(0, TOP)
    .map(({ k, es, accounts }) => {
      const burst = tightest(es, Math.min(SAMPLE, accounts));
      return {
        key: k,
        accounts,
        posts: es.length,
        first: es[0].ts,
        last: es.at(-1)!.ts,
        burst: { accounts: burst.length, seconds: (burst.at(-1)!.ts - burst[0].ts) / 1000 },
        sample: burst.map((e) => ({ actor: e.actor, handle: name.get(e.actor) ?? e.actor, ts: e.ts })),
      };
    });
}

export function proof(id: string) {
  const c = cases.get(id);
  if (!c) return undefined;
  const events = (
    db.query("SELECT json FROM events WHERE actor IN (SELECT value FROM json_each(?)) AND ts >= ? AND ts < ? ORDER BY ts").all(JSON.stringify(c.members), c.firstSeen - DAY, c.lastSeen) as { json: string }[]
  ).map((r) => JSON.parse(r.json) as Event);
  const name = handles(c.members);
  const byRaw = new Map(events.map((e) => [raw(e.id), e]));
  const norm = new Map<string, string>();
  const textKey = (t: string) => norm.get(t) ?? norm.set(t, normalize(t)).get(t)!;
  const copies = groups(events.filter((e) => e.text), (e) => [textKey(e.text!)], name);
  const original = new Map([...norm].map(([t, k]) => [k, t]));
  const actions = groups(events.filter((e) => e.target && e.action !== "post"), (e) => [`${e.action}|${e.target}`], name);
  const tags = groups(events, (e) => [...new Set((e.tags ?? []).map((t) => t.toLowerCase()))], name);
  const urls = groups(events, (e) => [...new Set(e.urls ?? [])], name);
  return {
    span: { from: c.firstSeen - DAY, to: c.lastSeen },
    posts: events.length,
    accounts: new Set(events.map((e) => e.actor)).size,
    copies: copies.map((g) => ({ ...g, text: original.get(g.key) ?? g.key })),
    actions: actions.map((g) => {
      const [action, target] = g.key.split("|");
      const t = byRaw.get(target);
      return { ...g, action, target, targetText: t?.text ?? null, targetHandle: t ? (name.get(t.actor) ?? null) : null };
    }),
    tags: tags.map(({ sample, ...g }) => g),
    urls: urls.map(({ sample, ...g }) => g),
  };
}
