import { afterEach, describe, expect, test } from "bun:test";
import { parseCaseDecisionInput } from "../src/server/case-decision";
import { caseDecisions, db } from "../src/server/db";

const caseId = `test-disposition-${crypto.randomUUID()}`;

afterEach(() => {
  db.query("DELETE FROM case_decisions WHERE case_id = ?").run(caseId);
  db.query("DELETE FROM case_decision_history WHERE case_id = ?").run(caseId);
});

describe("analyst disposition", () => {
  test("rejects invalid verdict, reason, and oversized notes", () => {
    expect(() => parseCaseDecisionInput({ verdict: "unknown", confidence: "low", reasons: [], note: "" }, caseId, "analyst")).toThrow("verdict tidak valid");
    expect(() => parseCaseDecisionInput({ verdict: "false_positive", confidence: "low", reasons: ["unknown"], note: "" }, caseId, "analyst")).toThrow("reason tidak valid");
    expect(() => parseCaseDecisionInput({ verdict: "false_positive", confidence: "low", reasons: [], note: "x".repeat(4001) }, caseId, "analyst")).toThrow("note tidak valid");
  });

  test("returns the latest decision and appends every review to history", () => {
    const first = parseCaseDecisionInput({ verdict: "coordinated_influence", confidence: "medium", reasons: ["copy_paste", "synchronized_actions"], note: "Repeated text and timing." }, caseId, "analyst", 1_700_000_000_000);
    const latest = { ...first, confidence: "high" as const, note: "Repeated text, timing, and shared tags." };
    caseDecisions.put(first);
    caseDecisions.put(latest);

    expect(caseDecisions.get(caseId)).toEqual(latest);
    const history = db.query("SELECT COUNT(*) AS count FROM case_decision_history WHERE case_id = ?").get(caseId) as { count: number };
    expect(history.count).toBe(2);
  });
});
