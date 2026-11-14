import { SCHEMA_VERSION, type Actor, type Dataset, type Event } from "cakranala";

export interface SidecarConfig {
  baseUrl: string;
  username: string;
  password: string;
}

interface Author {
  uid: string;
  unique_id?: string | null;
  nickname?: string;
}

interface Content {
  content_id: string;
  description?: string;
  title?: string;
  created_at?: string | null;
  author: Author;
  tags?: string[];
}

interface Comment {
  comment_id: string;
  content_id: string;
  parent_id?: string | null;
  text: string;
  created_at?: string | null;
  author: Author;
}

interface Page<T> {
  items: T[];
  cursor?: string | null;
  has_more?: boolean;
}

const TIMEOUT = 60_000;

export function sidecarFromEnv(env: Record<string, string | undefined> = process.env): SidecarConfig | undefined {
  if (!env.TIKTOK_SIDECAR_URL || !env.TIKTOK_SIDECAR_PASSWORD) return undefined;
  return { baseUrl: env.TIKTOK_SIDECAR_URL.replace(/\/$/, ""), username: env.TIKTOK_SIDECAR_USER ?? "cakranala", password: env.TIKTOK_SIDECAR_PASSWORD };
}

export function createTiktokCollector(config: SidecarConfig) {
  let session: string | undefined;

  async function login() {
    const res = await fetch(`${config.baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: config.username, password: config.password }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("dtk_session="));
    if (!res.ok || !cookie) throw new Error(`tiktok sidecar login failed with ${res.status}`);
    session = cookie.split(";")[0];
  }

  async function call<T>(method: string, path: string, params: Record<string, string | number | undefined> = {}, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 6; attempt++) {
      if (!session) await login();
      const qs = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])));
      const res = await fetch(`${config.baseUrl}${path}${qs.size ? `?${qs}` : ""}`, {
        method,
        headers: { cookie: session!, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.status === 401) {
        session = undefined;
        continue;
      }
      const json: any = await res.json().catch(() => ({}));
      if (json.success) {
        const data = json.data;
        if (data?.task_id && !("items" in data) && !("id" in data)) return task<T>(data.task_id);
        return data as T;
      }
      const retry = json.error?.retry_after;
      if (retry && attempt < 5) {
        await Bun.sleep(Math.min(30, Number(retry)) * 1000);
        continue;
      }
      throw new Error(`tiktok ${json.error?.code ?? res.status}: ${json.error?.message ?? "request failed"}`);
    }
    throw new Error("tiktok sidecar request failed after retries");
  }

  async function task<T>(id: string): Promise<T> {
    for (let i = 0; i < 20; i++) {
      const t: any = await call("GET", `/api/v1/tasks/${id}`);
      if (t?.state === "succeeded" || t?.state === "completed" || t?.result) return (t.result ?? t) as T;
      if (t?.state === "failed") throw new Error(`tiktok task failed: ${t.error?.message ?? id}`);
      await Bun.sleep(3000);
    }
    throw new Error("tiktok task timed out");
  }

  const actorOf = (a: Author, actors: Map<string, Actor>) => {
    const id = `tt:${a.uid}`;
    actors.set(id, { id, platform: "tiktok", handle: a.unique_id ?? a.nickname });
    return id;
  };

  async function comments(contentId: string, pages: number, identity: string | undefined, actors: Map<string, Actor>, events: Map<string, Event>) {
    let cursor: string | undefined;
    for (let p = 0; p < pages; p++) {
      const page = await call<Page<Comment>>("GET", "/api/v1/tiktok/video/comments", { aweme_id: contentId, cursor, count: 50, wait: 30, identity });
      for (const c of page.items ?? []) {
        if (!c.created_at) continue;
        events.set(`tt:${c.comment_id}`, { id: `tt:${c.comment_id}`, actor: actorOf(c.author, actors), action: c.parent_id ? "reply" : "comment", ts: Date.parse(c.created_at), precision: "s", target: c.parent_id ? `tt:${c.parent_id}` : `tt:${contentId}`, text: c.text });
      }
      if (!page.has_more || !page.cursor) break;
      cursor = page.cursor;
    }
  }

  const dataset = (actors: Map<string, Actor>, events: Map<string, Event>, query: string): Dataset => ({
    version: SCHEMA_VERSION,
    actors: [...actors.values()],
    events: [...events.values()].sort((a, b) => a.ts - b.ts),
    meta: { source: "tiktok", query, coverage: 1, collectedAt: Date.now() },
  });

  return {
    async check(cookies: string, userAgent?: string) {
      const r = await call<{ report: { authenticated?: boolean; usable?: boolean; missing_required?: string[]; browser_family?: string | null; warnings?: string[]; warning_codes?: string[] } }>("POST", "/api/v1/admin/identities/import", {}, { platform: "tiktok", cookies, user_agent: userAgent, dry_run: true });
      const rep = r.report;
      if (rep.missing_required?.length) throw new Error(`missing cookies: ${rep.missing_required.join(", ")}`);
      if (rep.usable === false) throw new Error(rep.warning_codes?.includes("unknown_browser") ? "add the exact User-Agent of the browser this cookie was copied from" : "the sidecar cannot use this cookie set");
      return { authenticated: !!rep.authenticated, browser: rep.browser_family ?? undefined };
    },
    async importIdentity(cookies: string, userAgent?: string) {
      const r = await call<{ identity_id?: string }>("POST", "/api/v1/admin/identities/import", {}, { platform: "tiktok", cookies, user_agent: userAgent, note: "cakranala vault" });
      if (!r.identity_id) throw new Error("tiktok sidecar did not store the identity");
      return r.identity_id;
    },
    async search(keyword: string, o: { videos?: number; pages?: number; identity?: string } = {}) {
      const actors = new Map<string, Actor>();
      const events = new Map<string, Event>();
      const page = await call<Page<Content>>("GET", "/api/v1/tiktok/search/posts", { keyword, count: 20, wait: 30, identity: o.identity });
      for (const v of page.items ?? []) {
        if (v.created_at) events.set(`tt:${v.content_id}`, { id: `tt:${v.content_id}`, actor: actorOf(v.author, actors), action: "post", ts: Date.parse(v.created_at), precision: "s", text: v.description ?? v.title, tags: v.tags });
      }
      for (const v of (page.items ?? []).slice(0, o.videos ?? 3)) await comments(v.content_id, o.pages ?? 2, o.identity, actors, events);
      return dataset(actors, events, keyword);
    },
    async video(contentId: string, o: { pages?: number; identity?: string } = {}) {
      const actors = new Map<string, Actor>();
      const events = new Map<string, Event>();
      await comments(contentId, o.pages ?? 3, o.identity, actors, events);
      return dataset(actors, events, contentId);
    },
  };
}
