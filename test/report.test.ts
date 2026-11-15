import { expect, test } from "bun:test";
import { mediaCode, mediaPk } from "../src/collect/instagram";
import { permalink, profileUrl } from "../src/collect/report/targets";

test("instagram shortcode dan media id saling balik", () => {
  for (const code of ["B", "BA", "C1a2B3c4D5e", "DAbCdEfGhIj"]) expect(mediaCode(mediaPk(code))).toBe(code);
});

test("tautan post per platform", () => {
  expect(permalink({ id: "x:1790000000000000000", action: "reply" })).toBe("https://x.com/i/status/1790000000000000000");
  expect(permalink({ id: "tg:beritaku/120", action: "post" })).toBe("https://t.me/beritaku/120");
  expect(permalink({ id: `ig:${mediaPk("C1a2B3c4D5e")}`, action: "post" })).toBe("https://www.instagram.com/p/C1a2B3c4D5e/");
  expect(permalink({ id: "ig:123", action: "comment" })).toBeUndefined();
  expect(permalink({ id: "fb:9876", action: "post" })).toBe("https://www.facebook.com/9876");
  expect(permalink({ id: "yt:Ugx1", action: "comment", target: "yt:abc123" })).toBe("https://www.youtube.com/watch?v=abc123&lc=Ugx1");
  expect(permalink({ id: "tt:7300", action: "post" }, { platform: "tiktok", id: "tt:1", handle: "@akunuji" })).toBe("https://www.tiktok.com/@akunuji/video/7300");
  expect(permalink({ id: "tt:7300", action: "comment" }, { platform: "tiktok", id: "tt:1", handle: "@akunuji" })).toBeUndefined();
  expect(permalink({ id: "akun:1", action: "post" })).toBeUndefined();
});

test("tautan profil per platform", () => {
  expect(profileUrl({ platform: "x", id: "x:44196397", handle: "@elon" })).toBe("https://x.com/i/user/44196397");
  expect(profileUrl({ platform: "instagram", id: "ig:1", handle: "@akunuji" })).toBe("https://www.instagram.com/akunuji/");
  expect(profileUrl({ platform: "facebook", id: "fb:100", handle: "Nama" })).toBe("https://www.facebook.com/100");
  expect(profileUrl({ platform: "tiktok", id: "tt:1", handle: "@akunuji" })).toBe("https://www.tiktok.com/@akunuji");
  expect(profileUrl({ platform: "youtube", id: "yt:UC123", handle: "Nama" })).toBe("https://www.youtube.com/channel/UC123");
  expect(profileUrl({ platform: "telegram", id: "tg:beritaku", handle: "beritaku" })).toBe("https://t.me/beritaku");
});

test("status X dipetakan ke receipt", async () => {
  const { xReceipt } = await import("../src/collect/report");
  expect(xReceipt(200, "x:1")).toEqual({ status: "sent", ref: "x:1" });
  expect(xReceipt(429, "x:1")!.status).toBe("limited");
  expect(xReceipt(429, "x:1")!.until).toBeGreaterThan(Date.now());
  expect(xReceipt(401, "x:1")!.status).toBe("failed");
  expect(xReceipt(500, "x:1")).toBeUndefined();
});

test("teks aduan polos dan memuat jumlah serta rentang waktu", async () => {
  const { complaintText } = await import("../src/collect/report");
  const t = complaintText({ title: "Narasi Uji", accounts: 12, posts: 30, from: Date.UTC(2026, 10, 1), to: Date.UTC(2026, 10, 3), layers: ["Copypasta", "Co-action"], platforms: ["X", "TikTok"] });
  expect(t).toContain("12 akun di X, TikTok memposting 30 konten");
  expect(t).toContain("1 November 2026");
  expect(t).not.toMatch(/[—–]/);
});
