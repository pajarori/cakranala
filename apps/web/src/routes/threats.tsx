import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { ensureState, useOps } from "@/lib/queries";

function Threats() {
  return (
    <>
      <PageHeader title="Threats" description="Threat cases requiring analyst review" />
      <DataTable state={useOps()} />
    </>
  );
}

export const threatsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/threats", staticData: { title: "Threats" }, loader: ensureState, component: Threats });
