import type { Session } from "../browser";
import { createXCollector } from "../x";
import { runFlow } from "./flow";
import { FLOWS } from "./flows";
import { reportKomdigi, type KomdigiFields } from "./komdigi";
import { reportTelegram, type TelegramFields } from "./telegram";
import type { Complaint, Receipt, ReportTarget } from "./types";

export { permalink, profileUrl, type Identity } from "./targets";
export { FLOWS } from "./flows";
export { runFlow, type Flow, type Step } from "./flow";
export { KOMDIGI_URL } from "./komdigi";
export { telegramCode, telegramMe, telegramVerify } from "./telegram";
export type { Channel, Complaint, Receipt, ReceiptStatus, ReportTarget } from "./types";

const DOMAIN = { x: "x.com", instagram: "instagram.com", facebook: "facebook.com", tiktok: "tiktok.com", youtube: "youtube.com" } as const;

export function complaintText(c: { title: string; brief?: string; accounts: number; posts: number; from: number; to: number; layers: string[]; platforms: string[] }) {
  const day = (t: number) => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return [
    `Kami melaporkan dugaan operasi pengaruh terkoordinasi dengan narasi "${c.title}".`,
    `${c.accounts} akun di ${c.platforms.join(", ")} memposting ${c.posts} konten secara terkoordinasi antara ${day(c.from)} dan ${day(c.to)}.`,
    c.brief,
    `Pola yang terdeteksi: ${c.layers.join(", ")}. Tautan setiap konten terlampir, dan laporan lengkap dengan hash SHA-256 ada di berkas PDF.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function xReceipt(status: number, ref: string): Receipt | undefined {
  if (status === 200) return { status: "sent", ref };
  if (status === 429) return { status: "limited", until: Date.now() + 15 * 60_000, error: "terkena batas laju X" };
  if (status === 401 || status === 403) return { status: "failed", error: `X menolak sesi (${status}), periksa kredensial` };
  return undefined;
}

export async function sendReport(target: ReportTarget, complaint: Complaint, fields: Record<string, string>, proxy?: string): Promise<Receipt> {
  try {
    if (target.channel === "komdigi") return await reportKomdigi(fields as unknown as KomdigiFields, complaint);
    if (target.channel === "telegram") return await reportTelegram(fields as unknown as TelegramFields, target.url, complaint.text.slice(0, 500));
    if (target.channel === "x" && target.who) {
      const x = await createXCollector({ authToken: fields.authToken, ct0: fields.ct0, userAgent: fields.userAgent || "Mozilla/5.0", proxy });
      const r = xReceipt((await x.reportSpam(target.who.id.replace(/^x:/, ""))).status, target.who.id);
      if (r) return r;
    }
    const session: Session = { cookie: target.channel === "x" ? `auth_token=${fields.authToken}; ct0=${fields.ct0}` : fields.cookie, userAgent: fields.userAgent || "Mozilla/5.0", proxy };
    return await runFlow(session, DOMAIN[target.channel], target.url, FLOWS[target.channel][target.kind]);
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
