import { mkdirSync } from "node:fs";
import type { Actor, Event } from "cakranala";
import { complaintText, KOMDIGI_URL, permalink, profileUrl, sendReport, type Channel, type Receipt } from "cakranala/collect";
import { alerts, audit, cases, db, decisions, DIR, reports } from "./db";
import { credentials, proxies } from "./credentials";
import { identities } from "./identities";
import { reportPdf } from "./pdf";
import { createReport, type ReportContent } from "./reports";

db.exec(`
  CREATE TABLE IF NOT EXISTS complaint_batches (id TEXT PRIMARY KEY, case_ids TEXT NOT NULL, by TEXT NOT NULL, created_at INTEGER NOT NULL, mode TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, report_id TEXT);
  CREATE TABLE IF NOT EXISTS complaint_items (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, case_id TEXT NOT NULL, channel TEXT NOT NULL, kind TEXT NOT NULL, pseudonym TEXT, label TEXT NOT NULL, url TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, not_before INTEGER NOT NULL DEFAULT 0, ref TEXT, screenshot TEXT, error TEXT, sent_at INTEGER, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS complaint_items_status ON complaint_items (status, not_before);
  CREATE INDEX IF NOT EXISTS complaint_items_target ON complaint_items (channel, url);
`);

export type ItemStatus = "queued" | "sent" | "needs_manual" | "failed" | "duplicate" | "simulated" | "unreportable";

export interface ComplaintItem {
  id: string;
  batchId: string;
  caseId: string;
  channel: Channel;
  kind: "account" | "post" | "complaint";
  pseudonym: string | null;
  label: string;
  url: string;
  status: ItemStatus;
  attempts: number;
  ref: string | null;
  screenshot: boolean;
  error: string | null;
  sentAt: number | null;
  createdAt: number;
}

export interface ComplaintBatch {
  id: string;
  caseIds: string[];
  by: string;
  createdAt: number;
  mode: "live" | "simulation";
  title: string;
  text: string;
  reportId: string | null;
}

export interface Candidate {
  key: string;
  caseId: string;
  channel: Channel;
  kind: "account" | "post";
  pseudonym: string;
  owner: string;
  label: string;
  reportable: boolean;
}

