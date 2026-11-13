import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { EmptyState, PageHeader } from "@/components/primitives";
import { DataTable } from "@/components/data-table";
import { ensureView, useViewData } from "@/lib/queries";
import { LAYERS, clock, clusterColor, num } from "@/lib/format";
import { narrativesOf, profile } from "@/lib/profile";
import type { Cluster } from "@/lib/api";

function Clusters() {
  const view = useViewData();
  const rows = view.report.clusters;
  return (
    <>
      <PageHeader title="Clusters" meta={`${rows.length} clusters, ${view.report.stats.flaggedActors} accounts`} />
      {rows.length ? (
        <DataTable<Cluster>
          rows={rows}
          rowKey={(c) => c.id}
          href={(c) => `/clusters/${c.id}`}
          initialSort={{ key: "members", desc: true }}
          columns={[
            {
              key: "id",
              header: "Cluster",
              cell: (c) => (
                <span className="flex items-center gap-2.5 font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: clusterColor(c.id) }} />
                  {c.id}
                </span>
              ),
              sort: (c) => Number(c.id.slice(1)),
            },
            { key: "profile", header: "Profile", cell: (c) => profile(c), sort: (c) => profile(c) },
            { key: "members", header: "Accounts", numeric: true, cell: (c) => c.members.length, sort: (c) => c.members.length },
            { key: "rho", header: "Dependence", numeric: true, cell: (c) => c.rho.toFixed(2), sort: (c) => c.rho },
            { key: "waves", header: "Waves", numeric: true, cell: (c) => c.forensics.waves, sort: (c) => c.forensics.waves },
            { key: "t0", header: "Started", numeric: true, cell: (c) => clock(c.forensics.onset.ts), sort: (c) => c.forensics.onset.ts },
            { key: "cadence", header: "Cadence", numeric: true, cell: (c) => (c.forensics.cadence ? `${num(c.forensics.cadence.medianSec)}s` : "n/a"), sort: (c) => c.forensics.cadence?.medianSec ?? Infinity },
            { key: "layers", header: "Evidence", cell: (c) => <span className="text-muted-foreground">{c.layers.map((l) => LAYERS[l.layer]?.name ?? l.layer).join(", ")}</span> },
            { key: "narratives", header: "Narratives", cell: (c) => narrativesOf(view, c.id).map((n) => n.id).join(", ") || "none" },
          ]}
        />
      ) : (
        <EmptyState title="No coordinated clusters in this source" />
      )}
    </>
  );
}

export const clustersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/clusters", staticData: { title: "Clusters" }, loader: ensureView, component: Clusters });
