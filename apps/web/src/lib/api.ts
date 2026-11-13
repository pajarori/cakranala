import type { Evaluation, ShieldResult } from "cakranala";
import type { View } from "../server/engine";

export type { View };
export type Narrative = View["report"]["narratives"][number];
export type Cluster = View["report"]["clusters"][number];
export type Source = View["source"];

export interface AblationRow {
  name: string;
  precision: number;
  recall: number;
  f1: number;
  paid: number;
  botfarm: number;
  swarm: number;
  organicFP: number;
  viralFP: number;
}

export interface Capabilities {
  live: boolean;
  reasoner: boolean;
  scenario: string;
}

export interface Snapshot {
  id: string;
  source: Source;
  events: number;
}

export type { Evaluation, ShieldResult };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok || data?.error) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

const post = (body?: unknown, headers?: Record<string, string>): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body), headers });

export const api = {
  capabilities: () => call<Capabilities>("/api/capabilities"),
  view: () => call<View>("/api/view"),
  simulate: (seed: number) => call<View>("/api/simulate", post({ seed })),
  live: (query: string, pages: number, token: string) => call<{ view: View }>("/api/live", post({ query, pages }, { "x-operator-token": token })).then((r) => r.view),
  snapshots: () => call<Snapshot[]>("/api/snapshots"),
  snapshot: (id: string) => call<View>(`/api/snapshots/${id}`, post()),
  shield: (body: { text?: string; image?: string }) => call<ShieldResult>("/api/shield", post(body)),
  ablation: () => call<{ seeds: number[]; rows: AblationRow[] }>("/api/ablation"),
};
