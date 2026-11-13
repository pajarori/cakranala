import { createRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CircleDot, Flag } from "lucide-react";
import { rootRoute } from "@/routes/root";
import { SectionCards } from "@/components/section-cards";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureState, useOps } from "@/lib/queries";
import { ago } from "@/lib/format";
import type { State } from "@/lib/api";

const ICON = { new: AlertTriangle, escalated: ArrowUpRight, status: Flag };

function Alerts({ state }: { state: State }) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
        <CardDescription>Newest first</CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        {state.alerts.length ? (
          <ul className="flex flex-col">
            {state.alerts.slice(0, 7).map((a) => {
              const Icon = ICON[a.kind] ?? CircleDot;
              return (
                <li key={a.id}>
                  <Link to="/threats/$id" params={{ id: a.caseId }} className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                    <Icon className={`mt-0.5 size-4 shrink-0 ${a.kind === "new" ? "text-destructive" : "text-muted-foreground"}`} />
                    <span className="min-w-0 flex-1 text-sm leading-snug">{a.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{ago(a.ts)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid h-[250px] place-items-center text-sm text-muted-foreground">No alerts yet</div>
        )}
      </CardContent>
    </Card>
  );
}

function Situation() {
  const state = useOps();
  return (
    <>
      <SectionCards state={state} />
      <div className="grid gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartAreaInteractive activity={state.activity} />
        <Alerts state={state} />
      </div>
      <DataTable state={state} />
    </>
  );
}

export const situationRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", staticData: { title: "Situation" }, loader: ensureState, component: Situation });
