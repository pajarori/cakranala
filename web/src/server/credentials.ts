import { CREDENTIAL_FIELDS as SPEC, type CredentialPool, type Probe } from "cakranala/collect";
import { db } from "./db";
import { open, seal } from "./vault";

export type CredentialPlatform = "x" | "youtube" | "tiktok" | "instagram" | "facebook";

export const CREDENTIAL_FIELDS = SPEC as Record<CredentialPlatform, { fields: string[]; required: string[] }>;
const REQUIRED = Object.fromEntries(Object.entries(SPEC).map(([p, s]) => [p, s.required])) as Record<CredentialPlatform, string[]>;
const MAX_FAILURES = 3;

db.exec("CREATE TABLE IF NOT EXISTS sidecar_identities (credential_id TEXT PRIMARY KEY, identity_id TEXT NOT NULL)");
db.exec(`CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, platform TEXT NOT NULL, label TEXT NOT NULL, secret TEXT NOT NULL, iv TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, failures INTEGER NOT NULL DEFAULT 0, uses INTEGER NOT NULL DEFAULT 0, cooldown_until INTEGER, last_used INTEGER, last_error TEXT, created_at INTEGER NOT NULL)`);

for (const [col, type] of [["profile", "TEXT"], ["checked_at", "INTEGER"]] as const)
  if (!(db.query("PRAGMA table_info(credentials)").all() as { name: string }[]).some((c) => c.name === col)) db.exec(`ALTER TABLE credentials ADD COLUMN ${col} ${type}`);

export interface Credential {
  id: string;
  platform: CredentialPlatform;
  label: string;
  active: boolean;
  failures: number;
  uses: number;
  cooldownUntil: number | null;
  lastUsed: number | null;
  lastError: string | null;
  createdAt: number;
  profile: Probe["profile"] | null;
  checkedAt: number | null;
  proxy: string | null;
}

const toCredential = (r: any): Credential => ({
  id: r.id,
  platform: r.platform,
  label: r.label,
  active: !!r.active,
  failures: r.failures,
  uses: r.uses,
  cooldownUntil: r.cooldown_until,
  lastUsed: r.last_used,
  lastError: r.last_error,
  createdAt: r.created_at,
  profile: r.profile ? JSON.parse(r.profile) : null,
  checkedAt: r.checked_at,
  proxy: (db.query("SELECT p.label FROM proxy_bindings b JOIN proxies p ON p.id = b.proxy_id WHERE b.credential_id = ?").get(r.id) as { label: string } | null)?.label ?? null,
});

export interface Lease {
  id: string;
  fields: Record<string, string>;
}

db.exec("CREATE TABLE IF NOT EXISTS proxies (id TEXT PRIMARY KEY, label TEXT NOT NULL, secret TEXT NOT NULL, iv TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, failures INTEGER NOT NULL DEFAULT 0, last_error TEXT, last_used INTEGER, exit TEXT, checked_at INTEGER, created_at INTEGER NOT NULL)");
db.exec("CREATE TABLE IF NOT EXISTS proxy_bindings (credential_id TEXT PRIMARY KEY, proxy_id TEXT NOT NULL)");

export interface Proxy {
  id: string;
  label: string;
  active: boolean;
  failures: number;
  lastError: string | null;
  lastUsed: number | null;
  exit: { ip: string; country: string } | null;
  checkedAt: number | null;
  createdAt: number;
  sessions: number;
}

const toProxy = (r: any): Proxy => ({
  id: r.id,
  label: r.label,
  active: !!r.active,
  failures: r.failures,
  lastError: r.last_error,
  lastUsed: r.last_used,
  exit: r.exit ? JSON.parse(r.exit) : null,
  checkedAt: r.checked_at,
  createdAt: r.created_at,
  sessions: r.sessions ?? 0,
});

export function parseProxy(line: string) {
  const s = line.trim();
  const parts = s.split(":");
  const raw = /^[a-z0-9]+:\/\//i.test(s) ? s : parts.length >= 4 ? `http://${encodeURIComponent(parts[2])}:${encodeURIComponent(parts.slice(3).join(":"))}@${parts[0]}:${parts[1]}` : `http://${s}`;
  const u = URL.parse(raw);
  if (!u?.hostname) throw new Error(`format proxy tidak dikenal: ${s.split("@").pop()}`);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error(`hanya proxy http atau https: ${u.host}`);
  const host = `${u.hostname}:${u.port || (u.protocol === "https:" ? "443" : "80")}`;
  return { url: `${u.protocol}//${u.username ? `${u.username}:${u.password}@` : ""}${host}`, label: u.username ? `${decodeURIComponent(u.username)}@${host}` : host };
}

const PROXY_ROWS = "SELECT p.*, (SELECT COUNT(*) FROM proxy_bindings b WHERE b.proxy_id = p.id) AS sessions FROM proxies p";

