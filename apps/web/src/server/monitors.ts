import { pseudonymize, simulate, type Dataset, type Scenario } from "cakranala";
import seruni from "cakranala/scenarios/seruni.json";
import { createCollector, sessionFromEnv, sidecarFromEnv, validate, type Kind } from "jala";
import { audit, monitors, store, type Monitor, type MonitorKind, type Platform } from "./db";
import { credentials, pool } from "./credentials";

const scenario = seruni as Scenario;
const secret = process.env.PSEUDONYM_SECRET ?? crypto.randomUUID();
export const collector = createCollector({ pool, tiktok: sidecarFromEnv() });

export const rateState = () => ({ ...collector.rate });

export function importEnvCredential() {
  const s = sessionFromEnv();
  if (s && !credentials.count("x")) return credentials.add("x", "Imported from environment", { authToken: s.authToken, ct0: s.ct0, userAgent: s.userAgent });
}

const sims = new Map<string, Dataset>();

const REPLAY_AFTER = 12 * 3_600_000;

function revealSimulation(m: Monitor, now: number) {
  const seed = Number(m.target) || 1;
  const ds = sims.get(m.id) ?? simulate(scenario, seed);
  sims.set(m.id, ds);
  const t0 = Math.min(...ds.events.map((e) => e.ts));
  const span = Math.max(...ds.events.map((e) => e.ts)) - t0;
  const base = m.createdAt - span;
  const progress = Math.min(1, ((now - m.createdAt) * m.speed) / span);
  const prefix = (id: string) => `${m.id}:${id}`;
  const events = ds.events
    .filter((e) => e.ts - t0 <= progress * span)
    .map((e) => ({ ...e, id: prefix(e.id), actor: prefix(e.actor), target: e.target && prefix(e.target), ts: base + (e.ts - t0) }));
  const actors = ds.actors.map((a) => ({ ...a, id: prefix(a.id), label: ds.truth?.[a.id] }));
  return { actors, events, progress };
}

export async function runMonitor(m: Monitor, now = Date.now()) {
  try {
    if (m.kind === "simulation") {
      if (now - m.createdAt > REPLAY_AFTER) {
        monitors.replay(m.id, now);
        audit.add("monitor.replayed", m.id);
        m = { ...m, createdAt: now };
      }
      const { actors, events } = revealSimulation(m, now);
      monitors.ran(m.id, now, null, store.add(m.id, actors, events));
      return;
    }
    const raw = await collector.collect({ platform: m.platform, kind: m.kind as Kind, target: m.target, pages: m.pages });
    const ds = await pseudonymize(raw, secret);
    monitors.ran(m.id, now, raw.meta?.coverage === 0 ? "rate limited" : null, store.add(m.id, ds.actors, ds.events));
  } catch (e) {
    monitors.ran(m.id, now, e instanceof Error ? e.message : String(e), 0);
  }
}

const SPAN = scenario.durationMin * 60_000;

export const simulationProgress = (m: Monitor, at = Date.now()) => Math.min(1, ((at - m.createdAt) * m.speed) / SPAN);

export function due(m: Monitor, now = Date.now()) {
  if (!m.active) return false;
  if (m.lastRunAt === null) return true;
  if (m.kind === "simulation") return now - m.createdAt > REPLAY_AFTER || (simulationProgress(m, m.lastRunAt) < 1 && now - m.lastRunAt >= 20_000);
  return now - m.lastRunAt >= m.intervalMin * 60_000;
}

export function createMonitor(input: { kind: MonitorKind; platform?: Platform; target: string; label?: string; intervalMin?: number; pages?: number; speed?: number }) {
  if (!["topic", "account", "post", "simulation"].includes(input.kind)) throw new Error("unknown monitor type");
  if (!input.target?.trim() || input.target.length > 200) throw new Error("target must be 1 to 200 characters");
  const platform = input.platform ?? "x";
  if (input.kind !== "simulation") validate({ platform, kind: input.kind as Kind, target: input.target });
  const m = {
    id: crypto.randomUUID(),
    kind: input.kind,
    platform,
    target: input.target.trim(),
    label: input.label?.trim() || (input.kind === "simulation" ? `Demo feed, seed ${input.target.trim()}` : input.target.trim()),
    intervalMin: Math.min(240, Math.max(5, Math.round(input.intervalMin ?? 15))),
    pages: Math.min(10, Math.max(1, Math.round(input.pages ?? 3))),
    speed: Math.min(600, Math.max(1, Math.round(input.speed ?? 60))),
    active: true,
    createdAt: Date.now(),
  };
  monitors.insert(m);
  return monitors.get(m.id)!;
}
