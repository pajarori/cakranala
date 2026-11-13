import { BarChart } from "@/components/ui/bar-chart";
import { SortableTable } from "@/components/ui/sortable-table";
import { Card, ErrorState, PageHeader, Skeleton, Stat, StatRow } from "@/components/primitives";
import { useAblation, useView } from "@/lib/queries";
import { pct } from "@/lib/format";
import type { AblationRow } from "@/lib/api";

const KINDS: Record<string, string> = { paid: "Paid buzzer", botfarm: "Bot farm", swarm: "LLM swarm" };

function Current() {
  const { data } = useView();
  const e = data?.evaluation;
  if (!e) return null;
  return (
    <StatRow>
      <Stat label="Precision" value={pct(e.precision)} />
      <Stat label="Recall" value={pct(e.recall)} />
      <Stat label="F1" value={e.f1.toFixed(2)} />
      {e.operations.map((o) => (
        <Stat key={o.id} label={KINDS[o.kind] ?? o.kind} value={pct(o.recall)} sub={`${o.size} accounts`} />
      ))}
      <Stat label="Viral false positives" value={pct(e.viralFlagRate ?? 0)} tone={(e.viralFlagRate ?? 0) === 0 ? "success" : "danger"} />
    </StatRow>
  );
}

function Ablation() {
  const { data, error, refetch, isPending } = useAblation();
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data)
    return (
      <div className="space-y-3">
        <Skeleton className="h-64" />
        <div className="text-[12.5px] text-fg-4">Running ablation…</div>
      </div>
    );
  return (
    <div className="space-y-5">
      <Card title={`Recall by operation type · ${data.seeds.length} scenarios`}>
        <BarChart
          data={data.rows.map((r) => ({ name: r.name, botfarm: r.botfarm * 100, paid: r.paid * 100, swarm: r.swarm * 100 }))}
          categoryKey="name"
          label="Recall by operation type"
          series={Object.entries(KINDS).map(([key, label]) => ({ key, label }))}
          layout="horizontal"
          formatValue={(v) => `${Math.round(v)}%`}
          legend
        />
      </Card>
      <SortableTable<AblationRow>
        caption="Ablation"
        getRowId={(r) => r.name}
        rows={data.rows}
        columns={[
          { key: "name", header: "Layers", sortValue: (r) => r.name },
          { key: "precision", header: "Precision", numeric: true, cell: (r) => pct(r.precision), sortValue: (r) => r.precision },
          { key: "recall", header: "Recall", numeric: true, cell: (r) => pct(r.recall), sortValue: (r) => r.recall },
          { key: "f1", header: "F1", numeric: true, cell: (r) => r.f1.toFixed(2), sortValue: (r) => r.f1 },
          { key: "org", header: "Organic FP", numeric: true, cell: (r) => pct(r.organicFP), sortValue: (r) => r.organicFP },
          { key: "viral", header: "Viral FP", numeric: true, cell: (r) => pct(r.viralFP), sortValue: (r) => r.viralFP },
        ]}
      />
    </div>
  );
}

export function Evaluation() {
  return (
    <>
      <PageHeader title="Evaluation" eyebrow="Detection quality against simulation ground truth" />
      <div className="space-y-5">
        <Current />
        <Ablation />
      </div>
    </>
  );
}
