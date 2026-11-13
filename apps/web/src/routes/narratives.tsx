import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { ClusterChips, EmptyState, PageHeader, Tag } from "@/components/primitives";
import { DataTable } from "@/components/data-table";
import { ensureView, useViewData } from "@/lib/queries";
import { approx, int, ratio, truncate } from "@/lib/format";
import { coordinated, inflation, isCoordinated } from "@/lib/profile";
import type { Narrative } from "@/lib/api";

function Narratives() {
  const view = useViewData();
  const rows = view.report.narratives;
  return (
    <>
      <PageHeader title="Narratives" meta={`${coordinated(view).length} coordinated of ${rows.length}`} />
      {rows.length ? (
        <DataTable<Narrative>
          rows={rows}
          rowKey={(n) => n.id}
          href={(n) => `/narratives/${n.id}`}
          initialSort={{ key: "inflation", desc: true }}
          columns={[
            { key: "id", header: "ID", cell: (n) => <span className="font-medium">{n.id}</span>, sort: (n) => Number(n.id.slice(1)), className: "w-16" },
            { key: "sample", header: "Narrative", cell: (n) => <span className="block max-w-[560px] truncate">{truncate(n.sample, 140)}</span> },
            { key: "verdict", header: "Verdict", cell: (n) => (isCoordinated(n) ? <Tag tone="danger">Coordinated</Tag> : <Tag>Organic</Tag>), sort: (n) => (isCoordinated(n) ? 1 : 0), className: "w-32" },
            { key: "apparent", header: "Apparent", numeric: true, cell: (n) => int(n.supporters), sort: (n) => n.supporters },
            { key: "sie", header: "Independent", numeric: true, cell: (n) => approx(n.sie.value), sort: (n) => n.sie.value },
            { key: "inflation", header: "Inflation", numeric: true, cell: (n) => <span className={isCoordinated(n) ? "font-medium text-destructive" : undefined}>{ratio(inflation(n))}</span>, sort: (n) => inflation(n) },
            { key: "clusters", header: "Driven by", cell: (n) => <ClusterChips ids={n.clusters} max={2} />, className: "w-48" },
          ]}
        />
      ) : (
        <EmptyState title="No narratives in this source" />
      )}
    </>
  );
}

export const narrativesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/narratives", staticData: { title: "Narratives" }, loader: ensureView, component: Narratives });
