import type { ReactNode } from "react";
import { useView } from "@/lib/queries";
import type { View } from "@/lib/api";
import { ErrorState, PageSkeleton } from "@/components/primitives";

export function ViewGate({ children }: { children: (view: View) => ReactNode }) {
  const { data, error, refetch, isPending } = useView();
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  return <>{children(data)}</>;
}
