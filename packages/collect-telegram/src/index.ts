import { SCHEMA_VERSION, type Actor, type Dataset, type Event } from "cakranala";

interface Post {
  post: string;
  text: string;
  ts: number;
  forwarded?: string;
  urls: string[];
}

const channelOf = (href: string) => href.match(/t\.me\/(?:s\/)?([A-Za-z0-9_]{4,})/)?.[1]?.toLowerCase();

async function page(channel: string, before?: number): Promise<Post[]> {
  const res = await fetch(`https://t.me/s/${channel}${before ? `?before=${before}` : ""}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`telegram ${channel} ${res.status}`);
  const posts: Post[] = [];
  let current: Post | undefined;
  let depth = 0;
  await new HTMLRewriter()
    .on("div.tgme_widget_message[data-post]", {
      element(el) {
        current = { post: el.getAttribute("data-post")!, text: "", ts: 0, urls: [] };
        posts.push(current);
      },
    })
    .on("div.tgme_widget_message_text", {
      element(el) {
        depth++;
        el.onEndTag(() => void depth--);
      },
      text(t) {
        if (current && depth > 0) current.text += t.text;
      },
    })
    .on("div.tgme_widget_message_text a[href]", {
      element(el) {
        const href = el.getAttribute("href");
        if (current && href?.startsWith("http")) current.urls.push(href);
      },
    })
    .on("div.tgme_widget_message_text br", {
      element() {
        if (current) current.text += "\n";
      },
    })
    .on(".tgme_widget_message_forwarded_from_name", {
      element(el) {
        const href = el.getAttribute("href");
        if (current && href) current.forwarded = channelOf(href);
      },
    })
    .on("a.tgme_widget_message_date time[datetime]", {
      element(el) {
        if (current) current.ts = Date.parse(el.getAttribute("datetime")!);
      },
    })
    .transform(res)
    .text();
  return posts.filter((p) => p.ts);
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");

export async function collectTelegram(channels: string[], pages = 1): Promise<Dataset> {
  const actors = new Map<string, Actor>();
  const events = new Map<string, Event>();
  for (const raw of channels) {
    const channel = raw.replace(/^@/, "").toLowerCase();
    let before: number | undefined;
    for (let p = 0; p < pages; p++) {
      const posts = await page(channel, before);
      if (!posts.length) break;
      for (const post of posts) {
        const [owner, num] = post.post.split("/");
        const actor = `tg:${owner.toLowerCase()}`;
        const text = decode(post.text).trim();
        actors.set(actor, { id: actor, platform: "telegram", handle: owner });
        events.set(`tg:${post.post}`, {
          id: `tg:${post.post}`,
          actor,
          action: post.forwarded ? "reshare" : "post",
          ts: post.ts,
          precision: "s",
          target: post.forwarded ? `tg:${post.forwarded}` : undefined,
          text: text || undefined,
          tags: [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase()),
          urls: post.urls,
        });
        before = before === undefined ? Number(num) : Math.min(before, Number(num));
      }
      await Bun.sleep(1500);
    }
  }
  return { version: SCHEMA_VERSION, actors: [...actors.values()], events: [...events.values()].sort((a, b) => a.ts - b.ts), meta: { source: "telegram", query: channels.join(" "), coverage: 1, collectedAt: Date.now() } };
}
