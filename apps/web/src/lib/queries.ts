import { QueryClient, queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { api, type CaseStatus, type MonitorKind } from "./api";

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

export const stateQuery = queryOptions({ queryKey: ["state"], queryFn: api.state, refetchInterval: 10_000 });
export const reportsQuery = queryOptions({ queryKey: ["reports"], queryFn: api.reports });
export const reportQuery = (id: string) => queryOptions({ queryKey: ["report", id], queryFn: () => api.report(id) });

export const useOps = () => useSuspenseQuery(stateQuery).data;
export const useLiveState = () => useQuery(stateQuery);
export const ensureState = () => queryClient.ensureQueryData(stateQuery);
export const useCapabilities = () => useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities, staleTime: Infinity });
export const useAblation = () => useQuery({ queryKey: ["ablation"], queryFn: api.ablation, staleTime: Infinity, retry: 0 });
export const useReports = () => useSuspenseQuery(reportsQuery).data;
export const useReport = (id: string) => useSuspenseQuery(reportQuery(id)).data;

function useInvalidate(...keys: string[][]) {
  const qc = useQueryClient();
  return () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

export const useCreateMonitor = () => {
  const done = useInvalidate(["state"]);
  return useMutation({ mutationFn: (a: { body: { kind: MonitorKind; target: string; label?: string; intervalMin?: number; pages?: number; speed?: number }; token?: string }) => api.createMonitor(a.body, a.token), onSuccess: done });
};
export const useToggleMonitor = () => {
  const done = useInvalidate(["state"]);
  return useMutation({ mutationFn: (a: { id: string; active: boolean; token?: string }) => api.toggleMonitor(a.id, a.active, a.token), onSuccess: done });
};
export const useDeleteMonitor = () => {
  const done = useInvalidate(["state"]);
  return useMutation({ mutationFn: (a: { id: string; token?: string }) => api.deleteMonitor(a.id, a.token), onSuccess: done });
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
