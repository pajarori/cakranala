import { useEffect, useMemo, useState } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSetSettings, useSigma } from "@react-sigma/core";
import type { State } from "@/lib/api";
import { graphColor } from "@/lib/format";

const ORGANIC = "#71717a";
const FADED = "#27272a";
const EDGE = "#3f3f46";

const jitter = (id: string, salt: number) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) / 4294967296) * 2 - 1;
};

type Props = {
  view: State;
  layers: string[];
  focus?: string[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  height?: number | string;
};

function build(view: State, focus?: string[]) {
  const report = view.report!;
  const membership = new Map(report.clusters.flatMap((c) => c.members.map((m) => [m, c.id] as const)));
  const members = focus ? new Set(report.clusters.filter((c) => focus.includes(c.id)).flatMap((c) => c.members)) : null;
  const handles = new Map(view.actors.map((a) => [a.id, a.handle ?? a.id]));
  const g = new Graph({ type: "undirected" });
  const edges = report.edges.filter((e) => !members || (members.has(e.a) && members.has(e.b)));
  const ids = [...new Set(edges.flatMap((e) => [e.a, e.b]))];
  const clusterIds = [...new Set(ids.map((id) => membership.get(id) ?? "organic"))];
  ids.forEach((id, i) => {
    const c = membership.get(id);
    const k = clusterIds.indexOf(c ?? "organic");
    const angle = (2 * Math.PI * k) / Math.max(1, clusterIds.length) + i * 0.01;
    g.addNode(id, { x: Math.cos(angle) * 10 + jitter(id, 1), y: Math.sin(angle) * 10 + jitter(id, 2), size: 3, label: handles.get(id) ?? id, color: c ? graphColor(c) : ORGANIC, cluster: c ?? null });
  });
  for (const e of edges) g.addEdge(e.a, e.b, { size: 0.4 + e.rho * 1.6, layers: Object.keys(e.layers), color: EDGE });
  g.forEachNode((n) => g.setNodeAttribute(n, "size", 2.5 + Math.sqrt(g.degree(n)) * 1.4));
  if (g.order > 1) forceAtlas2.assign(g, { iterations: 400, settings: { ...forceAtlas2.inferSettings(g), linLogMode: true, gravity: 1.5 } });
  return g;
}

function Behaviour({ graph, layers, selected, onSelect }: { graph: Graph; layers: string[]; selected?: string | null; onSelect?: (id: string | null) => void }) {
  const load = useLoadGraph();
  const register = useRegisterEvents();
  const setSettings = useSetSettings();
  const sigma = useSigma();
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => load(graph), [load, graph]);

  useEffect(() => {
    register({
      enterNode: (e) => setHovered(e.node),
      leaveNode: () => setHovered(null),
      clickNode: (e) => onSelect?.(e.node),
      clickStage: () => onSelect?.(null),
    });
  }, [register, onSelect]);

  useEffect(() => {
    const anchor = hovered ?? selected ?? null;
    const neighbors = anchor && graph.hasNode(anchor) ? new Set([anchor, ...graph.neighbors(anchor)]) : null;
    const minLayers = Math.min(2, layers.length);
    setSettings({
      nodeReducer: (node, data) => {
        if (neighbors && !neighbors.has(node)) return { ...data, color: FADED, label: "", zIndex: 0 };
        return { ...data, zIndex: 1, highlighted: node === selected };
      },
      edgeReducer: (edge, data) => {
        const own: string[] = graph.getEdgeAttribute(edge, "layers");
        if (own.filter((l) => layers.includes(l)).length < minLayers) return { ...data, hidden: true };
        if (neighbors && !graph.extremities(edge).every((n) => neighbors.has(n))) return { ...data, hidden: true };
        return neighbors ? { ...data, color: "#a1a1aa" } : data;
      },
    });
    sigma.refresh();
  }, [hovered, selected, layers, graph, setSettings, sigma]);

  return null;
}

export function NetworkGraph({ view, layers, focus, selected, onSelect, height = 560 }: Props) {
  const key = focus?.join(",");
  const graph = useMemo(() => build(view, focus), [view.report, key]);
  if (!graph.order) return <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>No ties</div>;
  return (
    <SigmaContainer
      style={{ height, width: "100%", background: "transparent" }}
      settings={{
        labelColor: { color: "#e4e4e7" },
        labelFont: "Geist",
        labelSize: 13,
        labelRenderedSizeThreshold: 9,
        defaultEdgeColor: EDGE,
        hideEdgesOnMove: true,
        zIndex: true,
      }}
    >
      <Behaviour graph={graph} layers={layers} selected={selected} onSelect={onSelect} />
    </SigmaContainer>
  );
}
