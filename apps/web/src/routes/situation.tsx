import { createRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Eye, Flag, ShieldAlert, ShieldCheck } from "lucide-react";
import { rootRoute } from "@/routes/root";
import { SectionCards } from "@/components/section-cards";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { Onboarding } from "@/components/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ensureState, useOps, useWatchlist } from "@/lib/queries";
import { ESCALATION_LABEL, SEVERITY_LABEL, SEVERITY_VARIANT, ago, approx, int } from "@/lib/format";
import type { State } from "@/lib/api";

const ICON = { new: AlertTriangle, escalated: ArrowUpRight, status: Flag, watchlist: Eye };
const RANK = { urgent: 0, alert: 1, watch: 2 };

function NeedsAction({ state }: { state: State }) {
  const items = state.cases
    .filter((c) => c.active && c.status !== "dismissed" && c.status !== "confirmed" && (c.status === "new" || c.escalation !== "watch"))
    .sort((a, b) => RANK[a.escalation] - RANK[b.escalation] || b.apparent - a.apparent)
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
                      {int(c.apparent)} pendukung tampak, sekitar {approx(c.independent)} suara independen, terakhir aktif {ago(c.lastSeen)}
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

function Alerts({ state }: { state: State }) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Alert</CardTitle>
        <CardDescription>Terbaru di atas</CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        {state.alerts.length ? (
          <ScrollArea className="h-[280px]">
            <ul className="flex flex-col pr-3">
              {state.alerts.map((a) => {
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

function Situation() {
  const state = useOps();
  const { data: watch } = useWatchlist();
  const watched = new Set((watch ?? []).map((w) => w.actorId));
  return (
    <>
      <Onboarding state={state} />
      <NeedsAction state={state} />
      <SectionCards state={state} watched={watched} />
      <div className="grid gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartAreaInteractive activity={state.activity} />
        <Alerts state={state} />
      </div>
      <DataTable state={state} />
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

export const situationRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", staticData: { title: "Situation" }, loader: ensureState, component: Situation });
