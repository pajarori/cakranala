import { createRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { rootRoute } from "@/routes/root";
import { ErrorState, PageHeader, Panel, Stat, StatRow } from "@/components/primitives";
import { DataTable } from "@/components/data-table";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAblation, useView } from "@/lib/queries";
import { pct } from "@/lib/format";
import type { AblationRow } from "@/lib/api";

const KINDS: Record<string, string> = { botfarm: "Bot farm", paid: "Paid buzzers", swarm: "LLM swarm" };

const config = {
  botfarm: { label: "Bot farm", color: "var(--chart-3)" },
  paid: { label: "Paid buzzers", color: "var(--chart-4)" },
  swarm: { label: "LLM swarm", color: "var(--chart-5)" },
} satisfies ChartConfig;

function Current() {
  const { data } = useView();
  const e = data?.evaluation;
  if (!e) return null;
  return (
    <StatRow>
      <Stat label="Precision" value={pct(e.precision)} />
      <Stat label="Recall" value={pct(e.recall)} />
      {e.operations.map((o) => (
        <Stat key={o.id} label={KINDS[o.kind] ?? o.kind} value={pct(o.recall)} sub={`${o.size} accounts`} />
      ))}
      <Stat label="Viral crowd flagged" value={pct(e.viralFlagRate ?? 0)} />
    </StatRow>
  );
}

function Ablation() {
  const { data, error, refetch, isPending } = useAblation();
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <Skeleton className="h-80" />;
  const chart = data.rows.map((r) => ({ name: r.name, botfarm: Math.round(r.botfarm * 100), paid: Math.round(r.paid * 100), swarm: Math.round(r.swarm * 100) }));
  return (
    <div className="space-y-6">
      <Panel title={`Detection rate by operation type, ${data.seeds.length} scenarios`}>
        <ChartContainer config={config} className="h-[340px] w-full">
          <BarChart data={chart} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 13 }} interval={0} />
            <YAxis tickLine={false} axisLine={false} width={40} unit="%" domain={[0, 100]} tick={{ fontSize: 13 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent className="text-[14px]" />} />
            {Object.keys(config).map((k) => (
              <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={2} />
            ))}
          </BarChart>
        </ChartContainer>
      </Panel>
      <DataTable<AblationRow>
        rows={data.rows}
        rowKey={(r) => r.name}
        columns={[
          { key: "name", header: "Layers used", cell: (r) => <span className="font-medium">{r.name}</span> },
          { key: "precision", header: "Precision", numeric: true, cell: (r) => pct(r.precision), sort: (r) => r.precision },
          { key: "recall", header: "Recall", numeric: true, cell: (r) => pct(r.recall), sort: (r) => r.recall },
          { key: "f1", header: "F1", numeric: true, cell: (r) => r.f1.toFixed(2), sort: (r) => r.f1 },
          { key: "org", header: "Organic flagged", numeric: true, cell: (r) => pct(r.organicFP), sort: (r) => r.organicFP },
          { key: "viral", header: "Viral flagged", numeric: true, cell: (r) => pct(r.viralFP), sort: (r) => r.viralFP },
        ]}
      />
    </div>
  );
}

function Evaluation() {
  return (
    <>
      <PageHeader title="Evaluation" />
      <div className="space-y-6">
        <Current />
        <Ablation />
      </div>
    </>
  );
}

export const evaluationRoute = createRoute({ getParentRoute: () => rootRoute, path: "/evaluation", staticData: { title: "Evaluation" }, component: Evaluation });