export const proxies = {
  all: () => db.query(`${PROXY_ROWS} ORDER BY p.created_at`).all().map(toProxy),
  get: (id: string) => {
    const r = db.query(`${PROXY_ROWS} WHERE p.id = ?`).get(id);
    return r ? toProxy(r) : undefined;
  },
  async add(text: string) {
    const lines = text.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) throw new Error("daftar proxy kosong");
    const parsed = lines.map(parseProxy);
    const known = new Set(await Promise.all((db.query("SELECT secret, iv FROM proxies").all() as { secret: string; iv: string }[]).map(async (r) => (await open(r.secret, r.iv)).url)));
    let added = 0;
    for (const p of parsed) {
      if (known.has(p.url)) continue;
      known.add(p.url);
      const { secret, iv } = await seal({ url: p.url });
      db.query("INSERT INTO proxies (id, label, secret, iv, created_at) VALUES (?, ?, ?, ?, ?)").run(crypto.randomUUID(), p.label, secret, iv, Date.now());
      added++;
    }
    return { added, skipped: parsed.length - added };
  },
  async url(id: string) {
    const r = db.query("SELECT secret, iv FROM proxies WHERE id = ?").get(id) as { secret: string; iv: string } | null;
    return r ? (await open(r.secret, r.iv)).url : undefined;
  },
  next: () => (db.query(`${PROXY_ROWS} WHERE p.active = 1 ORDER BY sessions, p.failures, COALESCE(p.last_used, 0) LIMIT 1`).get() as { id: string } | null)?.id,
  async lease(credentialId?: string) {
    const bound = credentialId ? (db.query("SELECT b.proxy_id AS id FROM proxy_bindings b JOIN proxies p ON p.id = b.proxy_id WHERE b.credential_id = ? AND p.active = 1").get(credentialId) as { id: string } | null)?.id : undefined;
    const id = bound ?? proxies.next();
    if (!id) return undefined;
    if (credentialId && !bound) db.query("INSERT OR REPLACE INTO proxy_bindings (credential_id, proxy_id) VALUES (?, ?)").run(credentialId, id);
    db.query("UPDATE proxies SET last_used = ? WHERE id = ?").run(Date.now(), id);
    return { id, url: (await proxies.url(id))! };
  },
  bind: (credentialId: string, proxyId: string) => db.query("INSERT OR REPLACE INTO proxy_bindings (credential_id, proxy_id) VALUES (?, ?)").run(credentialId, proxyId),
  failed(id: string, error: string, credentialId?: string) {
    if (credentialId) db.query("DELETE FROM proxy_bindings WHERE credential_id = ? AND proxy_id = ?").run(credentialId, id);
    db.query("UPDATE proxies SET failures = failures + 1, last_error = ?, active = CASE WHEN failures + 1 >= ? THEN 0 ELSE active END WHERE id = ?").run(error.slice(0, 200), MAX_FAILURES, id);
    if (!proxies.get(id)?.active) db.query("DELETE FROM proxy_bindings WHERE proxy_id = ?").run(id);
  },
  async test(id: string) {
    const url = await proxies.url(id);
    if (!url) throw new Error("proxy tidak ditemukan");
    try {
      const res = await fetch("https://cloudflare.com/cdn-cgi/trace", { proxy: url, signal: AbortSignal.timeout(15_000) });
      const body = Object.fromEntries((await res.text()).split("\n").map((l) => l.split("=")));
      const exit = { ip: body.ip ?? "", country: body.loc ?? "" };
      db.query("UPDATE proxies SET exit = ?, checked_at = ?, failures = 0, last_error = NULL WHERE id = ?").run(JSON.stringify(exit), Date.now(), id);
      return { ok: true, exit };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      db.query("UPDATE proxies SET checked_at = ?, last_error = ? WHERE id = ?").run(Date.now(), error.slice(0, 200), id);
      return { ok: false, error };
    }
  },
  setActive: (id: string, active: boolean) => {
    db.query("UPDATE proxies SET active = ?, failures = CASE WHEN ? THEN 0 ELSE failures END, last_error = CASE WHEN ? THEN NULL ELSE last_error END WHERE id = ?").run(active ? 1 : 0, active ? 1 : 0, active ? 1 : 0, id);
    if (!active) db.query("DELETE FROM proxy_bindings WHERE proxy_id = ?").run(id);
  },
  remove: (id: string) => {
    db.query("DELETE FROM proxy_bindings WHERE proxy_id = ?").run(id);
    db.query("DELETE FROM proxies WHERE id = ?").run(id);
  },
};

