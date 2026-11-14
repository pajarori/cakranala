import { serve } from "bun";
import index from "./index.html";
import { capabilities, runAblation, runShield } from "./server/engine";
import { refresh, snapshot } from "./server/analysis";
import { createMonitor, importEnvCredential } from "./server/monitors";
import { alerts, audit, cases, monitors, reports, type CaseStatus, type MonitorKind } from "./server/db";
import { counterNarrative, createReport } from "./server/reports";
import { stixBundle } from "./server/stix";
import { reportPdf } from "./server/pdf";
import { syncLibrary } from "./server/library";
import { CREDENTIAL_FIELDS, credentials } from "./server/credentials";
import { probe, sidecarFromEnv } from "cakranala-scrap";
import { currentUser, login, logout, sessionCookie, users, type User } from "./server/auth";

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler = (req: Bun.BunRequest, server: Bun.Server<undefined>) => Promise<unknown> | unknown;

const fail = (e: unknown) => Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: e instanceof HttpError ? e.status : 400 });

const json = (fn: Handler) => async (req: Bun.BunRequest, server: Bun.Server<undefined>) => {
  try {
    return Response.json(await fn(req, server));
  } catch (e) {
    return fail(e);
  }
};

const guard = (req: Request): User => {
  const u = currentUser(req);
  if (!u) throw new HttpError(401, "sign in required");
  return u;
};

const authed = (fn: (req: Bun.BunRequest, user: User, server: Bun.Server<undefined>) => Promise<unknown> | unknown) => json((req, server) => fn(req, guard(req), server));

const windows = new Map<string, { start: number; count: number }>();

const limit = (req: Request, server: Bun.Server<undefined>, bucket: string, max: number) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || server.requestIP(req)?.address || "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > 60_000) {
    if (windows.size > 10_000) windows.clear();
    windows.set(key, { start: now, count: 1 });
  } else if (++w.count > max) throw new HttpError(429, "too many requests, try again in a minute");
};

const SHIELD_PER_MINUTE = Number(process.env.SHIELD_PER_MINUTE ?? 20);
const STATUSES: CaseStatus[] = ["new", "investigating", "confirmed", "dismissed"];

const signIn = async (req: Bun.BunRequest, username: unknown, password: unknown) => {
  const s = await login(username, password);
  return Response.json({ user: s.user }, { headers: { "set-cookie": sessionCookie(req, s.token) } });
};

