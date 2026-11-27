"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers,
  MapPin,
  AlertTriangle,
  Activity,
  TrendingUp,
  Crosshair,
  Info,
} from "lucide-react";
import type {
  AdminUnit,
  ExpectedNeedRow,
  ObservedSignalRow,
  NeedUnit,
  SilentZoneFlag,
} from "@/lib/crisislens/pipeline/types";
import { NEED_TYPE_COLORS, NEED_TYPE_SHORT } from "@/lib/crisislens/pipeline/types";

type Layer = "expected" | "observed" | "silent" | "need_units";

interface Props {
  units: AdminUnit[];
  expected: ExpectedNeedRow[];
  observed: ObservedSignalRow[];
  needUnits: NeedUnit[];
  silentZones: SilentZoneFlag[];
  // Epicentre in SVG viewBox coordinates; defaults to the legacy Nepal position
  epicenter?: [number, number];
  // Neighbouring districts, drawn faintly for geographic context
  contextPaths?: string[];
  mapSource?: string;
  // SVG viewBox framing the region; defaults to the full 600x600 canvas
  viewBox?: string;
  onUnitClick: (unitId: string) => void;
}

export function CrisisMap({
  units,
  expected,
  observed,
  needUnits,
  silentZones,
  epicenter = [310, 265],
  contextPaths = [],
  mapSource,
  viewBox = "0 0 600 600",
  onUnitClick,
}: Props) {
  const [activeLayer, setActiveLayer] = useState<Layer>("silent");
  const [hovered, setHovered] = useState<string | null>(null);

  const expectedByUnit = useMemo(
    () => new Map(expected.map((r) => [r.admin_unit_id, r])),
    [expected],
  );
  const observedByUnit = useMemo(
    () => new Map(observed.map((r) => [r.admin_unit_id, r])),
    [observed],
  );
  const silentByUnit = useMemo(
    () => new Map(silentZones.map((s) => [s.admin_unit_id, s])),
    [silentZones],
  );

  const maxExpected = Math.max(...expected.map((r) => r.expected_need), 1);
  const maxObserved = Math.max(...observed.map((r) => r.observed_reporters), 1);

  // Aggregate need unit points by admin unit (count + dominant type)
  const nuByUnit = useMemo(() => {
    const m = new Map<string, NeedUnit[]>();
    for (const nu of needUnits) {
      const arr = m.get(nu.admin_unit_id) ?? [];
      arr.push(nu);
      m.set(nu.admin_unit_id, arr);
    }
    return m;
  }, [needUnits]);

  const layers: { id: Layer; label: string; icon: any; color: string }[] = [
    { id: "silent", label: "Silent Zones", icon: AlertTriangle, color: "#d32f2f" },
    { id: "expected", label: "Expected Need", icon: TrendingUp, color: "#0f2c4e" },
    { id: "observed", label: "Observed Signal", icon: Activity, color: "#0097a7" },
    { id: "need_units", label: "Need Units", icon: MapPin, color: "#ffc107" },
  ];

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Layer toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
          <Layers className="w-3.5 h-3.5" />
          <span>Layers</span>
        </div>
        {layers.map((l) => {
          const Icon = l.icon;
          const active = activeLayer === l.id;
          return (
            <button
              key={l.id}
              onClick={() => setActiveLayer(l.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {l.label}
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-[420px] rounded-lg border bg-gradient-to-b from-sky-50/30 to-background overflow-hidden">
        {/* Legend strip */}
        <div className="absolute top-3 left-3 z-10 bg-background/95 backdrop-blur-sm border rounded-md p-2.5 text-xs space-y-1.5 shadow-sm">
          <div className="font-semibold text-foreground">
            {layers.find((l) => l.id === activeLayer)?.label}
          </div>
          {activeLayer === "silent" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#7a0000]" />
                <span>Both detectors · 90+</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#c62828]" />
                <span>Score 60-89</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#ef9a9a]" />
                <span>Score 30-59</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#ffcdd2]" />
                <span>Score &lt; 30</span>
              </div>
            </div>
          )}
          {activeLayer === "expected" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#0f2c4e]" />
                <span>Very high exposure</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#3e5c7e]" />
                <span>High</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#9eb3c8]" />
                <span>Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#eef2f6]" />
                <span>Low</span>
              </div>
            </div>
          )}
          {activeLayer === "observed" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#006064]" />
                <span>High reporter volume</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#4fb3bf]" />
                <span>Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#b2ebf2]" />
                <span>Low</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#f5f5f5]" />
                <span>Silent (close to 0)</span>
              </div>
            </div>
          )}
          {activeLayer === "need_units" && (
            <div className="space-y-1">
              {[...new Set(needUnits.map((nu) => nu.need_types[0]))].slice(0, 6).map((nt) => (
                <div key={nt} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: NEED_TYPE_COLORS[nt] }}
                  />
                  <span>{NEED_TYPE_SHORT[nt]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coverage caveat */}
        <div className="absolute bottom-3 right-3 z-10 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 text-xs text-amber-900 flex items-center gap-1.5 max-w-[260px]">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {(observed[0]?.unlocated_post_share ?? 0) >= 0.01
              ? `Coverage caveat: ${Math.round((observed[0]?.unlocated_post_share ?? 0) * 100)}% of regional posts could not be located. Treat this map as advisory.`
              : "Advisory map. Flags are candidates to verify, not confirmed damage."}
            {mapSource ? ` ${mapSource}.` : ""}
          </span>
        </div>

        <svg
          viewBox={viewBox}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="epicenter-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d32f2f" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#d32f2f" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="-300" y="-300" width="1200" height="1200" fill="url(#grid)" />

          {/* Neighbouring districts, for context only */}
          {contextPaths.map((d, i) => (
            <path key={`ctx-${i}`} d={d} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={0.6} className="pointer-events-none" />
          ))}

          {/* Districts */}
          {units.map((u) => {
            const exp = expectedByUnit.get(u.id);
            const obs = observedByUnit.get(u.id);
            const sz = silentByUnit.get(u.id);
            let fill = "#f5f5f5";
            let stroke = "#cbd5e1";
            let strokeWidth = 1;
            if (activeLayer === "expected" && exp) {
              const ratio = exp.expected_need / maxExpected;
              fill = navyChoropleth(ratio);
              stroke = "#475569";
            } else if (activeLayer === "observed" && obs) {
              const ratio = obs.observed_reporters / maxObserved;
              fill = tealChoropleth(ratio);
              stroke = "#475569";
            } else if (activeLayer === "silent") {
              if (sz) {
                fill = redChoropleth(sz.score / 100);
                stroke = "#7a0000";
                strokeWidth = sz.both_detectors ? 2.5 : 1.5;
              } else {
                fill = "#f1f5f9";
                stroke = "#cbd5e1";
              }
            } else if (activeLayer === "need_units") {
              const nus = nuByUnit.get(u.id) ?? [];
              fill = nus.length > 0 ? "#fef9c3" : "#fafafa";
              stroke = nus.length > 0 ? "#ca8a04" : "#e2e8f0";
            }
            const isHovered = hovered === u.id;
            return (
              <path
                key={u.id}
                d={u.svg_path}
                fill={fill}
                stroke={stroke}
                strokeWidth={isHovered ? strokeWidth + 1 : strokeWidth}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHovered(u.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onUnitClick(u.id)}
              />
            );
          })}

          {/* District labels */}
          {units.map((u) => {
            const centroid = labelPoint(u);
            const sz = silentByUnit.get(u.id);
            return (
              <text
                key={`l-${u.id}`}
                x={centroid.x}
                y={centroid.y}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fontSize={sz ? 11 : 9}
                fontWeight={sz ? 700 : 500}
                fill={sz ? "#7a0000" : "#1e293b"}
              >
                {u.name}
              </text>
            );
          })}

          {/* Epicenter marker */}
          <g>
            <circle cx={epicenter[0]} cy={epicenter[1]} r={30} fill="url(#epicenter-glow)" />
            <circle
              cx={epicenter[0]}
              cy={epicenter[1]}
              r={6}
              fill="#d32f2f"
              className="crisislens-pulse"
            />
            <text
              x={epicenter[0] + 15}
              y={epicenter[1] - 3}
              fontSize={9}
              fontWeight={600}
              fill="#d32f2f"
              className="pointer-events-none select-none"
            >
              ★ Epicenter
            </text>
          </g>

          {/* Need Unit points (when layer is active) */}
          {activeLayer === "need_units" &&
            needUnits.slice(0, 60).map((nu) => {
              const unit = units.find((u) => u.id === nu.admin_unit_id);
              if (!unit) return null;
              const c = labelPoint(unit);
              // jitter so overlapping points don't stack
              const jx = (hashString(nu.need_unit_id) % 30) - 15;
              const jy = ((hashString(nu.need_unit_id) >> 4) % 30) - 15;
              const r = 3 + Math.min(8, Math.sqrt(nu.n_unique_authors) * 1.5);
              return (
                <circle
                  key={nu.need_unit_id}
                  cx={c.x + jx}
                  cy={c.y + jy}
                  r={r}
                  fill={NEED_TYPE_COLORS[nu.need_types[0]]}
                  fillOpacity={0.7}
                  stroke="#ffffff"
                  strokeWidth={1}
                  className="cursor-pointer"
                  onClick={() => onUnitClick(nu.admin_unit_id)}
                >
                  <title>
                    {NEED_TYPE_SHORT[nu.need_types[0]]} · {nu.n_unique_authors} author
                    {nu.n_unique_authors !== 1 ? "s" : ""}
                  </title>
                </circle>
              );
            })}

          {/* Silent zone badge */}
          {activeLayer === "silent" &&
            silentZones.map((sz) => {
              const unit = units.find((u) => u.id === sz.admin_unit_id);
              if (!unit) return null;
              const c = labelPoint(unit);
              return (
                <g key={`sz-${sz.admin_unit_id}`} className="pointer-events-none">
                  <circle
                    cx={c.x}
                    cy={c.y - 18}
                    r={8}
                    fill="#d32f2f"
                    className="crisislens-pulse"
                  />
                  <text
                    x={c.x}
                    y={c.y - 15}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="#fff"
                  >
                    {sz.score}
                  </text>
                </g>
              );
            })}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <Tooltip
            unit={units.find((u) => u.id === hovered)!}
            exp={expectedByUnit.get(hovered)}
            obs={observedByUnit.get(hovered)}
            sz={silentByUnit.get(hovered)}
            nuCount={nuByUnit.get(hovered)?.length ?? 0}
          />
        )}
      </div>
    </div>
  );
}

function Tooltip({
  unit,
  exp,
  obs,
  sz,
  nuCount,
}: {
  unit: AdminUnit;
  exp?: ExpectedNeedRow;
  obs?: ObservedSignalRow;
  sz?: SilentZoneFlag;
  nuCount: number;
}) {
  return (
    <div className="absolute top-3 right-3 z-20 bg-background/95 backdrop-blur border rounded-md shadow-lg p-3 text-xs space-y-1 max-w-[280px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-foreground">{unit.name}</span>
        {sz && (
          <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
            Silent Zone
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground text-[11px]">
        Pop {unit.population.toLocaleString()} · MMI {unit.mmi.toFixed(1)}
      </div>
      {exp && (
        <div className="pt-1 border-t">
          <div className="text-foreground">Expected need: {exp.expected_need.toLocaleString()}</div>
          <div className="text-muted-foreground text-[11px]">
            damage ratio {(exp.damage_ratio * 100).toFixed(0)}% · vulnerability ×{exp.vulnerability.toFixed(2)}
          </div>
        </div>
      )}
      {obs && (
        <div className="pt-1 border-t">
          <div className="text-foreground">
            Observed: {obs.observed_reporters} reporters · {obs.observed_posts} posts
          </div>
          <div className="text-muted-foreground text-[11px]">
            baseline {obs.baseline_authors_per_day}/day ({obs.baseline_source})
          </div>
        </div>
      )}
      {sz && (
        <div className="pt-1 border-t">
          <div className="text-destructive font-semibold">
            Score {sz.score} · CI [{sz.ci_low}, {sz.ci_high}]
          </div>
          <div className="text-muted-foreground text-[11px]">
            Detector A: {sz.detector_a_triggered ? "✓" : "✗"} · Detector B:{" "}
            {sz.detector_b_triggered ? "✓" : "✗"}
          </div>
        </div>
      )}
      <div className="pt-1 border-t text-muted-foreground text-[11px]">
        {nuCount} Need Unit{nuCount !== 1 ? "s" : ""} · click to view evidence
      </div>
    </div>
  );
}

// ─── Color helpers ──────────────────────────────────────────────────────────
function navyChoropleth(ratio: number): string {
  // 0 → very light, 1 → deep navy
  const stops = ["#eef2f6", "#9eb3c8", "#3e5c7e", "#0f2c4e"];
  return interpolateStops(stops, ratio);
}
function tealChoropleth(ratio: number): string {
  const stops = ["#f5f5f5", "#b2ebf2", "#4fb3bf", "#006064"];
  return interpolateStops(stops, ratio);
}
function redChoropleth(ratio: number): string {
  const stops = ["#ffcdd2", "#ef9a9a", "#c62828", "#7a0000"];
  return interpolateStops(stops, ratio);
}
function interpolateStops(stops: string[], ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  const idx = Math.min(stops.length - 2, Math.floor(r * (stops.length - 1)));
  const t = r * (stops.length - 1) - idx;
  return blendHex(stops[idx], stops[idx + 1], t);
}
function blendHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// Where to put a district's label and markers: the anchor supplied with real
// borders if there is one, otherwise the average of the path's points.
function labelPoint(u: { svg_path: string; label_xy?: [number, number] | null }): { x: number; y: number } {
  return u.label_xy ? { x: u.label_xy[0], y: u.label_xy[1] } : svgCentroid(u.svg_path);
}

function svgCentroid(path: string): { x: number; y: number } {
  const tokens = path.replace(/M|L|Z|,/gi, " ").trim().split(/\s+/);
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    sx += parseFloat(tokens[i]);
    sy += parseFloat(tokens[i + 1]);
    n++;
  }
  return { x: sx / Math.max(1, n), y: sy / Math.max(1, n) };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