export const credentials = {
  all: () => db.query("SELECT * FROM credentials ORDER BY platform, created_at").all().map(toCredential),
  get: (id: string) => {
    const r = db.query("SELECT * FROM credentials WHERE id = ?").get(id);
    return r ? toCredential(r) : undefined;
  },
  async add(platform: CredentialPlatform, label: string, fields: Record<string, string>) {
    if (!CREDENTIAL_FIELDS[platform]) throw new Error("platform tidak dikenal");
    const clean = Object.fromEntries(CREDENTIAL_FIELDS[platform].fields.flatMap((f) => (typeof fields[f] === "string" && fields[f].trim() ? [[f, fields[f].trim()]] : [])));
    const missing = REQUIRED[platform].filter((f) => !clean[f]);
    if (missing.length) throw new Error(`isian wajib belum diisi: ${missing.join(", ")}`);
    const { secret, iv } = await seal(clean);
    const id = crypto.randomUUID();
    db.query("INSERT INTO credentials (id, platform, label, secret, iv, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, platform, label.trim().slice(0, 80) || platform, secret, iv, Date.now());
    return credentials.get(id)!;
  },
  async fields(id: string) {
    const r = db.query("SELECT secret, iv FROM credentials WHERE id = ?").get(id) as { secret: string; iv: string } | null;
    if (!r) throw new Error("kredensial tidak ditemukan");
    return open(r.secret, r.iv);
  },
  checked(id: string, p: Probe) {
    db.query("UPDATE credentials SET checked_at = ?, profile = COALESCE(?, profile), last_error = ?, failures = CASE WHEN ? THEN 0 ELSE failures END WHERE id = ?").run(Date.now(), p.profile ? JSON.stringify(p.profile) : null, p.ok ? null : (p.error ?? "test failed"), p.ok ? 1 : 0, id);
  },
  remove: (id: string) => {
    db.query("DELETE FROM sidecar_identities WHERE credential_id = ?").run(id);
    db.query("DELETE FROM proxy_bindings WHERE credential_id = ?").run(id);
    db.query("DELETE FROM credentials WHERE id = ?").run(id);
  },
  sidecarIdentity: (id: string) => (db.query("SELECT identity_id FROM sidecar_identities WHERE credential_id = ?").get(id) as { identity_id: string } | null)?.identity_id,
  setSidecarIdentity: (id: string, identity: string) => db.query("INSERT OR REPLACE INTO sidecar_identities (credential_id, identity_id) VALUES (?, ?)").run(id, identity),
  setActive: (id: string, active: boolean) => db.query("UPDATE credentials SET active = ?, cooldown_until = NULL, failures = CASE WHEN ? THEN 0 ELSE failures END, last_error = CASE WHEN ? THEN NULL ELSE last_error END WHERE id = ?").run(active ? 1 : 0, active ? 1 : 0, active ? 1 : 0, id),
  rotate: (id: string, until = Date.now() + 15 * 60_000) => db.query("UPDATE credentials SET cooldown_until = ? WHERE id = ?").run(until, id),
  available: (platform: CredentialPlatform, now = Date.now()) =>
    (db.query("SELECT COUNT(*) AS n FROM credentials WHERE platform = ? AND active = 1 AND (cooldown_until IS NULL OR cooldown_until <= ?)").get(platform, now) as { n: number }).n,
  count: (platform: CredentialPlatform) => (db.query("SELECT COUNT(*) AS n FROM credentials WHERE platform = ? AND active = 1").get(platform) as { n: number }).n,
  async acquire(platform: CredentialPlatform, exclude: string[] = [], now = Date.now()): Promise<Lease | undefined> {
    const rows = db
      .query("SELECT * FROM credentials WHERE platform = ? AND active = 1 AND (cooldown_until IS NULL OR cooldown_until <= ?) ORDER BY COALESCE(last_used, 0), uses")
      .all(platform, now) as any[];
    const r = rows.find((x) => !exclude.includes(x.id));
    if (!r) return undefined;
    db.query("UPDATE credentials SET last_used = ?, uses = uses + 1 WHERE id = ?").run(now, r.id);
    return { id: r.id, fields: await open(r.secret, r.iv) };
  },
  ok: (id: string) => db.query("UPDATE credentials SET failures = 0, last_error = NULL WHERE id = ?").run(id),
  limited: (id: string, until: number) => db.query("UPDATE credentials SET cooldown_until = ?, last_error = 'terkena batas laju' WHERE id = ?").run(until, id),
  failed: (id: string, error: string) =>
    db.query("UPDATE credentials SET failures = failures + 1, last_error = ?, active = CASE WHEN failures + 1 >= ? THEN 0 ELSE active END WHERE id = ?").run(error.slice(0, 200), MAX_FAILURES, id),
};

export const pool: CredentialPool = {
  count: (p) => (p === "telegram" ? 0 : credentials.count(p)),
  acquire: async (p, exclude) => {
    if (p === "telegram") return undefined;
    const lease = await credentials.acquire(p, exclude);
    if (!lease || p === "tiktok" || !(db.query("SELECT COUNT(*) AS n FROM proxies").get() as { n: number }).n) return lease;
    const proxy = await proxies.lease(lease.id);
    if (!proxy) throw new Error("semua proxy mati, aktifkan atau tambah proxy di Credentials");
    return { ...lease, proxy };
  },
  ok: (id) => credentials.ok(id),
  limited: (id, until) => credentials.limited(id, until),
  failed: (id, error) => credentials.failed(id, error),
  identity: (id) => credentials.sidecarIdentity(id),
  setIdentity: (id, identity) => credentials.setSidecarIdentity(id, identity),
  proxyFailed: (id, error, credentialId) => proxies.failed(id, error, credentialId),
};
