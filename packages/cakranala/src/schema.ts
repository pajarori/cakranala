export const SCHEMA_VERSION = 1;

export type Action = "post" | "reply" | "quote" | "reshare" | "comment" | "react";
export type TimePrecision = "ms" | "s" | "min" | "approx";

export interface Actor {
  id: string;
  platform: string;
  handle?: string;
  createdAt?: number;
  followers?: number;
  following?: number;
  posts?: number;
  reshared?: string[];
  shape?: string;
}

export interface Event {
  id: string;
  actor: string;
  action: Action;
  ts: number;
  precision?: TimePrecision;
  target?: string;
  text?: string;
  tags?: string[];
  urls?: string[];
  lang?: string;
}

export type Truth = Record<string, string>;

export interface Dataset {
  version: typeof SCHEMA_VERSION;
  actors: Actor[];
  events: Event[];
  truth?: Truth;
  meta?: { source?: string; query?: string; coverage?: number; collectedAt?: number };
}

const ACTIONS = new Set<Action>(["post", "reply", "quote", "reshare", "comment", "react"]);

export function validate(input: unknown): Dataset {
  const d = input as Dataset;
  if (!d || typeof d !== "object") throw new Error("dataset harus berupa objek");
  if (d.version !== SCHEMA_VERSION) throw new Error(`versi skema ${d.version} tidak didukung (butuh ${SCHEMA_VERSION})`);
  if (!Array.isArray(d.actors) || !Array.isArray(d.events)) throw new Error("dataset butuh actors[] dan events[]");
  const ids = new Set<string>();
  for (const a of d.actors) {
    if (typeof a.id !== "string" || typeof a.platform !== "string") throw new Error("actor butuh id dan platform");
    ids.add(a.id);
  }
  for (const e of d.events) {
    if (typeof e.id !== "string" || !ids.has(e.actor)) throw new Error(`event ${e.id} merujuk actor tak dikenal`);
    if (!ACTIONS.has(e.action)) throw new Error(`event ${e.id} punya action tak dikenal: ${e.action}`);
    if (!Number.isFinite(e.ts)) throw new Error(`event ${e.id} butuh ts numerik`);
  }
  return d;
}
