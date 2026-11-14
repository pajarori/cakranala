import { Innertube } from "youtubei.js";
import { SCHEMA_VERSION, type Actor, type Dataset, type Event } from "cakranala";

const UNITS: Record<string, number> = { second: 1e3, minute: 6e4, hour: 3.6e6, day: 8.64e7, week: 6.048e8, month: 2.592e9, year: 3.1536e10 };

const relative = (text: string, now: number) => {
  const m = text.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/i);
  return m ? now - Number(m[1]) * UNITS[m[2].toLowerCase()] : now;
};

export interface YoutubeOptions {
  videos?: number;
  pages?: number;
}

export async function createYoutubeCollector(cookie?: string) {
  const yt = await Innertube.create({ retrieve_player: false, cookie });

  async function comments(videoId: string, pages: number, now: number, actors: Map<string, Actor>, events: Map<string, Event>) {
    let feed: any;
    for (const sort of ["NEWEST_FIRST", "NEWEST_FIRST", "TOP_COMMENTS"] as const) feed ??= await yt.getComments(videoId, sort).catch(() => undefined);
    for (let p = 0; p < pages && feed; p++) {
      for (const thread of feed.contents ?? []) {
        const c = thread.comment;
        if (!c?.comment_id || !c.author?.id) continue;
        const actor = `yt:${c.author.id}`;
        actors.set(actor, { id: actor, platform: "youtube", handle: c.author.name });
        events.set(`yt:${c.comment_id}`, { id: `yt:${c.comment_id}`, actor, action: "comment", ts: relative(String(c.published_time ?? ""), now), precision: "approx", target: `yt:${videoId}`, text: c.content?.toString() });
      }
      feed = feed.has_continuation ? await feed.getContinuation().catch(() => undefined) : undefined;
    }
  }

  const dataset = (actors: Map<string, Actor>, events: Map<string, Event>, query: string): Dataset => ({
    version: SCHEMA_VERSION,
    actors: [...actors.values()],
    events: [...events.values()].sort((a, b) => a.ts - b.ts),
    meta: { source: "youtube", query, coverage: 1, collectedAt: Date.now() },
  });

  return {
    async me() {
      if (!yt.session.logged_in) throw new Error("cookie is not signed in to YouTube");
      const info: any = await yt.account.getInfo();
      const item = info?.contents?.contents?.[0] ?? info?.contents?.[0];
      const name = item?.account_name?.toString() ?? "";
      const handle = item?.channel_handle?.toString() ?? name;
      if (!handle) throw new Error("YouTube account details are not available");
      return { id: `yt:${handle}`, handle, name };
    },
    async search(query: string, o: YoutubeOptions = {}) {
      const now = Date.now();
      const actors = new Map<string, Actor>();
      const events = new Map<string, Event>();
      const found: any = await yt.search(query, { type: "video", upload_date: "week", prioritize: "popularity" });
      for (const v of (found.videos ?? []).slice(0, o.videos ?? 3)) {
        const id = v.id ?? v.video_id;
        if (id) await comments(id, o.pages ?? 2, now, actors, events).catch(() => undefined);
      }
      return dataset(actors, events, query);
    },
    async video(id: string, o: YoutubeOptions = {}) {
      const actors = new Map<string, Actor>();
      const events = new Map<string, Event>();
      await comments(id, o.pages ?? 3, Date.now(), actors, events);
      return dataset(actors, events, id);
    },
  };
}
