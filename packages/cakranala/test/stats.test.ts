import { describe, expect, test } from "bun:test";
import { analyze, evaluate, type Dataset, type Event } from "../src";
import { normalize } from "../src/text";
import { cauchyCombine, nbTail, partialConjunction, poissonTail, rng } from "../src/util";

describe("statistics", () => {
  test("negative binomial tail reduces to Poisson", () => {
    expect(nbTail(9, 2.5, 0)).toBeCloseTo(poissonTail(9, 2.5), 12);
    expect(nbTail(9, 2.5, 1e-7)).toBeCloseTo(poissonTail(9, 2.5), 6);
    expect(nbTail(9, 2.5, 0.5)).toBeGreaterThan(poissonTail(9, 2.5));
  });
  test("cauchy combination stays finite with p of one", () => {
    expect(cauchyCombine([1, 1])).toBeLessThanOrEqual(1);
    expect(cauchyCombine([1e-20, 1])).toBeLessThan(1e-15);
  });
  test("partial conjunction of two families is the larger p", () => expect(partialConjunction([0.01, 0.2], 2)).toBe(0.2));
  test("normalization joins spaced letters and strips marks", () => expect(normalize("D A F T A R ṭnì")).toBe("daftar tni"));
});

const HOUR = 3_600_000;

function world(seed: number, operation: boolean): Dataset {
  const r = rng(seed);
  const actors = Array.from({ length: 200 }, (_, i) => `a${i}`);
  const events: Event[] = [];
  const t0 = Date.UTC(2026, 0, 1);
  let id = 0;
  for (const a of actors)
    for (let k = 0; k < 12; k++) events.push({ id: `e${id++}`, actor: a, action: "post", ts: t0 + r() * 72 * HOUR, tags: [`t${Math.floor(r() * 300)}`] });
  for (const a of actors.slice(0, 150)) events.push({ id: `e${id++}`, actor: a, action: "reshare", target: "viral", ts: t0 + 30 * HOUR + r() * 600_000 });
  if (operation)
    for (let w = 0; w < 6; w++) {
      const at = t0 + (5 + w * 11) * HOUR;
      for (const a of actors.slice(190)) events.push({ id: `e${id++}`, actor: a, action: "reshare", target: `push${w}`, ts: at + r() * 60_000 });
    }
  const truth = Object.fromEntries(actors.map((a, i) => [a, operation && i >= 190 ? "op:x:paid" : i < 150 ? "organic:viral" : "organic:base"]));
  return { version: 1, actors: actors.map((a) => ({ id: a, platform: "x" })), events: events.sort((x, y) => x.ts - y.ts), truth };
}

describe("null calibration", async () => {
  const quiet = world(3, false);
  const planted = world(3, true);
  const q = await analyze(quiet, { layers: ["coaction", "rhythm"] });
  const p = await analyze(planted, { layers: ["coaction", "rhythm"] });
  test("organic viral crowd is not flagged", () => expect(q.clusters.length).toBe(0));
  test("planted operation is recovered with a significant cluster", () => {
    const e = evaluate(p, planted.truth!);
    expect(e.operations[0].recall).toBeGreaterThanOrEqual(0.6);
    expect(e.organicFlagRate).toBe(0);
    expect(Math.max(...p.clusters.map((c) => c.p))).toBeLessThanOrEqual(0.05);
  });
  test("analysis is deterministic", async () => {
    const again = await analyze(planted, { layers: ["coaction", "rhythm"] });
    expect(again.clusters.map((c) => c.id)).toEqual(p.clusters.map((c) => c.id));
    expect(again.scores).toEqual(p.scores);
  });
});
