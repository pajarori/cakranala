import { ClientTransaction, fetchXDocument } from "x-client-transaction-id";
import { SCHEMA_VERSION, type Actor, type Dataset, type Event } from "cakranala";

export interface XSession {
  authToken: string;
  ct0: string;
  userAgent: string;
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

async function discover(s: XSession) {
  const userAgent = s.userAgent;
  const html = await (await fetch("https://x.com/home", { headers: { "user-agent": userAgent, cookie: `auth_token=${s.authToken}; ct0=${s.ct0}` } })).text();
  const main = html.match(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[a-z0-9]+\.js/)?.[0];
  if (!main) throw new Error("bundle main.js x.com tidak ditemukan");
  const js = await (await fetch(main, { headers: { "user-agent": userAgent } })).text();
  const queryId = (op: string) => js.match(new RegExp(`queryId:"([^"]+)",operationName:"${op}"`))?.[1];
  const bearer = js.match(/"(AAAAAAAAAAAAAAAAAAAAA[^"]+)"/)?.[1];
  const search = queryId("SearchTimeline");
  if (!search || !bearer) throw new Error("queryId/bearer tidak ditemukan; front-end x.com mungkin berubah");
  return { bearer, search };
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
  const { bearer, search } = await discover(session);
  const tx = await ClientTransaction.create(await fetchXDocument());
  const path = `/i/api/graphql/${search}/SearchTimeline`;
  const features: Record<string, boolean> = {};
  const rate: XRateState = { remaining: null, reset: null };

  async function page(rawQuery: string, cursor?: string): Promise<any> {
    const variables = { rawQuery, count: 20, querySource: "typed_query", product: "Latest", ...(cursor ? { cursor } : {}) };
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`https://x.com${path}?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`, {
        headers: {
          "user-agent": session.userAgent,
          authorization: `Bearer ${bearer}`,
          "x-csrf-token": session.ct0,
          cookie: `auth_token=${session.authToken}; ct0=${session.ct0}`,
          "x-twitter-auth-type": "OAuth2Session",
          "x-twitter-active-user": "yes",
          "x-client-transaction-id": await tx.generateTransactionId("GET", path),
          referer: "https://x.com/search",
        },
      });
      rate.remaining = Number(res.headers.get("x-rate-limit-remaining") ?? NaN) || (res.status === 429 ? 0 : rate.remaining);
      rate.reset = Number(res.headers.get("x-rate-limit-reset") ?? NaN) * 1000 || rate.reset;
      const body = await res.text();
      if (res.status === 400 && /cannot be null/.test(body)) {
        for (const m of body.matchAll(/cannot be null: ([^"]+)/g)) for (const k of m[1].split(",")) features[k.trim()] = false;
        continue;
      }
      if (res.status === 429) return { limited: true };
      if (!res.ok) throw new Error(`x search ${res.status}: ${body.slice(0, 160)}`);
      return JSON.parse(body);
    }
    throw new Error("x search gagal setelah menyesuaikan features");
  }

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
      return {
        version: SCHEMA_VERSION,
        actors: [...actors.values()],
        events: [...events.values()].sort((a, b) => a.ts - b.ts),
        meta: { source: "x", query: q, coverage: fetched / pages, collectedAt: Date.now() },
      };
    },
  };
}

export function sessionFromEnv(env: Record<string, string | undefined> = process.env): XSession | undefined {
  if (!env.X_AUTH_TOKEN || !env.X_CT0) return undefined;
  return { authToken: env.X_AUTH_TOKEN, ct0: env.X_CT0, userAgent: env.X_USER_AGENT ?? "Mozilla/5.0" };
}
