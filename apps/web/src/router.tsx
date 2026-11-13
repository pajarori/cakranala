import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { overviewRoute } from "@/routes/overview";
import { narrativesRoute } from "@/routes/narratives";
import { narrativeRoute } from "@/routes/narrative";
import { clustersRoute } from "@/routes/clusters";
import { clusterRoute, clusterTabs } from "@/routes/cluster";
import { networkRoute, networkChildren } from "@/routes/network";
import { perisaiRoute } from "@/routes/perisai";
import { evaluationRoute } from "@/routes/evaluation";
import { sourcesRoute } from "@/routes/sources";
import { ErrorState, PageSkeleton } from "@/components/primitives";

const routeTree = rootRoute.addChildren([
  overviewRoute,
  narrativesRoute,
  narrativeRoute,
  clustersRoute,
  clusterRoute.addChildren(clusterTabs),
  networkRoute.addChildren(networkChildren),
  perisaiRoute,
  evaluationRoute,
  sourcesRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: PageSkeleton,
  defaultErrorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
