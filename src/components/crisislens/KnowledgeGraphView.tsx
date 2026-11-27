"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type {
  GraphNode,
  GraphEdge,
  KnowledgeGraph as KG,
} from "@/lib/crisislens/pipeline/types";

interface Props {
  graph: KG;
}

type NodeTypeFilter = "All" | "Event" | "AdminUnit" | "NeedUnit" | "NeedType";

export function KnowledgeGraphView({ graph }: Props) {
  const [nodeFilter, setNodeFilter] = useState<NodeTypeFilter>("All");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  // Layout: simple radial force-directed — Event at center, AdminUnits around,
  // NeedTypes further out, NeedUnits clustered near their AdminUnit.
  const { nodes: positioned, edges: visibleEdges } = useMemo(() => {
    const W = 800;
    const H = 600;
    const cx = W / 2;
    const cy = H / 2;
    const pos = new Map<string, { x: number; y: number; r: number }>();

    // Event at center
    const eventNode = graph.nodes.find((n) => n.type === "Event");
    if (eventNode) pos.set(eventNode.id, { x: cx, y: cy, r: 18 });

    // AdminUnits on a ring around Event
    const adminUnits = graph.nodes.filter((n) => n.type === "AdminUnit");
    adminUnits.forEach((u, i) => {
      const angle = (i / Math.max(1, adminUnits.length)) * Math.PI * 2 - Math.PI / 2;
      const radius = 150;
      pos.set(u.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r: 12,
      });
    });

    // NeedTypes on outer ring
    const needTypes = graph.nodes.filter((n) => n.type === "NeedType");
    needTypes.forEach((n, i) => {
      const angle = (i / Math.max(1, needTypes.length)) * Math.PI * 2;
      const radius = 280;
      pos.set(n.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r: 8,
      });
    });

    // NeedUnits clustered around their AdminUnit
    const needUnits = graph.nodes.filter((n) => n.type === "NeedUnit");
    const nusByUnit = new Map<string, GraphNode[]>();
    needUnits.forEach((nu) => {
      const edge = graph.edges.find((e) => e.source === nu.id && e.type === "reported_in");
      const unitId = edge?.target;
      if (!unitId) return;
      const arr = nusByUnit.get(unitId) ?? [];
      arr.push(nu);
      nusByUnit.set(unitId, arr);
    });
    nusByUnit.forEach((nus, unitId) => {
      const unitPos = pos.get(unitId);
      if (!unitPos) return;
      nus.forEach((nu, i) => {
        const angle = (i / Math.max(1, nus.length)) * Math.PI * 2;
        const radius = 40 + Math.min(60, nus.length * 4);
        pos.set(nu.id, {
          x: unitPos.x + Math.cos(angle) * radius,
          y: unitPos.y + Math.sin(angle) * radius,
          r: 6,
        });
      });
    });

    // Apply filter
    const visibleNodes = graph.nodes.filter((n) => {
      if (nodeFilter === "All") return true;
      if (nodeFilter === "AdminUnit" && n.type === "NeedUnit") {
        // Keep NeedUnits when AdminUnit filter is on — they're attached
        return true;
      }
      return n.type === nodeFilter;
    });
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = graph.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    );

    const nodesWithPos = visibleNodes.map((n) => ({ ...n, ...pos.get(n.id)! })).filter((n) => n.x !== undefined);
    return { nodes: nodesWithPos, edges: visibleEdges };
  }, [graph, nodeFilter]);

  const focusNode = focusId ? positioned.find((n) => n.id === focusId) : null;
  const focusNeighbors = useMemo(() => {
    if (!focusId) return new Set<string>();
    const set = new Set<string>([focusId]);
    for (const e of visibleEdges) {
      if (e.source === focusId) set.add(e.target);
      if (e.target === focusId) set.add(e.source);
    }
    return set;
  }, [focusId, visibleEdges]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium mr-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          Node filter
        </div>
        {(["All", "AdminUnit", "NeedType", "NeedUnit"] as NodeTypeFilter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={nodeFilter === f ? "default" : "outline"}
            onClick={() => setNodeFilter(f)}
            className="h-7"
          >
            {f}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-mono w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(2, z + 0.2))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setZoom(1); setFocusId(null); }}>
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative rounded-lg border bg-gradient-to-br from-background to-muted/30 overflow-hidden" style={{ height: 600 }}>
        <svg
          ref={svgRef}
          viewBox="0 0 800 600"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        >
          {/* Edges */}
          {visibleEdges.map((e, i) => {
            const s = positioned.find((n) => n.id === e.source);
            const t = positioned.find((n) => n.id === e.target);
            if (!s || !t) return null;
            const dim = focusId && !(focusNeighbors.has(e.source) && focusNeighbors.has(e.target));
            const stroke =
              e.type === "reported_in"
                ? "#0f2c4e"
                : e.type === "has_type"
                  ? "#0097a7"
                  : e.type === "co_occurs_with"
                    ? "#ffc107"
                    : "#94a3b8";
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={stroke}
                strokeOpacity={dim ? 0.05 : 0.35 * e.weight}
                strokeWidth={e.type === "co_occurs_with" ? 1 : 1.5}
                strokeDasharray={e.type === "co_occurs_with" ? "4 2" : undefined}
              />
            );
          })}
          {/* Nodes */}
          {positioned.map((n) => {
            const dim = focusId && !focusNeighbors.has(n.id);
            const isFocus = n.id === focusId;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                opacity={dim ? 0.2 : 1}
                className="cursor-pointer"
                onClick={() => setFocusId(isFocus ? null : n.id)}
              >
                <circle
                  r={n.r}
                  fill={n.color ?? "#94a3b8"}
                  stroke={isFocus ? "#000" : "#fff"}
                  strokeWidth={isFocus ? 3 : 1.5}
                />
                {n.type === "AdminUnit" && (
                  <text
                    x={0}
                    y={n.r + 12}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill="#1e293b"
                    className="select-none pointer-events-none"
                  >
                    {n.label}
                  </text>
                )}
                {n.type === "Event" && (
                  <text
                    x={0}
                    y={n.r + 14}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill="#0f2c4e"
                    className="select-none pointer-events-none"
                  >
                    {n.label}
                  </text>
                )}
                {n.type === "NeedType" && (
                  <text
                    x={0}
                    y={n.r + 11}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={500}
                    fill="#475569"
                    className="select-none pointer-events-none"
                  >
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute top-3 left-3 bg-background/95 backdrop-blur border rounded-md p-2.5 text-xs space-y-1">
          <div className="font-semibold mb-1">Edge types</div>
          <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-[#0f2c4e]" /> reported_in</div>
          <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-[#0097a7]" /> has_type</div>
          <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-[#ffc107]" /> co_occurs_with</div>
          <div className="text-muted-foreground mt-2 text-[10px]">
            {positioned.length} nodes · {visibleEdges.length} edges
          </div>
        </div>

        {/* Focus info */}
        {focusNode && (
          <div className="absolute top-3 right-3 bg-background/95 backdrop-blur border rounded-md p-3 text-xs space-y-1 max-w-[220px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: focusNode.color }} />
              <span className="font-semibold">{focusNode.label}</span>
            </div>
            <Badge variant="secondary" className="text-[10px]">{focusNode.type}</Badge>
            {focusNode.sub_label && (
              <div className="text-muted-foreground text-[11px]">{focusNode.sub_label}</div>
            )}
            <div className="text-muted-foreground text-[10px]">
              {focusNeighbors.size - 1} neighbor{focusNeighbors.size - 1 !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
