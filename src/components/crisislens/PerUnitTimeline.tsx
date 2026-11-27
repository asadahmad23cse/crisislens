"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingDown, AlertCircle } from "lucide-react";
import type { TimelinePoint, SilentZoneFlag } from "@/lib/crisislens/pipeline/types";

interface Props {
  timeline: TimelinePoint[];
  silentZone?: SilentZoneFlag | null;
  impactUtc: string;
  unitName: string;
}

export function PerUnitTimeline({ timeline, silentZone, impactUtc, unitName }: Props) {
  if (!timeline || timeline.length === 0) {
    return (
      <Card className="p-3 text-xs text-muted-foreground">
        No timeline data available for {unitName}.
      </Card>
    );
  }

  const impactMs = Date.parse(impactUtc);
  const startMs = Date.parse(timeline[0].t);
  const endMs = Date.parse(timeline[timeline.length - 1].t);
  const range = endMs - startMs;
  const maxAuthors = Math.max(...timeline.map((t) => t.unique_authors), 1);

  // Compute pre-event mean for drop-off visualization
  const preEvent = timeline.filter((t) => t.pre_event);
  const postEvent = timeline.filter((t) => !t.pre_event);
  const preMean = preEvent.length > 0
    ? preEvent.reduce((s, t) => s + t.unique_authors, 0) / preEvent.length
    : 0;
  const postMean = postEvent.length > 0
    ? postEvent.reduce((s, t) => s + t.unique_authors, 0) / postEvent.length
    : 0;
  const dropoffPct = preMean > 0 ? Math.max(0, 1 - postMean / preMean) : 0;

  // Chart dimensions
  const W = 580;
  const H = 180;
  const PAD_L = 30;
  const PAD_R = 20;
  const PAD_T = 20;
  const PAD_B = 30;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Convert each bucket to (x, y)
  const points = timeline.map((t, i) => {
    const x = PAD_L + (i / Math.max(1, timeline.length - 1)) * chartW;
    const y = PAD_T + chartH - (t.unique_authors / maxAuthors) * chartH;
    return { x, y, t };
  });

  // Path d
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  // Area path (for filling under the line)
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_T + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD_T + chartH).toFixed(1)} Z`;

  // Impact line X position
  const impactX = PAD_L + ((impactMs - startMs) / range) * chartW;

  // Change point X
  const changePoint = silentZone?.change_point_utc
    ? Date.parse(silentZone.change_point_utc)
    : null;
  const cpX = changePoint
    ? PAD_L + ((changePoint - startMs) / range) * chartW
    : null;

  // Pre-event mean line Y
  const preMeanY = PAD_T + chartH - (preMean / maxAuthors) * chartH;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-semibold flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-accent" />
          Per-unit activity timeline — {unitName}
        </div>
        {silentZone && (
          <Badge variant="destructive" className="text-[10px]">
            Silent Zone · score {silentZone.score}
          </Badge>
        )}
      </div>

      <div className="relative w-full bg-muted/20 rounded border" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {/* Pre-event / post-event shading */}
          <rect x={PAD_L} y={PAD_T} width={impactX - PAD_L} height={chartH} fill="#e0f2fe" fillOpacity={0.5} />
          <rect x={impactX} y={PAD_T} width={PAD_L + chartW - impactX} height={chartH} fill="#fef2f2" fillOpacity={0.5} />

          {/* Pre-event mean line */}
          {preMean > 0 && (
            <line
              x1={PAD_L}
              y1={preMeanY}
              x2={impactX}
              y2={preMeanY}
              stroke="#0f2c4e"
              strokeWidth={1}
              strokeDasharray="3 2"
              opacity={0.6}
            />
          )}

          {/* Area fill */}
          <path d={areaD} fill="#0097a7" fillOpacity={0.15} />

          {/* Line */}
          <path d={pathD} fill="none" stroke="#0097a7" strokeWidth={1.5} />

          {/* Impact line */}
          <line
            x1={impactX}
            y1={PAD_T}
            x2={impactX}
            y2={PAD_T + chartH}
            stroke="#d32f2f"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <text x={impactX + 4} y={PAD_T + 10} fontSize="8" fill="#d32f2f" fontWeight="600">
            IMPACT
          </text>

          {/* Change point marker */}
          {cpX && (
            <g>
              <line
                x1={cpX}
                y1={PAD_T}
                x2={cpX}
                y2={PAD_T + chartH}
                stroke="#fb8c00"
                strokeWidth={1.5}
              />
              <circle cx={cpX} cy={PAD_T + 5} r={3} fill="#fb8c00" />
              <text x={cpX + 4} y={PAD_T + 14} fontSize="8" fill="#fb8c00" fontWeight="600">
                CHANGE POINT
              </text>
            </g>
          )}

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.t.unique_authors > 0 ? 2 : 0}
              fill={p.t.pre_event ? "#0f2c4e" : "#d32f2f"}
              opacity={0.6}
            />
          ))}

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T + chartH} x2={PAD_L + chartW} y2={PAD_T + chartH} stroke="#475569" strokeWidth={0.5} />
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + chartH} stroke="#475569" strokeWidth={0.5} />

          {/* Y-axis labels */}
          {[0, 0.5, 1].map((frac) => (
            <text
              key={frac}
              x={PAD_L - 5}
              y={PAD_T + chartH - frac * chartH + 3}
              textAnchor="end"
              fontSize="8"
              fill="#64748b"
            >
              {Math.round(frac * maxAuthors)}
            </text>
          ))}

          {/* X-axis labels (start, impact, end) */}
          <text x={PAD_L} y={PAD_T + chartH + 14} textAnchor="start" fontSize="8" fill="#64748b">
            {new Date(startMs).toISOString().slice(5, 10)}
          </text>
          <text x={impactX} y={PAD_T + chartH + 14} textAnchor="middle" fontSize="8" fill="#d32f2f" fontWeight="600">
            {new Date(impactMs).toISOString().slice(5, 10)}
          </text>
          <text x={PAD_L + chartW} y={PAD_T + chartH + 14} textAnchor="end" fontSize="8" fill="#64748b">
            {new Date(endMs).toISOString().slice(5, 10)}
          </text>
        </svg>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-background/70 rounded p-2 border">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Pre-event mean</div>
          <div className="font-semibold tabular-nums">{preMean.toFixed(1)} authors/6h</div>
        </div>
        <div className="bg-background/70 rounded p-2 border">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Post-event mean</div>
          <div className="font-semibold tabular-nums">
            {postMean.toFixed(1)} authors/6h
            {dropoffPct > 0 && (
              <span className="ml-1 text-destructive">↓{(dropoffPct * 100).toFixed(0)}%</span>
            )}
          </div>
        </div>
        <div className="bg-background/70 rounded p-2 border">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Detector B</div>
          <div className="font-semibold">
            {silentZone?.detector_b_triggered ? (
              <span className="text-destructive">TRIGGERED</span>
            ) : silentZone ? (
              <span className="text-muted-foreground">Not triggered</span>
            ) : (
              <span className="text-muted-foreground">N/A</span>
            )}
          </div>
        </div>
      </div>

      {silentZone?.change_point_utc && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1.5">
          <TrendingDown className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>
            Change point detected at{" "}
            <strong>
              {new Date(silentZone.change_point_utc).toISOString().slice(0, 16).replace("T", " ")} UTC
            </strong>{" "}
            — first post-impact bucket where unique authors dropped below 30% of the pre-event mean.
          </span>
        </div>
      )}

      {silentZone && !silentZone.detector_b_triggered && silentZone.baseline_authors_per_day < 5 && (
        <div className="text-[11px] text-muted-foreground bg-muted/30 border rounded p-2 flex items-start gap-1.5">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>
            Detector B did not fire because this unit's baseline is below 5 daily authors.
            Detector A still caught it via the regional residual comparison.
          </span>
        </div>
      )}
    </Card>
  );
}
