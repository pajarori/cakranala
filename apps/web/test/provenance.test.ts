import { describe, expect, test } from "bun:test";
import { buildCaseProvenance } from "../src/server/provenance";

describe("case provenance", () => {
  test("preserves source and detector evidence needed for reproduction", () => {
    const provenance = buildCaseProvenance({
      sourceMonitors: [{ id: "monitor-1", label: "Election archive", kind: "import", platform: "x", target: "archive.csv" }],
      eventCount: 42,
      actorCount: 7,
      report: { generatedAt: 1_700_000_000_000, stats: { actors: 7, events: 42, flaggedActors: 5, layersRun: ["coaction", "copypasta"] }, null: { replicates: 19, alpha: 0.05, decoyFdr: 0.01 } },
      fdr: 0.05,
    });
    expect(provenance).toEqual({
      sourceMonitors: [{ id: "monitor-1", label: "Election archive", kind: "import", platform: "x", target: "archive.csv" }],
      eventCount: 42,
      actorCount: 7,
      detector: { schemaVersion: 1, generatedAt: 1_700_000_000_000, layers: ["coaction", "copypasta"], nullReplicates: 19, fdr: 0.05 },
    });
  });

  test("supports empty source metadata without inventing provenance", () => {
    const provenance = buildCaseProvenance({
      sourceMonitors: [],
      eventCount: 0,
      actorCount: 0,
      report: { generatedAt: 1, stats: { actors: 0, events: 0, flaggedActors: 0, layersRun: [] }, null: { replicates: 0, alpha: 0.05, decoyFdr: 0 } },
      fdr: 0.05,
    });
    expect(provenance.sourceMonitors).toEqual([]);
    expect(provenance.eventCount).toBe(0);
    expect(provenance.actorCount).toBe(0);
    expect(provenance.detector.layers).toEqual([]);
  });
});
