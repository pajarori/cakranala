import type { Truth } from "./schema";
import type { Report } from "./detect";
import { groupBy } from "./util";

export interface Evaluation {
  precision: number;
  recall: number;
  f1: number;
  operations: { id: string; kind: string; size: number; recall: number }[];
  organicFlagRate: number;
  viralFlagRate: number | null;
}

export function evaluate(report: Report, truth: Truth): Evaluation {
  const flagged = new Set(report.clusters.flatMap((c) => c.members));
  const actors = Object.keys(truth);
  const isOp = (a: string) => truth[a].startsWith("op:");
  const tp = actors.filter((a) => isOp(a) && flagged.has(a)).length;
  const fp = actors.filter((a) => !isOp(a) && flagged.has(a)).length;
  const fn = actors.filter((a) => isOp(a) && !flagged.has(a)).length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const rate = (xs: string[]) => (xs.length ? xs.filter((a) => flagged.has(a)).length / xs.length : null);
  return {
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    operations: [...groupBy(actors.filter(isOp), (a) => truth[a])].map(([label, ms]) => {
      const [, id, kind] = label.split(":");
      return { id, kind, size: ms.length, recall: rate(ms) ?? 0 };
    }),
    organicFlagRate: rate(actors.filter((a) => !isOp(a))) ?? 0,
    viralFlagRate: rate(actors.filter((a) => truth[a] === "organic:viral")),
  };
}
