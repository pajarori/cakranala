import { lookup } from "node:dns/promises";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

export interface BrowserConfig {
  url: string;
}

export interface Session {
  cookie: string;
  userAgent: string;
  proxy?: string;
}

export class Checkpoint extends Error {}

export class Limited extends Error {}

export function browserFromEnv(env: Record<string, string | undefined> = process.env): BrowserConfig | undefined {
  return env.BROWSER_URL ? { url: env.BROWSER_URL.replace(/\/$/, "") } : undefined;
}

let shared: Promise<Browser> | undefined;

async function connect(config: BrowserConfig) {
  const current = await shared?.catch(() => undefined);
  if (current?.connected) return current;
  shared = (async () => {
    const u = new URL(config.url);
    const { address } = await lookup(u.hostname);
    return puppeteer.connect({ browserURL: `${u.protocol}//${address}:${u.port}`, defaultViewport: null, protocolTimeout: 120_000 });
  })();
  return shared;
}

const cookies = (raw: string, domain: string) =>
  raw
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.includes("="))
    .map((p) => ({ name: p.slice(0, p.indexOf("=")).trim(), value: p.slice(p.indexOf("=") + 1).trim(), domain, path: "/", secure: true }));

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms * (0.6 + Math.random() * 0.8)));

export function parseJson(body: string): unknown[] {
  const text = body.replace(/^for \(;;\);/, "").trim();
  if (!text || (text[0] !== "{" && text[0] !== "[")) return [];
  try {
    return [JSON.parse(text)];
  } catch {
    return text.split("\n").flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  }
}

export function* walk(value: unknown): Generator<Record<string, any>> {
  const stack = [value];
  while (stack.length) {
    const x = stack.pop();
    if (!x || typeof x !== "object") continue;
    if (!Array.isArray(x)) yield x as Record<string, any>;
    for (const v of Object.values(x)) if (v && typeof v === "object") stack.push(v);
  }
}

export function find<T>(value: unknown, pick: (o: Record<string, any>) => T | undefined): T | undefined {
  const queue = [value];
  while (queue.length) {
    const x = queue.shift();
    if (!x || typeof x !== "object") continue;
    if (!Array.isArray(x)) {
      const hit = pick(x as Record<string, any>);
      if (hit !== undefined) return hit;
    }
    for (const v of Object.values(x)) if (v && typeof v === "object") queue.push(v);
  }
  return undefined;
}

export const signedOut = (url: string) => /\/(login|checkpoint|challenge|two_step_verification)/.test(new URL(url).pathname);

export async function withPage<T>(config: BrowserConfig, session: Session, domain: string, run: (page: Page, captured: unknown[]) => Promise<T>): Promise<T> {
  const browser = await connect(config);
  const proxy = session.proxy ? new URL(session.proxy) : undefined;
  const context = await browser.createBrowserContext(proxy ? { proxyServer: `${proxy.protocol}//${proxy.host}` } : {});
  try {
    const page = await context.newPage();
    if (proxy?.username) await page.authenticate({ username: decodeURIComponent(proxy.username), password: decodeURIComponent(proxy.password) });
    await page.setUserAgent({ userAgent: session.userAgent });
    await page.setExtraHTTPHeaders({ "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7" });
    await page.setViewport({ width: 1366, height: 900 });
    await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, "webdriver", { get: () => undefined }));
    await context.setCookie(...cookies(session.cookie, domain));
    const captured: unknown[] = [];
    page.on("response", (res) => {
      const type = res.headers()["content-type"] ?? "";
      if (!/json|javascript|text\/html/.test(type) || !/graphql|\/api\//.test(res.url())) return;
      res
        .text()
        .then((body) => captured.push(...parseJson(body)))
        .catch(() => undefined);
    });
    return await run(page, captured);
  } finally {
    await context.close().catch(() => undefined);
  }
}
