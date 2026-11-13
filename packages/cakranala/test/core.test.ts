import { describe, expect, test } from "bun:test";
import { analyze, evaluate, shield, simulate, validate, type Scenario } from "../src";
import scenario from "../scenarios/seruni.json";

const ds = simulate(scenario as Scenario, 1);

describe("schema", () => {
  test("simulasi lolos validasi", () => expect(() => validate(ds)).not.toThrow());
  test("menolak versi asing", () => expect(() => validate({ ...ds, version: 99 })).toThrow());
  test("simulasi deterministik", () => expect(simulate(scenario as Scenario, 1).events.length).toBe(ds.events.length));
});

describe("deteksi tanpa embedder", async () => {
  const report = await analyze(ds);
  const e = evaluate(report, ds.truth!);
  const bot = report.clusters.find((c) => c.members.every((m) => ds.truth![m].endsWith(":botfarm")))!;
  test("tanpa false positive organik maupun viral", () => {
    expect(e.organicFlagRate).toBe(0);
    expect(e.viralFlagRate).toBe(0);
  });
  test("bot farm terdeteksi dengan sidik urutan giliran", () => {
    expect(e.operations.find((o) => o.kind === "botfarm")!.recall).toBeGreaterThan(0.9);
    expect(bot.forensics.rotation!).toBeGreaterThan(0.8);
  });
  test("SIE bot farm mendekati satu suara", () => {
    const n = report.narratives.find((x) => x.clusters.some((c) => c.id === bot.id))!;
    expect(n.sie.value).toBeLessThan(5);
  });
});

describe("perisai", () => {
  const official = ["ad.rekrutmen-tni.mil.id"];
  test("domain tiruan dan permintaan uang", async () => {
    const r = await shield({ text: "Daftar jalur khusus di ad-rekrutmen-tni.com/daftar, transfer Rp2jt" }, { officialDomains: official });
    expect(r.urls[0].imitates).toBe("ad.rekrutmen-tni.mil.id");
    expect(r.cues).toContain("menyebut nominal uang");
    expect(r.risk).not.toBe("rendah");
  });
  test("domain resmi tidak ditandai", async () => {
    const r = await shield({ text: "Info resmi di https://ad.rekrutmen-tni.mil.id, gratis." }, { officialDomains: official });
    expect(r.risk).toBe("rendah");
  });
  test("punycode ditandai", async () => {
    const r = await shield({ text: "cek http://xn--tniad-9ya.com sekarang" }, { officialDomains: official });
    expect(r.urls[0].flags.some((f) => f.includes("punycode"))).toBe(true);
  });
});
