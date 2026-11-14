import { pseudonymize, validate, type Actor, type Dataset, type Event } from "cakranala";
import { monitors, store } from "./db";
import { secret } from "./monitors";

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const list = (s: string) =>
  s && s !== "[]"
    ? s
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((x) => x.trim().replace(/^'|'$/g, ""))
        .filter(Boolean)
    : [];

function fromArchive(text: string): Dataset {
  const [head, ...rows] = parseCsv(text);
  const col = (name: string) => head.indexOf(name);
  const need = ["tweetid", "userid", "tweet_time", "tweet_text"];
  if (need.some((n) => col(n) < 0)) throw new Error("CSV bukan format arsip X/Twitter: kolom tweetid, userid, tweet_time, tweet_text wajib ada");
  const get = (r: string[], n: string) => (col(n) >= 0 ? (r[col(n)] ?? "") : "");
  const actors = new Map<string, Actor>();
  const events: Event[] = [];
  for (const r of rows) {
    const ts = Date.parse(`${get(r, "tweet_time").replace(" ", "T")}${get(r, "tweet_time").length <= 16 ? ":00" : ""}Z`);
    if (!Number.isFinite(ts)) continue;
    const actor = `x:${get(r, "userid")}`;
    if (!actors.has(actor)) {
      const created = Date.parse(get(r, "account_creation_date"));
      actors.set(actor, { id: actor, platform: "x", handle: get(r, "user_screen_name") || undefined, createdAt: Number.isFinite(created) ? created : undefined, followers: Number(get(r, "follower_count")) || undefined });
    }
    const rt = get(r, "is_retweet") === "true" && get(r, "retweet_tweetid");
    const reply = get(r, "in_reply_to_tweetid");
    const quote = get(r, "quoted_tweet_tweetid");
    events.push({
      id: `x:${get(r, "tweetid")}`,
      actor,
      action: rt ? "reshare" : reply ? "reply" : quote ? "quote" : "post",
      ts,
      precision: "min",
      target: rt ? `x:${rt}` : reply ? `x:${reply}` : quote ? `x:${quote}` : undefined,
      text: rt ? undefined : get(r, "tweet_text") || undefined,
      tags: list(get(r, "hashtags")).map((h) => h.toLowerCase()),
      urls: list(get(r, "urls")),
      lang: get(r, "tweet_language") || undefined,
    });
  }
  return { version: 1, actors: [...actors.values()], events };
}

export function parseImport(name: string, content: string): Dataset {
  const ds = name.toLowerCase().endsWith(".json") || content.trimStart().startsWith("{") ? validate(JSON.parse(content)) : fromArchive(content);
  if (!ds.events.length) throw new Error("berkas tidak berisi post");
  return ds;
}

export function summarize(ds: Dataset) {
  let from = Infinity;
  let to = -Infinity;
  for (const e of ds.events) {
    from = Math.min(from, e.ts);
    to = Math.max(to, e.ts);
  }
  return { posts: ds.events.length, accounts: new Set(ds.events.map((e) => e.actor)).size, from, to, spanHours: (to - from) / 3_600_000, platform: ds.actors[0]?.platform ?? "x" };
}

export async function importDataset(name: string, label: string, ds: Dataset) {
  const s = summarize(ds);
  if (s.spanHours > 24) throw new Error(`rentang data ${Math.ceil(s.spanHours)} jam, maksimal 24 jam agar muat di jendela analisis`);
  const now = Date.now();
  const shift = now - 60_000 - s.to;
  const clean = await pseudonymize({ ...ds, truth: undefined }, secret);
  const id = crypto.randomUUID();
  const events = clean.events.map((e) => ({ ...e, id: `${id}:${e.id}`, ts: e.ts + shift }));
  monitors.insert({ id, kind: "import", platform: s.platform as "x", target: name, label: label.trim() || name, intervalMin: 0, pages: 0, speed: 1, active: false, createdAt: now });
  const added = store.add(id, clean.actors, events);
  monitors.ran(id, now, null, added);
  return { id, ...s, added, originalFrom: s.from, originalTo: s.to };
}
