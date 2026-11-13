import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Overview } from "@/routes/overview";
import { Narratives } from "@/routes/narratives";
import { NarrativeDetail } from "@/routes/narrative";
import { Clusters } from "@/routes/clusters";
import { ClusterDetail, type ClusterTab } from "@/routes/cluster";
import { Network } from "@/routes/network";
import { Perisai } from "@/routes/perisai";
import { Evaluation } from "@/routes/evaluation";
import { Sources } from "@/routes/sources";
import { NotFound } from "@/routes/not-found";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface StaticDataRouteOption {
    title?: string;
  }
}

const root = createRootRoute({ component: Shell, notFoundComponent: NotFound });
const page = (path: string, title: string, component: () => React.ReactNode) => createRoute({ getParentRoute: () => root, path, staticData: { title }, component });

const clusterTab = (path: string, tab: ClusterTab) => [createRoute({ getParentRoute: () => root, path, staticData: { title: "Clusters" }, component: () => <ClusterDetail tab={tab} /> })];

const routeTree = root.addChildren([
  page("/", "Overview", Overview),
  page("/narratives", "Narratives", Narratives),
  createRoute({ getParentRoute: () => root, path: "/narratives/$id", staticData: { title: "Narratives" }, component: NarrativeDetail }),
  page("/clusters", "Clusters", Clusters),
  ...clusterTab("/clusters/$id", "evidence"),
  ...clusterTab("/clusters/$id/graph", "graph"),
  ...clusterTab("/clusters/$id/talking-points", "talking-points"),
  ...clusterTab("/clusters/$id/members", "members"),
  page("/network", "Network", Network),
  page("/network/$cluster", "Network", Network),
  page("/perisai", "Perisai", Perisai),
  page("/evaluation", "Evaluation", Evaluation),
  page("/sources", "Sources", Sources),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent", scrollRestoration: true });
