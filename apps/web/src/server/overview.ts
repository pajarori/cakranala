import { db } from "./db";
import { snapshot } from "./analysis";

const DAY = 86_400_000;
export const PERIODS = { all: 0, "30d": 30 * DAY, "7d": 7 * DAY, "24h": DAY };
export type Period = keyof typeof PERIODS;
const BINS = 120;
const cache = new Map<Period, { version: string; at: number; value: ReturnType<typeof compute> }>();

const version = () => {
  const r = db.query("SELECT (SELECT MAX(rowid) FROM events) AS e, (SELECT COUNT(*) FROM cases) AS c, (SELECT MAX(last_seen) FROM cases) AS l").get() as { e: number; c: number; l: number };
  return `${r.e}:${r.c}:${r.l}`;
};

function compute(period: Period) {
  const to = Date.now();
  const first = (db.query("SELECT MIN(ts) AS t FROM events").get() as { t: number | null }).t;
  const from = PERIODS[period] ? to - PERIODS[period] : (first ?? to);
  const members = JSON.stringify([...new Set(snapshot().cases.filter((c) => c.lastSeen >= from).flatMap((c) => c.members))]);
  const { posts, accounts } = db.query("SELECT COUNT(*) AS posts, COUNT(DISTINCT actor) AS accounts FROM events WHERE ts >= ?").get(from) as { posts: number; accounts: number };
  const coordinated = (db.query("SELECT COUNT(DISTINCT actor) AS n FROM events WHERE ts >= ? AND actor IN (SELECT value FROM json_each(?))").get(from, members) as { n: number }).n;
  const start = posts ? (db.query("SELECT MIN(ts) AS t FROM events WHERE ts >= ?").get(from) as { t: number }).t : from;
  const binMs = Math.max(60_000, Math.ceil((to - start) / BINS / 60_000) * 60_000);
  const bins = Math.floor((to - start) / binMs) + 1;
  const series = (sql: string, ...args: (number | string)[]) => {
    const out = new Array(bins).fill(0);
    for (const r of db.query(sql).all(...args) as { b: number; n: number }[]) out[Math.min(bins - 1, r.b)] += r.n;
    return out;
  };
  const bucket = "SELECT CAST((ts - ?) / ? AS INTEGER) AS b, COUNT(*) AS n FROM events WHERE ts >= ?";
  return {
    period,
    from,
    to,
    posts,
    accounts,
    coordinated,
    activity: {
      binSec: binMs / 1000,
      start,
      total: series(`${bucket} GROUP BY b`, start, binMs, from),
      coordinated: series(`${bucket} AND actor IN (SELECT value FROM json_each(?)) GROUP BY b`, start, binMs, from, members),
    },
  };
}

export function overview(period: Period) {
  const v = version();
  const hit = cache.get(period);
  if (hit && hit.version === v && (!PERIODS[period] || Date.now() - hit.at < PERIODS[period] / BINS)) return hit.value;
  const value = compute(period);
  cache.set(period, { version: v, at: Date.now(), value });
  return value;
}
