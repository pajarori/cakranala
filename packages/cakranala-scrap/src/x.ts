import { ClientTransaction, fetchXDocument } from "x-client-transaction-id";
import { SCHEMA_VERSION, type Actor, type Dataset, type Event } from "cakranala";

export interface XSession {
  authToken: string;
  ct0: string;
  userAgent: string;
  proxy?: string;
}

export interface Profile {
  id: string;
  handle: string;
  name: string;
  followers?: number;
  createdAt?: number;
}

export interface SearchOptions {
  pages?: number;
  since?: string;
  lang?: string;
  delayMs?: [number, number];
  onPage?: (info: { page: number; tweets: number; remaining: number | null }) => void;
}

export interface XRateState {
  remaining: number | null;
  reset: number | null;
}

const snowflakeTime = (id: string) => Number((BigInt(id) >> 22n) + 1288834974657n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TIMEOUT = 20_000;
const get = (url: string, headers: Record<string, string>, proxy?: string) => fetch(url, { headers, proxy, signal: AbortSignal.timeout(TIMEOUT) });

async function discover(s: XSession) {
  const userAgent = s.userAgent;
  const html = await (await get("https://x.com/home", { "user-agent": userAgent, cookie: `auth_token=${s.authToken}; ct0=${s.ct0}` }, s.proxy)).text();
  const main = html.match(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[a-z0-9]+\.js/)?.[0];
  if (!main) throw new Error("x.com main bundle not found, the session may be logged out");
  const js = await (await get(main, { "user-agent": userAgent }, s.proxy)).text();
  const queryId = (op: string) => js.match(new RegExp(`queryId:"([^"]+)",operationName:"${op}"`))?.[1];
  const bearer = js.match(/"(AAAAAAAAAAAAAAAAAAAAA[^"]+)"/)?.[1];
  const search = queryId("SearchTimeline");
  if (!search || !bearer) throw new Error("x.com query id or bearer not found, the front end may have changed");
  const lazy = async (op: string, hint: RegExp) => {
    const names = new Map<string, string>();
    const hashes = new Map<string, string>();
    for (const m of html.matchAll(/(\d+):"([^"]+)"/g)) (/^[a-f0-9]{5,}$/.test(m[2]) ? hashes : names).set(m[1], m[2]);
    for (const [id, name] of names) {
      if (!hashes.has(id) || !hint.test(name)) continue;
      const chunk = await (await get(`https://abs.twimg.com/responsive-web/client-web/${name}.${hashes.get(id)}a.js`, { "user-agent": userAgent }, s.proxy)).text();
      const found = chunk.match(new RegExp(`queryId:"([^"]+)",operationName:"${op}"`))?.[1];
      if (found) return found;
    }
    return undefined;
  };
  return { bearer, search, viewer: queryId("Viewer"), detail: queryId("TweetDetail"), retweeters: queryId("Retweeters") ?? (await lazy("Retweeters", /Tweet|Engagement|Retweet/i)) };
}

const unwrap = (r: any) => (r?.__typename === "TweetWithVisibilityResults" ? r.tweet : r);

function toActor(u: any): Actor | undefined {
  if (!u?.rest_id) return undefined;
  const created = u.core?.created_at ?? u.legacy?.created_at;
  return {
    id: `x:${u.rest_id}`,
    platform: "x",
    handle: u.core?.screen_name ?? u.legacy?.screen_name,
    createdAt: created ? Date.parse(created) : undefined,
    followers: u.relationship_counts?.followers ?? u.legacy?.followers_count,
    following: u.relationship_counts?.following ?? u.legacy?.friends_count,
    posts: u.tweet_counts?.tweets ?? u.legacy?.statuses_count,
  };
}

function toEvent(raw: any): { event: Event; actor: Actor } | undefined {
  const t = unwrap(raw);
  const L = t?.legacy;
  const actor = toActor(t?.core?.user_results?.result);
  if (!L || !actor) return undefined;
  const rt = unwrap(L.retweeted_status_result?.result)?.rest_id;
  const quote = unwrap(t.quoted_status_result?.result)?.rest_id;
  const reply = L.in_reply_to_status_id_str;
  const target = rt ?? reply ?? quote;
  return {
    actor,
    event: {
      id: `x:${t.rest_id}`,
      actor: actor.id,
      action: rt ? "reshare" : reply ? "reply" : quote ? "quote" : "post",
      ts: snowflakeTime(t.rest_id),
      precision: "ms",
      target: target ? `x:${target}` : undefined,
      text: t.note_tweet?.note_tweet_results?.result?.text ?? L.full_text,
      tags: (L.entities?.hashtags ?? []).map((h: any) => h.text),
      urls: (L.entities?.urls ?? []).map((u: any) => u.expanded_url),
      lang: L.lang,
    },
  };
}

