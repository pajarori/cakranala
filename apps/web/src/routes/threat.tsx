import { createRoute, Link, notFound, Outlet, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Counterfactual } from "@/components/counterfactual";
import { NetworkGraph } from "@/components/graph";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ensureState, useCreateReport, useOps, useSetStatus } from "@/lib/queries";
import { LAYERS, SEVERITY_VARIANT, STATUS_LABEL, ago, approx, clock, date, graphColor, int, num, pct, ratio, short } from "@/lib/format";
import { inflation, profile } from "@/lib/profile";
import type { CaseStatus } from "@/lib/api";

function useCase() {
  const { id } = threatRoute.useParams();
  const state = useOps();
  const c = state.cases.find((x) => x.id === id)!;
  const narratives = state.report?.narratives.filter((n) => c.narratives.includes(n.id)).sort((a, b) => b.supporters - a.supporters) ?? [];
  const clusters = state.report?.clusters.filter((k) => c.clusters.includes(k.id)) ?? [];
  return { state, c, narratives, clusters };
}

const TABS = [
  { value: "summary", to: "/threats/$id", label: "Summary" },
  { value: "evidence", to: "/threats/$id/evidence", label: "Evidence" },
  { value: "network", to: "/threats/$id/network", label: "Network" },
  { value: "accounts", to: "/threats/$id/accounts", label: "Accounts" },
] as const;

