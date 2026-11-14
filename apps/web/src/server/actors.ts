import type { Actor, Event } from "cakranala";
import { alerts, cases, db, evidence } from "./db";
import { snapshot, type CaseEvidence, type CaseView } from "./analysis";

db.exec("CREATE TABLE IF NOT EXISTS watchlist (actor_id TEXT PRIMARY KEY, note TEXT NOT NULL DEFAULT '', added_by TEXT NOT NULL, created_at INTEGER NOT NULL)");

export interface WatchEntry {
  actorId: string;
  note: string;
  addedBy: string;
  createdAt: number;
}

const toWatch = (r: any): WatchEntry => ({ actorId: r.actor_id, note: r.note, addedBy: r.added_by, createdAt: r.created_at });

export const watchlist = {
  all: () => db.query("SELECT * FROM watchlist ORDER BY created_at DESC").all().map(toWatch),
  get: (id: string) => {
    const r = db.query("SELECT * FROM watchlist WHERE actor_id = ?").get(id);
    return r ? toWatch(r) : undefined;
  },
  add: (id: string, note: string, by: string) => db.query("INSERT OR REPLACE INTO watchlist (actor_id, note, added_by, created_at) VALUES (?, ?, ?, ?)").run(id, note.slice(0, 500), by, Date.now()),
  remove: (id: string) => db.query("DELETE FROM watchlist WHERE actor_id = ?").run(id),
  ids: () => new Set((db.query("SELECT actor_id FROM watchlist").all() as { actor_id: string }[]).map((r) => r.actor_id)),
};

const actorRow = (id: string) => {
  const r = db.query("SELECT json FROM actors WHERE id = ?").get(id) as { json: string } | null;
  return r ? (JSON.parse(r.json) as Actor & { label?: string }) : undefined;
};

const eventsOf = (id: string, limit: number) =>
  (db.query("SELECT json FROM events WHERE actor = ? ORDER BY ts DESC LIMIT ?").all(id, limit) as { json: string }[]).map((r) => JSON.parse(r.json) as Event);

const DAY = 86_400_000;

const evidenceReports = () => {
  const live = snapshot().report;
  const stored = cases.all().flatMap((c) => evidence.get<CaseEvidence>(c.id)?.report ?? []);
  return live ? [live, ...stored] : stored;
};

const bestScores = (reports: ReturnType<typeof evidenceReports>) => {
  const out = new Map<string, number>();
  for (const r of reports) for (const [m, s] of Object.entries(r.scores)) out.set(m, Math.max(out.get(m) ?? 0, s));
  return out;
};

export function profile(id: string) {
  const actor = actorRow(id);
  if (!actor) return undefined;
  const reports = evidenceReports();
  const posts = eventsOf(id, 2000);
  const total = (db.query("SELECT COUNT(*) AS n FROM events WHERE actor = ?").get(id) as { n: number }).n;
  const now = Date.now();
  const end = posts[0] && posts[0].ts < now - 14 * DAY ? posts[0].ts : now;
  const days = Array.from({ length: 14 }, (_, i) => ({ day: end - (13 - i) * DAY, posts: 0 }));
  for (const e of posts) {
    const i = 13 - Math.floor((end - e.ts) / DAY);
    if (i >= 0 && i < 14) days[i].posts++;
  }
  const cluster = reports.flatMap((r) => r.clusters).find((c) => c.members.includes(id));
  const strongest = new Map<string, { id: string; rho: number; layers: string[] }>();
  for (const e of reports.flatMap((r) => r.edges)) {
    if (e.a !== id && e.b !== id) continue;
    const other = e.a === id ? e.b : e.a;
    if ((strongest.get(other)?.rho ?? -1) < e.rho) strongest.set(other, { id: other, rho: e.rho, layers: Object.keys(e.layers) });
  }
  const partners = [...strongest.values()]
    .sort((a, b) => b.rho - a.rho)
    .slice(0, 12)
    .map((p) => ({ ...p, handle: actorRow(p.id)?.handle ?? p.id }));
  return {
    id,
    handle: actor.handle ?? id,
    platform: actor.platform,
    createdAt: actor.createdAt ?? null,
    followers: actor.followers ?? null,
    following: actor.following ?? null,
    label: actor.label ?? null,
    score: bestScores(reports).get(id) ?? 0,
    cluster: cluster ? { id: cluster.id, size: cluster.members.length, rho: cluster.rho, p: cluster.p } : null,
    cases: cases
      .all()
      .filter((c) => c.members.includes(id))
      .map((c) => ({ id: c.id, title: c.title, status: c.status, lastSeen: c.lastSeen })),
    partners,
    activity: days,
    firstPost: posts.at(-1)?.ts ?? null,
    lastPost: posts[0]?.ts ?? null,
    activityEnd: end,
    totalPosts: total,
    recent: posts.slice(0, 6).map((e) => ({ id: e.id, ts: e.ts, action: e.action, text: e.text ?? "" })),
    watch: watchlist.get(id) ?? null,
  };
}

export function list(o: { q?: string; filter?: string; page?: number; size?: number }) {
  const { report } = snapshot();
  const watched = watchlist.ids();
  const scores = bestScores(evidenceReports());
  const flagged = new Map((report?.clusters ?? []).flatMap((c) => c.members.map((m) => [m, c.id] as const)));
  const caseCount = new Map<string, number>();
  for (const c of cases.all()) for (const m of c.members) caseCount.set(m, (caseCount.get(m) ?? 0) + 1);
  const ids = new Set([...scores.keys(), ...caseCount.keys(), ...flagged.keys(), ...watched]);
  const posts = new Map((db.query("SELECT actor, COUNT(*) AS n FROM events GROUP BY actor").all() as { actor: string; n: number }[]).map((r) => [r.actor, r.n]));
  const q = (o.q ?? "").trim().toLowerCase();
  const rows = [...ids]
    .map((id) => {
      const a = actorRow(id);
      return {
        id,
        handle: a?.handle ?? id,
        platform: a?.platform ?? "",
        score: scores.get(id) ?? 0,
        cluster: flagged.get(id) ?? null,
        cases: caseCount.get(id) ?? 0,
        posts: posts.get(id) ?? 0,
        watched: watched.has(id),
      };
    })
    .filter((r) => (o.filter === "watched" ? r.watched : o.filter === "flagged" ? !!r.cluster || r.cases > 0 : true))
    .filter((r) => !q || r.handle.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    .sort((a, b) => Number(b.watched) - Number(a.watched) || b.cases - a.cases || b.score - a.score || b.posts - a.posts);
  const size = Math.min(100, Math.max(5, o.size ?? 25));
  const page = Math.max(1, o.page ?? 1);
  return { total: rows.length, page, size, rows: rows.slice((page - 1) * size, page * size) };
}

const notified = new Set<string>();

export function notifyWatchlist(views: CaseView[]) {
  const watched = watchlist.ids();
  if (!watched.size) return;
  for (const c of views) {
    if (!c.active) continue;
    for (const m of c.members) {
      const key = `${m}:${c.id}`;
      if (!watched.has(m) || notified.has(key)) continue;
      notified.add(key);
      alerts.add({ ts: Date.now(), kind: "watchlist", caseId: c.id, text: `Akun dalam daftar pantau ${actorRow(m)?.handle ?? m.slice(0, 8)} terlibat di ${c.title}` });
    }
  }
}
