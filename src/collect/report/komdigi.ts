import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "puppeteer-core";
import { go, withPage } from "../browser";
import { blocked, clickText, seen, shot } from "./flow";
import type { Complaint, Receipt } from "./types";

export interface KomdigiFields {
  email: string;
  password: string;
  userAgent?: string;
}

export const KOMDIGI_URL = "https://aduankonten.id";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

async function fill(page: Page, selector: string, value: string) {
  const el = await page.$(selector);
  if (!el) return false;
  await el.click({ count: 3 });
  await el.type(value, { delay: 15 });
  return true;
}

async function login(page: Page, f: KomdigiFields) {
  if (!(await page.$("input[type=password]"))) await clickText(page, ["masuk", "login"], 4000);
  if (!(await page.$("input[type=password]"))) return true;
  const ok = (await fill(page, "input[type=email], input[name*=email i], input[name*=user i]", f.email)) && (await fill(page, "input[type=password]", f.password));
  if (!ok) return false;
  await clickText(page, ["masuk", "login", "sign in"]);
  await new Promise((r) => setTimeout(r, 3000));
  return !(await page.$("input[type=password]"));
}

export async function reportKomdigi(f: KomdigiFields, c: Complaint): Promise<Receipt> {
  return withPage({ cookie: "", userAgent: f.userAgent || UA }, "aduankonten.id", async (page) => {
    const manual = async (error: string): Promise<Receipt> => ({ status: "needs_manual", error, screenshot: await shot(page) });
    await go(page, KOMDIGI_URL);
    if (await blocked(page)) return manual("captcha atau verifikasi di aduankonten.id");
    if (!(await login(page, f))) return manual("gagal masuk ke aduankonten.id, periksa akun atau selesaikan verifikasi");
    if (!(await clickText(page, ["buat aduan baru", "buat aduan", "aduan baru"]))) return manual("tombol Buat Aduan Baru tidak ditemukan");
    await clickText(page, ["hoaks", "hoax", "berita bohong", "disinformasi"], 4000);
    const links = c.links.join("\n");
    const urlField = (await fill(page, "input[type=url], input[name*=url i], input[name*=link i], input[name*=tautan i]", c.links[0] ?? "")) || (await fill(page, "textarea[name*=url i], textarea[name*=link i], textarea[name*=tautan i]", links));
    const textField = await fill(page, "textarea:not([name*=url i]):not([name*=link i]):not([name*=tautan i])", `${c.title}\n\n${c.text}\n\nTautan:\n${links}`);
    if (!urlField || !textField) return manual("kolom tautan atau keterangan tidak ditemukan");
    const upload = await page.$("input[type=file]");
    if (upload && c.pdf) {
      const file = join(tmpdir(), `aduan-${crypto.randomUUID()}.pdf`);
      await Bun.write(file, c.pdf);
      await (upload as unknown as { uploadFile(p: string): Promise<void> }).uploadFile(file);
    }
    if (await blocked(page)) return manual("captcha sebelum aduan dikirim");
    if (!(await clickText(page, ["kirim aduan", "kirim", "submit", "simpan"]))) return manual("tombol kirim tidak ditemukan");
    if (!(await seen(page, ["berhasil", "terima kasih", "nomor aduan", "tiket"], 12_000))) return manual("konfirmasi aduan tidak terlihat");
    const ref = await page.evaluate(() => document.body.innerText.match(/(?:nomor|no\.?|tiket)\s*(?:aduan)?\s*[:#]?\s*([A-Z0-9-]{5,})/i)?.[1]);
    return { status: "sent", ref: ref ?? undefined, screenshot: await shot(page) };
  });
}
