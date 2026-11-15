import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pseudonymize, pseudonyms, type Dataset } from "../src";

process.env.CAKRANALA_DATA = mkdtempSync(join(tmpdir(), "cakranala-test-"));
const { alerts, audit, cases, db, decisions, store } = await import("../web/src/server/db");
const { identities } = await import("../web/src/server/identities");
const { credentials } = await import("../web/src/server/credentials");
const c = await import("../web/src/server/complaints");

const raw: Dataset = {
  version: 1,
  actors: [
    { id: "x:111", platform: "x", handle: "@satu" },
    { id: "x:222", platform: "x", handle: "@dua" },
  ],
  events: [
    { id: "x:9001", actor: "x:111", action: "post", ts: Date.UTC(2026, 10, 1), text: "pesan yang sama persis" },
    { id: "x:9002", actor: "x:222", action: "post", ts: Date.UTC(2026, 10, 1, 0, 5), text: "pesan yang sama persis" },
  ],
};
const ids = await pseudonyms(raw, "rahasia");
await identities.put(raw.actors, ids);
const ds = await pseudonymize(raw, "rahasia", ids);
store.add("m1", ds.actors, ds.events);
const members = ds.actors.map((a) => a.id);
const caseId = crypto.randomUUID();
cases.upsert({ id: caseId, title: "Narasi Uji", brief: "ringkasan", status: "new", members, firstSeen: Date.UTC(2026, 10, 1), lastSeen: Date.UTC(2026, 10, 2), peak: 2, createdAt: Date.now() });
await credentials.add("x", "pelapor", { authToken: "a", ct0: "b", userAgent: "ua" });

let clock = Date.now();
const later = () => (clock += 120_000);
const calls: string[] = [];
const ok: c.Sender = async (t) => (calls.push(t.url), { status: "sent", ref: "r1", screenshot: new Uint8Array([137, 80, 78, 71]) });

test("aduan ditolak sebelum verdict terkoordinasi", async () => {
  expect(c.createBatch({ caseIds: [caseId], komdigi: false, by: "analis", simulation: false })).rejects.toThrow("terkoordinasi");
});

test("kandidat berisi akun dan post dengan tautan", () => {
  decisions.put({ caseId, verdict: "coordinated", confidence: "high", reasons: ["copypasta"], note: "", by: "analis", at: Date.now() });
  const list = c.candidates([caseId]);
  expect(list.filter((x) => x.kind === "account")).toHaveLength(2);
  expect(list.filter((x) => x.kind === "post")).toHaveLength(2);
  expect(list.every((x) => x.reportable)).toBe(true);
});

test("batch live mengirim satu per kanal, membuka identitas dengan audit, lalu dedupe di batch berikutnya", async () => {
  const b = await c.createBatch({ caseIds: [caseId], komdigi: false, by: "analis", simulation: false });
  const items = c.ofCase(caseId).items.filter((i) => i.batchId === b.id);
  expect(items.map((i) => i.status)).toEqual(["queued", "queued", "queued", "queued"]);
  expect(items.map((i) => i.url)).toContain("https://x.com/i/user/111");
  expect(items.map((i) => i.url)).toContain("https://x.com/i/status/9001");
  expect(audit.recent(50).some((e) => e.action === "identity.revealed")).toBe(true);
  expect(await c.work(later(), ok)).toBe(1);
  expect(await c.work(later(), ok)).toBe(1);
  await c.work(later(), ok);
  await c.work(later(), ok);
  const after = c.ofCase(caseId).items.filter((i) => i.batchId === b.id);
  expect(after.every((i) => i.status === "sent" && i.screenshot)).toBe(true);
  expect(calls).toHaveLength(4);
  const again = await c.createBatch({ caseIds: [caseId], komdigi: false, by: "analis", simulation: false });
  expect(c.ofCase(caseId).items.filter((i) => i.batchId === again.id).every((i) => i.status === "duplicate")).toBe(true);
});

test("mode simulasi tidak pernah memanggil reporter", async () => {
  calls.length = 0;
  const b = await c.createBatch({ caseIds: [caseId], komdigi: true, by: "analis", simulation: true });
  const items = c.ofCase(caseId).items.filter((i) => i.batchId === b.id);
  expect(items.every((i) => i.status === "simulated")).toBe(true);
  expect(items.some((i) => i.channel === "komdigi")).toBe(true);
  await c.work(later(), ok);
  expect(calls).toHaveLength(0);
});

test("butuh verifikasi tercatat sebagai error penting, lalu bisa diselesaikan manual", async () => {
  db.exec("DELETE FROM complaint_items");
  const b = await c.createBatch({ caseIds: [caseId], komdigi: false, by: "analis", simulation: false });
  const manual: c.Sender = async () => ({ status: "needs_manual", error: "captcha atau verifikasi" });
  await c.work(later(), manual);
  const it = c.ofCase(caseId).items.find((i) => i.batchId === b.id && i.status === "needs_manual")!;
  expect(it).toBeDefined();
  expect(alerts.errors().some((a) => a.text.includes("butuh verifikasi"))).toBe(true);
  expect(c.markDone(it.id, "analis").status).toBe("sent");
  expect(audit.of(it.id).at(-1)!.action).toBe("complaint.manual");
  alerts.seen(alerts.errors().map((a) => a.id));
  expect(alerts.errors()).toHaveLength(0);
});

test("komdigi tanpa kredensial gagal dengan error yang jelas dan bisa dicoba lagi", async () => {
  const b = await c.createBatch({ caseIds: [caseId], komdigi: true, by: "analis", simulation: false });
  for (let k = 0; k < 6; k++) await c.work(later(), ok);
  const k = c.ofCase(caseId).items.find((i) => i.batchId === b.id && i.channel === "komdigi")!;
  expect(k.status).toBe("failed");
  expect(k.error).toContain("kredensial pelapor komdigi");
  expect(alerts.errors().some((a) => a.text.includes("komdigi"))).toBe(true);
  expect(c.retry(k.id, "analis").status).toBe("queued");
});
