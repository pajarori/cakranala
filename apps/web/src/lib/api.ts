import type { ShieldResult } from "cakranala";
import type { snapshot, CaseView, Severity } from "../server/analysis";
import type { AuditEntry, CaseStatus, Monitor, MonitorKind, Platform, ReportRow } from "../server/db";
import type { ReportContent } from "../server/reports";
import type { Credential, CredentialPlatform } from "../server/credentials";
import type { User } from "../server/auth";
import type { Probe } from "cakranala-scrap";

export type State = ReturnType<typeof snapshot>;
export type Report = NonNullable<State["report"]>;
export type Narrative = Report["narratives"][number];
export type Cluster = Report["clusters"][number];
export type Case = CaseView;
export type MonitorState = State["monitors"][number];
export type ReportItem = ReportRow<ReportContent>;
export type Audit = { entries: number; valid: boolean; brokenAt: number | null; recent: AuditEntry[] };
export type { Credential, CredentialPlatform, Probe, User };
export type { CaseStatus, Monitor, MonitorKind, Platform, Severity, ShieldResult };

export interface Capabilities {
  demo: boolean;
  live: boolean;
  tiktok: boolean;
  reasoner: boolean;
  scenario: string;
  severity: Record<"critical" | "high" | "medium", number>;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "same-origin", headers: { "content-type": "application/json", ...init?.headers } });
  if (res.status === 401 && !path.startsWith("/api/auth/") && location.pathname !== "/login") location.assign("/login");
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok || data?.error) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  me: () => call<{ user: User | null; setup: boolean }>("/api/auth/me"),
  login: (body: { username: string; password: string }) => call<{ user: User }>("/api/auth/login", send("POST", body)),
  setup: (body: { username: string; password: string }) => call<{ user: User }>("/api/auth/setup", send("POST", body)),
  logout: () => call<{ ok: true }>("/api/auth/logout", send("POST")),
  users: () => call<User[]>("/api/users"),
  addUser: (body: { username: string; password: string }) => call<User>("/api/users", send("POST", body)),
  setPassword: (id: string, password: string) => call<{ ok: true }>(`/api/users/${id}`, send("PATCH", { password })),
  removeUser: (id: string) => call<{ ok: true }>(`/api/users/${id}`, send("DELETE")),
  capabilities: () => call<Capabilities>("/api/capabilities"),
  state: () => call<State>("/api/state"),
  createMonitor: (body: { kind: MonitorKind; platform?: Platform; target: string; label?: string; intervalMin?: number; pages?: number; speed?: number }) => call<Monitor>("/api/monitors", send("POST", body)),
  toggleMonitor: (id: string, active: boolean) => call<Monitor>(`/api/monitors/${id}`, send("PATCH", { active })),
  deleteMonitor: (id: string) => call<{ ok: true }>(`/api/monitors/${id}`, send("DELETE")),
  setStatus: (id: string, status: CaseStatus) => call<{ ok: true }>(`/api/cases/${id}`, send("PATCH", { status })),
  createReport: (caseId: string) => call<ReportItem>(`/api/cases/${caseId}/reports`, send("POST")),
  reports: () => call<ReportItem[]>("/api/reports"),
  report: (id: string) => call<ReportItem & { custody: AuditEntry[] }>(`/api/reports/${id}`),
  audit: () => call<Audit>("/api/audit"),
  credentials: () => call<{ platforms: Record<CredentialPlatform, { fields: string[]; required: string[] }>; items: Credential[] }>("/api/credentials", send("GET")),
  addCredential: (body: { platform: CredentialPlatform; label: string; fields: Record<string, string> }) => call<Credential>("/api/credentials", send("POST", body)),
  updateCredential: (id: string, body: { active?: boolean; rotate?: boolean }) => call<Credential>(`/api/credentials/${id}`, send("PATCH", body)),
  testCredential: (body: { platform: CredentialPlatform; fields: Record<string, string> }) => call<Probe>("/api/credentials/test", send("POST", body)),
  retestCredential: (id: string) => call<Probe>(`/api/credentials/${id}/test`, send("POST")),
  removeCredential: (id: string) => call<{ ok: true }>(`/api/credentials/${id}`, send("DELETE")),
  counter: (id: string) => call<string>(`/api/reports/${id}/counter`, send("POST")),
  shield: (body: { text?: string; image?: string }) => call<ShieldResult>("/api/shield", send("POST", body)),
};
