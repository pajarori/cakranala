import { serve } from "bun";
import { timingSafeEqual } from "node:crypto";
import index from "./index.html";
import { capabilities, runAblation, runShield } from "./server/engine";
import { refresh, snapshot } from "./server/analysis";
import { createMonitor } from "./server/monitors";
import { alerts, audit, cases, monitors, reports, type CaseStatus, type MonitorKind } from "./server/db";
import { counterNarrative, createReport } from "./server/reports";
import { stixBundle } from "./server/stix";

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (fn: (req: Bun.BunRequest, server: Bun.Server<undefined>) => Promise<unknown> | unknown) => async (req: Bun.BunRequest, server: Bun.Server<undefined>) => {
  try {
    return Response.json(await fn(req, server));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: e instanceof HttpError ? e.status : 400 });
  }
};

const operator = (req: Request) => {
  const token = process.env.OPERATOR_TOKEN ?? "";
  const given = req.headers.get("x-operator-token") ?? "";
  if (!(token.length > 0 && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token)))) throw new HttpError(401, "operator token required");
};

const SHIELD_PER_MINUTE = Number(process.env.SHIELD_PER_MINUTE ?? 20);
const windows = new Map<string, { start: number; count: number }>();

const limit = (req: Request, server: Bun.Server<undefined>) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || server.requestIP(req)?.address || "unknown";
  const now = Date.now();
  const w = windows.get(ip);
  if (!w || now - w.start > 60_000) {
    if (windows.size > 10_000) windows.clear();
    windows.set(ip, { start: now, count: 1 });
  } else if (++w.count > SHIELD_PER_MINUTE) throw new HttpError(429, "too many requests, try again in a minute");
};

const STATUSES: CaseStatus[] = ["new", "investigating", "confirmed", "dismissed"];

const server = serve({
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: 7_000_000,
  idleTimeout: 255,
  routes: {
    "/*": index,
    "/api/capabilities": { GET: json(() => capabilities()) },
    "/api/state": { GET: json(() => snapshot()) },
    "/api/monitors": {
      POST: json(async (req) => {
        operator(req);
        const body = await req.json();
        const m = createMonitor({ ...body, kind: body.kind as MonitorKind });
        audit.add("monitor.created", m.id, { kind: m.kind, target: m.target });
        refresh(true);
        return m;
      }),
    },
    "/api/monitors/:id": {
      PATCH: json(async (req) => {
        const m = monitors.get(req.params.id);
        if (!m) throw new HttpError(404, "monitor not found");
        operator(req);
        const active = !!(await req.json()).active;
        monitors.setActive(m.id, active);
        audit.add(active ? "monitor.resumed" : "monitor.paused", m.id);
        return monitors.get(m.id);
      }),
      DELETE: json((req) => {
        const m = monitors.get(req.params.id);
        if (!m) throw new HttpError(404, "monitor not found");
        operator(req);
        monitors.remove(m.id);
        audit.add("monitor.deleted", m.id, { kind: m.kind, target: m.target });
        refresh(true);
        return { ok: true };
      }),
    },
    "/api/audit": { GET: json(() => ({ ...audit.verify(), recent: audit.recent() })) },
    "/api/operator": { POST: json((req) => (operator(req), { ok: true })) },
    "/api/cases/:id": {
      PATCH: json(async (req) => {
        operator(req);
        const c = cases.get(req.params.id);
        if (!c) throw new HttpError(404, "case not found");
        const { status } = await req.json();
        if (!STATUSES.includes(status)) throw new Error("invalid status");
        cases.setStatus(c.id, status);
        audit.add("case.status", c.id, { from: c.status, to: status });
        alerts.add({ ts: Date.now(), kind: "status", caseId: c.id, text: `${c.title} marked ${status}` });
        await refresh(true);
        return { ok: true };
      }),
    },
    "/api/cases/:id/stix": {
      GET: (req) => {
        try {
          return new Response(JSON.stringify(stixBundle(req.params.id), null, 2), { headers: { "content-type": "application/stix+json;version=2.1", "content-disposition": `attachment; filename="case-${req.params.id}.stix.json"` } });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 404 });
        }
      },
    },
    "/api/cases/:id/reports": { POST: json((req) => (operator(req), createReport(req.params.id))) },
    "/api/reports": { GET: json(() => reports.all()) },
    "/api/reports/:id": {
      GET: json((req) => {
        const r = reports.get(req.params.id);
        if (!r) throw new HttpError(404, "report not found");
        return { ...r, custody: audit.of(r.id) };
      }),
    },
    "/api/reports/:id/counter": { POST: json((req) => (operator(req), counterNarrative(req.params.id))) },
    "/api/shield": {
      POST: json(async (req, server) => {
        limit(req, server);
        const { text, image } = await req.json();
        if (!text && !image) throw new Error("send text or an image");
        if (text !== undefined && (typeof text !== "string" || text.length > 5000)) throw new Error("text must be under 5000 characters");
        if (image !== undefined && (typeof image !== "string" || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image) || image.length > 6_000_000)) throw new Error("image must be a PNG, JPEG, WebP or GIF under 4 MB");
        return runShield({ text, image });
      }),
    },
    "/api/ablation": { GET: json(() => runAblation()) },
  },
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

if (!monitors.all().length) createMonitor({ kind: "simulation", target: "1", label: "Demo feed, Pulau Seruni scenario", speed: 60 });
const tick = () => refresh().catch((e) => console.error("refresh failed", e));
tick();
setInterval(tick, 15_000);
runAblation();
console.log(`Cakra Nala running at ${server.url}`);
