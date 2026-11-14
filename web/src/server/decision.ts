import { LAYERS, type LayerId } from "cakranala";
import type { CaseStatus } from "./db";

export const VERDICT_STATUS = { coordinated: "confirmed", benign: "dismissed", false_positive: "dismissed", insufficient: "investigating" } as const satisfies Record<string, CaseStatus>;
export type Verdict = keyof typeof VERDICT_STATUS;
export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export interface Decision {
  caseId: string;
  verdict: Verdict;
  confidence: Confidence;
  reasons: LayerId[];
  note: string;
  by: string;
  at: number;
}

export function parseDecision(body: any, caseId: string, by: string, at = Date.now()): Decision {
  if (!Object.hasOwn(VERDICT_STATUS, body?.verdict ?? "")) throw new Error("verdict tidak valid");
  if (!CONFIDENCES.includes(body.confidence)) throw new Error("tingkat keyakinan tidak valid");
  if (!Array.isArray(body.reasons) || body.reasons.some((r: string) => !LAYERS.includes(r as LayerId))) throw new Error("alasan tidak valid");
  if (typeof body.note !== "string" || body.note.length > 4000) throw new Error("catatan maksimal 4000 karakter");
  return { caseId, verdict: body.verdict, confidence: body.confidence, reasons: [...new Set<LayerId>(body.reasons)], note: body.note.trim(), by, at };
}
