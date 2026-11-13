import { useNavigate } from "@tanstack/react-router";
import { SortableTable } from "@/components/ui/sortable-table";
import { EmptyState, PageHeader, Pill } from "@/components/primitives";
import { ViewGate } from "@/components/view-gate";
import { LAYERS, clock, clusterColor, num } from "@/lib/format";
import { narrativesOf, profile } from "@/lib/profile";
import type { Cluster, View } from "@/lib/api";

function Table({ view }: { view: View }) {
  const navigate = useNavigate();
  if (!view.report.clusters.length) return <EmptyState title="No coordinated clusters in this source." />;
  return (
    <SortableTable<Cluster>
      caption="Clusters"
      rows={view.report.clusters}
      getRowId={(c) => c.id}
      defaultSort={{ column: "members", direction: "desc" }}
      columns={[
        {
          key: "id",
          header: "Cluster",
          width: 96,
          cell: (c) => (
            <button onClick={() => navigate({ to: "/clusters/$id", params: { id: c.id } })} className="flex items-center gap-2 text-fg hover:underline">
              <span className="size-2 rounded-full" style={{ background: clusterColor(c.id) }} />
              {c.id}
            </button>
          ),
          sortValue: (c) => Number(c.id.slice(1)),
        },
        { key: "profile", header: "Profile", width: 120, cell: (c) => <Pill tone={profile(c).tone}>{profile(c).label}</Pill>, sortValue: (c) => profile(c).label },
        { key: "members", header: "Accounts", numeric: true, width: 90, sortValue: (c) => c.members.length, cell: (c) => c.members.length },
        { key: "rho", header: "ρ", numeric: true, width: 70, cell: (c) => c.rho.toFixed(2), sortValue: (c) => c.rho },
        { key: "waves", header: "Waves", numeric: true, width: 70, cell: (c) => c.forensics.waves, sortValue: (c) => c.forensics.waves },
        { key: "t0", header: "T0", numeric: true, width: 70, cell: (c) => clock(c.forensics.onset.ts), sortValue: (c) => c.forensics.onset.ts },
        { key: "rotation", header: "Rotation τ", numeric: true, width: 96, cell: (c) => (c.forensics.rotation === null ? "—" : c.forensics.rotation.toFixed(2)), sortValue: (c) => c.forensics.rotation ?? -2 },
        { key: "cadence", header: "Cadence", numeric: true, width: 90, cell: (c) => (c.forensics.cadence ? `${num(c.forensics.cadence.medianSec)}s` : "—"), sortValue: (c) => c.forensics.cadence?.medianSec ?? Infinity },
        { key: "layers", header: "Evidence", width: 170, sortable: false, cell: (c) => <div className="flex gap-1">{c.layers.map((l) => <span key={l.layer} title={LAYERS[l.layer]?.name} className="rounded border border-line-2 px-1 font-mono text-[10.5px] text-fg-2">{LAYERS[l.layer]?.short ?? l.layer}</span>)}</div> },
        { key: "narratives", header: "Narratives", width: 110, sortable: false, cell: (c) => <span className="font-mono text-[12px] text-fg-3">{narrativesOf(view, c.id).map((n) => n.id).join(" ") || "—"}</span> },
      ]}
    />
  );
}

export function Clusters() {
  return (
    <ViewGate>
      {(view) => (
        <>
          <PageHeader title="Clusters" eyebrow={`${view.report.clusters.length} coordinated clusters · ${view.report.stats.flaggedActors} accounts`} />
          <Table view={view} />
        </>
      )}
    </ViewGate>
  );
}
