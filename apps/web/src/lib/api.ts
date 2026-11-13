import type { ShieldResult } from "cakranala";
import type { snapshot, CaseView, Severity } from "../server/analysis";
import type { AuditEntry, CaseStatus, Monitor, MonitorKind, Platform, ReportRow } from "../server/db";
import type { ReportContent } from "../server/reports";
import type { Credential, CredentialPlatform } from "../server/credentials";

export type State = ReturnType<typeof snapshot>;
export type Report = NonNullable<State["report"]>;
export type Narrative = Report["narratives"][number];
export type Cluster = Report["clusters"][number];
export type Case = CaseView;
export type MonitorState = State["monitors"][number];
export type ReportItem = ReportRow<ReportContent>;
export type Audit = { entries: number; valid: boolean; brokenAt: number | null; recent: AuditEntry[] };
export type { Credential, CredentialPlatform };
export type { CaseStatus, Monitor, MonitorKind, Platform, Severity, ShieldResult };

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
  severity: Record<"critical" | "high" | "medium", number>;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok || data?.error) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

const KEY = "cakranala.operator";

export const operatorToken = {
  get: () => {
    try {
      return sessionStorage.getItem(KEY) ?? "";
    } catch {
      return "";
    }
  },
  set: (token: string) => {
    try {
      if (token) sessionStorage.setItem(KEY, token);
      else sessionStorage.removeItem(KEY);
    } catch {}
  },
};

const send = (method: string, body?: unknown, token = operatorToken.get()): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body), headers: token ? { "x-operator-token": token } : undefined });

export const api = {
  capabilities: () => call<Capabilities>("/api/capabilities"),
  state: () => call<State>("/api/state"),
  createMonitor: (body: { kind: MonitorKind; platform?: Platform; target: string; label?: string; intervalMin?: number; pages?: number; speed?: number }) => call<Monitor>("/api/monitors", send("POST", body)),
  toggleMonitor: (id: string, active: boolean) => call<Monitor>(`/api/monitors/${id}`, send("PATCH", { active })),
  deleteMonitor: (id: string) => call<{ ok: true }>(`/api/monitors/${id}`, send("DELETE")),
  verifyOperator: (token: string) => call<{ ok: true }>("/api/operator", send("POST", undefined, token)),
  setStatus: (id: string, status: CaseStatus) => call<{ ok: true }>(`/api/cases/${id}`, send("PATCH", { status })),
  createReport: (caseId: string) => call<ReportItem>(`/api/cases/${caseId}/reports`, send("POST")),
  reports: () => call<ReportItem[]>("/api/reports"),
  report: (id: string) => call<ReportItem & { custody: AuditEntry[] }>(`/api/reports/${id}`),
  audit: () => call<Audit>("/api/audit"),
  credentials: () => call<{ platforms: Record<CredentialPlatform, string[]>; items: Credential[] }>("/api/credentials", send("GET")),
  addCredential: (body: { platform: CredentialPlatform; label: string; fields: Record<string, string> }) => call<Credential>("/api/credentials", send("POST", body)),
  updateCredential: (id: string, body: { active?: boolean; rotate?: boolean }) => call<Credential>(`/api/credentials/${id}`, send("PATCH", body)),
  removeCredential: (id: string) => call<{ ok: true }>(`/api/credentials/${id}`, send("DELETE")),
  counter: (id: string) => call<string>(`/api/reports/${id}/counter`, send("POST")),
  shield: (body: { text?: string; image?: string }) => call<ShieldResult>("/api/shield", send("POST", body)),
  ablation: () => call<{ seeds: number[]; rows: AblationRow[] }>("/api/ablation"),
};
