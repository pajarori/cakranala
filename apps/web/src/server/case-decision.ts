import { CASE_CONFIDENCES, CASE_DECISION_REASONS, CASE_VERDICTS, type CaseConfidence, type CaseDecision, type CaseDecisionReason, type CaseVerdict } from "./db";

export function parseCaseDecisionInput(value: unknown, caseId: string, reviewedBy: string, reviewedAt = Date.now()): CaseDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("decision must be an object");
  const body = value as Record<string, unknown>;
  const verdict = body.verdict;
  const confidence = body.confidence;
  const reasons = body.reasons;
  const note = body.note;
  if (!CASE_VERDICTS.includes(verdict as CaseVerdict)) throw new Error("verdict tidak valid");
  if (!CASE_CONFIDENCES.includes(confidence as CaseConfidence)) throw new Error("confidence tidak valid");
  if (!Array.isArray(reasons) || reasons.some((reason) => !CASE_DECISION_REASONS.includes(reason as CaseDecisionReason))) throw new Error("reason tidak valid");
  if (typeof note !== "string" || note.length > 4000) throw new Error("note tidak valid");
  return { caseId, verdict: verdict as CaseVerdict, confidence: confidence as CaseConfidence, reasons: reasons as CaseDecisionReason[], note, reviewedBy, reviewedAt };
}