export const POSTS_PER_ACCOUNT = 3;
const CHANNEL_GAP = 45_000;
const MAX_ATTEMPTS = 3;
const SHOTS = `${DIR}complaints/`;
const PLATFORMS = new Set(["x", "youtube", "telegram", "tiktok", "instagram", "facebook"]);
const NAME: Record<string, string> = { x: "X", youtube: "YouTube", telegram: "Telegram", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", komdigi: "Komdigi" };

const toItem = (r: any): ComplaintItem => ({
  id: r.id,
  batchId: r.batch_id,
  caseId: r.case_id,
  channel: r.channel,
  kind: r.kind,
  pseudonym: r.pseudonym,
  label: r.label,
  url: r.url,
  status: r.status,
  attempts: r.attempts,
  ref: r.ref,
  screenshot: !!r.screenshot,
  error: r.error,
  sentAt: r.sent_at,
  createdAt: r.created_at,
});

const toBatch = (r: any): ComplaintBatch => ({ id: r.id, caseIds: JSON.parse(r.case_ids), by: r.by, createdAt: r.created_at, mode: r.mode, title: r.title, text: r.text, reportId: r.report_id });

function actorsOf(ids: string[]) {
  const out = new Map<string, Actor>();
  const q = db.query("SELECT json FROM actors WHERE id = ?");
  for (const id of ids) {
    const r = q.get(id) as { json: string } | null;
    if (r) out.set(id, JSON.parse(r.json));
  }
  return out;
}

const evidenceQuery = db.query(`WITH m AS (SELECT value AS actor FROM json_each(?1)),
  s AS (SELECT text_key, COUNT(DISTINCT actor) AS n FROM events INDEXED BY events_actor_text WHERE actor IN m AND length(text_key) >= 20 GROUP BY text_key HAVING n >= 2),
  r AS (SELECT e.id, e.actor, e.ts, s.n, ROW_NUMBER() OVER (PARTITION BY e.actor ORDER BY s.n DESC, e.ts DESC) AS rank FROM events e INDEXED BY events_actor_text JOIN s ON e.text_key = s.text_key WHERE e.actor IN m)
  SELECT r.actor, r.n, events.json FROM r JOIN events ON events.id = r.id WHERE r.rank <= ?2 ORDER BY r.actor, r.n DESC, r.ts DESC`);
const spanQuery = db.query("SELECT COUNT(*) AS n, MIN(ts) AS first, MAX(ts) AS last FROM events WHERE actor IN (SELECT value FROM json_each(?))");
const byIds = db.query("SELECT json FROM events WHERE id IN (SELECT value FROM json_each(?))");
const cache = new Map<string, { sig: string; posts: Map<string, Event[]> }>();

function evidencePosts(c: { id: string; members: string[]; lastSeen: number }) {
  const sig = `${c.members.length}:${c.lastSeen}`;
  const hit = cache.get(c.id);
  if (hit?.sig === sig) return hit.posts;
  const posts = new Map<string, Event[]>();
  for (const r of evidenceQuery.all(JSON.stringify(c.members), POSTS_PER_ACCOUNT) as { actor: string; json: string }[]) {
    const list = posts.get(r.actor) ?? [];
    list.push(JSON.parse(r.json));
    posts.set(r.actor, list);
  }
  cache.set(c.id, { sig, posts });
  return posts;
}

export function coordinated(caseId: string) {
  return decisions.get(caseId)?.verdict === "coordinated";
}

export function candidates(caseIds: string[], simulation = false): Candidate[] {
  const out: Candidate[] = [];
  for (const caseId of caseIds) {
    const c = cases.get(caseId);
    if (!c) continue;
    const actors = actorsOf(c.members);
    const known = identities.known(c.members);
    const evidence = evidencePosts(c);
    for (const m of c.members) {
      const a = actors.get(m);
      const platform = simulation && a?.platform === "sim" ? "x" : (a?.platform ?? "");
      if (!PLATFORMS.has(platform)) continue;
      const reportable = known.has(m);
      const owner = a?.handle ?? m;
      out.push({ key: `${caseId}|account|${m}`, caseId, channel: platform as Channel, kind: "account", pseudonym: m, owner, label: owner, reportable });
      const posts = (evidence.get(m) ?? []).filter((e) => simulation || permalink(e, { platform, id: "", handle: "akun" }));
      for (const e of posts) out.push({ key: `${caseId}|post|${e.id}`, caseId, channel: platform as Channel, kind: "post", pseudonym: m, owner, label: e.text!.slice(0, 120), reportable });
    }
  }
  return out;
}

const sentBefore = db.query("SELECT 1 FROM complaint_items WHERE channel = ? AND url = ? AND status = 'sent' LIMIT 1");
const insertItem = db.query(
  "INSERT INTO complaint_items (id, batch_id, case_id, channel, kind, pseudonym, label, url, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
);

export async function createBatch(input: { caseIds: string[]; keys?: string[]; komdigi: boolean; by: string; simulation: boolean }) {
  const caseIds = [...new Set(input.caseIds)];
  if (!caseIds.length) throw new Error("pilih minimal satu kasus");
  const blocked = caseIds.filter((id) => !coordinated(id));
  if (blocked.length) throw new Error(`isi keputusan analis "terkoordinasi" dulu untuk ${blocked.length} kasus`);
  const all = candidates(caseIds, input.simulation);
  const wanted = input.keys ? new Set(input.keys) : undefined;
  const chosen = all.filter((c) => !wanted || wanted.has(c.key));
  if (!chosen.length && !input.komdigi) throw new Error("tidak ada target yang dipilih");
  const mode = input.simulation ? "simulation" : "live";
  const now = Date.now();
  const id = crypto.randomUUID();
  const rows = caseIds.map((cid) => cases.get(cid)!).filter(Boolean);
  const title = rows.length === 1 ? rows[0].title : `${rows.length} kasus operasi pengaruh terkoordinasi`;
  const span = spanQuery.get(JSON.stringify([...new Set(rows.flatMap((r) => r.members))])) as { n: number; first: number | null; last: number | null };
  const chosenPosts = new Map((byIds.all(JSON.stringify(chosen.filter((c) => c.kind === "post").map((c) => c.key.split("|")[2]))) as { json: string }[]).map((r) => {
    const e = JSON.parse(r.json) as Event;
    return [e.id, e] as const;
  }));
  const text = complaintText({
    title,
    brief: rows.length === 1 ? (rows[0].brief ?? undefined) : undefined,
    accounts: new Set(rows.flatMap((r) => r.members)).size,
    posts: span.n,
    from: Math.min(...rows.map((r) => r.firstSeen), span.first ?? Infinity),
    to: Math.max(...rows.map((r) => r.lastSeen), span.last ?? -Infinity),
    layers: [...new Set(caseIds.flatMap((cid) => decisions.get(cid)?.reasons ?? []))],
    platforms: [...new Set(chosen.map((c) => c.channel))],
  });
  const resolved: { c: Candidate; url: string; status: ItemStatus; error: string | null }[] = [];
  for (const c of chosen) {
    if (!c.reportable && mode === "live") {
      resolved.push({ c, url: "", status: "unreportable", error: "identitas asli tidak tersedia, data berasal dari arsip yang sudah disamarkan" });
      continue;
    }
    const who = c.reportable ? await identities.reveal(c.pseudonym, input.by, c.caseId) : undefined;
    const event = c.kind === "post" ? chosenPosts.get(c.key.split("|")[2]) : undefined;
    const url = (event ? permalink(event, who) : who ? profileUrl(who) : undefined) ?? (mode === "simulation" ? `simulasi://${c.channel}/${c.kind}/${c.pseudonym}` : "");
    if (!url) {
      resolved.push({ c, url: "", status: "unreportable", error: "tautan target tidak bisa dibentuk" });
      continue;
    }
    resolved.push({ c, url, status: mode === "simulation" ? "simulated" : sentBefore.get(c.channel, url) ? "duplicate" : "queued", error: null });
  }
  db.transaction(() => {
    db.query("INSERT INTO complaint_batches (id, case_ids, by, created_at, mode, title, text) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, JSON.stringify(caseIds), input.by, now, mode, title, text);
    for (const r of resolved) insertItem.run(crypto.randomUUID(), id, r.c.caseId, r.c.channel, r.c.kind, r.c.pseudonym, r.c.label, r.url, r.status, r.error, now);
    if (input.komdigi) insertItem.run(crypto.randomUUID(), id, caseIds[0], "komdigi", "complaint", null, `Aduan ke Komdigi: ${title}`, KOMDIGI_URL, mode === "simulation" ? "simulated" : "queued", null, now);
  })();
  audit.add("complaint.created", id, { caseIds, mode, items: resolved.length + (input.komdigi ? 1 : 0), by: input.by });
  return batch(id)!;
}

export function batch(id: string) {
  const r = db.query("SELECT * FROM complaint_batches WHERE id = ?").get(id);
  return r ? toBatch(r) : undefined;
}

export function ofCase(caseId: string) {
  const batches = (db.query("SELECT * FROM complaint_batches ORDER BY created_at DESC").all() as any[]).map(toBatch).filter((b) => b.caseIds.includes(caseId));
  const ids = new Set(batches.map((b) => b.id));
  const items = (db.query("SELECT * FROM complaint_items ORDER BY created_at, rowid").all() as any[]).map(toItem).filter((i) => ids.has(i.batchId));
  return { batches, items };
}

export const item = (id: string) => {
  const r = db.query("SELECT * FROM complaint_items WHERE id = ?").get(id);
  return r ? toItem(r) : undefined;
};

export const screenshotPath = (id: string) => (db.query("SELECT screenshot FROM complaint_items WHERE id = ?").get(id) as { screenshot: string | null } | null)?.screenshot ?? undefined;

export function retry(id: string, by: string) {
  const i = item(id);
  if (!i) throw new Error("item aduan tidak ditemukan");
  if (!["failed", "needs_manual"].includes(i.status)) throw new Error("hanya item gagal atau butuh verifikasi yang bisa dicoba lagi");
  db.query("UPDATE complaint_items SET status = 'queued', attempts = 0, not_before = 0, error = NULL WHERE id = ?").run(id);
  audit.add("complaint.retried", id, { by });
  return item(id)!;
}

export function markDone(id: string, by: string, ref?: string) {
  const i = item(id);
  if (!i) throw new Error("item aduan tidak ditemukan");
  if (i.status !== "needs_manual" && i.status !== "failed") throw new Error("item ini tidak menunggu penyelesaian manual");
  db.query("UPDATE complaint_items SET status = 'sent', ref = COALESCE(?, ref), error = NULL, sent_at = ? WHERE id = ?").run(ref ?? null, Date.now(), id);
  audit.add("complaint.manual", id, { by, channel: i.channel, url: i.url });
  return item(id)!;
}

async function pdfOf(b: ComplaintBatch) {
  let reportId = b.reportId;
  if (!reportId) {
    reportId = (await createReport(b.caseIds[0], b.by)).id;
    db.query("UPDATE complaint_batches SET report_id = ? WHERE id = ?").run(reportId, b.id);
  }
  const r = reports.get(reportId);
  return r ? reportPdf(r as Parameters<typeof reportPdf>[0] & { content: ReportContent }, audit.of(r.id)) : undefined;
}

async function save(i: ComplaintItem, r: Receipt) {
  let shot: string | null = null;
  if (r.screenshot) {
    mkdirSync(SHOTS, { recursive: true });
    shot = `${SHOTS}${i.id}.png`;
    await Bun.write(shot, r.screenshot);
  }
  const hash = r.screenshot ? new Bun.CryptoHasher("sha256").update(r.screenshot).digest("hex") : undefined;
  return { shot, hash };
}

const lastSent = new Map<string, number>();
let running = false;

export type Sender = typeof sendReport;

export async function work(now = Date.now(), send: Sender = sendReport) {
  if (running) return 0;
  running = true;
  let done = 0;
  try {
    const queued = (db.query("SELECT * FROM complaint_items WHERE status = 'queued' AND not_before <= ? ORDER BY created_at, rowid").all(now) as any[]).map(toItem);
    const busy = new Set<string>();
    for (const i of queued) {
      if (busy.has(i.channel) || now - (lastSent.get(i.channel) ?? 0) < CHANNEL_GAP) continue;
      busy.add(i.channel);
      await process(i, send);
      lastSent.set(i.channel, Date.now());
      done++;
    }
  } finally {
    running = false;
  }
  return done;
}

async function process(i: ComplaintItem, send: Sender) {
  const b = batch(i.batchId)!;
  const fail = (error: string, status: ItemStatus = "failed") => {
    db.query("UPDATE complaint_items SET status = ?, attempts = attempts + 1, error = ? WHERE id = ?").run(status, error.slice(0, 300), i.id);
    alerts.add({ ts: Date.now(), kind: "error", caseId: i.caseId, text: `Aduan ${NAME[i.channel]} gagal: ${error.slice(0, 160)}` });
  };
  const lease = await credentials.reporter(i.channel);
  if (!lease) return fail(`belum ada kredensial pelapor ${NAME[i.channel]} yang aktif, tambahkan di Credentials`);
  const px = ["tiktok", "telegram", "komdigi"].includes(i.channel) || !(db.query("SELECT COUNT(*) AS n FROM proxies").get() as { n: number }).n ? undefined : await proxies.lease(lease.id);
  const links = i.channel === "komdigi" ? (db.query("SELECT url FROM complaint_items WHERE batch_id = ? AND channel != 'komdigi' AND url != ''").all(b.id) as { url: string }[]).map((r) => r.url) : [i.url];
  const r = await send({ channel: i.channel, kind: i.kind === "complaint" ? "post" : i.kind, url: i.url, who: i.pseudonym && i.kind === "account" ? await identities.reveal(i.pseudonym, b.by, i.caseId) : undefined }, { title: b.title, text: b.text, links, pdf: i.channel === "komdigi" ? await pdfOf(b) : undefined }, lease.fields, px?.url);
  const { shot, hash } = await save(i, r);
  if (r.status === "sent") {
    db.query("UPDATE complaint_items SET status = 'sent', attempts = attempts + 1, ref = ?, screenshot = ?, error = NULL, sent_at = ? WHERE id = ?").run(r.ref ?? null, shot, Date.now(), i.id);
    credentials.ok(lease.id);
    audit.add("complaint.sent", i.id, { channel: i.channel, url: i.url, ref: r.ref ?? null, screenshot: hash ?? null });
  } else if (r.status === "limited") {
    credentials.limited(lease.id, r.until ?? Date.now() + 15 * 60_000);
    db.query("UPDATE complaint_items SET not_before = ?, error = ? WHERE id = ?").run(r.until ?? Date.now() + 15 * 60_000, r.error ?? "terkena batas laju", i.id);
  } else if (r.status === "needs_manual") {
    db.query("UPDATE complaint_items SET status = 'needs_manual', attempts = attempts + 1, screenshot = ?, error = ? WHERE id = ?").run(shot, (r.error ?? "butuh verifikasi").slice(0, 300), i.id);
    alerts.add({ ts: Date.now(), kind: "error", caseId: i.caseId, text: `Aduan ${NAME[i.channel]} butuh verifikasi manual: ${r.error ?? ""}`.trim() });
  } else if (/proxy|ECONN|ETIMEDOUT|fetch failed|socket/i.test(r.error ?? "") && i.attempts + 1 < MAX_ATTEMPTS) {
    if (px) proxies.failed(px.id, r.error ?? "", lease.id);
    db.query("UPDATE complaint_items SET attempts = attempts + 1, not_before = ?, error = ? WHERE id = ?").run(Date.now() + 60_000, r.error ?? null, i.id);
  } else {
    if (/sesi|kredensial|401|403/i.test(r.error ?? "")) credentials.failed(lease.id, r.error ?? "");
    db.query("UPDATE complaint_items SET screenshot = ? WHERE id = ?").run(shot, i.id);
    fail(r.error ?? "gagal tanpa keterangan");
  }
}

export const summary = (items: ComplaintItem[]) => Object.fromEntries(["queued", "sent", "needs_manual", "failed", "duplicate", "simulated", "unreportable"].map((s) => [s, items.filter((i) => i.status === s).length])) as Record<ItemStatus, number>;
