import type { Report } from "cakranala";
import framework from "../../config/disarm.json";

export interface Technique {
  id: string;
  name: string;
  stix: string;
  url: string;
}

const RULES = framework.rules as Record<string, Technique>;

export const DISARM_SOURCE = framework.source;

export function techniques(report: Report, clusterIds: string[], narrativeIds: string[], events: { actor: string; action: string }[]): Technique[] {
  const clusters = report.clusters.filter((c) => clusterIds.includes(c.id));
  const narratives = report.narratives.filter((n) => narrativeIds.includes(n.id));
  const members = new Set(clusters.flatMap((c) => c.members));
  const layers = new Set(clusters.flatMap((c) => c.layers.map((l) => l.layer)));
  const hits = new Set<string>();
  if (layers.has("copypasta")) hits.add("copypasta");
  if (layers.has("coaction")) hits.add("coaction");
  if (layers.has("lifecycle")) hits.add("lifecycle");
  if (clusters.some((c) => (c.forensics.rotation ?? 0) >= 0.7)) hits.add("scripted");
  if (narratives.some((n) => n.tags.length) && layers.has("coaction")) hits.add("hashtag");
  if (events.some((e) => members.has(e.actor) && (e.action === "reply" || e.action === "comment"))) hits.add("reply");
  if (narratives.some((n) => n.verdict === "manufactured")) hits.add("manufactured");
  return [...hits].flatMap((k) => (RULES[k] ? [RULES[k]] : []));
}
