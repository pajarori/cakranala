import { QueryClient, queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { api, type CaseStatus, type MonitorKind, type Platform } from "./api";

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

export const stateQuery = queryOptions({ queryKey: ["state"], queryFn: api.state, refetchInterval: 10_000 });
export const reportsQuery = queryOptions({ queryKey: ["reports"], queryFn: api.reports });
export const reportQuery = (id: string) => queryOptions({ queryKey: ["report", id], queryFn: () => api.report(id) });

export const useOps = () => useSuspenseQuery(stateQuery).data;
export const useLiveState = () => useQuery(stateQuery);
export const ensureState = () => queryClient.ensureQueryData(stateQuery);
export const useCapabilities = () => useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities, staleTime: Infinity });
export const useCredentials = () => useQuery({ queryKey: ["credentials"], queryFn: api.credentials, refetchInterval: 15_000, retry: 0 });
export const useCredentialAction = () => {
  const done = useInvalidate(["credentials"], ["capabilities"]);
  return useMutation({
    mutationFn: async (a: { id: string; action: "enable" | "disable" | "rotate" | "remove" | "test" }): Promise<unknown> =>
      a.action === "test" ? api.retestCredential(a.id) : a.action === "remove" ? api.removeCredential(a.id) : api.updateCredential(a.id, a.action === "rotate" ? { rotate: true } : { active: a.action === "enable" }),
    onSuccess: done,
  });
};
export const useAddCredential = () => {
  const done = useInvalidate(["credentials"], ["capabilities"]);
  return useMutation({ mutationFn: api.addCredential, onSuccess: done });
};
export const meQuery = queryOptions({ queryKey: ["me"], queryFn: api.me, staleTime: 60_000 });
export const useMe = () => useQuery(meQuery);
export const useUsers = () => useQuery({ queryKey: ["users"], queryFn: api.users });
export const useUserAction = () => {
  const done = useInvalidate(["users"]);
  return useMutation({
    mutationFn: async (a: { kind: "add"; username: string; password: string } | { kind: "password"; id: string; password: string } | { kind: "remove"; id: string }): Promise<unknown> =>
      a.kind === "add" ? api.addUser({ username: a.username, password: a.password }) : a.kind === "password" ? api.setPassword(a.id, a.password) : api.removeUser(a.id),
    onSuccess: done,
  });
};
export const actorQuery = (id: string) => queryOptions({ queryKey: ["actor", id], queryFn: () => api.actor(id) });
export const useActors = (q: { q: string; filter: string; page: number }) => useQuery({ queryKey: ["actors", q], queryFn: () => api.actors(q), placeholderData: (prev) => prev });
export const useActor = (id: string) => useSuspenseQuery(actorQuery(id)).data;
export const useWatchlist = () => useQuery({ queryKey: ["watchlist"], queryFn: api.watchlist });
export const useTemplates = () => useQuery({ queryKey: ["templates"], queryFn: api.templates, staleTime: Infinity });
export const useWatch = () => {
  const done = useInvalidate(["actor"], ["actors"], ["watchlist"]);
  return useMutation({ mutationFn: async (a: { id: string; watch: boolean; note?: string }): Promise<unknown> => (a.watch ? api.watch(a.id, a.note ?? "") : api.unwatch(a.id)), onSuccess: done });
};
export const evidenceQuery = (id: string) => queryOptions({ queryKey: ["evidence", id], queryFn: () => api.evidence(id), retry: 0 });
export const useRedescribe = () => {
  const done = useInvalidate(["state"]);
  return useMutation({ mutationFn: api.redescribe, onSuccess: done });
};
export const useAudit = (page = 1) => useQuery({ queryKey: ["audit", page], queryFn: () => api.audit(page), refetchInterval: 15_000, placeholderData: (prev) => prev });
export const useReports = () => useSuspenseQuery(reportsQuery).data;
export const useReport = (id: string) => useSuspenseQuery(reportQuery(id)).data;

function useInvalidate(...keys: string[][]) {
  const qc = useQueryClient();
  return () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

export const useCreateMonitor = () => {
  const done = useInvalidate(["state"]);
  return useMutation({ mutationFn: (body: { kind: MonitorKind; platform?: Platform; target: string; label?: string; intervalMin?: number; pages?: number; speed?: number }) => api.createMonitor(body), onSuccess: done });
};
export const useToggleMonitor = () => {
  const done = useInvalidate(["state"]);
  return useMutation({ mutationFn: (a: { id: string; active: boolean }) => api.toggleMonitor(a.id, a.active), onSuccess: done });
};
export const useDeleteMonitor = () => {
  const done = useInvalidate(["state"]);
  return useMutation({ mutationFn: (id: string) => api.deleteMonitor(id), onSuccess: done });
};
export const useSetStatus = () => {
  const done = useInvalidate(["state"]);
  return useMutation({ mutationFn: (a: { id: string; status: CaseStatus }) => api.setStatus(a.id, a.status), onSuccess: done });
};
export const useCreateReport = () => {
  const done = useInvalidate(["reports"]);
  return useMutation({ mutationFn: api.createReport, onSuccess: done });
};
export const useCounter = (id: string) => {
  const done = useInvalidate(["report", id]);
  return useMutation({ mutationFn: () => api.counter(id), onSuccess: done });
};
export const useShield = () => useMutation({ mutationFn: api.shield });