export async function createXCollector(session: XSession) {
  const { bearer, search, viewer, detail, retweeters } = await discover(session);
  let tx = await ClientTransaction.create(await fetchXDocument());
  const features: Record<string, boolean> = {};
  const rate: XRateState = { remaining: null, reset: null };

  async function graphql(path: string, variables: Record<string, unknown>, referer: string): Promise<any> {
    if (rate.remaining === 0 && rate.reset && Date.now() < rate.reset) return { limited: true };
    let renewed = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await get(`https://x.com${path}?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`, {
        "user-agent": session.userAgent,
        authorization: `Bearer ${bearer}`,
        "x-csrf-token": session.ct0,
        cookie: `auth_token=${session.authToken}; ct0=${session.ct0}`,
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
        "x-client-transaction-id": await tx.generateTransactionId("GET", path),
        referer,
      }, session.proxy).catch((e: Error) => e);
      if (res instanceof Error) {
        await sleep(Math.min(16_000, 1000 * 2 ** attempt));
        continue;
      }
      rate.remaining = Number(res.headers.get("x-rate-limit-remaining") ?? NaN) || (res.status === 429 ? 0 : rate.remaining);
      rate.reset = Number(res.headers.get("x-rate-limit-reset") ?? NaN) * 1000 || rate.reset;
      const body = await res.text();
      if (res.status === 400 && /cannot be null/.test(body)) {
        for (const m of body.matchAll(/cannot be null: ([^"]+)/g)) for (const k of m[1].split(",")) features[k.trim()] = false;
        continue;
      }
      if (res.status === 429) return { limited: true };
      if (res.status === 404 && !renewed) {
        tx = await ClientTransaction.create(await fetchXDocument());
        renewed = true;
        continue;
      }
      if (res.status >= 500) {
        await sleep(Math.min(16_000, 1000 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`x ${res.status}: ${body.slice(0, 160)}`);
      return JSON.parse(body);
    }
    throw new Error("x request failed after retries");
  }

  const page = (rawQuery: string, cursor?: string) =>
    graphql(`/i/api/graphql/${search}/SearchTimeline`, { rawQuery, count: 20, querySource: "typed_query", product: "Latest", ...(cursor ? { cursor } : {}) }, "https://x.com/search");

  const collected = (actors: Map<string, Actor>, events: Map<string, Event>, query: string, coverage: number): Dataset => ({
    version: SCHEMA_VERSION,
    actors: [...actors.values()],
    events: [...events.values()].sort((a, b) => a.ts - b.ts),
    meta: { source: "x", query, coverage, collectedAt: Date.now() },
  });

  return {
    rate,
    async search(query: string, o: SearchOptions = {}): Promise<Dataset> {
      const pages = o.pages ?? 10;
      const [lo, hi] = o.delayMs ?? [2000, 4500];
      const q = `${query}${o.since ? ` since:${o.since}` : ""}`;
      const actors = new Map<string, Actor>();
      const events = new Map<string, Event>();
      let cursor: string | undefined;
      let fetched = 0;
      for (let p = 0; p < pages; p++) {
        if (rate.remaining === 0) break;
        const json = await page(q, cursor);
        if (json.limited) break;
        fetched++;
        const entries = (json.data?.search_by_raw_query?.search_timeline?.timeline?.instructions ?? []).flatMap((i: any) => i.entries ?? (i.entry ? [i.entry] : []));
        let n = 0;
        cursor = undefined;
        for (const e of entries) {
          const mapped = toEvent(e.content?.itemContent?.tweet_results?.result);
          if (mapped && (!o.lang || mapped.event.lang === o.lang)) {
            actors.set(mapped.actor.id, mapped.actor);
            events.set(mapped.event.id, mapped.event);
            n++;
          }
          if (e.content?.cursorType === "Bottom") cursor = e.content.value;
        }
        o.onPage?.({ page: p, tweets: n, remaining: rate.remaining });
        if (!cursor || !entries.length) break;
        if (p < pages - 1) await sleep(lo + Math.random() * (hi - lo));
      }
      return collected(actors, events, q, fetched / pages);
    },
    async me(): Promise<Profile> {
      if (!viewer) throw new Error("x.com Viewer query id not found");
      const json = await graphql(`/i/api/graphql/${viewer}/Viewer`, { withCommunitiesMemberships: false }, "https://x.com/home");
      if (json.limited) throw new Error("rate limited");
      const u = json.data?.viewer?.user_results?.result;
      const a = toActor(u);
      if (!a) throw new Error("session is not signed in");
      return { id: a.id, handle: `@${a.handle}`, name: u.core?.name ?? u.legacy?.name ?? a.handle ?? "", followers: a.followers, createdAt: a.createdAt };
    },
    async retweeters(id: string, pages = 1): Promise<Actor[]> {
      if (!retweeters) throw new Error("x.com Retweeters query id not found");
      const actors = new Map<string, Actor>();
      let cursor: string | undefined;
      for (let p = 0; p < pages; p++) {
        const json = await graphql(`/i/api/graphql/${retweeters}/Retweeters`, { tweetId: id, count: 100, includePromotedContent: false, ...(cursor ? { cursor } : {}) }, `https://x.com/i/status/${id}/retweets`);
        if (json.limited) break;
        cursor = undefined;
        for (const e of (json.data?.retweeters_timeline?.timeline?.instructions ?? []).flatMap((i: any) => i.entries ?? [])) {
          const a = toActor(e.content?.itemContent?.user_results?.result);
          if (a) actors.set(a.id, { ...a, reshared: [`x:${id}`] });
          if (e.content?.cursorType === "Bottom") cursor = e.content.value;
        }
        if (!cursor) break;
      }
      return [...actors.values()];
    },
    async conversation(id: string, o: Pick<SearchOptions, "pages" | "delayMs"> = {}): Promise<Dataset> {
      if (!detail) throw new Error("x.com TweetDetail query id not found");
      const pages = o.pages ?? 5;
      const [lo, hi] = o.delayMs ?? [2000, 4500];
      const actors = new Map<string, Actor>();
      const events = new Map<string, Event>();
      let cursor: string | undefined;
      let fetched = 0;
      for (let p = 0; p < pages; p++) {
        const json = await graphql(
          `/i/api/graphql/${detail}/TweetDetail`,
          { focalTweetId: id, with_rux_injections: false, rankingMode: "Recency", includePromotedContent: false, withCommunity: true, withQuickPromoteEligibilityTweetFields: false, withBirdwatchNotes: false, withVoice: true, ...(cursor ? { cursor, referrer: "tweet" } : {}) },
          `https://x.com/i/status/${id}`,
        );
        if (json.limited) break;
        fetched++;
        const entries = (json.data?.threaded_conversation_with_injections_v2?.instructions ?? []).flatMap((i: any) => i.entries ?? []);
        cursor = undefined;
        for (const e of entries) {
          const items = [e.content?.itemContent, ...(e.content?.items ?? []).map((x: any) => x.item?.itemContent)];
          for (const it of items) {
            const mapped = toEvent(it?.tweet_results?.result);
            if (mapped) {
              actors.set(mapped.actor.id, mapped.actor);
              events.set(mapped.event.id, mapped.event);
            }
            if (it?.cursorType === "Bottom" || it?.cursorType === "ShowMoreThreads") cursor = it.value;
          }
          if (e.content?.cursorType === "Bottom") cursor = e.content.value;
        }
        if (!cursor) break;
        if (p < pages - 1) await sleep(lo + Math.random() * (hi - lo));
      }
      return collected(actors, events, `conversation:${id}`, fetched / pages);
    },
  };
}

export function sessionFromEnv(env: Record<string, string | undefined> = process.env): XSession | undefined {
  if (!env.X_AUTH_TOKEN || !env.X_CT0) return undefined;
  return { authToken: env.X_AUTH_TOKEN, ct0: env.X_CT0, userAgent: env.X_USER_AGENT ?? "Mozilla/5.0" };
}
