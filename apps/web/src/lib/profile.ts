import type { Cluster, Narrative, View } from "./api";

export const profile = (c: Cluster) => ((c.forensics.rotation ?? 0) >= 0.7 ? "Scripted" : c.layers.some((l) => l.layer === "coframing") ? "Human-paced" : "Copy-driven");

export const inflation = (n: Narrative) => n.supporters / Math.max(1, n.sie.value);

export const isCoordinated = (n: Narrative) => n.verdict === "manufactured";

export const coordinated = (view: View) => view.report.narratives.filter(isCoordinated);

export const narrativesOf = (view: View, clusterId: string) => coordinated(view).filter((n) => n.clusters.some((c) => c.id === clusterId));

export const headline = (view: View) => [...coordinated(view)].sort((a, b) => b.supporters - b.sie.value - (a.supporters - a.sie.value))[0];
