import { serve } from "bun";
import { timingSafeEqual } from "node:crypto";
import index from "./index.html";
import { capabilities, runAblation, runShield } from "./server/engine";
import { refresh, snapshot } from "./server/analysis";
import { createMonitor } from "./server/monitors";
import { alerts, cases, monitors, reports, type CaseStatus, type MonitorKind } from "./server/db";
import { counterNarrative, createReport } from "./server/reports";

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (fn: (req: Bun.BunRequest) => Promise<unknown> | unknown) => async (req: Bun.BunRequest) => {
  try {
    return Response.json(await fn(req));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: e instanceof HttpError ? e.status : 400 });
  }
};

const operator = (req: Request) => {
  const token = process.env.OPERATOR_TOKEN ?? "";
  const given = req.headers.get("x-operator-token") ?? "";
  if (!(token.length > 0 && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token)))) throw new HttpError(401, "operator token required");
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
        const body = await req.json();
        if (body.kind !== "simulation") operator(req);
        const m = createMonitor({ ...body, kind: body.kind as MonitorKind });
        refresh(true);
        return m;
      }),
    },
    "/api/monitors/:id": {
      PATCH: json(async (req) => {
        const m = monitors.get(req.params.id);
        if (!m) throw new HttpError(404, "monitor not found");
        if (m.kind !== "simulation") operator(req);
        monitors.setActive(m.id, !!(await req.json()).active);
        return monitors.get(m.id);
      }),
      DELETE: json((req) => {
        const m = monitors.get(req.params.id);
        if (!m) throw new HttpError(404, "monitor not found");
        if (m.kind !== "simulation") operator(req);
        monitors.remove(m.id);
        refresh(true);
        return { ok: true };
      }),
    },
    "/api/cases/:id": {
      PATCH: json(async (req) => {
        const c = cases.get(req.params.id);
        if (!c) throw new HttpError(404, "case not found");
        const { status } = await req.json();
        if (!STATUSES.includes(status)) throw new Error("invalid status");
        cases.setStatus(c.id, status);
        alerts.add({ ts: Date.now(), kind: "status", caseId: c.id, text: `${c.title} marked ${status}` });
        await refresh(true);
        return { ok: true };
      }),
    },
    "/api/cases/:id/reports": { POST: json((req) => createReport(req.params.id)) },
    "/api/reports": { GET: json(() => reports.all()) },
    "/api/reports/:id": {
      GET: json((req) => {
        const r = reports.get(req.params.id);
        if (!r) throw new HttpError(404, "report not found");
        return r;
      }),
    },
    "/api/reports/:id/counter": { POST: json((req) => counterNarrative(req.params.id)) },
    "/api/shield": {
      POST: json(async (req) => {
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
