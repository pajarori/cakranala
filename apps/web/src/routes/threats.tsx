import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { DataTable } from "@/components/data-table";
import { ensureState, useOps } from "@/lib/queries";

function Threats() {
  return <DataTable state={useOps()} />;
}

export const threatsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/threats", staticData: { title: "Threats" }, loader: ensureState, component: Threats });