function ThreatLayout() {
  const { c, clusters } = useCase();
  const navigate = useNavigate();
  const setStatus = useSetStatus();
  const report = useCreateReport();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tab = TABS.find((t) => t.value !== "summary" && path.includes(`/${t.value}`))?.value ?? "summary";
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-foreground" title={c.id}>{short(c.id)}</span>
            <Badge variant={SEVERITY_VARIANT[c.severity]} className="capitalize">
              {c.severity}
            </Badge>
            {!c.active && <Badge variant="outline">Dormant</Badge>}
            <span>First seen {date(c.firstSeen)}</span>
            <span>Last activity {ago(c.lastSeen)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{c.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={c.status} onValueChange={(v) => setStatus.mutate({ id: c.id, status: v as CaseStatus }, { onSuccess: () => toast.success(`Marked ${STATUS_LABEL[v as CaseStatus].toLowerCase()}`) })}>
            <SelectTrigger className="w-40" aria-label="Case status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!c.active || report.isPending} onClick={() => report.mutate(c.id, { onSuccess: (r) => navigate({ to: "/reports/$id", params: { id: r.id } }), onError: (e) => toast.error(e.message) })}>
            {report.isPending ? <Spinner /> : <FileText />}
            Create report
          </Button>
        </div>
      </div>
      <Tabs value={tab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} asChild>
              <Link to={t.to} params={{ id: c.id }}>
                {t.label}
                {t.value === "accounts" && <Badge variant="secondary">{clusters.reduce((s, k) => s + k.members.length, 0)}</Badge>}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {c.active ? (
        <Outlet />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Not active in the last 24 hours</EmptyTitle>
            <EmptyDescription>The evidence returns when these accounts act again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function Summary() {
  const { c, narratives, clusters } = useCase();
  const lead = narratives[0];
  const coordinated = clusters.reduce((s, k) => s + k.members.length, 0);
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid gap-4 *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[
          ["Apparent supporters", int(c.apparent), "Accounts that pushed these narratives"],
          ["Independent voices", approx(c.independent), "What the support is really worth"],
          ["Inflation", ratio(inflation({ supporters: c.apparent, sie: { value: c.independent } })), "Apparent support divided by independent voices"],
          ["Coordinated accounts", int(coordinated), `In ${clusters.length} cluster${clusters.length === 1 ? "" : "s"}`],
        ].map(([label, value, foot]) => (
          <Card key={label} className="@container/card">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
            </CardHeader>
            <CardFooter className="text-sm text-muted-foreground">{foot}</CardFooter>
          </Card>
        ))}
      </div>
      {c.brief && (
        <Card>
          <CardHeader>
            <CardTitle>Assessment</CardTitle>
            <CardDescription>What the operators appear to be pushing</CardDescription>
          </CardHeader>
          <CardContent className="leading-relaxed">{c.brief}</CardContent>
        </Card>
      )}
      {lead && (
        <Card>
          <CardHeader>
            <CardTitle>Without the operation</CardTitle>
            <CardDescription>Volume of the main narrative, with and without the coordinated accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Counterfactual narrative={lead} height={260} />
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 @5xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Narratives</CardTitle>
            <CardDescription>Messages pushed in this operation</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {narratives.map((n) => (
              <div key={n.id}>
                <p className="mb-2 leading-relaxed">“{n.sample}”</p>
                <Progress value={Math.max(1, (n.sie.value / Math.max(1, n.supporters)) * 100)} aria-label="Independent share" />
                <div className="mt-1.5 flex justify-between text-sm text-muted-foreground tabular-nums">
                  <span>{approx(n.sie.value)} independent</span>
                  <span>{int(n.supporters)} apparent</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operators</CardTitle>
            <CardDescription>Coordinated clusters behind the narratives</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {clusters.map((k) => (
              <div key={k.id} className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: graphColor(k.id) }} />
                  <span className="font-medium" title={k.id}>Cluster <span className="font-mono">{short(k.id)}</span></span>
                  <Badge variant="outline">{profile(k)}</Badge>
                  <span className="ml-auto text-sm text-muted-foreground tabular-nums">{k.members.length} accounts</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Started</div>
                    <div className="tabular-nums">{clock(k.forensics.onset.ts)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Waves</div>
                    <div className="tabular-nums">{k.forensics.waves}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cadence</div>
                    <div className="tabular-nums">{k.forensics.cadence ? `${num(k.forensics.cadence.medianSec)}s` : "n/a"}</div>
                  </div>
                </div>
                {(k.forensics.rotation ?? 0) >= 0.7 && <p className="mt-3 text-sm text-destructive">Accounts post in the same order every wave, which points to automation.</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Evidence() {
  const { state, clusters } = useCase();
  const decoy = state.report?.null.decoyFdr ?? 0;
  return (
    <div className="flex flex-col gap-4">
      {clusters.map((k) => {
        const rows = [...k.layers].sort((a, b) => b.meanObserved / Math.max(b.meanExpected, 0.001) - a.meanObserved / Math.max(a.meanExpected, 0.001));
        return (
          <Card key={k.id}>
            <CardHeader>
              <CardTitle title={k.id}>Cluster <span className="font-mono">{short(k.id)}</span></CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Cluster p {k.p <= 0.05 ? "≤ 0.05" : num(k.p)}</Badge>
                <Badge variant="outline">Score {int(k.score)}</Badge>
                <Badge variant="outline">Decoy FDR {pct(decoy)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Evidence layer</TableHead>
                      <TableHead className="text-right">Account pairs</TableHead>
                      <TableHead className="text-right">Observed</TableHead>
                      <TableHead className="text-right">Expected by chance</TableHead>
                      <TableHead className="text-right">Above chance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((l) => {
                      const x = l.meanObserved / Math.max(l.meanExpected, 0.001);
                      return (
                        <TableRow key={l.layer}>
                          <TableCell className="font-medium">{LAYERS[l.layer] ?? l.layer}</TableCell>
                          <TableCell className="text-right tabular-nums">{l.pairs}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(l.meanObserved)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{l.meanExpected < 0.01 ? "under 0.01" : num(l.meanExpected)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{x >= 1000 ? `${Math.round(x / 1000)}k×` : ratio(x)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const ALL_LAYERS = Object.keys(LAYERS);

function Network() {
  const { state, c } = useCase();
  const { actor } = useParams({ strict: false }) as { actor?: string };
  const navigate = useNavigate();
  const a = actor ? state.actors.find((x) => x.id === actor) : undefined;
  return (
    <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="overflow-hidden py-0">
        <NetworkGraph
          view={state}
          focus={c.clusters}
          layers={ALL_LAYERS}
          selected={actor ?? null}
          onSelect={(id) => navigate(id ? { to: "/threats/$id/network/$actor", params: { id: c.id, actor: id } } : { to: "/threats/$id/network", params: { id: c.id } })}
          height="min(70vh, 640px)"
        />
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{a?.handle ?? "Select an account"}</CardTitle>
          <CardDescription>{a ? (() => { const k = state.report?.clusters.find((x) => x.members.includes(a.id)); return k ? `Cluster ${short(k.id)}` : "Organic account"; })() : "Click a node to inspect it"}</CardDescription>
        </CardHeader>
        {a && (
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ties</span>
              <span className="tabular-nums">{state.report?.edges.filter((e) => e.a === a.id || e.b === a.id).length}</span>
            </div>
            {a.followers !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Followers</span>
                <span className="tabular-nums">{int(a.followers)}</span>
              </div>
            )}
            {a.createdAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account created</span>
                <span>{date(a.createdAt)}</span>
              </div>
            )}
            {a.label && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Simulation label</span>
                <span>{a.label}</span>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function Accounts() {
  const { state, c, clusters } = useCase();
  const handle = (id: string) => state.actors.find((a) => a.id === id)?.handle ?? id;
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Cluster</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clusters.flatMap((k) => {
            const seeders = new Map(k.forensics.seeders.map((s) => [s.actor, s.leadScore]));
            return k.members.map((m) => (
              <TableRow key={m}>
                <TableCell>
                  <Link to="/threats/$id/network/$actor" params={{ id: c.id, actor: m }} className="font-medium hover:underline">
                    {handle(m)}
                  </Link>
                </TableCell>
                <TableCell className="font-mono" title={k.id}>{short(k.id)}</TableCell>
                <TableCell className="text-muted-foreground">{seeders.has(m) ? `Seeder, posts first ${Math.round(seeders.get(m)! * 100)}% of the time` : "Amplifier"}</TableCell>
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export const threatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/threats/$id",
  staticData: { title: "Threats" },
  loader: async ({ params }) => {
    const state = await ensureState();
    if (!state.cases.some((c) => c.id === params.id)) throw notFound();
  },
  component: ThreatLayout,
});

const networkTab = createRoute({ getParentRoute: () => threatRoute, path: "/network", component: Network });

export const threatTabs = [
  createRoute({ getParentRoute: () => threatRoute, path: "/", component: Summary }),
  createRoute({ getParentRoute: () => threatRoute, path: "/evidence", component: Evidence }),
  networkTab.addChildren([createRoute({ getParentRoute: () => networkTab, path: "/$actor", component: () => null })]),
  createRoute({ getParentRoute: () => threatRoute, path: "/accounts", component: Accounts }),
];
