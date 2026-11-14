import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { State } from "@/lib/api";
import { graphColor } from "@/lib/format";

const ORGANIC = "#71717a";
const CLUSTER = "#14b8a6";

type Props = {
  view: State;
  layers: string[];
  focus?: string[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  height?: number | string;
};

type Point = { x: number; y: number };

function layoutPositions(ids: string[], membership: Map<string, string | null>) {
  const groups = new Map<string, string[]>();
  ids.forEach((id) => {
    const group = membership.get(id) ?? "organic";
    groups.set(group, [...(groups.get(group) ?? []), id]);
  });
  const entries = [...groups.entries()];
  const points = new Map<string, Point>();
  const ring = Math.max(1, entries.length);
  entries.forEach(([group, members], groupIndex) => {
    const angle = (Math.PI * 2 * groupIndex) / ring - Math.PI / 2;
    const center = entries.length === 1 ? { x: 0, y: 0 } : { x: Math.cos(angle) * 260, y: Math.sin(angle) * 210 };
    const radius = Math.max(72, Math.min(155, members.length * 18));
    members.forEach((id, index) => {
      const nodeAngle = (Math.PI * 2 * index) / Math.max(1, members.length) - Math.PI / 2;
      points.set(id, { x: center.x + Math.cos(nodeAngle) * radius, y: center.y + Math.sin(nodeAngle) * radius });
    });
  });
  return points;
}

function buildElements(view: State, focus?: string[]) {
  const report = view.report!;
  const membership = new Map(report.clusters.flatMap((cluster) => cluster.members.map((member) => [member, cluster.id] as const)));
  const members = focus ? new Set(report.clusters.filter((cluster) => focus.includes(cluster.id)).flatMap((cluster) => cluster.members)) : null;
  const handles = new Map(view.actors.map((actor) => [actor.id, actor.handle ?? actor.id]));
  const edges = report.edges.filter((edge) => !members || (members.has(edge.a) && members.has(edge.b)));
  const ids = [...new Set(edges.flatMap((edge) => [edge.a, edge.b]))];
  const positions = layoutPositions(ids, new Map(ids.map((id) => [id, membership.get(id) ?? null])));
  const nodes: ElementDefinition[] = ids.map((id) => ({
    data: {
      id,
      label: handles.get(id) ?? id,
      cluster: membership.get(id) ?? null,
      color: membership.has(id) ? graphColor(membership.get(id)!) : ORGANIC,
      size: 9,
    },
    position: positions.get(id) ?? { x: 0, y: 0 },
  }));
  const graphEdges: ElementDefinition[] = edges.map((edge, index) => ({
    data: { id: `edge-${index}-${edge.a}-${edge.b}`, source: edge.a, target: edge.b, layers: Object.keys(edge.layers), rho: edge.rho },
  }));
  return [...nodes, ...graphEdges];
}

function applyFocus(cy: Core, id: string | null) {
  cy.elements().removeClass("node-hover node-neighbor edge-active faded");
  if (!id || !cy.getElementById(id).nonempty()) return;
  const node = cy.getElementById(id);
  cy.elements().addClass("faded");
  node.removeClass("faded").addClass("node-hover");
  node.neighborhood().removeClass("faded").addClass("node-neighbor");
  node.connectedEdges().removeClass("faded").addClass("edge-active");
}

function CameraControls({ cyRef }: { cyRef: MutableRefObject<Core | null> }) {
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm">
      <Button variant="ghost" size="icon" className="size-8" aria-label="Perbesar peta" title="Perbesar" onClick={() => { const cy = cyRef.current; if (cy) cy.zoom({ level: Math.min(cy.maxZoom(), cy.zoom() * 1.25), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }); }}><Plus /></Button>
      <Button variant="ghost" size="icon" className="size-8" aria-label="Perkecil peta" title="Perkecil" onClick={() => { const cy = cyRef.current; if (cy) cy.zoom({ level: Math.max(cy.minZoom(), cy.zoom() / 1.25), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }); }}><Minus /></Button>
      <Button variant="ghost" size="icon" className="size-8" aria-label="Reset peta" title="Reset" onClick={() => cyRef.current?.fit(undefined, 48)}><RotateCcw /></Button>
    </div>
  );
}

export function NetworkGraph({ view, layers, focus, selected, onSelect, height = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const elements = useMemo(() => buildElements(view, focus), [view.report?.generatedAt, view.report?.edges.length, focus?.join(",")]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cy = cytoscape({
      container,
      elements,
      minZoom: 0.25,
      maxZoom: 3,
      wheelSensitivity: 0.18,
      layout: { name: "preset", fit: true, padding: 48 },
      style: [
        { selector: "node", style: { "background-color": "data(color)", width: "data(size)", height: "data(size)", label: "data(label)", color: "#f5f5f4", "font-family": "Geist, sans-serif", "font-size": "12px", "font-weight": "normal", "text-wrap": "ellipsis", "text-max-width": "120px", "text-valign": "bottom", "text-halign": "center", "text-margin-y": 9, "text-outline-color": "#171717", "text-outline-width": "2px", "overlay-opacity": 0, "z-index": 2 } },
        { selector: "edge", style: { width: "mapData(rho, 0, 1, 0.7, 2.6)", "line-color": "#77766f", opacity: 0.32, "curve-style": "bezier", "line-cap": "round", "z-index": 1 } },
        { selector: ".faded", style: { opacity: 0.12 } },
        { selector: ".node-neighbor", style: { opacity: 1, "font-weight": "bold" } },
        { selector: ".node-hover", style: { "background-color": "#f97316", "border-color": "#fff7ed", "border-width": "3px", width: "18px", height: "18px", color: "#fff7ed", "font-size": "14px", "font-weight": "bold", "text-outline-color": "#171717", "text-outline-width": "3px", "z-index": 10 } },
        { selector: ".edge-active", style: { opacity: 0.95, "line-color": "#f97316", width: "mapData(rho, 0, 1, 1.5, 4)" } },
        { selector: ".layer-hidden", style: { display: "none" } },
      ],
    });
    cyRef.current = cy;
    cy.on("tap", "node", (event) => onSelectRef.current?.(event.target.id()));
    cy.on("tap", (event) => { if (event.target === cy) onSelectRef.current?.(null); });
    cy.on("mouseover", "node", (event) => applyFocus(cy, event.target.id()));
    cy.on("mouseout", "node", () => applyFocus(cy, selected ?? null));
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (cy) applyFocus(cy, selected ?? null);
  }, [selected]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.edges().forEach((edge) => {
      const edgeLayers = edge.data("layers") as string[];
      edge.toggleClass("layer-hidden", !!layers.length && !edgeLayers.some((layer) => layers.includes(layer)));
    });
  }, [layers, elements]);

  if (!elements.some((element) => "source" in element.data)) return <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>Tidak ada keterkaitan antar akun</div>;
  return <div className="relative w-full" style={{ height }}><div ref={containerRef} className="h-full w-full bg-[#171717]" /><CameraControls cyRef={cyRef} /></div>;
}
