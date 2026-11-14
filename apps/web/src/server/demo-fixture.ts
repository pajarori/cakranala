import { simulate, type Dataset, type Scenario } from "cakranala";
import seruni from "cakranala/scenarios/seruni.json";
import { createReport } from "./reports";
import { caseEvidence, refresh, restoreState, snapshot, type State } from "./analysis";
import { DEMO_FIXTURE } from "./monitors";
import { alerts, audit, caseDecisions, cases, db, evidence, monitors, reports, store, type CaseStatus } from "./db";
import { watchlist } from "./actors";

const sourceScenario = seruni as Scenario;
const scenario: Scenario = {
  ...sourceScenario,
  durationMin: 120,
  organic: { ...sourceScenario.organic, actors: 80, hubs: 5, eventsPerActor: 3 },
  viral: undefined,
  operations: sourceScenario.operations.map((operation) => ({ ...operation, size: Math.min(operation.size, 12), waves: 3 })),
};
const VERSION = "v2";
const SIMULATION_ID = "demo-fixture-simulation";
const META_KEY = "demo-fixture-version";
type MonitorInput = Parameters<typeof monitors.insert>[0];

const mockMonitors: MonitorInput[] = [
  { id: SIMULATION_ID, kind: "simulation", platform: "x", target: "1", label: "Demo feed · Pulau Seruni", intervalMin: 15, pages: 1, speed: 1, active: true, createdAt: Date.now() - scenario.durationMin * 60_000 },
  { id: "demo-fixture-x-topic", kind: "topic", platform: "x", target: "#PulauSeruni", label: "X · Isu Pulau Seruni", intervalMin: 15, pages: 3, speed: 1, active: false, createdAt: Date.now() - 12 * 60_000 },
  { id: "demo-fixture-youtube", kind: "topic", platform: "youtube", target: "Pulau Seruni border post", label: "YouTube · Reaksi publik", intervalMin: 30, pages: 2, speed: 1, active: false, createdAt: Date.now() - 28 * 60_000 },
  { id: "demo-fixture-telegram", kind: "account", platform: "telegram", target: "kanal_seruni_watch", label: "Telegram · Kanal pemantauan", intervalMin: 15, pages: 2, speed: 1, active: false, createdAt: Date.now() - 2 * 60 * 60_000 },
  { id: "demo-fixture-import", kind: "import", platform: "x", target: "demo-archive.json", label: "Import · Arsip percakapan demo", intervalMin: 15, pages: 1, speed: 1, active: false, createdAt: Date.now() - 45 * 60_000 },
];

function fixtureVersion() {
  return (db.query("SELECT value FROM demo_fixture_meta WHERE key = ?").get(META_KEY) as { value: string } | null)?.value;
}

function ensureTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS demo_fixture_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS demo_fixture_state (key TEXT PRIMARY KEY, json TEXT NOT NULL);
  `);
}

function resetFixtureRows() {
  db.query("DELETE FROM events WHERE monitor = ?").run(SIMULATION_ID);
  db.query("DELETE FROM actors WHERE id LIKE ?").run(`${SIMULATION_ID}:%`);
  db.query("DELETE FROM watchlist WHERE actor_id LIKE ?").run(`${SIMULATION_ID}:%`);
  db.query("DELETE FROM case_decision_history WHERE case_id LIKE 'demo-fixture-case-%'").run();
  db.query("DELETE FROM case_decisions WHERE case_id LIKE 'demo-fixture-case-%'").run();
  db.query("DELETE FROM reports WHERE case_id LIKE 'demo-fixture-case-%'").run();
  db.query("DELETE FROM case_evidence WHERE case_id LIKE 'demo-fixture-case-%'").run();
  db.query("DELETE FROM cases WHERE id LIKE 'demo-fixture-case-%'").run();
  db.query("DELETE FROM demo_fixture_state WHERE key = ?").run(META_KEY);
}

function restoreCachedFixtureState() {
  const row = db.query("SELECT json FROM demo_fixture_state WHERE key = ?").get(META_KEY) as { json: string } | null;
  if (!row) return false;
  const cached = JSON.parse(row.json) as State;
  restoreState({
    ...cached,
    updatedAt: Date.now(),
    analyzing: false,
    alerts: alerts.recent(),
    cases: cached.cases.map((view) => ({ ...view, ...(cases.get(view.id) ?? {}) })),
  });
  return true;
}
export function restoreDemoFixtureState() {
  if (!DEMO_FIXTURE) return false;
  ensureTables();
  return restoreCachedFixtureState();
}

function cacheFixtureState() {
  const current = snapshot();
  const fixtureCopies = cases.all()
    .filter((row) => row.id.startsWith("demo-fixture-case-"))
    .flatMap((row) => {
      const stored = caseEvidence(row.id);
      return stored ? [{ ...stored.view, ...row, active: false }] : [];
    });
  const cachedCases = [...current.cases, ...fixtureCopies.filter((copy) => !current.cases.some((item) => item.id === copy.id))];
  const cached: State = {
    updatedAt: current.updatedAt,
    analyzing: false,
    window: current.window,
    report: current.report,
    actors: current.actors,
    cases: cachedCases,
    alerts: current.alerts,
    evaluation: current.evaluation,
  };
  db.query("INSERT OR REPLACE INTO demo_fixture_state (key, json) VALUES (?, ?)").run(META_KEY, JSON.stringify(cached));
}

function ensureMonitors() {
  for (const input of mockMonitors) {
    const existing = monitors.get(input.id);
    if (existing) {
      if (input.id !== SIMULATION_ID && existing.active) monitors.setActive(input.id, false);
      continue;
    }
    monitors.insert(input);
    audit.add("monitor.created", input.id, { fixture: true, kind: input.kind, platform: input.platform, label: input.label });
    if (input.id !== SIMULATION_ID) db.query("UPDATE monitors SET note = ? WHERE id = ?").run("Data mock lokal untuk presentasi dan QA.", input.id);
  }
  return monitors.get(SIMULATION_ID)!;
}

function fixtureDataset(monitorId: string, now: number): Dataset {
  const source = simulate(scenario, 1);
  const first = Math.min(...source.events.map((event) => event.ts));
  const last = Math.max(...source.events.map((event) => event.ts));
  const base = now - (last - first);
  const prefix = (id: string) => `${monitorId}:${id}`;
  const actors = source.actors.map((actor) => ({ ...actor, id: prefix(actor.id), label: source.truth?.[actor.id] }));
  const events = source.events.map((event) => ({ ...event, id: prefix(event.id), actor: prefix(event.actor), target: event.target ? prefix(event.target) : undefined, ts: base + event.ts - first }));
  const truth = source.truth ? Object.fromEntries(Object.entries(source.truth).map(([id, label]) => [prefix(id), label])) : undefined;
  return { version: source.version, actors, events, truth, meta: { source: "Cakra Nala deterministic demo fixture", query: "Pulau Seruni" } };
}

function ensureReviewCopies(baseId: string, now: number) {
  const baseCase = cases.get(baseId);
  const baseEvidence = caseEvidence(baseId);
  if (!baseCase || !baseEvidence) return { ids: [] as string[], changed: false };
  const statuses: Array<{ status: CaseStatus; title: string; note: string }> = [
    { status: "new", title: "Demo · Kasus baru untuk triase", note: "Gunakan untuk mencoba alur triase awal." },
    { status: "investigating", title: "Demo · Kasus sedang diselidiki", note: "Gunakan untuk mencoba status investigasi dan evidence review." },
    { status: "confirmed", title: "Demo · Koordinasi terkonfirmasi", note: "Gunakan untuk mencoba alur eskalasi dan laporan komandan." },
    { status: "dismissed", title: "Demo · False positive untuk pembanding", note: "Gunakan untuk mencoba status dismissed dan pembanding analis." },
  ];
  let changed = false;
  const ids: string[] = [];
  for (const [index, item] of statuses.entries()) {
    const id = `demo-fixture-case-${item.status}`;
    ids.push(id);
    if (cases.get(id)) continue;
    const row = { ...baseCase, id, title: item.title, brief: item.note, status: item.status, createdAt: now - (index + 1) * 60 * 60_000 };
    cases.upsert(row);
    evidence.put(id, now, { ...baseEvidence, view: { ...baseEvidence.view, ...row, active: false } });
    audit.add("case.created", id, { fixture: true, status: item.status, sourceCase: baseId });
    changed = true;
  }
  return { ids, changed };
}

async function ensureReportsAndDecisions(caseIds: string[]) {
  const activeIds = snapshot().cases.filter((item) => item.active).map((item) => item.id);
  const ids = [...new Set([...activeIds, ...caseIds])];
  const currentSnapshot = snapshot();
  const missing = ids.flatMap((id) => {
    if (currentSnapshot.cases.some((item) => item.id === id)) return [];
    const row = cases.get(id);
    const stored = caseEvidence(id);
    if (!row || !stored) throw new Error(`demo fixture case ${id} tidak terhidrasi`);
    return [{ ...stored.view, ...row, active: false }];
  });
  if (missing.length) {
    restoreState({
      updatedAt: currentSnapshot.updatedAt,
      analyzing: false,
      window: currentSnapshot.window,
      report: currentSnapshot.report,
      actors: currentSnapshot.actors,
      cases: [...currentSnapshot.cases, ...missing],
      alerts: currentSnapshot.alerts,
      evaluation: currentSnapshot.evaluation,
    });
  }
  const current = ids.map((id) => snapshot().cases.find((item) => item.id === id)!);
  const existingReports = reports.all();
  for (const c of current) {
    if (!existingReports.some((report) => report.caseId === c.id)) {
      const report = await createReport(c.id, "demo-analyst");
      const counter = `Klarifikasi demo: periksa sumber resmi, waktu unggahan, dan pola koordinasi sebelum mengambil kesimpulan.`;
      reports.setCounter(report.id, counter);
      audit.add("report.counter", report.id, { fixture: true, caseId: c.id });
    }
    if (!caseDecisions.get(c.id)) {
      const decision = c.status === "confirmed"
        ? { verdict: "coordinated_influence" as const, confidence: "high" as const, reasons: ["copy_paste", "synchronized_actions", "shared_urls_or_tags"] as const, note: "Fixture decision: several independent signals align." }
        : c.status === "dismissed"
          ? { verdict: "false_positive" as const, confidence: "low" as const, reasons: ["statistical_cluster"] as const, note: "Fixture decision: use as a false-positive review example." }
          : { verdict: "insufficient_evidence" as const, confidence: "medium" as const, reasons: ["rhythm_or_cadence"] as const, note: "Fixture decision: evidence needs analyst review." };
      const saved = caseDecisions.put({ caseId: c.id, ...decision, reasons: [...decision.reasons], reviewedBy: "demo-analyst", reviewedAt: Date.now() });
      audit.add("case.decision", c.id, { fixture: true, verdict: saved.verdict, confidence: saved.confidence, reasons: saved.reasons, by: saved.reviewedBy });
    }
  }
}


export async function seedDemoFixture() {
  if (!DEMO_FIXTURE) return;
  ensureTables();
  const simulation = ensureMonitors();
  const version = fixtureVersion();
  const firstRun = version !== VERSION;
  const now = Date.now();
  if (!firstRun && restoreCachedFixtureState()) return;
  if (firstRun) {
    resetFixtureRows();
    monitors.replay(simulation.id, now - scenario.durationMin * 60_000);
    const dataset = fixtureDataset(simulation.id, now);
    const added = store.add(simulation.id, dataset.actors, dataset.events);
    monitors.ran(simulation.id, now, null, added);
    const watched = dataset.actors.find((actor) => actor.id.includes(`${SIMULATION_ID}:opA_`));
    if (watched && !watchlist.get(watched.id)) {
      watchlist.add(watched.id, "Demo watchlist entry untuk menguji alert akun.", "demo-analyst");
      audit.add("actor.watched", watched.id, { fixture: true, by: "demo-analyst" });
    }
  }

  await refresh(true);
  const base = snapshot().cases.find((item) => item.active && item.clusters.length > 0) ?? snapshot().cases.find((item) => item.active);
  if (!base) throw new Error("demo fixture tidak menghasilkan case");
  const copies = ensureReviewCopies(base.id, now);
  if (copies.changed) await refresh(true);
  if (firstRun) alerts.add({ ts: now, kind: "new", caseId: base.id, text: "Demo fixture aktif: tersedia kasus, evidence, reports, dan disposition untuk QA." });
  await ensureReportsAndDecisions(copies.ids);
  if (firstRun) {
    cacheFixtureState();
    db.query("INSERT OR REPLACE INTO demo_fixture_meta (key, value) VALUES (?, ?)").run(META_KEY, VERSION);
    audit.add("demo.fixture", META_KEY, { version: VERSION, cases: snapshot().cases.length, monitors: mockMonitors.length });
  }
}
