import { useNavigate } from "@tanstack/react-router";
import { SortableTable } from "@/components/ui/sortable-table";
import { ClusterChip, PageHeader, Pill, VoiceBar } from "@/components/primitives";
import { ViewGate } from "@/components/view-gate";
import { clusterColor, int, num, ratio, truncate } from "@/lib/format";
import { inflation } from "@/lib/profile";
import type { Narrative, View } from "@/lib/api";

function Table({ view }: { view: View }) {
  const navigate = useNavigate();
  const go = (id: string) => navigate({ to: "/narratives/$id", params: { id } });
  return (
    <SortableTable<Narrative>
      caption="Narratives"
      rows={view.report.narratives}
      getRowId={(n) => n.id}
      defaultSort={{ column: "inflation", direction: "desc" }}
      columns={[
        { key: "id", header: "ID", width: 64, cell: (n) => <button onClick={() => go(n.id)} className="font-mono text-[12px] text-fg-2 hover:text-fg">{n.id}</button>, sortValue: (n) => Number(n.id.slice(1)) },
        { key: "sample", header: "Narrative", cell: (n) => <button onClick={() => go(n.id)} className="block max-w-[520px] truncate text-left text-fg hover:underline">{truncate(n.sample, 120)}</button>, sortable: false },
        { key: "verdict", header: "Verdict", width: 120, cell: (n) => (n.clusters.length ? <Pill tone="danger">Manufactured</Pill> : <Pill>Organic</Pill>), sortValue: (n) => n.clusters.length },
        { key: "apparent", header: "Apparent", numeric: true, width: 96, cell: (n) => int(n.supporters), sortValue: (n) => n.supporters },
        { key: "sie", header: "Independent", numeric: true, width: 120, cell: (n) => `±${num(n.sie.value)}`, sortValue: (n) => n.sie.value },
        { key: "inflation", header: "Inflation", numeric: true, width: 96, cell: (n) => <span className={n.clusters.length ? "text-danger" : ""}>{ratio(inflation(n))}</span>, sortValue: (n) => inflation(n) },
        { key: "bar", header: "Voices", width: 140, cell: (n) => <VoiceBar apparent={n.supporters} effective={n.sie.value} size="sm" />, sortable: false },
        { key: "clusters", header: "Driven by", width: 180, cell: (n) => <div className="flex flex-wrap gap-1">{n.clusters.map((c) => <ClusterChip key={c.id} id={c.id} color={clusterColor(c.id)} />)}</div>, sortValue: (n) => n.clusters.length },
      ]}
    />
  );
}

export function Narratives() {
  return (
    <ViewGate>
      {(view) => (
        <>
          <PageHeader title="Narratives" eyebrow={`${view.report.narratives.length} narratives · ${view.source.label}`} />
          <Table view={view} />
        </>
      )}
    </ViewGate>
  );
}
