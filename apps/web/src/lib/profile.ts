import type { Cluster, Narrative } from "./api";

export const profile = (c: Cluster) => ((c.forensics.rotation ?? 0) >= 0.7 ? "Scripted" : c.layers.some((l) => l.layer === "coframing") ? "Human-paced" : "Copy-driven");

export const inflation = (n: { supporters: number; sie: { value: number } }) => n.supporters / Math.max(1, n.sie.value);

export const isCoordinated = (n: Narrative) => n.verdict === "manufactured";
