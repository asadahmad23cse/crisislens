"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Satellite, TrendingUp, AlertCircle, Gauge } from "lucide-react";
import type { NighttimeLightsResult } from "@/lib/crisislens/pipeline/run";
import type { ReliabilityBin } from "@/lib/crisislens/pipeline/run";

interface Props {
  validation: NighttimeLightsResult & { reliability_diagram?: ReliabilityBin[] };
}

export function ValidationView({ validation }: Props) {
  const correlation = validation.correlation_score_vs_radiance_drop;
  const isStrong = correlation > 0.5;
  const isModerate = correlation > 0.2 && correlation <= 0.5;
  const isWeak = correlation <= 0.2;

  const scatter = validation.scatter_plot;
  const maxScore = 100;
  const maxDrop = 1.0;

  // Reliability diagram bins
  const reliability = validation.reliability_diagram ?? [];

  return (
    <div className="space-y-4">
      {/* Headline */}
      <Card
        className={`p-4 ${
          isStrong
            ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-300"
            : isModerate
              ? "bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-300"
              : "bg-gradient-to-br from-red-50 to-red-100/50 border-red-300"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isStrong
                ? "bg-emerald-500"
                : isModerate
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
          >
            <Satellite className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Simulation-only cross-check — not empirical validation
            </div>
            <div className="text-base md:text-lg font-semibold leading-snug text-foreground">
              Correlation r = {correlation.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{validation.headline}</div>
            <div className="text-xs text-muted-foreground mt-2 italic">
              The radiance and social values are simulated scenario inputs. This chart demonstrates the calculation;
              it does not validate CrisisLens against observed satellite measurements or real outages.
            </div>
          </div>
        </div>
      </Card>

      {/* Scatter plot: silent zone score vs radiance drop */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-1 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Social shortfall (% below expected voices) ↔ Nighttime radiance drop
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          Each point is an admin unit. Red = flagged silent zone. An upward trend means districts
          that went quiet also went dark. Districts that are dark but not quiet (bottom right is
          empty, top left is not) are why outage evidence alone over-flags.
        </div>
        <div className="relative w-full h-[320px] bg-muted/20 rounded-md border">
          <svg viewBox="0 0 400 320" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            {/* Axes */}
            <line x1="40" y1="280" x2="380" y2="280" stroke="#475569" strokeWidth="1" />
            <line x1="40" y1="20" x2="40" y2="280" stroke="#475569" strokeWidth="1" />
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((v) => {
              const x = 40 + (v / 100) * 340;
              return (
                <g key={v}>
                  <line x1={x} y1="20" x2={x} y2="280" stroke="#e2e8f0" strokeWidth="0.5" />
                  <text x={x} y="295" textAnchor="middle" fontSize="9" fill="#64748b">{v}</text>
                </g>
              );
            })}
            {[0, 0.25, 0.5, 0.75, 1.0].map((v) => {
              const y = 280 - v * 260;
              return (
                <g key={v}>
                  <line x1="40" y1={y} x2="380" y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
                  <text x="35" y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">{(v * 100).toFixed(0)}%</text>
                </g>
              );
            })}
            {/* Axis labels */}
            <text x="210" y="315" textAnchor="middle" fontSize="10" fill="#475569" fontWeight="600">
              Social shortfall (% below expected voices)
            </text>
            <text
              x="15"
              y="150"
              textAnchor="middle"
              fontSize="10"
              fill="#475569"
              fontWeight="600"
              transform="rotate(-90 15 150)"
            >
              Radiance drop (%)
            </text>
            {/* Trend line (least squares) */}
            {(() => {
              const points = scatter.map((p) => [p.x, p.y]);
              const n = points.length;
              const meanX = points.reduce((s, p) => s + p[0], 0) / n;
              const meanY = points.reduce((s, p) => s + p[1], 0) / n;
              let num = 0, den = 0;
              for (const p of points) {
                num += (p[0] - meanX) * (p[1] - meanY);
                den += (p[0] - meanX) ** 2;
              }
              const slope = den === 0 ? 0 : num / den;
              const intercept = meanY - slope * meanX;
              const yAt0 = intercept;
              const yAt100 = intercept + slope * 100;
              return (
                <line
                  x1={40}
                  y1={280 - Math.max(0, Math.min(1, yAt0)) * 260}
                  x2={380}
                  y2={280 - Math.max(0, Math.min(1, yAt100)) * 260}
                  stroke="#0097a7"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              );
            })()}
            {/* Data points */}
            {scatter.map((p, i) => {
              const cx = 40 + (p.x / 100) * 340;
              const cy = 280 - p.y * 260;
              return (
                <g key={i}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={p.silent ? 6 : 4}
                    fill={p.silent ? "#d32f2f" : "#0f2c4e"}
                    fillOpacity={p.silent ? 0.85 : 0.5}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  <title>{`${p.label}: score ${p.x}, drop ${(p.y * 100).toFixed(0)}%`}</title>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#d32f2f]" /> Silent zone
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#0f2c4e]" /> Non-silent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-accent" style={{ borderTop: "2px dashed #0097a7" }} />
            Least-squares fit (r = {correlation.toFixed(2)})
          </span>
        </div>
      </Card>

      {/* Per-unit table */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Per-unit radiance change (dataset evidence sheet, simulated)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b">
              <tr className="text-left text-muted-foreground">
                <th className="py-1.5 pr-2">Admin Unit</th>
                <th className="py-1.5 pr-2 text-right">Silent Zone?</th>
                <th className="py-1.5 pr-2 text-right">Score</th>
                <th className="py-1.5 pr-2 text-right">Pre-event radiance</th>
                <th className="py-1.5 pr-2 text-right">Post-event radiance</th>
                <th className="py-1.5 pr-2 text-right">Drop %</th>
                <th className="py-1.5 pr-2 text-right">Cloud cover</th>
              </tr>
            </thead>
            <tbody>
              {validation.per_unit.slice().sort((a, b) => b.radiance_drop_pct - a.radiance_drop_pct).map((u) => (
                <tr key={u.admin_unit_id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-1.5 pr-2 font-medium">{u.admin_unit_name}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {u.silent_zone ? (
                      <Badge variant="destructive" className="text-[10px]">SZ</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{u.silent_zone_score}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{u.pre_event_radiance.toFixed(1)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{u.post_event_radiance.toFixed(1)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums font-semibold">
                    <span className={u.radiance_drop_pct > 0.5 ? "text-destructive" : "text-foreground"}>
                      {(u.radiance_drop_pct * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{u.cloud_cover_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reliability diagram */}
      {reliability.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent" />
            Reliability diagram — confidence calibration
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            Bins silent-zone scores into 20-point ranges. Reports empirical frequency of
            "both detectors triggered" (high-confidence ground truth) in each bin.
            A well-calibrated model has empirical frequency ≈ bin midpoint (the dashed line).
          </div>
          <div className="relative w-full h-[200px] bg-muted/20 rounded-md border">
            <svg viewBox="0 0 400 200" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              {/* Axes */}
              <line x1="40" y1="170" x2="380" y2="170" stroke="#475569" strokeWidth="1" />
              <line x1="40" y1="20" x2="40" y2="170" stroke="#475569" strokeWidth="1" />
              {/* Diagonal = perfect calibration */}
              <line x1="40" y1="170" x2="380" y2="20" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
              {/* Bars */}
              {reliability.map((bin, i) => {
                const barX = 40 + (i / reliability.length) * 340;
                const barWidth = 340 / reliability.length - 8;
                const barHeight = bin.empirical_frequency * 150;
                const barY = 170 - barHeight;
                return (
                  <g key={i}>
                    <rect
                      x={barX + 4}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      fill={bin.n_units > 0 ? "#0097a7" : "#cbd5e1"}
                      fillOpacity={0.8}
                    />
                    {bin.n_units > 0 && (
                      <text
                        x={barX + 4 + barWidth / 2}
                        y={barY - 3}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="600"
                        fill="#0f2c4e"
                      >
                        {(bin.empirical_frequency * 100).toFixed(0)}%
                      </text>
                    )}
                    <text
                      x={barX + 4 + barWidth / 2}
                      y="185"
                      textAnchor="middle"
                      fontSize="8"
                      fill="#64748b"
                    >
                      {bin.range_low}-{bin.range_high}
                    </text>
                    <text
                      x={barX + 4 + barWidth / 2}
                      y="195"
                      textAnchor="middle"
                      fontSize="8"
                      fill="#94a3b8"
                    >
                      n={bin.n_units}
                    </text>
                  </g>
                );
              })}
              {/* Y-axis labels */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
                <text
                  key={v}
                  x="35"
                  y={170 - v * 150 + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#64748b"
                >
                  {(v * 100).toFixed(0)}%
                </text>
              ))}
            </svg>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Dashed diagonal = perfect calibration. Bars above diagonal = model is conservative (true-positive rate exceeds predicted confidence). Bars below = model is over-confident.
          </div>
        </Card>
      )}
    </div>
  );
}
