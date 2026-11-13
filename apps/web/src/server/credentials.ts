import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { db, DIR } from "./db";

export type CredentialPlatform = "x" | "youtube" | "tiktok";

export const CREDENTIAL_FIELDS: Record<CredentialPlatform, string[]> = {
  x: ["authToken", "ct0", "userAgent"],
  youtube: ["cookie"],
  tiktok: ["cookie"],
};

const REQUIRED: Record<CredentialPlatform, string[]> = { x: ["authToken", "ct0"], youtube: ["cookie"], tiktok: ["cookie"] };
const MAX_FAILURES = 3;

db.exec(`CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, platform TEXT NOT NULL, label TEXT NOT NULL, secret TEXT NOT NULL, iv TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, failures INTEGER NOT NULL DEFAULT 0, uses INTEGER NOT NULL DEFAULT 0, cooldown_until INTEGER, last_used INTEGER, last_error TEXT, created_at INTEGER NOT NULL)`);

const KEY_FILE = `${DIR}credential.key`;

function keyBytes() {
  if (!existsSync(KEY_FILE)) {
    writeFileSync(KEY_FILE, Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"), { mode: 0o600 });
    chmodSync(KEY_FILE, 0o600);
  }
  return Buffer.from(readFileSync(KEY_FILE, "utf8").trim(), "base64");
}

const key = crypto.subtle.importKey("raw", keyBytes(), "AES-GCM", false, ["encrypt", "decrypt"]);

async function seal(fields: Record<string, string>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key, new TextEncoder().encode(JSON.stringify(fields)));
  return { secret: Buffer.from(data).toString("base64"), iv: Buffer.from(iv).toString("base64") };
}

async function open(secret: string, iv: string): Promise<Record<string, string>> {
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, await key, Buffer.from(secret, "base64"));
  return JSON.parse(new TextDecoder().decode(data));
}

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
});

export interface Lease {
  id: string;
  fields: Record<string, string>;
}

export const credentials = {
  all: () => db.query("SELECT * FROM credentials ORDER BY platform, created_at").all().map(toCredential),
  get: (id: string) => {
    const r = db.query("SELECT * FROM credentials WHERE id = ?").get(id);
    return r ? toCredential(r) : undefined;
  },
  async add(platform: CredentialPlatform, label: string, fields: Record<string, string>) {
    if (!CREDENTIAL_FIELDS[platform]) throw new Error("unknown platform");
    const clean = Object.fromEntries(CREDENTIAL_FIELDS[platform].flatMap((f) => (typeof fields[f] === "string" && fields[f].trim() ? [[f, fields[f].trim()]] : [])));
    const missing = REQUIRED[platform].filter((f) => !clean[f]);
    if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
    const { secret, iv } = await seal(clean);
    const id = crypto.randomUUID();
    db.query("INSERT INTO credentials (id, platform, label, secret, iv, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, platform, label.trim().slice(0, 80) || platform, secret, iv, Date.now());
    return credentials.get(id)!;
  },
  remove: (id: string) => db.query("DELETE FROM credentials WHERE id = ?").run(id),
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
  limited: (id: string, until: number) => db.query("UPDATE credentials SET cooldown_until = ?, last_error = 'rate limited' WHERE id = ?").run(until, id),
  failed: (id: string, error: string) =>
    db.query("UPDATE credentials SET failures = failures + 1, last_error = ?, active = CASE WHEN failures + 1 >= ? THEN 0 ELSE active END WHERE id = ?").run(error.slice(0, 200), MAX_FAILURES, id),
};

export async function rotating<T>(platform: CredentialPlatform, run: (lease: Lease) => Promise<{ value: T; limitedUntil?: number }>): Promise<T> {
  const tried: string[] = [];
  let last: Error | undefined;
  for (;;) {
    const lease = await credentials.acquire(platform, tried);
    if (!lease) break;
    tried.push(lease.id);
    try {
      const { value, limitedUntil } = await run(lease);
      if (limitedUntil) {
        credentials.limited(lease.id, limitedUntil);
        last = new Error("rate limited");
        continue;
      }
      credentials.ok(lease.id);
      return value;
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      credentials.failed(lease.id, last.message);
    }
  }
  throw last ?? new Error(`no ${platform} credential available`);
}
