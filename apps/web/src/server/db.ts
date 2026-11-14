import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import type { Actor, Event } from "cakranala";
import type { Platform } from "jala";

export const DIR = new URL("../../../../data/", import.meta.url).pathname;
mkdirSync(DIR, { recursive: true });

export const db = new Database(`${DIR}cakranala.sqlite`, { create: true });
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS monitors (id TEXT PRIMARY KEY, kind TEXT NOT NULL, target TEXT NOT NULL, label TEXT NOT NULL, interval_min INTEGER NOT NULL, pages INTEGER NOT NULL, speed INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, last_run_at INTEGER, last_error TEXT, collected INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, monitor TEXT NOT NULL, ts INTEGER NOT NULL, json TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
  CREATE TABLE IF NOT EXISTS actors (id TEXT PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, title TEXT NOT NULL, brief TEXT, status TEXT NOT NULL, members TEXT NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, peak INTEGER NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, kind TEXT NOT NULL, case_id TEXT NOT NULL, text TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, created_at INTEGER NOT NULL, json TEXT NOT NULL, counter TEXT);
  CREATE TABLE IF NOT EXISTS audit (seq INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, action TEXT NOT NULL, subject TEXT NOT NULL, detail TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL);
`);

if (!(db.query("PRAGMA table_info(monitors)").all() as { name: string }[]).some((c) => c.name === "platform")) db.exec("ALTER TABLE monitors ADD COLUMN platform TEXT NOT NULL DEFAULT 'x'");

export const sha256 = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");

export type MonitorKind = "topic" | "account" | "post" | "simulation";
export type { Platform };

export interface Monitor {
  id: string;
  kind: MonitorKind;
  platform: Platform;
  target: string;
  label: string;
  intervalMin: number;
  pages: number;
  speed: number;
  active: boolean;
  createdAt: number;
  lastRunAt: number | null;
  lastError: string | null;
  collected: number;
}

const toMonitor = (r: any): Monitor => ({
  id: r.id,
  kind: r.kind,
  platform: r.platform,
  target: r.target,
  label: r.label,
  intervalMin: r.interval_min,
  pages: r.pages,
  speed: r.speed,
  active: !!r.active,
  createdAt: r.created_at,
  lastRunAt: r.last_run_at,
  lastError: r.last_error,
  collected: r.collected,
});

export const monitors = {
  all: () => db.query("SELECT * FROM monitors ORDER BY created_at").all().map(toMonitor),
  get: (id: string) => {
    const r = db.query("SELECT * FROM monitors WHERE id = ?").get(id);
    return r ? toMonitor(r) : undefined;
  },
  insert: (m: Omit<Monitor, "lastRunAt" | "lastError" | "collected">) =>
    db.query("INSERT INTO monitors (id, kind, platform, target, label, interval_min, pages, speed, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(m.id, m.kind, m.platform, m.target, m.label, m.intervalMin, m.pages, m.speed, m.active ? 1 : 0, m.createdAt),
  setActive: (id: string, active: boolean) => db.query("UPDATE monitors SET active = ? WHERE id = ?").run(active ? 1 : 0, id),
  ran: (id: string, at: number, error: string | null, added: number) => db.query("UPDATE monitors SET last_run_at = ?, last_error = ?, collected = collected + ? WHERE id = ?").run(at, error, added, id),
  replay: (id: string, at: number) => {
    db.query("DELETE FROM events WHERE monitor = ?").run(id);
    db.query("UPDATE monitors SET created_at = ?, collected = 0 WHERE id = ?").run(at, id);
  },
  remove: (id: string) => {
    db.query("DELETE FROM events WHERE monitor = ?").run(id);
    db.query("DELETE FROM monitors WHERE id = ?").run(id);
  },
};

const putEvent = db.query("INSERT OR IGNORE INTO events (id, monitor, ts, json) VALUES (?, ?, ?, ?)");
const putActor = db.query("INSERT OR REPLACE INTO actors (id, json) VALUES (?, ?)");
const getActor = db.query("SELECT json FROM actors WHERE id = ?");

export const store = {
  add(monitor: string, actors: Actor[], events: Event[]) {
    let added = 0;
    db.transaction(() => {
      for (const a of actors) {
        const prev = getActor.get(a.id) as { json: string } | null;
        const reshared = [...new Set([...((prev && (JSON.parse(prev.json) as Actor).reshared) || []), ...(a.reshared ?? [])])];
        putActor.run(a.id, JSON.stringify(reshared.length ? { ...a, reshared } : a));
      }
      for (const e of events) added += putEvent.run(e.id, monitor, e.ts, JSON.stringify(e)).changes;
    })();
    return added;
  },
  window(since: number) {
    const events = db.query("SELECT json FROM events WHERE ts >= ? ORDER BY ts").all(since).map((r: any) => JSON.parse(r.json) as Event);
    const ids = new Set(events.map((e) => e.actor));
    const posts = new Set(events.map((e) => e.id));
    const actors = db.query("SELECT json FROM actors").all().map((r: any) => JSON.parse(r.json) as Actor).filter((a) => ids.has(a.id) || a.reshared?.some((t) => posts.has(t)));
    return { actors, events };
  },
  rows: (actors: string[], since: number) => {
    const set = new Set(actors);
    return (db.query("SELECT id, json FROM events WHERE ts >= ? ORDER BY id").all(since) as { id: string; json: string }[]).filter((r) => set.has((JSON.parse(r.json) as Event).actor));
  },
  monitorOf: () => new Map(db.query("SELECT id, monitor FROM events").all().map((r: any) => [r.id as string, r.monitor as string])),
};

export type CaseStatus = "new" | "investigating" | "confirmed" | "dismissed";

export interface CaseRow {
  id: string;
  title: string;
  brief: string | null;
  status: CaseStatus;
  members: string[];
  firstSeen: number;
  lastSeen: number;
  peak: number;
  createdAt: number;
}

const toCase = (r: any): CaseRow => ({ id: r.id, title: r.title, brief: r.brief, status: r.status, members: JSON.parse(r.members), firstSeen: r.first_seen, lastSeen: r.last_seen, peak: r.peak, createdAt: r.created_at });

export const cases = {
  all: () => db.query("SELECT * FROM cases ORDER BY created_at").all().map(toCase),
  get: (id: string) => {
    const r = db.query("SELECT * FROM cases WHERE id = ?").get(id);
    return r ? toCase(r) : undefined;
  },
  upsert: (c: CaseRow) =>
    db
      .query("INSERT OR REPLACE INTO cases (id, title, brief, status, members, first_seen, last_seen, peak, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(c.id, c.title, c.brief, c.status, JSON.stringify(c.members), c.firstSeen, c.lastSeen, c.peak, c.createdAt),
  setStatus: (id: string, status: CaseStatus) => db.query("UPDATE cases SET status = ? WHERE id = ?").run(status, id),
};

export interface Alert {
  id: number;
  ts: number;
  kind: "new" | "escalated" | "status";
  caseId: string;
  text: string;
}

export const alerts = {
  add: (a: Omit<Alert, "id">) => db.query("INSERT INTO alerts (ts, kind, case_id, text) VALUES (?, ?, ?, ?)").run(a.ts, a.kind, a.caseId, a.text),
  recent: (limit = 30) => db.query("SELECT id, ts, kind, case_id AS caseId, text FROM alerts ORDER BY ts DESC, id DESC LIMIT ?").all(limit) as Alert[],
};

export interface ReportRow<T = unknown> {
  id: string;
  caseId: string;
  createdAt: number;
  content: T;
  counter: string | null;
  hash?: string;
}

export const reports = {
  all: () => db.query("SELECT id, case_id, created_at, json, counter FROM reports ORDER BY created_at DESC").all().map((r: any) => ({ id: r.id, caseId: r.case_id, createdAt: r.created_at, content: JSON.parse(r.json), counter: r.counter, hash: sha256(r.json) }) as ReportRow),
  get: (id: string) => reports.all().find((r) => r.id === id),
  insert: (r: ReportRow) => {
    const json = JSON.stringify(r.content);
    db.query("INSERT INTO reports (id, case_id, created_at, json, counter) VALUES (?, ?, ?, ?, ?)").run(r.id, r.caseId, r.createdAt, json, r.counter);
    return sha256(json);
  },
  setCounter: (id: string, counter: string) => db.query("UPDATE reports SET counter = ? WHERE id = ?").run(counter, id),
};

export interface AuditEntry {
  seq: number;
  ts: number;
  action: string;
  subject: string;
  detail: Record<string, unknown>;
  prev: string;
  hash: string;
}

const GENESIS = "0".repeat(64);
const link = (prev: string, ts: number, action: string, subject: string, detail: string) => sha256(`${prev}\n${JSON.stringify([ts, action, subject, detail])}`);
const toEntry = (r: any): AuditEntry => ({ seq: r.seq, ts: r.ts, action: r.action, subject: r.subject, detail: JSON.parse(r.detail), prev: r.prev, hash: r.hash });

export const audit = {
  add(action: string, subject: string, detail: Record<string, unknown> = {}) {
    db.transaction(() => {
      const prev = (db.query("SELECT hash FROM audit ORDER BY seq DESC LIMIT 1").get() as { hash: string } | null)?.hash ?? GENESIS;
      const ts = Date.now();
      const d = JSON.stringify(detail);
      db.query("INSERT INTO audit (ts, action, subject, detail, prev, hash) VALUES (?, ?, ?, ?, ?, ?)").run(ts, action, subject, d, prev, link(prev, ts, action, subject, d));
    })();
  },
  recent: (limit = 50) => db.query("SELECT * FROM audit ORDER BY seq DESC LIMIT ?").all(limit).map(toEntry),
  of: (subject: string) => db.query("SELECT * FROM audit WHERE subject = ? ORDER BY seq").all(subject).map(toEntry),
  verify() {
    let prev = GENESIS;
    let entries = 0;
    for (const r of db.query("SELECT * FROM audit ORDER BY seq").all() as any[]) {
      if (r.prev !== prev || r.hash !== link(prev, r.ts, r.action, r.subject, r.detail)) return { entries, valid: false, brokenAt: r.seq as number };
      prev = r.hash;
      entries++;
    }
    return { entries, valid: true, brokenAt: null };
  },
};
