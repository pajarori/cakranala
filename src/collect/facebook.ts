import { SCHEMA_VERSION, type Actor, type Dataset, type Event } from "../engine";
import type { Page } from "puppeteer-core";
import { Checkpoint, find, go, pause, parseJson, signedOut, walk, withPage, type Session } from "./browser";

const ORIGIN = "https://www.facebook.com";
const GAP = 3_000;

const tagsOf = (text: string) => [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase());
const urlsOf = (text: string) => [...text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);

export const facebookUrl = (t: string) => {
  const s = t.trim();
  if (/^https?:\/\/(www\.|m\.|web\.)?facebook\.com\//.test(s)) return s.replace(/^https?:\/\/(m|web)\./, "https://www.");
  if (/^[\w.]{3,}$/.test(s)) return `${ORIGIN}/${s}`;
  return undefined;
};

function handleOf(a: { name?: string; url?: string; profile_url?: string }) {
  const url = a.url ?? a.profile_url;
  const path = url ? new URL(url, ORIGIN).pathname.split("/").filter(Boolean)[0] : undefined;
  return path && path !== "profile.php" && path !== "people" ? `@${path}` : (a.name ?? undefined);
}

function collector() {
  const actors = new Map<string, Actor>();
  const events = new Map<string, Event>();
  const feedbackPost = new Map<string, string>();
  const urls = new Map<string, string>();

  const actor = (a: { id: string; name?: string; url?: string; profile_url?: string }) => {
    const id = `fb:${a.id}`;
    if (!actors.has(id)) actors.set(id, { id, platform: "facebook", handle: handleOf(a) });
    return id;
  };

  const story = (o: Record<string, any>) => {
    const id = `fb:${o.post_id}`;
    const author = find(o, (x) => (Array.isArray(x.actors) && x.actors[0]?.id ? (x.actors[0] as { id: string; name?: string; url?: string }) : undefined));
    const ts = find(o, (x) => (typeof x.creation_time === "number" ? x.creation_time : undefined));
    const feedback = find(o, (x) => (x.feedback && typeof x.feedback.id === "string" ? (x.feedback.id as string) : undefined));
    if (feedback) feedbackPost.set(feedback, id);
    const link = find(o, (x) => (typeof x.wwwURL === "string" ? (x.wwwURL as string) : undefined));
    if (link) urls.set(id, link);
    if (!author || !ts || events.get(id)?.text) return;
    const text = find(o, (x) => (x.message && typeof x.message.text === "string" ? (x.message.text as string) : undefined)) ?? "";
    const shared = o.attached_story?.post_id as string | undefined;
    events.set(id, {
      id,
      actor: actor(author),
      action: shared ? "reshare" : "post",
      ts: ts * 1000,
      precision: "s",
      target: shared ? `fb:${shared}` : undefined,
      text: text || undefined,
      tags: tagsOf(text),
      urls: urlsOf(text),
    });
  };

  const comment = (o: Record<string, any>, fallback?: string) => {
    const text: string | undefined = o.body?.text ?? o.preferred_body?.text;
    const ts = o.created_time;
    if (typeof text !== "string" || typeof ts !== "number" || !o.author?.id) return;
    const id = `fb:${o.id}`;
    const parent = o.comment_parent?.id as string | undefined;
    const target = parent ? `fb:${parent}` : (feedbackPost.get(o.parent_feedback?.id) ?? fallback);
    events.set(id, { id, actor: actor(o.author), action: parent ? "reply" : "comment", ts: ts * 1000, precision: "s", target, text, tags: tagsOf(text), urls: urlsOf(text) });
  };

  const harvest = (roots: unknown[], fallback?: string) => {
    const nodes = roots.flatMap((r) => [...walk(r)]);
    for (const o of nodes) if (o.__typename === "Story" && typeof o.post_id === "string") story(o);
    for (const o of nodes) if (o.__typename === "Comment") comment(o, fallback);
  };

  const dataset = (query: string): Dataset => ({ version: SCHEMA_VERSION, actors: [...actors.values()], events: [...events.values()], meta: { source: "facebook", query, collectedAt: Date.now() } });
  const posts = () => [...events.values()].filter((e) => e.action === "post" || e.action === "reshare").map((e) => ({ id: e.id, url: urls.get(e.id) }));
  return { harvest, dataset, posts };
}

async function visit(page: Page, url: string, scrolls: number, captured: unknown[]) {
  captured.length = 0;
  await go(page, url);
  if (signedOut(page.url())) throw new Checkpoint("sesi Facebook perlu verifikasi atau login ulang");
  await pause(GAP);
  for (let i = 0; i < scrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await pause(GAP);
  }
  const ssr = await page.$$eval('script[type="application/json"]', (els) => els.map((e) => e.textContent ?? ""));
  return [...ssr.flatMap(parseJson), ...captured];
}

async function deep(page: Page, captured: unknown[], add: ReturnType<typeof collector>) {
  for (const p of add.posts()) {
    if (!p.url) continue;
    add.harvest(await visit(page, p.url, 1, captured), p.id);
  }
}

export function createFacebookCollector() {
  const run = <T>(session: Session, fn: (page: Page, captured: unknown[]) => Promise<T>) => withPage(session, ".facebook.com", fn);

  return {
    me: (session: Session) =>
      run(session, async (page) => {
        await go(page, `${ORIGIN}/me`);
        if (signedOut(page.url())) throw new Checkpoint("sesi Facebook perlu verifikasi atau login ulang");
        const html = await page.content();
        const id = html.match(/"USER_ID":"(\d+)"/)?.[1];
        if (!id || id === "0") throw new Checkpoint("cookie Facebook tidak masuk ke akun");
        const name = html.match(/"NAME":"((?:[^"\\]|\\.)*)"/)?.[1];
        const path = new URL(page.url()).pathname.split("/").filter(Boolean)[0];
        return { id: `fb:${id}`, handle: path && path !== "profile.php" ? `@${path}` : (name ? JSON.parse(`"${name}"`) : id), name: name ? JSON.parse(`"${name}"`) : "" };
      }),

    page: (session: Session, target: string, o: { pages: number }) =>
      run(session, async (page, captured) => {
        const url = facebookUrl(target);
        if (!url) throw new Error("pantauan Facebook butuh URL atau nama Page");
        const add = collector();
        add.harvest(await visit(page, url, o.pages, captured));
        await deep(page, captured, add);
        return add.dataset(url);
      }),

    post: (session: Session, target: string, o: { pages: number }) =>
      run(session, async (page, captured) => {
        const url = facebookUrl(target);
        if (!url) throw new Error("pantauan Facebook butuh URL post");
        const add = collector();
        const roots = await visit(page, url, o.pages, captured);
        add.harvest(roots);
        add.harvest(roots, add.posts()[0]?.id);
        return add.dataset(url);
      }),

    search: (session: Session, query: string, o: { pages: number }) =>
      run(session, async (page, captured) => {
        const add = collector();
        add.harvest(await visit(page, `${ORIGIN}/search/posts/?q=${encodeURIComponent(query)}`, o.pages, captured));
        await deep(page, captured, add);
        return add.dataset(query);
      }),
  };
}
