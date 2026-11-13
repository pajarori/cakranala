import { serve } from "bun";
import { timingSafeEqual } from "node:crypto";
import index from "./index.html";
import { capabilities, currentView, listSnapshots, loadSnapshot, runAblation, runLive, runShield, runSimulation } from "./server/engine";

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
  const ok = token.length > 0 && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token));
  if (!ok) throw new HttpError(401, "operator token required");
};

const busy = new Set<string>();
const once = async <T>(key: string, fn: () => Promise<T>) => {
  if (busy.has(key)) throw new HttpError(429, "another analysis is running, try again shortly");
  busy.add(key);
  try {
    return await fn();
  } finally {
    busy.delete(key);
  }
};

const server = serve({
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: 7_000_000,
  idleTimeout: 255,
  routes: {
    "/*": index,
    "/api/capabilities": { GET: json(() => capabilities()) },
    "/api/view": { GET: json(() => currentView() ?? runSimulation(1)) },
    "/api/simulate": { POST: json(async (req) => once("analyze", async () => runSimulation(Number((await req.json()).seed) || 1))) },
    "/api/live": {
      POST: json(async (req) => {
        operator(req);
        const { query, pages } = await req.json();
        if (typeof query !== "string" || !query.trim() || query.length > 200) throw new Error("query must be 1 to 200 characters");
        return once("analyze", () => runLive(query.trim(), Number(pages) || 5));
      }),
    },
    "/api/snapshots": { GET: json(() => listSnapshots()) },
    "/api/snapshots/:id": { POST: json((req) => once("analyze", () => loadSnapshot(req.params.id))) },
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

console.log(`Cakra Nala berjalan di ${server.url}`);
runAblation();
