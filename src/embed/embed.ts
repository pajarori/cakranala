import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import type { Embedder } from "../engine";
import { cacheDir } from "../home";

export const MODEL = "Xenova/multilingual-e5-small";

export interface E5Options {
  model?: string;
  dtype?: "fp32" | "fp16" | "q8" | "q4";
  batch?: number;
  progress?: (file: string, loaded: number, total: number) => void;
}

type Transformers = typeof import("@huggingface/transformers");

export async function transformers(): Promise<Transformers | undefined> {
  const found = await import("@huggingface/transformers").catch(() => undefined);
  if (found) return found;
  const root = join(cacheDir(), "deps");
  if (!existsSync(join(root, "node_modules", "@huggingface", "transformers"))) return undefined;
  return import(pathToFileURL(createRequire(join(root, "package.json")).resolve("@huggingface/transformers")).href);
}

export const modelCached = (model = MODEL) => existsSync(join(cacheDir(), "models", model));

export async function createE5Embedder(opts: E5Options = {}): Promise<Embedder> {
  const t = await transformers();
  if (!t) throw new Error("layer semantik butuh @huggingface/transformers, jalankan: cakranala install");
  t.env.cacheDir = join(cacheDir(), "models");
  const load = t.pipeline as (task: string, model: string, o: object) => Promise<FeatureExtractionPipeline>;
  const progress = opts.progress && ((p: { status: string; file?: string; loaded?: number; total?: number }) => p.status === "progress" && opts.progress!(p.file ?? "", p.loaded ?? 0, p.total ?? 0));
  const extract = await load("feature-extraction", opts.model ?? MODEL, { dtype: opts.dtype ?? "q8", progress_callback: progress });
  const batch = opts.batch ?? 64;
  return {
    async embed(texts) {
      const out: Float32Array[] = [];
      for (let i = 0; i < texts.length; i += batch) {
        const t = await extract(texts.slice(i, i + batch).map((x) => `query: ${x}`), { pooling: "mean", normalize: true });
        const [n, d] = t.dims;
        const data = t.data as Float32Array;
        for (let k = 0; k < n; k++) out.push(data.slice(k * d, (k + 1) * d));
      }
      return out;
    },
  };
}
