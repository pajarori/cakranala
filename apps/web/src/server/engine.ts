import { shield, type Scenario, type ShieldInput } from "cakranala";
import seruni from "cakranala/scenarios/seruni.json";
import registry from "../../config/registry.json";
import taxonomy from "../../config/taxonomy.json";
import { library } from "./library";
import { credentials } from "./credentials";
import { collector, DEMO_MODE } from "./monitors";
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

export const capabilities = () => ({ demo: DEMO_MODE, live: credentials.count("x") > 0, tiktok: collector.tiktok, reasoner: !!reasoner, scenario: scenario.name, severity: SEVERITY });
