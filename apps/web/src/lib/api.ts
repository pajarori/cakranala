import type { ShieldResult } from "cakranala";
import type { View } from "../server/engine";

export type { View };

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

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  capabilities: () => call<Capabilities>("/api/capabilities"),
  view: () => call<View>("/api/view"),
  simulate: (seed: number) => call<View>("/api/simulate", { method: "POST", body: JSON.stringify({ seed }) }),
  live: (query: string, pages: number, token: string) =>
    call<{ view: View; rate: { remaining: number | null } }>("/api/live", { method: "POST", body: JSON.stringify({ query, pages }), headers: { "x-operator-token": token } }),
  snapshots: () => call<{ id: string; source: View["source"]; events: number }[]>("/api/snapshots"),
  snapshot: (id: string) => call<View>(`/api/snapshots/${id}`, { method: "POST" }),
  shield: (body: { text?: string; image?: string }) => call<ShieldResult>("/api/shield", { method: "POST", body: JSON.stringify(body) }),
  ablation: () => call<{ seeds: number[]; rows: AblationRow[] }>("/api/ablation"),
};

export const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const time = (ts: number) => new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const PALETTE = ["#e5646a", "#e0a85a", "#7aa7e8", "#5fc992", "#c58af0", "#4fd1c5", "#f08ac0", "#b8c46a"];
export const LAYER_NAMES: Record<string, string> = {
  coaction: "Co-action",
  coframing: "Co-framing semantik",
  copypasta: "Copypasta",
  rhythm: "Ritme",
  lifecycle: "Siklus hidup akun",
};
