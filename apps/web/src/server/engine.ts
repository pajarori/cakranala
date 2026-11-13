import { analyze, evaluate, shield, simulate, LAYERS, type Evaluation, type LayerId, type Scenario, type ShieldInput } from "cakranala";
import seruni from "cakranala/scenarios/seruni.json";
import registry from "../../config/registry.json";
import taxonomy from "../../config/taxonomy.json";
import { library } from "./library";
import { credentials } from "./credentials";
import { embedder, reasoner, snapshot, SEVERITY } from "./analysis";

const scenario = seruni as Scenario;

export const runShield = async (input: ShieldInput) =>
  shield(input, {
    report: snapshot().report ?? undefined,
    officialDomains: registry.officialDomains,
    library: library().map((l) => ({ claim: l.claim, verdict: l.verdict, source: l.url, title: l.title })),
    taxonomy,
    embedder: await embedder(),
    reasoner,
  });

const ABLATIONS: { name: string; layers: LayerId[] }[] = [
  { name: "Copypasta only", layers: ["copypasta"] },
  { name: "Co-action only", layers: ["coaction"] },
  { name: "Lexical", layers: ["coaction", "copypasta"] },
  { name: "No semantic layer", layers: LAYERS.filter((l) => l !== "coframing") },
  { name: "Full multiplex", layers: LAYERS },
];

let ablation: Promise<unknown> | undefined;
export function runAblation(seeds = [1, 2, 3]) {
  ablation ??= (async () => {
    const e = await embedder();
    const rows = [];
    for (const a of ABLATIONS) {
      const runs: Evaluation[] = [];
      for (const seed of seeds) {
        const ds = simulate(scenario, seed);
        runs.push(evaluate(await analyze(ds, { embedder: e, layers: a.layers, seed }), ds.truth!));
      }
      const avg = (f: (x: Evaluation) => number) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
      const kind = (k: string) => avg((r) => r.operations.find((o) => o.kind === k)?.recall ?? 0);
      rows.push({ name: a.name, precision: avg((r) => r.precision), recall: avg((r) => r.recall), f1: avg((r) => r.f1), paid: kind("paid"), botfarm: kind("botfarm"), swarm: kind("swarm"), organicFP: avg((r) => r.organicFlagRate), viralFP: avg((r) => r.viralFlagRate ?? 0) });
    }
    return { seeds, rows };
  })().catch((e) => {
    ablation = undefined;
    throw e;
  });
  return ablation;
}

export const capabilities = () => ({ live: credentials.count("x") > 0, reasoner: !!reasoner, scenario: scenario.name, severity: SEVERITY });
