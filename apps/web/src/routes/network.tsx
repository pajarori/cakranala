import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Card, KeyValue, PageHeader, Pill } from "@/components/primitives";
import { NetworkGraph } from "@/components/graph";
import { ViewGate } from "@/components/view-gate";
import { LAYERS, clusterColor, date, int } from "@/lib/format";
import { profile } from "@/lib/profile";
import type { View } from "@/lib/api";

function Inspector({ view, id, onClose }: { view: View; id: string; onClose: () => void }) {
  const actor = view.actors.find((a) => a.id === id);
  const cluster = view.report.clusters.find((c) => c.members.includes(id));
  const ties = view.report.edges.filter((e) => e.a === id || e.b === id);
  const layers = [...new Set(ties.flatMap((e) => Object.keys(e.layers)))];
  return (
    <Card
      title={<span className="font-mono">{actor?.handle ?? id}</span>}
      action={
        <button onClick={onClose} className="grid size-6 place-items-center rounded text-fg-3 hover:bg-hover hover:text-fg" aria-label="Close">
          <X size={14} />
        </button>
      }
    >
      <KeyValue
        items={[
          ["Cluster", cluster ? <Link to="/clusters/$id" params={{ id: cluster.id }} className="hover:underline">{cluster.id}</Link> : "Organic"],
          ...(cluster ? ([["Profile", <Pill tone={profile(cluster).tone}>{profile(cluster).label}</Pill>]] as [string, React.ReactNode][]) : []),
          ["Ties", ties.length],
          ["Layers", layers.map((l) => LAYERS[l]?.short ?? l).join(" ") || "—"],
          ...(actor?.followers !== undefined ? ([["Followers", int(actor.followers)]] as [string, React.ReactNode][]) : []),
          ...(actor?.createdAt ? ([["Created", date(actor.createdAt)]] as [string, React.ReactNode][]) : []),
          ...(actor?.label ? ([["Ground truth", actor.label]] as [string, React.ReactNode][]) : []),
        ]}
      />
    </Card>
  );
}

function Body({ view, focus }: { view: View; focus?: string }) {
  const navigate = useNavigate();
  const [layers, setLayers] = useState<string[]>(view.report.stats.layersRun);
  const [selected, setSelected] = useState<string | null>(null);
  const toggle = (l: string) => setLayers((xs) => (xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l]));
  return (
    <>
      <PageHeader title="Network" eyebrow={`${int(view.report.edges.length)} significant ties · ${view.report.clusters.length} clusters`} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-lg border border-line bg-frame">
          <NetworkGraph view={view} layers={layers} focus={focus} selected={selected} onSelect={setSelected} height="min(72vh, 760px)" />
        </div>
        <div className="space-y-5">
          {selected && <Inspector view={view} id={selected} onClose={() => setSelected(null)} />}
          <Card title="Evidence layers" flush>
            <ul className="divide-y divide-line">
              {view.report.stats.layersRun.map((l) => (
                <li key={l}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-hover">
                    <input type="checkbox" checked={layers.includes(l)} onChange={() => toggle(l)} className="accent-[var(--fg)]" />
                    <span className={layers.includes(l) ? "text-fg" : "text-fg-3"}>{LAYERS[l]?.name ?? l}</span>
                    <span className="tabular ml-auto text-[12px] text-fg-4">{view.report.tests[l]?.significant ?? 0}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Clusters" flush>
            <ul className="divide-y divide-line">
              <li>
                <button onClick={() => navigate({ to: "/network" })} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-hover ${focus ? "text-fg-3" : "text-fg"}`}>
                  All
                </button>
              </li>
              {view.report.clusters.map((c) => (
                <li key={c.id}>
                  <button onClick={() => navigate({ to: "/network/$cluster", params: { cluster: c.id } })} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-hover ${focus === c.id ? "text-fg" : "text-fg-2"}`}>
                    <span className="size-2 rounded-full" style={{ background: clusterColor(c.id) }} />
                    {c.id}
                    <Pill tone={profile(c).tone}>{profile(c).label}</Pill>
                    <span className="tabular ml-auto text-[12px] text-fg-4">{c.members.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

export function Network() {
  const { cluster } = useParams({ strict: false }) as { cluster?: string };
  return <ViewGate>{(view) => <Body key={cluster ?? "all"} view={view} focus={cluster} />}</ViewGate>;
}
