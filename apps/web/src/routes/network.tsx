import { useState } from "react";
import { createRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { KeyValue, PageHeader, Panel, linkRow } from "@/components/primitives";
import { NetworkGraph } from "@/components/graph";
import { ensureView, useViewData } from "@/lib/queries";
import { LAYERS, clusterColor, date, int } from "@/lib/format";
import { profile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import type { View } from "@/lib/api";

function Inspector({ view, id, scope }: { view: View; id: string; scope: string }) {
  const actor = view.actors.find((a) => a.id === id);
  const cluster = view.report.clusters.find((c) => c.members.includes(id));
  const ties = view.report.edges.filter((e) => e.a === id || e.b === id);
  const layers = [...new Set(ties.flatMap((e) => Object.keys(e.layers)))];
  const items: [string, React.ReactNode][] = [
    ["Cluster", cluster ? <Link to="/clusters/$id" params={{ id: cluster.id }} className="underline underline-offset-4">{cluster.id}</Link> : "organic"],
    ["Ties", ties.length],
    ["Evidence", layers.map((l) => LAYERS[l]?.name ?? l).join(", ") || "none"],
  ];
  if (cluster) items.splice(1, 0, ["Profile", profile(cluster)]);
  if (actor?.followers !== undefined) items.push(["Followers", int(actor.followers)]);
  if (actor?.createdAt) items.push(["Account created", date(actor.createdAt)]);
  if (actor?.label) items.push(["Ground truth", actor.label]);
  return (
    <Panel title={actor?.handle ?? id} action={<Link to={scope === "all" ? "/network" : "/network/$scope"} params={{ scope }} className="text-[14px] text-muted-foreground hover:text-foreground">Close</Link>}>
      <KeyValue items={items} />
    </Panel>
  );
}

function Network() {
  const view = useViewData();
  const navigate = useNavigate();
  const { scope = "all", actor } = useParams({ strict: false }) as { scope?: string; actor?: string };
  const focus = scope === "all" ? undefined : scope;
  const [layers, setLayers] = useState<string[]>(view.report.stats.layersRun);
  const toggle = (l: string) => setLayers((xs) => (xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l]));
  const select = (id: string | null) => navigate(id ? { to: "/network/$scope/$actor", params: { scope, actor: id } } : scope === "all" ? { to: "/network" } : { to: "/network/$scope", params: { scope } });
  return (
    <>
      <PageHeader title="Network" meta={`${int(view.report.edges.length)} significant ties, ${view.report.clusters.length} clusters`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-xl border bg-card">
          <NetworkGraph key={view.report.generatedAt} view={view} layers={layers} focus={focus} selected={actor ?? null} onSelect={select} height="min(74vh, 780px)" />
        </div>
        <div className="space-y-6">
          {actor && <Inspector view={view} id={actor} scope={scope} />}
          <Panel title="Clusters" flush>
            <ul className="divide-y">
              <li>
                <Link to="/network" activeOptions={{ exact: true }} className={cn("flex items-center px-5 py-3 text-[15px] text-muted-foreground data-[status=active]:text-foreground", linkRow)}>
                  All accounts
                </Link>
              </li>
              {view.report.clusters.map((c) => (
                <li key={c.id}>
                  <Link to="/network/$scope" params={{ scope: c.id }} activeOptions={{ exact: false }} className={cn("flex items-center gap-3 px-5 py-3 text-[15px] text-muted-foreground data-[status=active]:text-foreground", linkRow)}>
                    <span className="size-2.5 rounded-full" style={{ background: clusterColor(c.id) }} />
                    <span className="font-medium">{c.id}</span>
                    <span>{profile(c)}</span>
                    <span className="tabular ml-auto">{c.members.length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Evidence layers" flush>
            <ul className="divide-y">
              {view.report.stats.layersRun.map((l) => (
                <li key={l}>
                  <label className={cn("flex cursor-pointer items-center gap-3 px-5 py-3 text-[15px]", linkRow)}>
                    <input type="checkbox" checked={layers.includes(l)} onChange={() => toggle(l)} className="size-4 accent-[var(--foreground)]" />
                    <span className={layers.includes(l) ? "" : "text-muted-foreground"}>{LAYERS[l]?.name ?? l}</span>
                    <span className="tabular ml-auto text-[14px] text-muted-foreground">{view.report.tests[l]?.significant ?? 0}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

export const networkRoute = createRoute({ getParentRoute: () => rootRoute, path: "/network", staticData: { title: "Network" }, loader: ensureView, component: Network });

export const networkChildren = [
  createRoute({ getParentRoute: () => networkRoute, path: "/$scope", component: () => null }),
  createRoute({ getParentRoute: () => networkRoute, path: "/$scope/$actor", component: () => null }),
];
