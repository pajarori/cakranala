import { mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { analyze, pseudonymize, type Actor, type Event } from "cakranala";
import { DIR, monitors, store } from "./db";
import { secret } from "./monitors";
import { consolidate, refresh, track } from "./analysis";

const DAY = 86_400_000;
const WIB = 7 * 3_600_000;
const BATCH = 5_000;
const MIN_EVENTS = 30;

const list = (s: string) =>
  s && s !== "[]"
    ? s
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((x) => x.trim().replace(/^'|'$/g, ""))
        .filter(Boolean)
    : [];

async function* records(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let pendingQuote = false;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (ch === '"') {
          field += '"';
          continue;
        }
        quoted = false;
      }
      if (quoted) {
        if (ch === '"') pendingQuote = true;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
        if (row.length > 1 || row[0]) yield row;
        row = [];
        field = "";
      } else field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

function toEvent(get: (n: string) => string): { actor: Actor; event: Event } | undefined {
  const time = get("tweet_time");
  const ts = Date.parse(`${time.replace(" ", "T")}${time.length <= 16 ? ":00" : ""}Z`);
  if (!Number.isFinite(ts)) return undefined;
  const id = `x:${get("userid")}`;
  const created = Date.parse(get("account_creation_date"));
  const rt = get("is_retweet") === "true" && get("retweet_tweetid");
  const reply = get("in_reply_to_tweetid");
  const quote = get("quoted_tweet_tweetid");
  return {
    actor: { id, platform: "x", handle: get("user_screen_name") || undefined, createdAt: Number.isFinite(created) ? created : undefined, followers: Number(get("follower_count")) || undefined },
    event: {
      id: `x:${get("tweetid")}`,
      actor: id,
      action: rt ? "reshare" : reply ? "reply" : quote ? "quote" : "post",
      ts,
      precision: "min",
      target: rt ? `x:${rt}` : reply ? `x:${reply}` : quote ? `x:${quote}` : undefined,
      text: rt ? undefined : get("tweet_text") || undefined,
      tags: list(get("hashtags")).map((h) => h.toLowerCase()),
      urls: list(get("urls")),
      lang: get("tweet_language") || undefined,
    },
  };
}

async function load(id: string, stream: ReadableStream<Uint8Array>) {
  let head: string[] | undefined;
  let index = new Map<string, number>();
  let actors = new Map<string, Actor>();
  let events: Event[] = [];
  let total = 0;
  const flush = async () => {
    if (!events.length) return;
    const clean = await pseudonymize({ version: 1, actors: [...actors.values()], events }, secret);
    store.add(id, clean.actors, clean.events.map((e) => ({ ...e, id: `${id}:${e.id}` })));
    total += events.length;
    monitors.progress(id, 0, `Membaca arsip, ${total.toLocaleString("id-ID")} post`);
    actors = new Map();
    events = [];
    await Bun.sleep(0);
  };
  for await (const row of records(stream)) {
    if (!head) {
      head = row;
      if (!["tweetid", "userid", "tweet_time"].every((c) => head!.includes(c))) throw new Error("bukan format arsip X/Twitter");
      index = new Map(head.map((h, i) => [h, i]));
      continue;
    }
    const r = toEvent((n) => row[index.get(n) ?? -1] ?? "");
    if (!r) continue;
    actors.set(r.actor.id, r.actor);
    events.push(r.event);
    if (events.length >= BATCH) await flush();
  }
  await flush();
  return total;
}

async function source(id: string, url: string) {
  const dir = `${DIR}imports/`;
  mkdirSync(dir, { recursive: true });
  monitors.progress(id, 0, "Mengunduh arsip");
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`unduhan gagal: ${res.status}`);
  const path = `${dir}${id}${url.toLowerCase().split("?")[0].endsWith(".zip") ? ".zip" : ".csv"}`;
  await Bun.write(path, res);
  if (!path.endsWith(".zip")) return { stream: Bun.file(path).stream(), cleanup: () => rm(path, { force: true }) };
  const unzip = Bun.spawn(["unzip", "-p", path, "*.csv"], { stdout: "pipe", stderr: "ignore" });
  return { stream: unzip.stdout, cleanup: () => rm(path, { force: true }) };
}

async function replay(id: string) {
  const b = store.bounds(id);
  if (!b.from_ || !b.to_) return { windows: 0, cases: 0 };
  const start = Math.floor((b.from_ + WIB) / DAY) * DAY - WIB;
  const days = Math.ceil((b.to_ - start) / DAY) + 1;
  let analyzed = 0;
  const seen = new Set<string>();
  for (let d = 0; d < days; d++) {
    const from = start + d * DAY;
    const to = from + DAY;
    if (d % 7 === 0) monitors.progress(id, d / days, `Menganalisis ${new Date(from + WIB).toISOString().slice(0, 10)}`);
    if (store.count(id, from, to) < MIN_EVENTS) continue;
    const { actors, events } = store.range(id, from, to);
    const report = await analyze({ version: 1, actors, events });
    if (report.clusters.length) for (const c of await track(report, to, store.monitorOf(from, to), events, actors)) if (c.active) seen.add(c.id);
    analyzed++;
    await Bun.sleep(0);
  }
  return { windows: analyzed, cases: seen.size };
}

export function startArchive(url: string, label: string) {
  if (!/^https?:\/\//.test(url)) throw new Error("URL arsip harus diawali http atau https");
  const id = crypto.randomUUID();
  const name = decodeURIComponent(url.split("?")[0].split("/").pop() || "arsip");
  monitors.insert({ id, kind: "import", platform: "x", target: name, label: label.trim() || name, intervalMin: 0, pages: 0, speed: 1, active: false, createdAt: Date.now() });
  (async () => {
    const { stream, cleanup } = await source(id, url);
    try {
      const total = await load(id, stream);
      monitors.ran(id, Date.now(), null, total);
      const r = await replay(id);
      await consolidate();
      monitors.progress(id, 1, `Selesai, ${r.windows.toLocaleString("id-ID")} hari dianalisis`);
      await refresh(true);
    } finally {
      await cleanup();
    }
  })().catch((e) => {
    monitors.progress(id, null, null);
    monitors.ran(id, Date.now(), e instanceof Error ? e.message : String(e), 0);
  });
  return monitors.get(id)!;
}
