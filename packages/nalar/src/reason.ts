import type { Reasoner } from "cakranala";

export interface OpenAIReasonerOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
}

export function createReasoner(o: OpenAIReasonerOptions): Reasoner {
  return {
    async complete(prompt, opts = {}) {
      const content = opts.images?.length
        ? [{ type: "text", text: prompt }, ...opts.images.map((url) => ({ type: "image_url", image_url: { url } }))]
        : prompt;
      const res = await fetch(`${o.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${o.apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(o.timeoutMs ?? 120000),
        body: JSON.stringify({
          model: o.model,
          temperature: o.temperature ?? 0.7,
          messages: [...(opts.system ? [{ role: "system", content: opts.system }] : []), { role: "user", content }],
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`reasoner ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return data.choices[0].message.content;
    },
  };
}

export function reasonerFromEnv(env: Record<string, string | undefined> = process.env): Reasoner | undefined {
  if (!env.DEEPSEEK_API_KEY) return undefined;
  return createReasoner({ baseUrl: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com", apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL ?? "deepseek-flash" });
}
