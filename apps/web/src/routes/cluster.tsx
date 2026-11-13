import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsPanel, TabsPanels, TabsTab } from "@/components/ui/tabs";
import { Card, EmptyState, PageHeader, Pill, Stat, StatRow } from "@/components/primitives";
import { NetworkGraph } from "@/components/graph";
import { ViewGate } from "@/components/view-gate";
import { LAYERS, clock, clusterColor, num } from "@/lib/format";
import { inflation, narrativesOf, profile } from "@/lib/profile";
import type { Cluster, View } from "@/lib/api";

export type ClusterTab = "evidence" | "graph" | "talking-points" | "members";
const PATHS = { evidence: "/clusters/$id", graph: "/clusters/$id/graph", "talking-points": "/clusters/$id/talking-points", members: "/clusters/$id/members" } as const;

function Evidence({ c }: { c: Cluster }) {
  const max = Math.max(...c.layers.map((l) => Math.log10(Math.max(1, l.meanObserved / Math.max(l.meanExpected, 0.001)))), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-fg-3">
            <th className="py-2 pr-4 font-normal">Layer</th>
            <th className="py-2 pr-4 text-right font-normal">Pairs</th>
            <th className="py-2 pr-4 text-right font-normal">Observed</th>
            <th className="py-2 pr-4 text-right font-normal">Expected by chance</th>
            <th className="w-[34%] py-2 font-normal">Excess</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...c.layers]
            .sort((a, b) => b.meanObserved / Math.max(b.meanExpected, 0.001) - a.meanObserved / Math.max(a.meanExpected, 0.001))
            .map((l) => {
              const x = l.meanObserved / Math.max(l.meanExpected, 0.001);
              return (
                <tr key={l.layer}>
                  <td className="py-2.5 pr-4 text-fg">{LAYERS[l.layer]?.name ?? l.layer}</td>
                  <td className="tabular py-2.5 pr-4 text-right text-fg-2">{l.pairs}</td>
                  <td className="tabular py-2.5 pr-4 text-right text-fg-2">{num(l.meanObserved)}</td>
                  <td className="tabular py-2.5 pr-4 text-right text-fg-3">{l.meanExpected < 0.01 ? "<0.01" : num(l.meanExpected)}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                        <div className="h-full rounded-full bg-danger" style={{ width: `${(Math.log10(Math.max(1, x)) / max) * 100}%` }} />
                      </div>
                      <span className="tabular w-16 text-right text-fg">×{x >= 1000 ? `${Math.round(x / 1000)}k` : num(x)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

function Body({ view, id, tab }: { view: View; id: string; tab: ClusterTab }) {
  const navigate = useNavigate();
  const c = view.report.clusters.find((x) => x.id === id);
  if (!c) return <EmptyState title={`Cluster ${id} is not in the current source.`} action={<Link to="/clusters" className="text-[13px] text-fg-2 underline">Back to clusters</Link>} />;
  const f = c.forensics;
  const p = profile(c);
  const handle = (a: string) => view.actors.find((x) => x.id === a)?.handle ?? a;
  const narratives = narrativesOf(view, c.id);
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="size-3 rounded-full" style={{ background: clusterColor(c.id) }} />
            Cluster {c.id}
          </span>
        }
        eyebrow={
          <>
            <Pill tone={p.tone}>{p.label}</Pill>
            {narratives.map((n) => (
              <Link key={n.id} to="/narratives/$id" params={{ id: n.id }} className="text-fg-3 hover:text-fg">
                pushes {n.id} ({`×${num(inflation(n))}`})
              </Link>
            ))}
          </>
        }
        actions={
          <Link to="/network/$cluster" params={{ cluster: c.id }} className="inline-flex h-8 items-center rounded-md border border-line-2 px-3 text-[12.5px] text-fg-2 hover:border-fg-4 hover:text-fg">
            Open in network
          </Link>
        }
      />
      <div className="space-y-5">
        <StatRow>
          <Stat label="Accounts" value={c.members.length} />
          <Stat label="Dependence ρ" value={c.rho.toFixed(2)} title="Average pairwise dependence. 0 = independent, 1 = one voice" />
          <Stat label="Waves" value={f.waves} />
          <Stat label="T0" value={clock(f.onset.ts)} sub={`${f.onset.actors} accounts in ${f.onset.windowSec / 60} min`} />
          <Stat label="Rotation τ" value={f.rotation === null ? "—" : f.rotation.toFixed(2)} tone={(f.rotation ?? 0) >= 0.7 ? "danger" : undefined} title="Kendall τ of account order across waves. Near 1 = the same scripted order every wave" />
          <Stat label="Cadence" value={f.cadence ? `${num(f.cadence.medianSec)}s` : "—"} sub={f.cadence ? `CV ${f.cadence.cv.toFixed(2)}` : undefined} />
        </StatRow>

        {c.brief && (
          <Card title={<span className="flex items-center gap-2"><Sparkles size={14} className="text-fg-3" />Reconstructed brief</span>}>
            <p className="max-w-4xl text-[14.5px] leading-relaxed text-fg">{c.brief}</p>
          </Card>
        )}

        <Card flush>
          <Tabs value={tab} onValueChange={(v) => navigate({ to: PATHS[v as ClusterTab], params: { id: c.id } })}>
            <TabsList wrapperClassName="px-4 border-b border-line">
              <TabsTab value="evidence" count={c.layers.length}>Evidence</TabsTab>
              <TabsTab value="graph">Graph</TabsTab>
              <TabsTab value="talking-points" count={f.talkingPoints.length}>Talking points</TabsTab>
              <TabsTab value="members" count={c.members.length}>Members</TabsTab>
            </TabsList>
            <TabsPanels className="p-4">
              <TabsPanel value="evidence">
                <Evidence c={c} />
              </TabsPanel>
              <TabsPanel value="graph">
                <div className="rounded-md border border-line bg-page">
                  <NetworkGraph view={view} focus={c.id} layers={Object.keys(LAYERS)} height={420} />
                </div>
              </TabsPanel>
              <TabsPanel value="talking-points">
                <ul className="space-y-3">
                  {f.talkingPoints.map((t) => (
                    <li key={t} className="border-l-2 pl-3 text-[14px] leading-relaxed text-fg-2" style={{ borderColor: clusterColor(c.id) }}>
                      {t}
                    </li>
                  ))}
                </ul>
              </TabsPanel>
              <TabsPanel value="members">
                {!!f.seeders.length && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="text-fg-3">Seeders</span>
                    {f.seeders.map((s) => (
                      <span key={s.actor} className="rounded-md bg-warning-soft px-2 py-0.5 font-mono text-[12px] text-warning">
                        {handle(s.actor)} · {Math.round(s.leadScore * 100)}%
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {c.members.map((m) => (
                    <span key={m} className="truncate font-mono text-[12px] text-fg-2">
                      {handle(m)}
                    </span>
                  ))}
                </div>
              </TabsPanel>
            </TabsPanels>
          </Tabs>
        </Card>
      </div>
    </>
  );
}

export function ClusterDetail({ tab }: { tab: ClusterTab }) {
  const { id } = useParams({ strict: false }) as { id: string };
  return <ViewGate>{(view) => <Body view={view} id={id} tab={tab} />}</ViewGate>;
}
