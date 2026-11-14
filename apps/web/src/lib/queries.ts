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
    mutationFn: async (a: { id: string; action: "enable" | "disable" | "rotate" | "remove" }): Promise<unknown> =>
      a.action === "remove" ? api.removeCredential(a.id) : api.updateCredential(a.id, a.action === "rotate" ? { rotate: true } : { active: a.action === "enable" }),
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
export const useAudit = () => useQuery({ queryKey: ["audit"], queryFn: api.audit, refetchInterval: 15_000 });
export const useAblation = () => useQuery({ queryKey: ["ablation"], queryFn: api.ablation, staleTime: Infinity, retry: 0 });
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
