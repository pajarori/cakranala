import { QueryClient, queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { api, type View } from "./api";

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false } } });

export const viewQuery = queryOptions({ queryKey: ["view"], queryFn: api.view });
export const useView = () => useQuery(viewQuery);
export const useViewData = () => useSuspenseQuery(viewQuery).data;
export const ensureView = () => queryClient.ensureQueryData(viewQuery);
export const useCapabilities = () => useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities });
export const useSnapshots = () => useQuery({ queryKey: ["snapshots"], queryFn: api.snapshots, staleTime: 0 });
export const useAblation = () => useQuery({ queryKey: ["ablation"], queryFn: api.ablation, retry: 0 });

function useSource<A>(fn: (a: A) => Promise<View>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (view) => {
      qc.setQueryData(["view"], view);
      qc.invalidateQueries({ queryKey: ["snapshots"] });
    },
  });
}

export const useSimulate = () => useSource((seed: number) => api.simulate(seed));
export const useLive = () => useSource((a: { query: string; pages: number; token: string }) => api.live(a.query, a.pages, a.token));
export const useLoadSnapshot = () => useSource((id: string) => api.snapshot(id));
export const useShield = () => useMutation({ mutationFn: api.shield });
