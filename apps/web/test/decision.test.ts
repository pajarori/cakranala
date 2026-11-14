import { describe, expect, test } from "bun:test";
import { parseDecision, VERDICT_STATUS } from "../src/server/decision";

const parse = (body: object) => parseDecision(body, "c", "analis", 1);

describe("keputusan analis", () => {
  test("menolak verdict, alasan dan catatan yang tidak valid", () => {
    expect(() => parse({ verdict: "x", confidence: "low", reasons: [], note: "" })).toThrow("verdict");
    expect(() => parse({ verdict: "coordinated", confidence: "x", reasons: [], note: "" })).toThrow("keyakinan");
    expect(() => parse({ verdict: "coordinated", confidence: "low", reasons: ["x"], note: "" })).toThrow("alasan");
    expect(() => parse({ verdict: "coordinated", confidence: "low", reasons: [], note: "x".repeat(4001) })).toThrow("catatan");
  });

  test("alasan memakai layer detektor tanpa duplikat", () => {
    expect(parse({ verdict: "coordinated", confidence: "high", reasons: ["copypasta", "coaction", "copypasta"], note: " sama " })).toEqual({
      caseId: "c",
      verdict: "coordinated",
      confidence: "high",
      reasons: ["copypasta", "coaction"],
      note: "sama",
      by: "analis",
      at: 1,
    });
  });

  test("verdict menentukan status kasus", () => {
    expect(VERDICT_STATUS).toEqual({ coordinated: "confirmed", benign: "dismissed", false_positive: "dismissed", insufficient: "investigating" });
  });
});
