import type { Dataset } from "cakranala";
import { createXCollector, type Profile } from "./x";
import { createYoutubeCollector } from "./youtube";
import { collectTelegram } from "./telegram";
import { createTiktokCollector, tiktokAccount, type SidecarConfig } from "./tiktok";
import { Limited, type BrowserConfig, type Session } from "./browser";
import { createInstagramCollector, shortcode } from "./instagram";
import { createFacebookCollector, facebookUrl } from "./facebook";

export { createXCollector, sessionFromEnv, type XSession, type XRateState, type Profile } from "./x";
export { createYoutubeCollector } from "./youtube";
export { collectTelegram } from "./telegram";
export { createTiktokCollector, sidecarFromEnv, type SidecarConfig } from "./tiktok";
export { browserFromEnv, type BrowserConfig } from "./browser";
export { createInstagramCollector } from "./instagram";
export { createFacebookCollector } from "./facebook";

export type Platform = "x" | "youtube" | "telegram" | "tiktok" | "instagram" | "facebook";
export type Kind = "topic" | "account" | "post";

export const PLATFORM_KINDS: Record<Platform, Kind[]> = { x: ["topic", "account", "post"], youtube: ["topic", "post"], telegram: ["account"], tiktok: ["topic", "post"], instagram: ["topic", "account", "post"], facebook: ["topic", "account", "post"] };

export const CREDENTIAL_FIELDS: Record<Exclude<Platform, "telegram">, { fields: string[]; required: string[] }> = {
  x: { fields: ["authToken", "ct0", "userAgent"], required: ["authToken", "ct0"] },
  youtube: { fields: ["cookie"], required: ["cookie"] },
  tiktok: { fields: ["cookie", "userAgent"], required: ["cookie", "userAgent"] },
  instagram: { fields: ["cookie", "userAgent"], required: ["cookie", "userAgent"] },
  facebook: { fields: ["cookie", "userAgent"], required: ["cookie", "userAgent"] },
};

const session = (fields: Record<string, string>, proxy?: string): Session => ({ cookie: fields.cookie, userAgent: fields.userAgent, proxy });

const NETWORK = /proxy|tunnel|ERR_TUNNEL|ERR_PROXY|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket|407|unable to connect|fetch failed/i;

export interface Probe {
  ok: boolean;
  profile?: Profile & { signedIn?: boolean };
  error?: string;
}

