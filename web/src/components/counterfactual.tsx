import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Narrative } from "@/lib/api";
import { clock } from "@/lib/format";

const config = {
  observed: { label: "Teramati", color: "var(--chart-5)" },
  organic: { label: "Tanpa akun terkoordinasi", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function Counterfactual({ narrative, height = 260 }: { narrative: Narrative; height?: number }) {
  const cf = narrative.counterfactual;
  if (!cf.all.length) return null;
  const data = cf.all.map((v, i) => ({ t: clock(cf.start + i * cf.binSec * 1000), observed: v, organic: cf.organic[i] }));
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={32} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area dataKey="observed" type="monotone" stroke="var(--color-observed)" fill="var(--color-observed)" fillOpacity={0.18} strokeWidth={2} />
        <Area dataKey="organic" type="monotone" stroke="var(--color-organic)" fill="var(--color-organic)" fillOpacity={0.25} strokeWidth={2} strokeDasharray="5 4" />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
