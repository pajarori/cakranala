import { createRoute, Link, Outlet } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { PageHeader, Panel, Stat, StatRow, Tag } from "@/components/primitives";
import { NetworkGraph } from "@/components/graph";
import { requireCluster } from "@/components/use-entity";
import { useViewData } from "@/lib/queries";
import { LAYERS, clock, clusterColor, num, ratio } from "@/lib/format";
import { inflation, narrativesOf, profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

function useCluster() {
  const { id } = clusterRoute.useParams();
  const view = useViewData();
  return { view, c: view.report.clusters.find((x) => x.id === id)! };
}

const TABS = [
  { to: "/clusters/$id", label: "Evidence", exact: true },
  { to: "/clusters/$id/graph", label: "Graph" },
  { to: "/clusters/$id/talking-points", label: "Talking points" },
  { to: "/clusters/$id/members", label: "Members" },
] as const;

function ClusterLayout() {
  const { view, c } = useCluster();
  const f = c.forensics;
  const scripted = (f.rotation ?? 0) >= 0.7;
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="size-3.5 rounded-full" style={{ background: clusterColor(c.id) }} />
            Cluster {c.id}
          </span>
        }
        meta={
          <>
            <Tag>{profile(c)}</Tag>
            {narrativesOf(view, c.id).map((n) => (
              <Link key={n.id} to="/narratives/$id" params={{ id: n.id }} className="hover:text-foreground">
                pushes {n.id}, {ratio(inflation(n))}
              </Link>
            ))}
          </>
        }
        actions={
          <Link to="/network/$scope" params={{ scope: c.id }} className="inline-flex h-9 items-center rounded-md border px-4 text-[15px] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            Open in network
          </Link>
        }
      />
      <div className="space-y-6">
        <StatRow>
          <Stat label="Accounts" value={c.members.length} />
          <Stat label="Dependence" value={c.rho.toFixed(2)} hint="Average pairwise dependence. 0 means independent, 1 means one voice." />
          <Stat label="Waves" value={f.waves} />
          <Stat label="Started" value={clock(f.onset.ts)} sub={`${f.onset.actors} accounts in ${f.onset.windowSec / 60} min`} />
          <Stat label="Account order" value={f.rotation === null ? "n/a" : f.rotation.toFixed(2)} sub={scripted ? "same order every wave" : undefined} tone={scripted ? "danger" : "neutral"} hint="Kendall tau of the order accounts post in, across waves" />
          <Stat label="Cadence" value={f.cadence ? `${num(f.cadence.medianSec)}s` : "n/a"} />
        </StatRow>
        {c.brief && (
          <Panel title="Brief">
            <p className="max-w-4xl text-[17px] leading-relaxed">{c.brief}</p>
          </Panel>
        )}
        <nav className="flex gap-1 border-b">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              params={{ id: c.id }}
              activeOptions={{ exact: "exact" in t }}
              className="-mb-px border-b-2 border-transparent px-4 py-2.5 text-[15px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:border-foreground data-[status=active]:text-foreground"
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <Outlet />
      </div>
    </>
  );
}

function Evidence() {
  const { c } = useCluster();
  const excess = (l: (typeof c.layers)[number]) => l.meanObserved / Math.max(l.meanExpected, 0.001);
  const rows = [...c.layers].sort((a, b) => excess(b) - excess(a));
  const max = Math.max(1, ...rows.map((l) => Math.log10(Math.max(1, excess(l)))));
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[680px] text-[15px]">
        <thead>
          <tr className="border-b text-left text-[14px] text-muted-foreground">
            <th className="px-5 py-3 font-medium">Layer</th>
            <th className="px-5 py-3 text-right font-medium">Pairs</th>
            <th className="px-5 py-3 text-right font-medium">Observed</th>
            <th className="px-5 py-3 text-right font-medium">Expected by chance</th>
            <th className="w-[34%] px-5 py-3 font-medium">Above chance</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((l) => (
            <tr key={l.layer}>
              <td className="px-5 py-3.5">{LAYERS[l.layer]?.name ?? l.layer}</td>
              <td className="tabular px-5 py-3.5 text-right text-muted-foreground">{l.pairs}</td>
              <td className="tabular px-5 py-3.5 text-right">{num(l.meanObserved)}</td>
              <td className="tabular px-5 py-3.5 text-right text-muted-foreground">{l.meanExpected < 0.01 ? "under 0.01" : num(l.meanExpected)}</td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-muted">
                    <div className="h-full bg-destructive" style={{ width: `${(Math.log10(Math.max(1, excess(l))) / max) * 100}%` }} />
                  </div>
                  <span className="tabular w-20 text-right font-medium">{excess(l) >= 1000 ? `${Math.round(excess(l) / 1000)}k×` : `${num(excess(l))}×`}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ALL_LAYERS = Object.keys(LAYERS);

function Graph() {
  const { view, c } = useCluster();
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <NetworkGraph view={view} focus={c.id} layers={ALL_LAYERS} height={460} />
    </div>
  );
}

function TalkingPoints() {
  const { c } = useCluster();
  return (
    <ul className="space-y-4">
      {c.forensics.talkingPoints.map((t) => (
        <li key={t} className="border-l-2 pl-4 text-[17px] leading-relaxed" style={{ borderColor: clusterColor(c.id) }}>
          {t}
        </li>
      ))}
    </ul>
  );
}

function Members() {
  const { view, c } = useCluster();
  const handle = (a: string) => view.actors.find((x) => x.id === a)?.handle ?? a;
  const seeders = new Map(c.forensics.seeders.map((s) => [s.actor, s.leadScore]));
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {c.members.map((m) => (
        <Link key={m} to="/network/$scope/$actor" params={{ scope: c.id, actor: m }} className={cn("flex items-center justify-between rounded-md px-2 py-1.5 text-[15px] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", seeders.has(m) && "text-warning")}>
          <span className="truncate">{handle(m)}</span>
          {seeders.has(m) && <span className="tabular text-[14px]">seeder, leads {Math.round(seeders.get(m)! * 100)}%</span>}
        </Link>
      ))}
    </div>
  );
}

export const clusterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/clusters/$id",
  staticData: { title: "Clusters" },
  loader: ({ params }) => requireCluster(params.id),
  component: ClusterLayout,
});

export const clusterTabs = [
  createRoute({ getParentRoute: () => clusterRoute, path: "/", component: Evidence }),
  createRoute({ getParentRoute: () => clusterRoute, path: "/graph", component: Graph }),
  createRoute({ getParentRoute: () => clusterRoute, path: "/talking-points", component: TalkingPoints }),
  createRoute({ getParentRoute: () => clusterRoute, path: "/members", component: Members }),
];
