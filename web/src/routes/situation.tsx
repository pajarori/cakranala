import { createRoute, Link, notFound } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Eye, Flag, ShieldAlert, ShieldCheck } from "lucide-react";
import { rootRoute } from "@/routes/root";
import { SectionCards } from "@/components/section-cards";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ensureState, overviewQuery, queryClient, useOps, useOverview, useWatchlist } from "@/lib/queries";
import { ESCALATION_LABEL, SEVERITY_LABEL, SEVERITY_VARIANT, ago, approx, int } from "@/lib/format";
import type { Case, Period, State } from "@/lib/api";

const ICON = { new: AlertTriangle, escalated: ArrowUpRight, status: Flag, watchlist: Eye, error: ShieldAlert };
const RANK = { urgent: 0, alert: 1, watch: 2 };

const PERIODS: { value: Period; label: string; text: string }[] = [
  { value: "all", label: "Semua waktu", text: "sepanjang data" },
  { value: "30d", label: "30 hari", text: "30 hari terakhir" },
  { value: "7d", label: "7 hari", text: "7 hari terakhir" },
  { value: "24h", label: "24 jam", text: "24 jam terakhir" },
];

function NeedsAction({ cases }: { cases: Case[] }) {
  const items = cases
    .filter((c) => c.status !== "dismissed" && c.status !== "confirmed" && (c.status === "new" || (c.active && c.escalation !== "watch")))
    .sort((a, b) => Number(b.active) - Number(a.active) || RANK[a.escalation] - RANK[b.escalation] || b.lastSeen - a.lastSeen)
    .slice(0, 5);
  return (
    <Card className="mx-4 lg:mx-6">
      <CardHeader>
        <CardTitle>Perlu tindakan</CardTitle>
        <CardDescription>Kasus baru atau yang sedang eskalasi</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ItemGroup className="gap-2">
            {items.map((c) => (
              <Item key={c.id} variant="outline" asChild>
                <Link to="/threats/$id" params={{ id: c.id }}>
                  <ItemMedia variant="icon">
                    <ShieldAlert className={c.escalation === "urgent" ? "text-destructive" : ""} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{c.title}</ItemTitle>
                    <ItemDescription>
                      {c.apparent ? `${int(c.apparent)} pendukung tampak, sekitar ${approx(c.independent)} suara independen` : `${int(c.members.length)} akun terkoordinasi`}, terakhir aktif {ago(c.lastSeen)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant={SEVERITY_VARIANT[c.severity]}>{SEVERITY_LABEL[c.severity]}</Badge>
                    <Badge variant={c.escalation === "urgent" ? "destructive" : "outline"}>{ESCALATION_LABEL[c.escalation]}</Badge>
                    {c.status === "new" && <Badge variant="secondary">Belum ditriase</Badge>}
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldCheck />
              </EmptyMedia>
              <EmptyTitle>Tidak ada yang perlu ditindak</EmptyTitle>
              <EmptyDescription>Kasus baru dan eskalasi akan muncul di sini.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

function Alerts({ alerts }: { alerts: State["alerts"] }) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Alert</CardTitle>
        <CardDescription>Terbaru di atas</CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        {alerts.length ? (
          <ScrollArea className="h-[280px]">
            <ul className="flex flex-col pr-3">
              {alerts.map((a) => {
                const Icon = ICON[a.kind];
                return (
                  <li key={a.id}>
                    <Link to="/threats/$id" params={{ id: a.caseId }} className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <Icon className={`mt-0.5 size-4 shrink-0 ${a.kind === "new" || a.kind === "watchlist" ? "text-destructive" : "text-muted-foreground"}`} />
                      <span className="min-w-0 flex-1 text-sm leading-snug">{a.text}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{ago(a.ts)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        ) : (
          <div className="grid h-[280px] place-items-center text-sm text-muted-foreground">Belum ada alert</div>
        )}
      </CardContent>
    </Card>
  );
}

function Situation({ period }: { period: Period }) {
  const state = useOps();
  const overview = useOverview(period);
  const { data: watch } = useWatchlist();
  const watched = new Set((watch ?? []).map((w) => w.actorId));
  const cases = state.cases.filter((c) => c.active || c.lastSeen >= overview.from);
  const text = PERIODS.find((p) => p.value === period)!.text;
  return (
    <>
      <div className="px-4 lg:px-6">
        <Tabs value={period}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value} asChild>
                {p.value === "all" ? <Link to="/">{p.label}</Link> : <Link to="/situation/$period" params={{ period: p.value }}>{p.label}</Link>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <NeedsAction cases={cases} />
      <SectionCards cases={cases} overview={overview} running={state.monitors.filter((m) => m.active).length} watched={watched} period={text} />
      <div className="grid gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartAreaInteractive activity={overview.activity} description={`Post yang dikumpulkan semua pantauan, ${text}`} />
        <Alerts alerts={state.alerts.filter((a) => a.ts >= overview.from)} />
      </div>
      <DataTable state={{ ...state, cases }} />
      {!state.monitors.length && (
        <div className="px-4 lg:px-6">
          <Button asChild>
            <Link to="/monitors/templates">Buat pantauan dari template</Link>
          </Button>
        </div>
      )}
    </>
  );
}

const load = (period: Period) => Promise.all([ensureState(), queryClient.ensureQueryData(overviewQuery(period))]);

export const situationRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", staticData: { title: "Situation" }, loader: () => load("all"), component: () => <Situation period="all" /> });

export const situationPeriodRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/situation/$period",
  staticData: { title: "Situation" },
  loader: ({ params }) => {
    if (!PERIODS.some((p) => p.value === params.period && p.value !== "all")) throw notFound();
    return load(params.period as Period);
  },
  component: function SituationPeriod() {
    return <Situation period={situationPeriodRoute.useParams().period as Period} />;
  },
});
