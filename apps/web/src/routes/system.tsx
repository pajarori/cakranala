import { createRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAblation, useAudit, useCapabilities, useLiveState } from "@/lib/queries";
import { date, pct, short } from "@/lib/format";

const config = {
  botfarm: { label: "Bot farm", color: "var(--chart-1)" },
  paid: { label: "Paid buzzers", color: "var(--chart-2)" },
  swarm: { label: "LLM swarm", color: "var(--chart-3)" },
} satisfies ChartConfig;

function Accuracy() {
  const { data, error, refetch, isPending } = useAblation();
  if (error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Accuracy test failed</AlertTitle>
        <AlertDescription>
          {error.message}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (isPending || !data) return <Skeleton className="h-96 rounded-xl" />;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Detection rate by operation type</CardTitle>
          <CardDescription>Average over {data.seeds.length} simulated scenarios with known ground truth</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
            <BarChart data={data.rows.map((r) => ({ name: r.name, botfarm: Math.round(r.botfarm * 100), paid: Math.round(r.paid * 100), swarm: Math.round(r.swarm * 100) }))}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={40} unit="%" domain={[0, 100]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {Object.keys(config).map((k) => (
                <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={4} />
              ))}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Evidence layers used</TableHead>
              <TableHead className="text-right">Precision</TableHead>
              <TableHead className="text-right">Recall</TableHead>
              <TableHead className="text-right">F1</TableHead>
              <TableHead className="text-right">Organic flagged</TableHead>
              <TableHead className="text-right">Viral crowd flagged</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(r.precision)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(r.recall)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.f1.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(r.organicFP)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(r.viralFP)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function AuditLog() {
  const { data } = useAudit();
  if (!data) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit chain</CardTitle>
        <CardDescription>{data.entries} entries</CardDescription>
        <CardAction>{data.valid ? <Badge>Verified</Badge> : <Badge variant="destructive">Broken at {data.brokenAt}</Badge>}</CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((a) => (
                <TableRow key={a.seq}>
                  <TableCell className="text-muted-foreground">{date(a.ts)}</TableCell>
                  <TableCell className="font-medium">{a.action}</TableCell>
                  <TableCell className="font-mono" title={a.subject}>{short(a.subject)}</TableCell>
                  <TableCell className="text-right font-mono" title={a.hash}>{a.hash.slice(0, 12)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function System() {
  const caps = useCapabilities();
  const { data: state } = useLiveState();
  const e = state?.evaluation;
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">System</h1>
        <p className="text-muted-foreground">Detection accuracy and configuration</p>
      </div>
      <div className="grid gap-4 @xl/main:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Live collection on X</CardDescription>
            <CardTitle>{caps.data?.live ? <Badge>Configured</Badge> : <Badge variant="outline">Off</Badge>}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Language model</CardDescription>
            <CardTitle>{caps.data?.reasoner ? <Badge>Configured</Badge> : <Badge variant="outline">Off</Badge>}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Current window against ground truth</CardDescription>
            <CardTitle className="tabular-nums">{e ? `Precision ${pct(e.precision)}, recall ${pct(e.recall)}` : "Only for demo feeds"}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Accuracy />
      <AuditLog />
    </div>
  );
}

export const systemRoute = createRoute({ getParentRoute: () => rootRoute, path: "/system", staticData: { title: "System" }, component: System });
