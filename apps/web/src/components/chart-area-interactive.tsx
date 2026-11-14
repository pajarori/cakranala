import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Overview } from "@/lib/api";
import { clock, day } from "@/lib/format";

const config = {
  total: { label: "Semua post", color: "var(--chart-2)" },
  coordinated: { label: "Dari akun terkoordinasi", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function ChartAreaInteractive({ activity, title = "Aktivitas", description = "Post yang dikumpulkan semua pantauan" }: { activity: Overview["activity"]; title?: string; description?: string }) {
  const label = activity.binSec >= 86_400 ? day : clock;
  const data = activity.total.map((v, i) => ({ ts: activity.start + i * activity.binSec * 1000, total: v, coordinated: activity.coordinated[i] }));
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {data.some((d) => d.total) ? (
          <ChartContainer config={config} className="aspect-auto h-[250px] w-full">
            <AreaChart data={data}>
              <defs>
                {Object.keys(config).map((k) => (
                  <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="ts" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => label(v)} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => label(p?.[0]?.payload?.ts ?? 0)} indicator="dot" />} />
              <Area dataKey="total" type="natural" fill="url(#fill-total)" stroke="var(--color-total)" />
              <Area dataKey="coordinated" type="natural" fill="url(#fill-coordinated)" stroke="var(--color-coordinated)" />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="grid h-[250px] place-items-center text-sm text-muted-foreground">Belum ada post dalam rentang ini</div>
        )}
      </CardContent>
    </Card>
  );
}
