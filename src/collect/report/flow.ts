import type { Page } from "puppeteer-core";
import { go, signedOut, withPage, type Session } from "../browser";
import type { Receipt } from "./types";

export interface Step {
  click: string[];
  optional?: boolean;
}

export interface Flow {
  steps: Step[];
  done: string[];
}

const CAPTCHA = /captcha|recaptcha|hcaptcha|arkoselabs|funcaptcha|challenge/i;
const WAIT = 8_000;

export async function blocked(page: Page) {
  if (signedOut(page.url())) return "sesi keluar atau diminta verifikasi";
  const frames = page.frames().map((f) => f.url());
  if (frames.some((u) => CAPTCHA.test(u)) || CAPTCHA.test(page.url())) return "captcha atau verifikasi";
  return undefined;
}

export async function clickText(page: Page, labels: string[], timeout = WAIT) {
  const wanted = labels.map((l) => l.toLowerCase());
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const handle = await page.evaluateHandle((wanted: string[]) => {
      const nodes = document.querySelectorAll<HTMLElement>("button, a, [role=button], [role=menuitem], [role=radio], [role=option], [role=link], label, li, span, div[tabindex]");
      const label = (el: HTMLElement) => (el.getAttribute("aria-label") ?? el.innerText ?? "").trim().toLowerCase();
      for (const w of wanted)
        for (const el of nodes) {
          const text = label(el);
          if (!text || el.offsetParent === null) continue;
          if (text === w || (text.startsWith(w) && text.length <= w.length + 40)) return el.closest("button, a, [role=button], [role=menuitem], [role=radio], [role=option], [role=link], label") ?? el;
        }
      return null;
    }, wanted);
    const el = handle.asElement();
    if (el) {
      await (el as unknown as { click(): Promise<void> }).click();
      await new Promise((r) => setTimeout(r, 900));
      return true;
    }
    await handle.dispose();
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

export async function seen(page: Page, labels: string[], timeout = WAIT) {
  const wanted = labels.map((l) => l.toLowerCase());
  return page
    .waitForFunction((wanted: string[]) => wanted.some((w) => document.body.innerText.toLowerCase().includes(w)), { timeout }, wanted)
    .then(() => true)
    .catch(() => false);
}

export const shot = async (page: Page) => new Uint8Array(await page.screenshot({ type: "png" }));

export async function runFlow(session: Session, domain: string, url: string, flow: Flow): Promise<Receipt> {
  return withPage(session, domain, async (page) => {
    await go(page, url);
    await new Promise((r) => setTimeout(r, 2500));
    for (const step of flow.steps) {
      const stop = await blocked(page);
      if (stop) return { status: "needs_manual", error: stop, screenshot: await shot(page) };
      if (!(await clickText(page, step.click)) && !step.optional) return { status: "needs_manual", error: `tombol "${step.click[0]}" tidak ditemukan`, screenshot: await shot(page) };
    }
    const stop = await blocked(page);
    if (stop) return { status: "needs_manual", error: stop, screenshot: await shot(page) };
    if (!(await seen(page, flow.done))) return { status: "needs_manual", error: "konfirmasi laporan tidak terlihat", screenshot: await shot(page) };
    return { status: "sent", screenshot: await shot(page) };
  });
}
