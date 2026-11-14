import type { Dataset } from "cakranala";
import { createXCollector, type Profile } from "./x";
import { createYoutubeCollector } from "./youtube";
import { collectTelegram } from "./telegram";
import { createTiktokCollector, tiktokAccount, type SidecarConfig } from "./tiktok";

export { createXCollector, sessionFromEnv, type XSession, type XRateState, type Profile } from "./x";
export { createYoutubeCollector } from "./youtube";
export { collectTelegram } from "./telegram";
export { createTiktokCollector, sidecarFromEnv, type SidecarConfig } from "./tiktok";

export type Platform = "x" | "youtube" | "telegram" | "tiktok";
export type Kind = "topic" | "account" | "post";

export const PLATFORM_KINDS: Record<Platform, Kind[]> = { x: ["topic", "account", "post"], youtube: ["topic", "post"], telegram: ["account"], tiktok: ["topic", "post"] };

export const CREDENTIAL_FIELDS: Record<Exclude<Platform, "telegram">, { fields: string[]; required: string[] }> = {
  x: { fields: ["authToken", "ct0", "userAgent"], required: ["authToken", "ct0"] },
  youtube: { fields: ["cookie"], required: ["cookie"] },
  tiktok: { fields: ["cookie", "userAgent"], required: ["cookie", "userAgent"] },
};

export interface Probe {
  ok: boolean;
  profile?: Profile & { signedIn?: boolean };
  error?: string;
}

export async function probe(platform: Platform, fields: Record<string, string>, tiktok?: SidecarConfig): Promise<Probe> {
  try {
    if (platform === "x") return { ok: true, profile: await (await createXCollector({ authToken: fields.authToken, ct0: fields.ct0, userAgent: fields.userAgent || "Mozilla/5.0" })).me() };
    if (platform === "youtube") return { ok: true, profile: await (await createYoutubeCollector(fields.cookie)).me() };
    if (platform === "tiktok") {
      if (!tiktok) throw new Error("TikTok sidecar is not configured");
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
}

export interface CredentialPool {
  count(platform: Platform): number;
  acquire(platform: Platform, exclude: string[]): Promise<Lease | undefined>;
  ok(id: string): void;
  limited(id: string, until: number): void;
  failed(id: string, error: string): void;
  identity(id: string): string | undefined;
  setIdentity(id: string, identity: string): void;
}

const videoId = (t: string) => t.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1] ?? t.match(/^[\w-]{11}$/)?.[0];
const tiktokVideo = (t: string) => t.match(/video\/(\d{8,})/)?.[1] ?? t.match(/^\d{8,}$/)?.[0];
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
    if (!id) throw new Error("post monitor needs a post URL or ID");
    return `conversation_id:${id}`;
  }
  return t;
}

export function validate(t: Pick<Target, "platform" | "kind" | "target">) {
  if (!PLATFORM_KINDS[t.platform]?.includes(t.kind)) throw new Error(`${t.platform} does not support ${t.kind} monitors`);
  if (t.platform === "x") xQuery(t.kind, t.target);
  if (t.platform === "youtube" && t.kind === "post" && !videoId(t.target)) throw new Error("YouTube monitor needs a video URL or ID");
  if (t.platform === "telegram" && !channels(t.target).length) throw new Error("Telegram monitor needs public channel names");
  if (t.platform === "tiktok" && t.kind === "post" && !tiktokVideo(t.target)) throw new Error("TikTok monitor needs a video URL or ID");
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

export function createCollector(o: { pool: CredentialPool; tiktok?: SidecarConfig }) {
  const rate = { remaining: null as number | null, reset: null as number | null };
  const xs = cache<Awaited<ReturnType<typeof createXCollector>>>();
  const yts = cache<Awaited<ReturnType<typeof createYoutubeCollector>>>();
  let tt: ReturnType<typeof createTiktokCollector> | undefined;

  async function rotating<T>(platform: Platform, run: (lease: Lease) => Promise<{ value: T; limitedUntil?: number }>): Promise<T> {
    const tried: string[] = [];
    let last: Error | undefined;
    for (;;) {
      const lease = await o.pool.acquire(platform, tried);
      if (!lease) break;
      tried.push(lease.id);
      try {
        const { value, limitedUntil } = await run(lease);
        if (limitedUntil) {
          o.pool.limited(lease.id, limitedUntil);
          last = new Error("rate limited");
          continue;
        }
        o.pool.ok(lease.id);
        return value;
      } catch (e) {
        last = e instanceof Error ? e : new Error(String(e));
        o.pool.failed(lease.id, last.message);
      }
    }
    throw last ?? new Error(`no ${platform} credential available`);
  }

  const youtube = async (run: (c: Awaited<ReturnType<typeof createYoutubeCollector>>) => Promise<Dataset>) =>
    o.pool.count("youtube") ? rotating("youtube", async (l) => ({ value: await run(await yts(l.id, () => createYoutubeCollector(l.fields.cookie))) })) : run(await yts("anonymous", () => createYoutubeCollector()));

  const x = (run: (c: Awaited<ReturnType<typeof createXCollector>>) => Promise<Dataset>) =>
    rotating("x", async (l) => {
      const c = await xs(l.id, () => createXCollector({ authToken: l.fields.authToken, ct0: l.fields.ct0, userAgent: l.fields.userAgent || "Mozilla/5.0" }));
      const value = await run(c);
      Object.assign(rate, c.rate);
      const until = c.rate.reset && c.rate.reset > Date.now() ? c.rate.reset : Date.now() + 15 * 60_000;
      if (value.meta?.coverage === 0) return { value, limitedUntil: until };
      if (c.rate.remaining === 0) o.pool.limited(l.id, until);
      return { value };
    });

  const tiktok = (run: (c: ReturnType<typeof createTiktokCollector>, identity?: string) => Promise<Dataset>) => {
    if (!o.tiktok) throw new Error("TikTok sidecar is not configured");
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

  return {
    rate,
    tiktok: !!o.tiktok,
    async collect(t: Target): Promise<Dataset> {
      validate(t);
      if (t.platform === "youtube") return youtube((c) => (t.kind === "post" ? c.video(videoId(t.target)!, { pages: t.pages }) : c.search(t.target, { videos: t.pages, pages: 2 })));
      if (t.platform === "telegram") return collectTelegram(channels(t.target), t.pages);
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
