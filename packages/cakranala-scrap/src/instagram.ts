import { SCHEMA_VERSION, type Actor, type Dataset, type Event } from "cakranala";
import type { Page } from "puppeteer-core";
import { Checkpoint, Limited, pause, signedOut, withPage, type BrowserConfig, type Session } from "./browser";

const ORIGIN = "https://www.instagram.com";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const GAP = 2_500;

interface User {
  pk?: string | number;
  id?: string;
  username: string;
  full_name?: string;
  follower_count?: number;
}

interface Media {
  pk: string | number;
  code?: string;
  taken_at: number;
  caption?: { text?: string } | null;
  user: User;
  comment_count?: number;
}

interface Comment {
  pk: string | number;
  text: string;
  created_at: number;
  user: User;
  preview_child_comments?: Comment[];
}

export const shortcode = (t: string) => t.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/)?.[1] ?? t.match(/^[\w-]{10,12}$/)?.[0];

export const mediaPk = (code: string) => [...code.slice(0, 11)].reduce((n, c) => n * 64n + BigInt(ALPHABET.indexOf(c)), 0n).toString();

const tagsOf = (text: string) => [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase());
const urlsOf = (text: string) => [...text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);

async function api<T>(page: Page, path: string, form?: Record<string, string>): Promise<T> {
  const r = await page.evaluate(
    async (path, form) => {
      const app = document.documentElement.innerHTML.match(/"X-IG-App-ID":"(\d+)"/i)?.[1] ?? document.documentElement.innerHTML.match(/"appId":"(\d+)"/)?.[1] ?? "";
      const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
      const res = await fetch(path, {
        method: form ? "POST" : "GET",
        credentials: "include",
        headers: { "x-ig-app-id": app, "x-csrftoken": csrf, "x-requested-with": "XMLHttpRequest", ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
        body: form ? new URLSearchParams(form).toString() : undefined,
      });
      return { status: res.status, url: res.url, body: await res.text() };
    },
    path,
    form,
  );
  if (r.status === 429 || /wait a few minutes/i.test(r.body)) throw new Limited("Instagram membatasi laju permintaan");
  if (signedOut(r.url) || /checkpoint_required|challenge_required|login_required|not-logged-in/.test(r.body)) throw new Checkpoint("sesi Instagram perlu verifikasi atau login ulang");
  if (r.status >= 400) throw new Error(`Instagram ${r.status} untuk ${path.split("?")[0]}`);
  return JSON.parse(r.body) as T;
}

async function open(page: Page) {
  await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (signedOut(page.url())) throw new Checkpoint("sesi Instagram perlu verifikasi atau login ulang");
}

function collector() {
  const actors = new Map<string, Actor>();
  const events = new Map<string, Event>();
  const actor = (u: User) => {
    const id = `ig:${u.pk ?? u.id}`;
    const prev = actors.get(id);
    actors.set(id, { ...prev, id, platform: "instagram", handle: `@${u.username}`, followers: u.follower_count ?? prev?.followers });
    return id;
  };
  const post = (m: Media) => {
    const text = m.caption?.text ?? "";
    const id = `ig:${m.pk}`;
    events.set(id, { id, actor: actor(m.user), action: "post", ts: m.taken_at * 1000, precision: "s", text: text || undefined, tags: tagsOf(text), urls: urlsOf(text) });
    return id;
  };
  const comment = (c: Comment, target: string, action: "comment" | "reply" = "comment") => {
    const id = `ig:${c.pk}`;
    events.set(id, { id, actor: actor(c.user), action, ts: c.created_at * 1000, precision: "s", target, text: c.text, tags: tagsOf(c.text), urls: urlsOf(c.text) });
    for (const child of c.preview_child_comments ?? []) comment(child, id, "reply");
  };
  const dataset = (query: string): Dataset => ({ version: SCHEMA_VERSION, actors: [...actors.values()], events: [...events.values()], meta: { source: "instagram", query, collectedAt: Date.now() } });
  return { actor, post, comment, dataset };
}

async function comments(page: Page, pk: string, target: string, pages: number, add: ReturnType<typeof collector>) {
  let cursor = "";
  for (let i = 0; i < pages; i++) {
    const r = await api<{ comments?: Comment[]; next_min_id?: string; has_more_headload_comments?: boolean }>(
      page,
      `/api/v1/media/${pk}/comments/?can_support_threading=true&permalink_enabled=false${cursor ? `&min_id=${encodeURIComponent(cursor)}` : ""}`,
    );
    for (const c of r.comments ?? []) add.comment(c, target);
    if (!r.next_min_id) break;
    cursor = r.next_min_id;
    await pause(GAP);
  }
}

export function createInstagramCollector(config: BrowserConfig) {
  const run = <T>(session: Session, fn: (page: Page) => Promise<T>) => withPage(config, session, ".instagram.com", async (page) => (await open(page), fn(page)));

  return {
    me: (session: Session) =>
      run(session, async (page) => {
        const r = await api<{ user: User }>(page, "/api/v1/accounts/current_user/?edit=true");
        return { id: `ig:${r.user.pk ?? r.user.id}`, handle: `@${r.user.username}`, name: r.user.full_name ?? "" };
      }),

    account: (session: Session, username: string, o: { pages: number }) =>
      run(session, async (page) => {
        const add = collector();
        const profile = await api<{ data: { user: { id: string; username: string; full_name?: string; edge_followed_by?: { count: number } } } }>(page, `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
        const owner = profile.data.user;
        add.actor({ pk: owner.id, username: owner.username, follower_count: owner.edge_followed_by?.count });
        let cursor = "";
        const posts: Media[] = [];
        for (let i = 0; i < o.pages; i++) {
          const r = await api<{ items?: Media[]; next_max_id?: string; more_available?: boolean }>(page, `/api/v1/feed/user/${owner.id}/?count=12${cursor ? `&max_id=${encodeURIComponent(cursor)}` : ""}`);
          posts.push(...(r.items ?? []));
          if (!r.more_available || !r.next_max_id) break;
          cursor = r.next_max_id;
          await pause(GAP);
        }
        for (const m of posts) {
          const target = add.post(m);
          if (m.comment_count) {
            await pause(GAP);
            await comments(page, String(m.pk), target, 1, add);
          }
        }
        return add.dataset(`@${owner.username}`);
      }),

    post: (session: Session, code: string, o: { pages: number }) =>
      run(session, async (page) => {
        const add = collector();
        const pk = mediaPk(code);
        const info = await api<{ items?: Media[] }>(page, `/api/v1/media/${pk}/info/`);
        const media = info.items?.[0];
        const target = media ? add.post(media) : `ig:${pk}`;
        await comments(page, pk, target, o.pages, add);
        return add.dataset(code);
      }),

    tag: (session: Session, tag: string, o: { pages: number }) =>
      run(session, async (page) => {
        const add = collector();
        const name = tag.replace(/^#/, "").trim().toLowerCase();
        const medias = new Map<string, Media>();
        const take = (x: unknown) => {
          for (const s of (x as { sections?: { layout_content?: { medias?: { media: Media }[] } }[] })?.sections ?? []) for (const m of s.layout_content?.medias ?? []) medias.set(String(m.media.pk), m.media);
        };
        const first = await api<{ data?: { recent?: { sections?: unknown[]; next_max_id?: string; next_page?: number; more_available?: boolean }; top?: unknown } }>(page, `/api/v1/tags/web_info/?tag_name=${encodeURIComponent(name)}`).catch(() => undefined);
        if (first?.data) {
          take(first.data.top);
          take(first.data.recent);
          let next = first.data.recent;
          for (let i = 1; i < o.pages && next?.more_available && next.next_max_id; i++) {
            await pause(GAP);
            next = await api<typeof next>(page, `/api/v1/tags/${encodeURIComponent(name)}/sections/`, { include_persistent: "0", max_id: next.next_max_id, page: String(next.next_page ?? i), surface: "grid", tab: "recent" });
            take(next);
          }
        } else {
          const serp = await api<{ media_grid?: { sections?: unknown[] } }>(page, `/api/v1/fbsearch/web/top_serp/?enable_metadata=true&query=${encodeURIComponent(`#${name}`)}`);
          take(serp.media_grid);
        }
        for (const m of medias.values()) {
          const target = add.post(m);
          if (m.comment_count) {
            await pause(GAP);
            await comments(page, String(m.pk), target, 1, add);
          }
        }
        return add.dataset(`#${name}`);
      }),
  };
}
