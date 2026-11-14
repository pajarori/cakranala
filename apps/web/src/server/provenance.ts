import { SCHEMA_VERSION, type Report } from "cakranala";

export interface CaseProvenance {
  sourceMonitors: Array<{ id: string; label: string; kind: string; platform: string; target: string }>;
  eventCount: number;
  actorCount: number;
  detector: { schemaVersion: number; generatedAt: number; layers: string[]; nullReplicates: number; fdr: number };
}

export function buildCaseProvenance(input: {
  sourceMonitors: CaseProvenance["sourceMonitors"];
  eventCount: number;
  actorCount: number;
  report: Pick<Report, "generatedAt" | "stats" | "null">;
  fdr: number;
}): CaseProvenance {
  return {
    sourceMonitors: input.sourceMonitors,
    eventCount: input.eventCount,
    actorCount: input.actorCount,
    detector: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: input.report.generatedAt,
      layers: [...input.report.stats.layersRun],
      nullReplicates: input.report.null.replicates,
      fdr: input.fdr,
    },
  };
}
