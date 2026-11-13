import type { Cluster, Narrative, View } from "./api";

export type Profile = { label: string; tone: "danger" | "warning" | "info" };

export function profile(c: Cluster): Profile {
  const layers = new Set(c.layers.map((l) => l.layer));
  if ((c.forensics.rotation ?? 0) >= 0.7) return { label: "Scripted", tone: "danger" };
  if (layers.has("copypasta") && !layers.has("coframing")) return { label: "Copy-driven", tone: "warning" };
  return { label: "Human-paced", tone: "info" };
}

export const inflation = (n: Narrative) => n.supporters / Math.max(1, n.sie.value);

export const narrativesOf = (view: View, clusterId: string) => view.report.narratives.filter((n) => n.clusters.some((c) => c.id === clusterId));

export const manufactured = (view: View) => view.report.narratives.filter((n) => n.clusters.length);
