import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { State } from "@/lib/api";
import { clock } from "@/lib/format";

const config = {
  total: { label: "All posts", color: "var(--chart-2)" },
  coordinated: { label: "From coordinated accounts", color: "var(--chart-5)" },
} satisfies ChartConfig;

const RANGES = { "1h": 3600_000, "6h": 6 * 3600_000, "24h": 24 * 3600_000 };

export function ChartAreaInteractive({ activity, title = "Activity", description = "Posts collected by all monitors" }: { activity: State["activity"]; title?: string; description?: string }) {
  const [range, setRange] = useState<keyof typeof RANGES>("24h");
  const end = activity.start + activity.total.length * activity.binSec * 1000;
  const data = activity.total
    .map((v, i) => ({ ts: activity.start + i * activity.binSec * 1000, total: v, coordinated: activity.coordinated[i] }))
    .filter((d) => d.ts >= end - RANGES[range]);
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as keyof typeof RANGES)} variant="outline" className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex">
            <ToggleGroupItem value="24h">Last 24 hours</ToggleGroupItem>
            <ToggleGroupItem value="6h">Last 6 hours</ToggleGroupItem>
            <ToggleGroupItem value="1h">Last hour</ToggleGroupItem>
          </ToggleGroup>
          <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
            <SelectTrigger className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden" size="sm" aria-label="Time range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="1h">Last hour</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {data.length ? (
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
              <XAxis dataKey="ts" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => clock(v)} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => clock(p?.[0]?.payload?.ts ?? 0)} indicator="dot" />} />
              <Area dataKey="total" type="natural" fill="url(#fill-total)" stroke="var(--color-total)" />
              <Area dataKey="coordinated" type="natural" fill="url(#fill-coordinated)" stroke="var(--color-coordinated)" />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="grid h-[250px] place-items-center text-sm text-muted-foreground">Waiting for data from monitors</div>
        )}
      </CardContent>
    </Card>
  );
}
