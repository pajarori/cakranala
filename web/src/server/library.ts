import { db } from "./db";

const FEED = process.env.LIBRARY_FEED ?? "https://turnbackhoax.id/feed/";

db.exec("CREATE TABLE IF NOT EXISTS library (id TEXT PRIMARY KEY, title TEXT NOT NULL, verdict TEXT NOT NULL, claim TEXT NOT NULL, url TEXT NOT NULL, published INTEGER NOT NULL)");

export interface LibraryItem {
  id: string;
  title: string;
  verdict: string;
  claim: string;
  url: string;
  published: number;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

const text = (html: string) => decode(decode(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "";

function parse(xml: string): LibraryItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]) => {
    const raw = text(tag(item, "title"));
    const label = raw.match(/^\[([^\]]+)\]\s*/);
    const url = text(tag(item, "link"));
    if (!label || !url) return [];
    const title = raw.slice(label[0].length);
    return [{ id: text(tag(item, "guid")) || url, title, verdict: label[1].toUpperCase(), claim: `${title}. ${text(tag(item, "description")).slice(0, 280)}`, url, published: Date.parse(text(tag(item, "pubDate"))) || Date.now() }];
  });
}

const put = db.query("INSERT OR REPLACE INTO library (id, title, verdict, claim, url, published) VALUES (?, ?, ?, ?, ?, ?)");

export async function syncLibrary() {
  const res = await fetch(FEED, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`feed returned ${res.status}`);
  const items = parse(await res.text());
  db.transaction(() => {
    for (const i of items) put.run(i.id, i.title, i.verdict, i.claim, i.url, i.published);
  })();
}

export const library = () => db.query("SELECT * FROM library ORDER BY published DESC").all() as LibraryItem[];
