import type { ShieldResult } from "cakranala";
import type { snapshot, CaseEvidence, CaseView, Severity } from "../server/analysis";
import type { AuditEntry, CaseStatus, Monitor, MonitorKind, Platform, ReportRow } from "../server/db";
import type { ReportContent } from "../server/reports";
import type { Credential, CredentialPlatform } from "../server/credentials";
import type { User } from "../server/auth";
import type { list as listActors, profile as actorProfile, WatchEntry } from "../server/actors";
import type templates from "../../config/templates.json";
import type { summarize as summarizeImport } from "../server/imports";
import type { overview, Period } from "../server/overview";
import type { proof } from "../server/proof";
import type { Probe } from "cakranala-scrap";

export type State = ReturnType<typeof snapshot>;
export type Report = NonNullable<State["report"]>;
export type Narrative = Report["narratives"][number];
export type Cluster = Report["clusters"][number];
export type Case = CaseView;
export type { CaseEvidence };
export type MonitorState = State["monitors"][number];
export type ReportItem = ReportRow<ReportContent>;
export type Audit = { entries: number; valid: boolean; brokenAt: number | null; recent: AuditEntry[] };
export type { Credential, CredentialPlatform, Probe, User, WatchEntry };
export type ActorPage = ReturnType<typeof listActors>;
export type ActorProfile = NonNullable<ReturnType<typeof actorProfile>>;
export type Template = (typeof templates)[number];
export type ImportSummary = ReturnType<typeof summarizeImport>;
export type Overview = ReturnType<typeof overview>;
export type Proof = NonNullable<ReturnType<typeof proof>>;
export type { Period };
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
  actors: (q: { q: string; filter: string; page: number }) => call<ActorPage>(`/api/actors?${new URLSearchParams({ q: q.q, filter: q.filter, page: String(q.page) })}`),
  actor: (id: string) => call<ActorProfile>(`/api/actors/${id}`),
  watch: (id: string, note: string) => call<WatchEntry>(`/api/actors/${id}/watch`, send("POST", { note })),
  unwatch: (id: string) => call<{ ok: true }>(`/api/actors/${id}/watch`, send("DELETE")),
  watchlist: () => call<(WatchEntry & { profile: ActorProfile | undefined })[]>("/api/watchlist"),
  previewImport: (body: { name: string; content: string }) => call<ImportSummary>("/api/imports/preview", send("POST", body)),
  importArchive: (body: { url: string; label: string }) => call<Monitor>("/api/imports/archive", send("POST", body)),
  importData: (body: { name: string; label: string; content: string }) => call<ImportSummary & { id: string; added: number }>("/api/imports", send("POST", body)),
  templates: () => call<Template[]>("/api/templates"),
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
  overview: (period: Period) => call<Overview>(`/api/overview/${period}`),
  createMonitor: (body: { kind: MonitorKind; platform?: Platform; target: string; label?: string; intervalMin?: number; pages?: number; speed?: number }) => call<Monitor>("/api/monitors", send("POST", body)),
  toggleMonitor: (id: string, active: boolean) => call<Monitor>(`/api/monitors/${id}`, send("PATCH", { active })),
  deleteMonitor: (id: string) => call<{ ok: true }>(`/api/monitors/${id}`, send("DELETE")),
  setStatus: (id: string, status: CaseStatus) => call<{ ok: true }>(`/api/cases/${id}`, send("PATCH", { status })),
  evidence: (caseId: string) => call<CaseEvidence>(`/api/cases/${caseId}/evidence`),
  proof: (caseId: string) => call<Proof>(`/api/cases/${caseId}/proof`),
  redescribe: (caseId: string) => call<{ title: string; brief: string | null }>(`/api/cases/${caseId}/describe`, send("POST")),
  createReport: (caseId: string) => call<ReportItem>(`/api/cases/${caseId}/reports`, send("POST")),
  reports: () => call<ReportItem[]>("/api/reports"),
  report: (id: string) => call<ReportItem & { custody: AuditEntry[] }>(`/api/reports/${id}`),
  audit: (page = 1) => call<Audit>(`/api/audit?page=${page}`),
  credentials: () => call<{ platforms: Record<CredentialPlatform, { fields: string[]; required: string[] }>; items: Credential[] }>("/api/credentials", send("GET")),
  addCredential: (body: { platform: CredentialPlatform; label: string; fields: Record<string, string> }) => call<Credential>("/api/credentials", send("POST", body)),
  updateCredential: (id: string, body: { active?: boolean; rotate?: boolean }) => call<Credential>(`/api/credentials/${id}`, send("PATCH", body)),
  testCredential: (body: { platform: CredentialPlatform; fields: Record<string, string> }) => call<Probe>("/api/credentials/test", send("POST", body)),
  retestCredential: (id: string) => call<Probe>(`/api/credentials/${id}/test`, send("POST")),
  removeCredential: (id: string) => call<{ ok: true }>(`/api/credentials/${id}`, send("DELETE")),
  counter: (id: string) => call<string>(`/api/reports/${id}/counter`, send("POST")),
  shield: (body: { text?: string; image?: string }) => call<ShieldResult>("/api/shield", send("POST", body)),
};
