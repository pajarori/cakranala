import type { Actor, Event } from "cakranala";
import { alerts, cases, db } from "./db";
import { snapshot, type CaseView } from "./analysis";

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

export function profile(id: string) {
  const actor = actorRow(id);
  if (!actor) return undefined;
  const { report, window } = snapshot();
  const posts = eventsOf(id, 2000);
  const now = Date.now();
  const days = Array.from({ length: 14 }, (_, i) => ({ day: now - (13 - i) * DAY, posts: 0 }));
  for (const e of posts) {
    const i = 13 - Math.floor((now - e.ts) / DAY);
    if (i >= 0 && i < 14) days[i].posts++;
  }
  const cluster = report?.clusters.find((c) => c.members.includes(id));
  const partners = (report?.edges ?? [])
    .filter((e) => e.a === id || e.b === id)
    .map((e) => ({ id: e.a === id ? e.b : e.a, rho: e.rho, layers: Object.keys(e.layers) }))
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
    score: report?.scores[id] ?? 0,
    cluster: cluster ? { id: cluster.id, size: cluster.members.length, rho: cluster.rho, p: cluster.p } : null,
    cases: cases
      .all()
      .filter((c) => c.members.includes(id))
      .map((c) => ({ id: c.id, title: c.title, status: c.status, lastSeen: c.lastSeen })),
    partners,
    activity: days,
    firstPost: posts.at(-1)?.ts ?? null,
    lastPost: posts[0]?.ts ?? null,
    postsInWindow: posts.filter((e) => e.ts >= window.from).length,
    recent: posts.slice(0, 6).map((e) => ({ id: e.id, ts: e.ts, action: e.action, text: e.text ?? "" })),
    watch: watchlist.get(id) ?? null,
  };
}

export function list(o: { q?: string; filter?: string; page?: number; size?: number }) {
  const { report, window, cases: views } = snapshot();
  const watched = watchlist.ids();
  const flagged = new Map((report?.clusters ?? []).flatMap((c) => c.members.map((m) => [m, c.id] as const)));
  const caseCount = new Map<string, number>();
  for (const c of views) for (const m of c.members) caseCount.set(m, (caseCount.get(m) ?? 0) + 1);
  const ids = new Set([...Object.keys(report?.scores ?? {}), ...flagged.keys(), ...watched]);
  const posts = new Map(
    (db.query("SELECT actor, COUNT(*) AS n FROM events WHERE ts >= ? GROUP BY actor").all(window.from) as { actor: string; n: number }[]).map((r) => [r.actor, r.n]),
  );
  const q = (o.q ?? "").trim().toLowerCase();
  const rows = [...ids]
    .map((id) => {
      const a = actorRow(id);
      return {
        id,
        handle: a?.handle ?? id,
        platform: a?.platform ?? "",
        score: report?.scores[id] ?? 0,
        cluster: flagged.get(id) ?? null,
        cases: caseCount.get(id) ?? 0,
        posts: posts.get(id) ?? 0,
        watched: watched.has(id),
      };
    })
    .filter((r) => (o.filter === "watched" ? r.watched : o.filter === "flagged" ? !!r.cluster : true))
    .filter((r) => !q || r.handle.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    .sort((a, b) => Number(b.watched) - Number(a.watched) || b.score - a.score || b.posts - a.posts);
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
