import { expect, mock, test } from "bun:test";

const calls: { name: string; args: any }[] = [];
let script: any[] = [];

class Req {
  constructor(public args: any) {}
}
class ReportResultReported {}
class ReportResultAddComment {
  constructor(public option: Buffer) {}
}
class ReportResultChooseOption {
  constructor(public options: { text: string; option: Buffer }[]) {}
}
const Api = {
  account: { ReportPeer: class extends Req { name = "account.ReportPeer"; } },
  messages: { Report: class extends Req { name = "messages.Report"; } },
  InputReportReasonSpam: class {},
  ReportResultReported,
  ReportResultAddComment,
  ReportResultChooseOption,
};

mock.module("telegram", () => ({
  Api,
  TelegramClient: class {
    session = { save: () => "s" };
    setLogLevel() {}
    async connect() {}
    async disconnect() {}
    async invoke(r: any) {
      calls.push({ name: r.name, args: r.args });
      const next = script.shift();
      if (next instanceof Error) throw next;
      return next;
    }
  },
}));
mock.module("telegram/sessions/index.js", () => ({ StringSession: class {} }));

const { reportTelegram } = await import("../src/collect/report/telegram");
const f = { apiId: "1", apiHash: "h", session: "s" };

test("kanal dilaporkan lewat account.ReportPeer", async () => {
  calls.length = 0;
  script = [true];
  expect((await reportTelegram(f, "https://t.me/kanaluji", "spam")).status).toBe("sent");
  expect(calls[0].name).toBe("account.ReportPeer");
  expect(calls[0].args.peer).toBe("kanaluji");
});

test("post dilaporkan lewat messages.Report dan memilih opsi spam", async () => {
  calls.length = 0;
  const spam = Buffer.from("s");
  script = [new ReportResultChooseOption([{ text: "Kekerasan", option: Buffer.from("v") }, { text: "Spam", option: spam }]), new ReportResultAddComment(Buffer.from("c")), new ReportResultReported()];
  const r = await reportTelegram(f, "https://t.me/kanaluji/42", "spam");
  expect(r).toEqual({ status: "sent", ref: "kanaluji/42" });
  expect(calls.map((c) => c.name)).toEqual(["messages.Report", "messages.Report", "messages.Report"]);
  expect(calls[0].args.id).toEqual([42]);
  expect(calls[1].args.option).toBe(spam);
});

test("FLOOD_WAIT menjadi limited", async () => {
  script = [new Error("FLOOD_WAIT_120")];
  const r = await reportTelegram(f, "https://t.me/kanaluji", "spam");
  expect(r.status).toBe("limited");
  expect(r.until!).toBeGreaterThan(Date.now() + 100_000);
});

test("opsi tanpa kecocokan menjadi needs_manual", async () => {
  script = [new ReportResultChooseOption([{ text: "Kekerasan", option: Buffer.from("v") }])];
  expect((await reportTelegram(f, "https://t.me/kanaluji/1", "spam")).status).toBe("needs_manual");
});
