import { SCHEMA_VERSION, type Actor, type Dataset, type Event } from "../engine";
import type { Page } from "puppeteer-core";
import { Checkpoint, Limited, go, pause, parseJson, signedOut, walk, withPage, type Session } from "./browser";

const ORIGIN = "https://www.instagram.com";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const GAP = 3_000;

interface User {
  pk?: string | number;
  id?: string;
  username: string;
  full_name?: string;
  follower_count?: number;
}

export const shortcode = (t: string) => t.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/)?.[1] ?? t.match(/^[\w-]{10,12}$/)?.[0];

export const mediaPk = (code: string) => [...code.slice(0, 11)].reduce((n, c) => n * 64n + BigInt(ALPHABET.indexOf(c)), 0n).toString();

const tagsOf = (text: string) => [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase());
const urlsOf = (text: string) => [...text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
const userId = (u: User) => String(u.pk ?? u.id);

async function visit(page: Page, path: string, scrolls: number, captured: unknown[]) {
  captured.length = 0;
  const res = await go(page, `${ORIGIN}${path}`);
  if (res.status() === 429) throw new Limited("Instagram membatasi laju permintaan");
  if (signedOut(page.url())) throw new Checkpoint("sesi Instagram perlu verifikasi atau login ulang");
  await pause(GAP);
  for (let i = 0; i < scrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await pause(GAP);
  }
  const html = await page.content();
  if (/class="[^"]*not-logged-in/.test(html)) throw new Checkpoint("sesi Instagram tidak masuk ke akun");
  if (/Please wait a few minutes/i.test(html)) throw new Limited("Instagram membatasi laju permintaan");
  const ssr = await page.$$eval('script[type="application/json"]', (els) => els.map((e) => e.textContent ?? ""));
  return [...ssr.flatMap(parseJson), ...captured];
}

function collector() {
  const actors = new Map<string, Actor>();
  const events = new Map<string, Event>();
  const codes = new Map<string, string>();
  const counts = new Map<string, number>();

  const actor = (u: User) => {
    const id = `ig:${userId(u)}`;
    const prev = actors.get(id);
    actors.set(id, { ...prev, id, platform: "instagram", handle: `@${u.username}`, followers: u.follower_count ?? prev?.followers });
    return id;
  };

  const harvest = (roots: unknown[], context?: string) => {
    const nodes = roots.flatMap((r) => [...walk(r)]);
    const captions = new Set<unknown>();
    for (const o of nodes) {
      if (typeof o.code !== "string" || typeof o.taken_at !== "number" || !o.user?.username) continue;
      const id = `ig:${String(o.pk ?? String(o.id).split("_")[0])}`;
      if (o.caption) captions.add(o.caption);
      codes.set(id, o.code);
      if (typeof o.comment_count === "number") counts.set(id, o.comment_count);
      const text: string = o.caption?.text ?? "";
      if (!events.get(id)?.text) events.set(id, { id, actor: actor(o.user), action: "post", ts: o.taken_at * 1000, precision: "s", text: text || undefined, tags: tagsOf(text), urls: urlsOf(text) });
    }
    for (const o of nodes) {
      if (captions.has(o) || typeof o.code === "string" || typeof o.text !== "string" || typeof o.created_at !== "number" || !o.user?.username || (o.pk ?? o.id) === undefined) continue;
      const parent = o.parent_comment_id ? `ig:${o.parent_comment_id}` : undefined;
      const target = parent ?? (o.media_id ? `ig:${String(o.media_id).split("_")[0]}` : context);
      const id = `ig:${o.pk ?? o.id}`;
      events.set(id, { id, actor: actor(o.user), action: parent ? "reply" : "comment", ts: o.created_at * 1000, precision: "s", target, text: o.text, tags: tagsOf(o.text), urls: urlsOf(o.text) });
    }
  };

  const posts = () => [...codes.entries()].filter(([id]) => (counts.get(id) ?? 1) > 0).map(([id, code]) => ({ id, code }));
  const dataset = (query: string): Dataset => ({ version: SCHEMA_VERSION, actors: [...actors.values()], events: [...events.values()], meta: { source: "instagram", query, collectedAt: Date.now() } });
  return { harvest, posts, dataset };
}

async function comments(page: Page, captured: unknown[], add: ReturnType<typeof collector>) {
  for (const p of add.posts()) add.harvest(await visit(page, `/p/${p.code}/`, 1, captured), p.id);
}

export function createInstagramCollector() {
  const run = <T>(session: Session, fn: (page: Page, captured: unknown[]) => Promise<T>) => withPage(session, ".instagram.com", fn);

  return {
    me: (session: Session) =>
      run(session, async (page, captured) => {
        const roots = await visit(page, "/", 0, captured);
        const id = (await page.cookies()).find((c) => c.name === "ds_user_id")?.value;
        if (!id) throw new Checkpoint("cookie Instagram tidak masuk ke akun");
        let viewer = roots.flatMap((r) => [...walk(r)]).find((o) => String(o.pk ?? o.id) === id && typeof o.username === "string") as User | undefined;
        if (!viewer) {
          const html = await page.content();
          const username = html.match(new RegExp(`"(?:pk|id)":"${id}"[^}]{0,400}?"username":"([\\w.]+)"`))?.[1] ?? html.match(new RegExp(`"username":"([\\w.]+)"[^}]{0,400}?"(?:pk|id)":"${id}"`))?.[1];
          if (username) viewer = { pk: id, username };
        }
        return { id: `ig:${id}`, handle: viewer ? `@${viewer.username}` : `ig:${id}`, name: viewer?.full_name ?? "" };
      }),

    account: (session: Session, username: string, o: { pages: number }) =>
      run(session, async (page, captured) => {
        const add = collector();
        add.harvest(await visit(page, `/${encodeURIComponent(username)}/`, o.pages, captured));
        await comments(page, captured, add);
        return add.dataset(`@${username}`);
      }),

    post: (session: Session, code: string, o: { pages: number }) =>
      run(session, async (page, captured) => {
        const add = collector();
        add.harvest(await visit(page, `/p/${code}/`, o.pages, captured), `ig:${mediaPk(code)}`);
        return add.dataset(code);
      }),

    tag: (session: Session, tag: string, o: { pages: number }) =>
      run(session, async (page, captured) => {
        const add = collector();
        const name = tag.replace(/^#/, "").trim().toLowerCase();
        add.harvest(await visit(page, `/explore/tags/${encodeURIComponent(name)}/`, o.pages, captured));
        await comments(page, captured, add);
        return add.dataset(`#${name}`);
      }),
  };
}
