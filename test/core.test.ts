import { describe, expect, test } from "bun:test";
import { analyze, evaluate, pseudonymize, ranking, shield, simulate, validate, type Scenario } from "../src";
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
  test("pseudonymisasi menyamarkan handle tanpa mengubah struktur", async () => {
    const p = await pseudonymize(ds, "rahasia");
    expect(p.actors[0].handle).toMatch(/^akun_[0-9a-f]{10}$/);
    expect(p.events.length).toBe(ds.events.length);
    expect(new Set(p.actors.map((a) => a.id)).size).toBe(ds.actors.length);
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

test("ranking metrics handle perfect order and ties", () => {
  const truth = { a: "op:x:io", b: "op:x:io", c: "organic:control", d: "organic:control" };
  expect(ranking({ a: 3, b: 2, c: 1 }, truth).ap).toBe(1);
  expect(ranking({}, truth).ap).toBeCloseTo(0.6, 2);
  expect(ranking({ c: 3, d: 2 }, truth).precisionAt.R).toBe(0);
});

describe("swarm pelan", async () => {
  const slow = (await import("./slow-swarm.json")).default as Scenario;
  const { LAYERS } = await import("../src");
  const runs = await Promise.all(
    [1, 2, 3].map(async (seed) => {
      const ds = simulate(slow, seed);
      const base = evaluate(await analyze(ds, { layers: LAYERS.filter((l) => l !== "portfolio") }), ds.truth!);
      const full = evaluate(await analyze(ds), ds.truth!);
      return { base, full };
    }),
  );
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const recall = (k: "base" | "full") => mean(runs.map((r) => r[k].operations.find((o) => o.kind === "slowswarm")!.recall));
  test("lapisan portfolio menaikkan recall swarm pelan", () => expect(recall("full")).toBeGreaterThan(recall("base")));
  test("tanpa false positive organik maupun viral", () => {
    for (const r of runs) {
      expect(r.full.organicFlagRate).toBe(0);
      expect(r.full.viralFlagRate).toBe(0);
    }
  });
});
