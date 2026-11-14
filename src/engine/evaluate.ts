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

export interface Ranking {
  ap: number;
  prevalence: number;
  lift: number;
  precisionAt: Record<string, number>;
}

export function ranking(scores: Record<string, number>, truth: Truth, ks: number[] = [10, 50]): Ranking {
  const actors = Object.keys(truth);
  const isOp = (a: string) => truth[a].startsWith("op:");
  const positives = actors.filter(isOp).length;
  const groups = [...groupBy(actors, (a) => scores[a] ?? 0)].sort((x, y) => y[0] - x[0]).map(([, ms]) => ms);
  let ap = 0;
  let rank = 0;
  let tp = 0;
  const hits: number[] = [];
  for (const g of groups) {
    const p = g.filter(isOp).length;
    for (let i = 1; i <= p; i++) ap += (tp + i) / (rank + (i * (g.length + 1)) / (p + 1));
    for (let i = 0; i < g.length; i++) hits.push(tp + ((i + 1) * p) / g.length);
    rank += g.length;
    tp += p;
  }
  const prevalence = positives / Math.max(1, actors.length);
  const at = (k: number) => (k > 0 ? hits[Math.min(k, hits.length) - 1] / Math.min(k, hits.length) : 0);
  ap = positives ? ap / positives : 0;
  return {
    ap,
    prevalence,
    lift: prevalence ? ap / prevalence : 0,
    precisionAt: Object.fromEntries([...ks.map((k) => [String(k), at(k)]), ["R", at(positives)]]),
  };
}
