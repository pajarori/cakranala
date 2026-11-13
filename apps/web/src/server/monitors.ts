import { pseudonymize, simulate, type Dataset, type Scenario } from "cakranala";
import seruni from "cakranala/scenarios/seruni.json";
import { createXCollector, sessionFromEnv } from "@cakranala/collect-x";
import { audit, monitors, store, type Monitor, type MonitorKind } from "./db";

const scenario = seruni as Scenario;
const secret = process.env.PSEUDONYM_SECRET ?? crypto.randomUUID();
let collector: ReturnType<typeof createXCollector> | undefined;
const rate = { remaining: null as number | null, reset: null as number | null };

const x = () => (collector ??= (() => {
  const s = sessionFromEnv();
  if (!s) throw new Error("X session is not configured");
  return createXCollector(s);
})().catch((e) => {
  collector = undefined;
  throw e;
}));

export const rateState = () => ({ ...rate });

export function query(kind: MonitorKind, target: string) {
  const t = target.trim();
  if (kind === "topic") return t;
  if (kind === "account") {
    const h = t.replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, "").split(/[/?]/)[0];
    return `(to:${h} OR @${h})`;
  }
  if (kind === "post") {
    const id = t.match(/status\/(\d+)/)?.[1] ?? t.match(/^\d+$/)?.[0];
    if (!id) throw new Error("post monitor needs a post URL or ID");
    return `conversation_id:${id}`;
  }
  return t;
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
    const c = await x();
    const raw = await c.search(query(m.kind, m.target), { pages: m.pages, lang: m.kind === "topic" ? "in" : undefined });
    Object.assign(rate, c.rate);
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

export function createMonitor(input: { kind: MonitorKind; target: string; label?: string; intervalMin?: number; pages?: number; speed?: number }) {
  if (!["topic", "account", "post", "simulation"].includes(input.kind)) throw new Error("unknown monitor type");
  if (!input.target?.trim() || input.target.length > 200) throw new Error("target must be 1 to 200 characters");
  if (input.kind !== "simulation") query(input.kind, input.target);
  const m = {
    id: crypto.randomUUID(),
    kind: input.kind,
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
