import { serve } from "bun";
import index from "./index.html";
import { capabilities, currentView, listSnapshots, loadSnapshot, runAblation, runLive, runShield, runSimulation } from "./server/engine";

const json = (fn: (req: Bun.BunRequest) => Promise<unknown> | unknown) => async (req: Bun.BunRequest) => {
  try {
    return Response.json(await fn(req));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
};

const operator = (req: Request) => {
  const token = process.env.OPERATOR_TOKEN;
  if (!token || req.headers.get("x-operator-token") !== token) throw new Error("token operator diperlukan untuk koleksi live");
};

const busy = new Set<string>();
const once = async <T>(key: string, fn: () => Promise<T>) => {
  if (busy.has(key)) throw new Error("proses serupa sedang berjalan, coba sesaat lagi");
  busy.add(key);
  try {
    return await fn();
  } finally {
    busy.delete(key);
  }
};

const server = serve({
  port: Number(process.env.PORT ?? 3000),
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
        if (typeof query !== "string" || !query.trim()) throw new Error("query kosong");
        return once("analyze", () => runLive(query.trim(), Number(pages) || 5));
      }),
    },
    "/api/snapshots": { GET: json(() => listSnapshots()) },
    "/api/snapshots/:id": { POST: json((req) => once("analyze", () => loadSnapshot(req.params.id))) },
    "/api/shield": {
      POST: json(async (req) => {
        const { text, image } = await req.json();
        if (!text && !image) throw new Error("kirim teks atau gambar");
        if (image && (typeof image !== "string" || image.length > 6_000_000)) throw new Error("gambar terlalu besar");
        return runShield({ text, image });
      }),
    },
    "/api/ablation": { GET: json(() => runAblation()) },
  },
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`Cakra Nala berjalan di ${server.url}`);