const server = serve({
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: 7_000_000,
  idleTimeout: 255,
  routes: {
    "/*": index,
    "/api/capabilities": { GET: json(() => capabilities()) },
    "/api/auth/me": { GET: json((req) => ({ user: currentUser(req) ?? null, setup: users.count() === 0 })) },
    "/api/auth/login": {
      POST: async (req, server) => {
        try {
          limit(req, server, "login", 10);
          const { username, password } = await req.json();
          return await signIn(req, username, password);
        } catch (e) {
          return fail(e instanceof HttpError ? e : new HttpError(401, e instanceof Error ? e.message : String(e)));
        }
      },
    },
    "/api/auth/setup": {
      POST: async (req, server) => {
        try {
          limit(req, server, "login", 10);
          if (users.count() > 0) throw new HttpError(403, "already set up");
          const { username, password } = await req.json();
          const u = await users.create(username, password);
          audit.add("user.created", u.id, { username: u.username, by: u.username });
          return await signIn(req, username, password);
        } catch (e) {
          return fail(e);
        }
      },
    },
    "/api/auth/logout": {
      POST: (req) => {
        logout(req);
        return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookie(req, "", 0) } });
      },
    },
    "/api/users": {
      GET: authed(() => users.all()),
      POST: authed(async (req, me) => {
        const { username, password } = await req.json();
        const u = await users.create(username, password);
        audit.add("user.created", u.id, { username: u.username, by: me.username });
        return u;
      }),
    },
    "/api/users/:id": {
      PATCH: authed(async (req, me) => {
        if (!users.all().some((u) => u.id === req.params.id)) throw new HttpError(404, "user not found");
        await users.setPassword(req.params.id, (await req.json()).password);
        audit.add("user.password", req.params.id, { by: me.username });
        return { ok: true };
      }),
      DELETE: authed((req, me) => {
        const u = users.all().find((x) => x.id === req.params.id);
        if (!u) throw new HttpError(404, "user not found");
        if (u.id === me.id) throw new Error("you cannot remove yourself");
        users.remove(u.id);
        audit.add("user.removed", u.id, { username: u.username, by: me.username });
        return { ok: true };
      }),
    },
    "/api/state": { GET: authed(() => snapshot()) },
    "/api/monitors": {
      POST: authed(async (req, me) => {
        const body = await req.json();
        const m = createMonitor({ ...body, kind: body.kind as MonitorKind });
        audit.add("monitor.created", m.id, { kind: m.kind, target: m.target, by: me.username });
        refresh(true);
        return m;
      }),
    },
    "/api/monitors/:id": {
      PATCH: authed(async (req, me) => {
        const m = monitors.get(req.params.id);
        if (!m) throw new HttpError(404, "monitor not found");
        const active = !!(await req.json()).active;
        monitors.setActive(m.id, active);
        audit.add(active ? "monitor.resumed" : "monitor.paused", m.id, { by: me.username });
        return monitors.get(m.id);
      }),
      DELETE: authed((req, me) => {
        const m = monitors.get(req.params.id);
        if (!m) throw new HttpError(404, "monitor not found");
        monitors.remove(m.id);
        audit.add("monitor.deleted", m.id, { kind: m.kind, target: m.target, by: me.username });
        refresh(true);
        return { ok: true };
      }),
    },
    "/api/audit": { GET: authed(() => ({ ...audit.verify(), recent: audit.recent() })) },
    "/api/credentials": {
      GET: authed(() => ({ platforms: CREDENTIAL_FIELDS, items: credentials.all() })),
      POST: authed(async (req, me) => {
        const { platform, label, fields } = await req.json();
        const p = await probe(platform, fields ?? {}, sidecarFromEnv());
        const c = await credentials.add(platform, String(label ?? "").trim() || p.profile?.handle || "", fields ?? {});
        credentials.checked(c.id, p);
        audit.add("credential.added", c.id, { platform: c.platform, label: c.label, verified: p.ok, by: me.username });
        return credentials.get(c.id);
      }),
    },
    "/api/credentials/test": {
      POST: authed(async (req) => {
        const { platform, fields } = await req.json();
        return probe(platform, fields ?? {}, sidecarFromEnv());
      }),
    },
    "/api/credentials/:id/test": {
      POST: authed(async (req, me) => {
        const c = credentials.get(req.params.id);
        if (!c) throw new HttpError(404, "credential not found");
        const p = await probe(c.platform, await credentials.fields(c.id), sidecarFromEnv());
        credentials.checked(c.id, p);
        audit.add("credential.tested", c.id, { platform: c.platform, ok: p.ok, by: me.username });
        return p;
      }),
    },
    "/api/credentials/:id": {
      PATCH: authed(async (req, me) => {
        const c = credentials.get(req.params.id);
        if (!c) throw new HttpError(404, "credential not found");
        const { active, rotate } = await req.json();
        if (typeof active === "boolean") credentials.setActive(c.id, active);
        if (rotate) credentials.rotate(c.id);
        audit.add(rotate ? "credential.rotated" : active ? "credential.enabled" : "credential.disabled", c.id, { platform: c.platform, by: me.username });
        return credentials.get(c.id);
      }),
      DELETE: authed((req, me) => {
        const c = credentials.get(req.params.id);
        if (!c) throw new HttpError(404, "credential not found");
        credentials.remove(c.id);
        audit.add("credential.removed", c.id, { platform: c.platform, by: me.username });
        return { ok: true };
      }),
    },
    "/api/cases/:id": {
      PATCH: authed(async (req, me) => {
        const c = cases.get(req.params.id);
        if (!c) throw new HttpError(404, "case not found");
        const { status } = await req.json();
        if (!STATUSES.includes(status)) throw new Error("invalid status");
        cases.setStatus(c.id, status);
        audit.add("case.status", c.id, { from: c.status, to: status, by: me.username });
        alerts.add({ ts: Date.now(), kind: "status", caseId: c.id, text: `${c.title} marked ${status}` });
        await refresh(true);
        return { ok: true };
      }),
    },
    "/api/cases/:id/stix": {
      GET: (req) => {
        try {
          guard(req);
          return new Response(JSON.stringify(stixBundle(req.params.id), null, 2), { headers: { "content-type": "application/stix+json;version=2.1", "content-disposition": `attachment; filename="case-${req.params.id}.stix.json"` } });
        } catch (e) {
          return fail(e instanceof HttpError ? e : new HttpError(404, e instanceof Error ? e.message : String(e)));
        }
      },
    },
    "/api/cases/:id/reports": { POST: authed((req, me) => createReport(req.params.id, me.username)) },
    "/api/reports": { GET: authed(() => reports.all()) },
    "/api/reports/:id": {
      GET: authed((req) => {
        const r = reports.get(req.params.id);
        if (!r) throw new HttpError(404, "report not found");
        return { ...r, custody: audit.of(r.id) };
      }),
    },
    "/api/reports/:id/pdf": {
      GET: async (req) => {
        try {
          guard(req);
          const r = reports.get(req.params.id) as Parameters<typeof reportPdf>[0] | undefined;
          if (!r) throw new HttpError(404, "report not found");
          const pdf = await reportPdf(r, audit.of(r.id));
          const name = r.content.title.replace(/[^\w ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "report";
          return new Response(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${name}.pdf"`, "cache-control": "no-store" } });
        } catch (e) {
          return fail(e);
        }
      },
    },
    "/api/reports/:id/counter": { POST: authed((req, me) => counterNarrative(req.params.id, me.username)) },
    "/api/shield": {
      POST: json(async (req, server) => {
        limit(req, server, "shield", SHIELD_PER_MINUTE);
        const { text, image } = await req.json();
        if (!text && !image) throw new Error("send text or an image");
        if (text !== undefined && (typeof text !== "string" || text.length > 5000)) throw new Error("text must be under 5000 characters");
        if (image !== undefined && (typeof image !== "string" || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image) || image.length > 6_000_000)) throw new Error("image must be a PNG, JPEG, WebP or GIF under 4 MB");
        return runShield({ text, image });
      }),
    },
    "/api/ablation": { GET: authed(() => runAblation()) },
  },
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

await importEnvCredential();
if (!monitors.all().length) createMonitor({ kind: "simulation", target: "1", label: "Demo feed, Pulau Seruni scenario", speed: 60 });
const tick = () => refresh().catch((e) => console.error("refresh failed", e));
tick();
setInterval(tick, 15_000);
runAblation();
const sync = () => syncLibrary().catch((e) => console.error("library sync failed", e));
sync();
setInterval(sync, 3_600_000);
console.log(`Cakra Nala running at ${server.url}`);