export async function probe(platform: Platform, fields: Record<string, string>, o: { tiktok?: SidecarConfig; browser?: BrowserConfig; proxy?: string } = {}): Promise<Probe> {
  const { tiktok, browser, proxy } = o;
  try {
    if (platform === "instagram" || platform === "facebook") {
      if (!browser) throw new Error("browser belum dikonfigurasi");
      const c = platform === "instagram" ? createInstagramCollector(browser) : createFacebookCollector(browser);
      return { ok: true, profile: { ...(await c.me(session(fields, proxy))), signedIn: true } };
    }
    if (platform === "x") return { ok: true, profile: await (await createXCollector({ authToken: fields.authToken, ct0: fields.ct0, userAgent: fields.userAgent || "Mozilla/5.0", proxy })).me() };
    if (platform === "youtube") return { ok: true, profile: await (await createYoutubeCollector(fields.cookie, proxy)).me() };
    if (platform === "tiktok") {
      if (!tiktok) throw new Error("sidecar TikTok belum dikonfigurasi");
      const r = await createTiktokCollector(tiktok).check(fields.cookie, fields.userAgent);
      const account = r.authenticated ? await tiktokAccount(fields.cookie, fields.userAgent).catch(() => undefined) : undefined;
      return { ok: true, profile: account ? { ...account, signedIn: true } : { id: "tiktok", handle: r.authenticated ? "Signed in session" : "Anonymous session", name: r.browser ?? "", signedIn: r.authenticated } };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface Target {
  platform: Platform;
  kind: Kind;
  target: string;
  pages: number;
}

export interface Lease {
  id: string;
  fields: Record<string, string>;
  proxy?: { id: string; url: string };
}

export interface CredentialPool {
  count(platform: Platform): number;
  acquire(platform: Platform, exclude: string[]): Promise<Lease | undefined>;
  ok(id: string): void;
  limited(id: string, until: number): void;
  failed(id: string, error: string): void;
  identity(id: string): string | undefined;
  setIdentity(id: string, identity: string): void;
  proxyFailed(id: string, error: string, credentialId: string): void;
}

const videoId = (t: string) => t.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1] ?? t.match(/^[\w-]{11}$/)?.[0];
const tiktokVideo = (t: string) => t.match(/video\/(\d{8,})/)?.[1] ?? t.match(/^\d{8,}$/)?.[0];
const igUser = (t: string) => t.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").split(/[/?]/)[0].match(/^[\w.]{1,30}$/)?.[0];
const channels = (t: string) =>
  t
    .split(/[\s,]+/)
    .map((c) => c.replace(/^@/, "").replace(/^https?:\/\/t\.me\/(s\/)?/, "").split(/[/?]/)[0])
    .filter((c) => /^[A-Za-z0-9_]{4,}$/.test(c));

export function xQuery(kind: Kind, target: string) {
  const t = target.trim();
  if (kind === "account") {
    const h = t.replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, "").split(/[/?]/)[0];
    return `(to:${h} OR @${h})`;
  }
  if (kind === "post") {
    const id = t.match(/status\/(\d+)/)?.[1] ?? t.match(/^\d+$/)?.[0];
    if (!id) throw new Error("pantauan post butuh URL atau ID post");
    return `conversation_id:${id}`;
  }
  return t;
}

export function validate(t: Pick<Target, "platform" | "kind" | "target">) {
  if (!PLATFORM_KINDS[t.platform]?.includes(t.kind)) throw new Error(`${t.platform} tidak mendukung pantauan ${t.kind}`);
  if (t.platform === "x") xQuery(t.kind, t.target);
  if (t.platform === "youtube" && t.kind === "post" && !videoId(t.target)) throw new Error("pantauan YouTube butuh URL atau ID video");
  if (t.platform === "telegram" && !channels(t.target).length) throw new Error("pantauan Telegram butuh nama kanal publik");
  if (t.platform === "tiktok" && t.kind === "post" && !tiktokVideo(t.target)) throw new Error("pantauan TikTok butuh URL atau ID video");
  if (t.platform === "instagram" && t.kind === "post" && !shortcode(t.target)) throw new Error("pantauan Instagram butuh URL post atau reel");
  if (t.platform === "instagram" && t.kind === "account" && !igUser(t.target)) throw new Error("pantauan Instagram butuh nama akun");
  if (t.platform === "instagram" && t.kind === "topic" && !t.target.replace(/^#/, "").trim()) throw new Error("pantauan Instagram butuh tagar");
  if (t.platform === "facebook" && t.kind !== "topic" && !facebookUrl(t.target)) throw new Error("pantauan Facebook butuh URL atau nama Page");
}

const cache = <T>() => {
  const m = new Map<string, Promise<T>>();
  return (key: string, make: () => Promise<T>) => {
    let p = m.get(key);
    if (!p) {
      p = make().catch((e) => {
        m.delete(key);
        throw e;
      });
      m.set(key, p);
    }
    return p;
  };
};

export function createCollector(o: { pool: CredentialPool; tiktok?: SidecarConfig; browser?: BrowserConfig; cooldownMs?: number }) {
  const rate = { remaining: null as number | null, reset: null as number | null };
  const xs = cache<Awaited<ReturnType<typeof createXCollector>>>();
  const yts = cache<Awaited<ReturnType<typeof createYoutubeCollector>>>();
  let tt: ReturnType<typeof createTiktokCollector> | undefined;

  async function rotating<T>(platform: Platform, run: (lease: Lease) => Promise<{ value: T; limitedUntil?: number }>): Promise<T> {
    const tried: string[] = [];
    const reproxied = new Set<string>();
    let last: Error | undefined;
    for (;;) {
      const lease = await o.pool.acquire(platform, tried);
      if (!lease) break;
      tried.push(lease.id);
      try {
        const { value, limitedUntil } = await run(lease);
        if (limitedUntil) {
          o.pool.limited(lease.id, limitedUntil);
          last = new Error("terkena batas laju");
          continue;
        }
        o.pool.ok(lease.id);
        return value;
      } catch (e) {
        last = e instanceof Error ? e : new Error(String(e));
        if (lease.proxy && NETWORK.test(last.message)) {
          o.pool.proxyFailed(lease.proxy.id, last.message, lease.id);
          if (!reproxied.has(lease.id)) {
            reproxied.add(lease.id);
            tried.pop();
          }
        } else o.pool.failed(lease.id, last.message);
      }
    }
    throw last ?? new Error(`tidak ada kredensial ${platform} yang siap`);
  }

  const youtube = async (run: (c: Awaited<ReturnType<typeof createYoutubeCollector>>) => Promise<Dataset>) =>
    o.pool.count("youtube") ? rotating("youtube", async (l) => ({ value: await run(await yts(`${l.id}:${l.proxy?.id ?? ""}`, () => createYoutubeCollector(l.fields.cookie, l.proxy?.url))) })) : run(await yts("anonymous", () => createYoutubeCollector()));

  const x = (run: (c: Awaited<ReturnType<typeof createXCollector>>) => Promise<Dataset>) =>
    rotating("x", async (l) => {
      const c = await xs(`${l.id}:${l.proxy?.id ?? ""}`, () => createXCollector({ authToken: l.fields.authToken, ct0: l.fields.ct0, userAgent: l.fields.userAgent || "Mozilla/5.0", proxy: l.proxy?.url }));
      const value = await run(c);
      Object.assign(rate, c.rate);
      const until = c.rate.reset && c.rate.reset > Date.now() ? c.rate.reset : Date.now() + 15 * 60_000;
      if (value.meta?.coverage === 0) return { value, limitedUntil: until };
      if (c.rate.remaining === 0) o.pool.limited(l.id, until);
      return { value };
    });

  const tiktok = (run: (c: ReturnType<typeof createTiktokCollector>, identity?: string) => Promise<Dataset>) => {
    if (!o.tiktok) throw new Error("sidecar TikTok belum dikonfigurasi");
    const c = (tt ??= createTiktokCollector(o.tiktok));
    if (!o.pool.count("tiktok")) return run(c);
    return rotating("tiktok", async (l) => {
      let identity = o.pool.identity(l.id);
      if (!identity) {
        identity = await c.importIdentity(l.fields.cookie, l.fields.userAgent);
        o.pool.setIdentity(l.id, identity);
      }
      return { value: await run(c, identity) };
    });
  };

  const meta = (platform: "instagram" | "facebook", run: (s: Session) => Promise<Dataset>) => {
    if (!o.browser) throw new Error("browser belum dikonfigurasi");
    return rotating(platform, async (l) => {
      try {
        return { value: await run(session(l.fields, l.proxy?.url)) };
      } catch (e) {
        if (e instanceof Limited) return { value: undefined as unknown as Dataset, limitedUntil: Date.now() + (o.cooldownMs ?? 30 * 60_000) };
        throw e;
      }
    });
  };
  const ig = o.browser ? createInstagramCollector(o.browser) : undefined;
  const fb = o.browser ? createFacebookCollector(o.browser) : undefined;

  return {
    rate,
    tiktok: !!o.tiktok,
    meta: !!o.browser,
    async collect(t: Target): Promise<Dataset> {
      validate(t);
      if (t.platform === "youtube") return youtube((c) => (t.kind === "post" ? c.video(videoId(t.target)!, { pages: t.pages }) : c.search(t.target, { videos: t.pages, pages: 2 })));
      if (t.platform === "telegram") return collectTelegram(channels(t.target), t.pages);
      if (t.platform === "instagram")
        return meta("instagram", (s) => (t.kind === "post" ? ig!.post(s, shortcode(t.target)!, { pages: t.pages }) : t.kind === "account" ? ig!.account(s, igUser(t.target)!, { pages: t.pages }) : ig!.tag(s, t.target, { pages: t.pages })));
      if (t.platform === "facebook")
        return meta("facebook", (s) => (t.kind === "post" ? fb!.post(s, t.target, { pages: t.pages }) : t.kind === "account" ? fb!.page(s, t.target, { pages: t.pages }) : fb!.search(s, t.target, { pages: t.pages })));
      if (t.platform === "tiktok") return tiktok((c, identity) => (t.kind === "post" ? c.video(tiktokVideo(t.target)!, { pages: t.pages, identity }) : c.search(t.target, { videos: t.pages, pages: 2, identity })));
      return x(async (c) => {
        if (t.kind !== "post") return c.search(xQuery(t.kind, t.target), { pages: t.pages, lang: t.kind === "topic" ? "in" : undefined });
        const id = xQuery(t.kind, t.target).replace("conversation_id:", "");
        const ds = await c.conversation(id, { pages: t.pages });
        const known = new Set(ds.actors.map((a) => a.id));
        const profiles = (await c.retweeters(id).catch(() => [])).filter((a) => !known.has(a.id));
        return { ...ds, actors: [...ds.actors, ...profiles] };
      });
    },
  };
}
