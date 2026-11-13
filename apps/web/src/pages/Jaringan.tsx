import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Panel } from "@/components/kit";
import { LAYER_NAMES, PALETTE, type View } from "@/lib/api";

export function Jaringan({ view, onCluster }: { view: View; onCluster: (id: string) => void }) {
  const { report } = view;
  const layers = report.stats.layersRun;
  const [active, setActive] = useState<string[]>(layers);
  const [truth, setTruth] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cluster = useMemo(() => new Map(report.clusters.flatMap((c, i) => c.members.map((m) => [m, { id: c.id, color: PALETTE[i % PALETTE.length] }] as const))), [report]);
  const actors = useMemo(() => new Map(view.actors.map((a) => [a.id, a])), [view]);
  const graph = useMemo(() => {
    const links = report.edges
      .map((e) => ({ source: e.a, target: e.b, rho: e.rho, layers: Object.keys(e.layers).filter((l) => active.includes(l)) }))
      .filter((l) => l.layers.length >= Math.min(2, active.length));
    const ids = new Set(links.flatMap((l) => [l.source, l.target]));
    return { nodes: [...ids].map((id) => ({ id })), links };
  }, [report, active]);

  const color = (id: string) => {
    if (truth) {
      const label = actors.get(id)?.label ?? "";
      return label.includes("botfarm") ? "#e5646a" : label.includes("paid") ? "#e0a85a" : label.includes("swarm") ? "#c58af0" : "#5fc992";
    }
    return cluster.get(id)?.color ?? "#454545";
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Panel title="Multiplex dependency graph" className="min-w-0">
        <div ref={box} className="overflow-hidden rounded-lg bg-page">
          <ForceGraph2D
            graphData={graph}
            width={width}
            height={560}
            backgroundColor="#080808"
            nodeRelSize={4}
            nodeColor={(n) => color(String(n.id))}
            nodeLabel={(n) => {
              const a = actors.get(String(n.id));
              return `${a?.handle ?? n.id}${cluster.get(String(n.id)) ? ` · ${cluster.get(String(n.id))!.id}` : ""}${truth && a?.label ? ` · ${a.label}` : ""}`;
            }}
            linkColor={() => "rgba(237,237,237,0.12)"}
            linkWidth={(l) => 0.5 + 2.5 * (l as { rho: number }).rho}
            onNodeClick={(n) => {
              const c = cluster.get(String(n.id));
              if (c) onCluster(c.id);
            }}
            cooldownTicks={120}
          />
        </div>
      </Panel>
      <div className="space-y-5">
        <Panel title="Layers">
          <div className="space-y-2">
            {layers.map((l) => (
              <label key={l} className="flex cursor-pointer items-center justify-between gap-2 text-[13px]">
                <span className="text-fg-2">{LAYER_NAMES[l] ?? l}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular text-[11.5px] text-fg-4">{report.tests[l]?.significant ?? 0}</span>
                  <input type="checkbox" checked={active.includes(l)} onChange={(e) => setActive(e.target.checked ? [...active, l] : active.filter((x) => x !== l))} />
                </span>
              </label>
            ))}
          </div>
        </Panel>
        <Panel title="Clusters">
          <div className="space-y-1.5">
            {report.clusters.map((c, i) => (
              <button key={c.id} onClick={() => onCluster(c.id)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] hover:bg-hover">
                <span className="size-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="text-fg">{c.id}</span>
                <span className="text-fg-3">{c.members.length}</span>
                <span className="tabular ml-auto text-fg-4">ρ {c.rho.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </Panel>
        {view.source.kind === "sim" && (
          <Panel title="Ground truth">
            <label className="flex items-center gap-2 text-[13px] text-fg-2">
              <input type="checkbox" checked={truth} onChange={(e) => setTruth(e.target.checked)} /> Color by true label
            </label>
            {truth && (
              <div className="mt-3 space-y-1 text-[12px] text-fg-3">
                <div><span className="text-danger">●</span> bot farm</div>
                <div><span className="text-warning">●</span> paid buzzer</div>
                <div><span style={{ color: "#c58af0" }}>●</span> LLM swarm</div>
                <div><span className="text-success">●</span> organic</div>
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
