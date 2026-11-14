import { db, sha256 } from "./db";

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, created_at INTEGER NOT NULL, last_login INTEGER);
  CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
`);

const COOKIE = "cn_session";
const DUMMY = Bun.password.hash(crypto.randomUUID());
const TTL = 7 * 24 * 3_600_000;

export interface User {
  id: string;
  username: string;
  createdAt: number;
  lastLogin: number | null;
}

const toUser = (r: any): User => ({ id: r.id, username: r.username, createdAt: r.created_at, lastLogin: r.last_login });

const validName = (u: unknown) => {
  const name = String(u ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(name)) throw new Error("nama pengguna 3 sampai 32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung");
  return name;
};

const validPassword = (p: unknown) => {
  const pw = String(p ?? "");
  if (pw.length < 10 || pw.length > 200) throw new Error("kata sandi harus 10 sampai 200 karakter");
  return pw;
};

export const users = {
  all: () => db.query("SELECT id, username, created_at, last_login FROM users ORDER BY created_at").all().map(toUser),
  count: () => (db.query("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n,
  async create(username: unknown, password: unknown) {
    const name = validName(username);
    const hash = await Bun.password.hash(validPassword(password));
    if (db.query("SELECT 1 FROM users WHERE username = ?").get(name)) throw new Error("nama pengguna sudah dipakai");
    const id = crypto.randomUUID();
    db.query("INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)").run(id, name, hash, Date.now());
    return toUser(db.query("SELECT id, username, created_at, last_login FROM users WHERE id = ?").get(id));
  },
  async setPassword(id: string, password: unknown) {
    db.query("UPDATE users SET password = ? WHERE id = ?").run(await Bun.password.hash(validPassword(password)), id);
    db.query("DELETE FROM sessions WHERE user_id = ?").run(id);
  },
  remove(id: string) {
    db.query("DELETE FROM sessions WHERE user_id = ?").run(id);
    db.query("DELETE FROM users WHERE id = ?").run(id);
  },
};

export async function login(username: unknown, password: unknown) {
  const r = db.query("SELECT * FROM users WHERE username = ?").get(String(username ?? "").trim().toLowerCase()) as any;
  const ok = await Bun.password.verify(String(password ?? ""), r?.password ?? (await DUMMY));
  if (!r || !ok) throw new Error("nama pengguna atau kata sandi salah");
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(sha256(token), r.id, Date.now() + TTL);
  db.query("UPDATE users SET last_login = ? WHERE id = ?").run(Date.now(), r.id);
  db.query("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  return { token, user: toUser(r) };
}

const tokenOf = (req: Request) =>
  req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);

export function currentUser(req: Request): User | undefined {
  const token = tokenOf(req);
  if (!token) return undefined;
  const r = db.query("SELECT u.id, u.username, u.created_at, u.last_login FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?").get(sha256(token), Date.now());
  return r ? toUser(r) : undefined;
}

export const logout = (req: Request) => {
  const token = tokenOf(req);
  if (token) db.query("DELETE FROM sessions WHERE id = ?").run(sha256(token));
};

export const sessionCookie = (req: Request, token: string, maxAge = TTL / 1000) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${req.headers.get("x-forwarded-proto") === "https" ? "; Secure" : ""}`;
