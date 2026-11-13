import { notFound } from "@tanstack/react-router";
import { ensureView } from "@/lib/queries";

export const requireNarrative = async (id: string) => {
  const view = await ensureView();
  if (!view.report.narratives.some((n) => n.id === id)) throw notFound();
};

export const requireCluster = async (id: string) => {
  const view = await ensureView();
  if (!view.report.clusters.some((c) => c.id === id)) throw notFound();
};
