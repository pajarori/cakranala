import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { Embedder } from "cakranala";

export interface E5Options {
  model?: string;
  dtype?: "fp32" | "fp16" | "q8" | "q4";
  batch?: number;
}

export async function createE5Embedder(opts: E5Options = {}): Promise<Embedder> {
  const load = pipeline as (task: string, model: string, o: object) => Promise<FeatureExtractionPipeline>;
  const extract = await load("feature-extraction", opts.model ?? "Xenova/multilingual-e5-small", { dtype: opts.dtype ?? "q8" });
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
