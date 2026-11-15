import type { Receipt } from "./types";

export interface TelegramFields {
  apiId: string;
  apiHash: string;
  session: string;
}

const PREFER = [/spam/i, /fake|palsu/i, /scam|penipuan/i, /other|lain/i];

async function client(f: TelegramFields) {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions/index.js");
  const c = new TelegramClient(new StringSession(f.session), Number(f.apiId), f.apiHash, { connectionRetries: 2 });
  c.setLogLevel("none" as never);
  await c.connect();
  return c;
}

export async function telegramCode(apiId: string, apiHash: string, phone: string) {
  const c = await client({ apiId, apiHash, session: "" });
  try {
    const { phoneCodeHash } = await c.sendCode({ apiId: Number(apiId), apiHash }, phone);
    return { phoneCodeHash, session: String(c.session.save()) };
  } finally {
    await c.disconnect();
  }
}

export async function telegramVerify(o: { apiId: string; apiHash: string; session: string; phone: string; phoneCodeHash: string; code: string; password?: string }) {
  const { Api } = await import("telegram");
  const { computeCheck } = await import("telegram/Password.js");
  const c = await client(o);
  try {
    try {
      await c.invoke(new Api.auth.SignIn({ phoneNumber: o.phone, phoneCodeHash: o.phoneCodeHash, phoneCode: o.code }));
    } catch (e) {
      if (!String(e).includes("SESSION_PASSWORD_NEEDED")) throw e;
      if (!o.password) throw new Error("akun ini memakai verifikasi dua langkah, isi password");
      const srp = await c.invoke(new Api.account.GetPassword());
      await c.invoke(new Api.auth.CheckPassword({ password: await computeCheck(srp, o.password) }));
    }
    const me = (await c.getMe()) as { id: { toString(): string }; username?: string; firstName?: string };
    return { session: String(c.session.save()), profile: { id: `tg:${me.id.toString()}`, handle: me.username ? `@${me.username}` : (me.firstName ?? ""), name: me.firstName ?? "" } };
  } finally {
    await c.disconnect();
  }
}

export async function telegramMe(f: TelegramFields) {
  const c = await client(f);
  try {
    const me = (await c.getMe()) as { id: { toString(): string }; username?: string; firstName?: string };
    return { id: `tg:${me.id.toString()}`, handle: me.username ? `@${me.username}` : (me.firstName ?? ""), name: me.firstName ?? "" };
  } finally {
    await c.disconnect();
  }
}

export async function reportTelegram(f: TelegramFields, url: string, message: string): Promise<Receipt> {
  const m = new URL(url).pathname.match(/^\/([\w]+)(?:\/(\d+))?/);
  if (!m) return { status: "failed", error: "tautan Telegram tidak dikenali" };
  const { Api } = await import("telegram");
  const c = await client(f);
  try {
    if (!m[2]) {
      await c.invoke(new Api.account.ReportPeer({ peer: m[1], reason: new Api.InputReportReasonSpam(), message }));
      return { status: "sent", ref: m[1] };
    }
    let option: Buffer = Buffer.alloc(0);
    for (let i = 0; i < 4; i++) {
      const r = await c.invoke(new Api.messages.Report({ peer: m[1], id: [Number(m[2])], option, message }));
      if (r instanceof Api.ReportResultReported) return { status: "sent", ref: `${m[1]}/${m[2]}` };
      if (r instanceof Api.ReportResultAddComment) {
        option = r.option;
        continue;
      }
      if (r instanceof Api.ReportResultChooseOption) {
        const pick = PREFER.map((re) => r.options.find((o) => re.test(o.text))).find(Boolean);
        if (!pick) return { status: "needs_manual", error: `pilihan alasan Telegram tidak cocok: ${r.options.map((o) => o.text).join(", ")}` };
        option = pick.option;
      }
    }
    return { status: "needs_manual", error: "alur laporan Telegram tidak selesai" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const wait = msg.match(/FLOOD_WAIT_(\d+)/);
    if (wait) return { status: "limited", until: Date.now() + Number(wait[1]) * 1000, error: msg };
    return { status: "failed", error: msg };
  } finally {
    await c.disconnect();
  }
}
