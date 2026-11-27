"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  MapPin,
  Activity,
  ShieldQuestion,
  CheckCircle2,
  XCircle,
  Languages,
  Database,
  Network,
} from "lucide-react";
import type { SilentZoneFlag } from "@/lib/crisislens/pipeline/types";

interface ScreenedOut {
  admin_unit_id: string;
  admin_unit_name: string;
  status: string;
  score: number;
  reason: string;
}

const SCREEN_LABEL: Record<string, string> = {
  explained_evacuation: "Explained by evacuation",
  explained_data_gap: "Likely data-collection gap",
  uncorroborated: "No outage evidence",
};

interface Props {
  flags: SilentZoneFlag[];
  screened?: ScreenedOut[];
  onConfirm: (unitId: string, confirmed: boolean) => void;
}

export function SilentZoneList({ flags, screened = [], onConfirm }: Props) {
  const [expanded, setExpanded] = useState<string | null>(
    flags[0]?.admin_unit_id ?? null,
  );

  return (
    <div className="space-y-2">
      {flags.map((flag) => {
        const isOpen = expanded === flag.admin_unit_id;
        return (
          <Card
            key={flag.admin_unit_id}
            className={`overflow-hidden transition-all ${
              flag.both_detectors ? "border-destructive/60" : ""
            }`}
          >
            {/* Header */}
            <button
              onClick={() => setExpanded(isOpen ? null : flag.admin_unit_id)}
              className="w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{
                  backgroundColor: scoreColor(flag.score),
                  boxShadow: flag.both_detectors ? `0 0 0 3px ${scoreColor(flag.score)}33` : "none",
                }}
              >
                {flag.score}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">
                    #{flag.rank} · {flag.admin_unit_name}
                  </span>
                  {flag.both_detectors && (
                    <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                      BOTH DETECTORS · HIGH CONFIDENCE
                    </Badge>
                  )}
                  {flag.baseline_source === "modeled" && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      Modeled baseline
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Score {flag.score} · CI [{flag.ci_low}, {flag.ci_high}] ·{" "}
                  {flag.observed_reporters} observed vs {flag.expected_reporters} expected reporters
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>

            {/* Expanded evidence */}
            {isOpen && (
              <div className="border-t bg-muted/20 p-4 space-y-4">
                {/* Explanation */}
                <div className="text-sm text-foreground leading-relaxed bg-amber-50 border border-amber-200 rounded-md p-3">
                  <AlertTriangle className="w-4 h-4 inline mr-2 text-amber-700" />
                  {flag.explanation}
                </div>

                {/* Detector breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-background border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Activity className="w-4 h-4 text-accent" />
                      Detector A — Exposure-conditioned under-reporting
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Residual of observed local voices against baseline × 3 days × regional surge.
                      Flags badly hit units that are quieter than chance would explain.
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Triggered:</span>
                      <Badge variant={flag.detector_a_triggered ? "destructive" : "secondary"}>
                        {flag.detector_a_triggered ? "YES — residual > 2" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Expected need:</span>
                      <span className="font-mono">{flag.expected_need.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Expected reporters (μ):</span>
                      <span className="font-mono">{flag.expected_reporters}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Observed reporters:</span>
                      <span className="font-mono">{flag.observed_reporters}</span>
                    </div>
                  </div>

                  <div className="bg-background border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Clock className="w-4 h-4 text-accent" />
                      Detector B — Temporal drop-off
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Drop of more than 50% below the unit&apos;s own expected voices. Requires at
                      least 5 expected voices in the window, so thin baselines are not flagged by noise.
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Triggered:</span>
                      <Badge variant={flag.detector_b_triggered ? "destructive" : "secondary"}>
                        {flag.detector_b_triggered
                          ? `YES — ${(flag.dropoff_pct! * 100).toFixed(0)}% drop-off`
                          : flag.expected_reporters < 5
                            ? "No — baseline too thin"
                            : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Baseline (authors/day):</span>
                      <span className="font-mono">{flag.baseline_authors_per_day}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Baseline source:</span>
                      <Badge variant={flag.baseline_source === "empirical" ? "default" : "secondary"}>
                        {flag.baseline_source}
                      </Badge>
                    </div>
                    {flag.change_point_utc && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Change point:</span>
                        <span className="font-mono text-xs">
                          {new Date(flag.change_point_utc).toISOString().slice(0, 16).replace("T", " ")} UTC
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {flag.evidence && (
                  <div className="bg-background border rounded-md p-3 space-y-2">
                    <div className="text-sm font-semibold">
                      Independent evidence and other rules
                      <span className="text-xs font-normal text-muted-foreground ml-2">
                        not used to compute the social score
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Night lights down</div>
                        <div className="font-mono text-sm">
                          {flag.evidence.ntl_drop === null ? "n/a" : `${Math.round(flag.evidence.ntl_drop * 100)}%`}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Cell sites down</div>
                        <div className="font-mono text-sm">
                          {flag.evidence.cell_sites_down === null ? "n/a" : `${Math.round(flag.evidence.cell_sites_down * 100)}%`}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Reported evacuated</div>
                        <div className="font-mono text-sm">
                          {flag.evidence.evacuated_share === null ? "n/a" : `${Math.round(flag.evidence.evacuated_share * 100)}%`}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Voices about (elsewhere)</div>
                        <div className="font-mono text-sm">{flag.evidence.voices_about}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <Badge variant={flag.detector_f_triggered ? "destructive" : "secondary"}>
                        Fusion rule F: {flag.detector_f_triggered ? "YES — outage evidence + shortfall" : "No"}
                      </Badge>
                      <Badge variant={flag.detector_z_triggered ? "destructive" : "secondary"}>
                        Zero-voice rule Z: {flag.detector_z_triggered ? "YES — no local need reports" : "No"}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Confounder panel */}
                <div className="bg-background border rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldQuestion className="w-4 h-4 text-amber-600" />
                    Confounder Panel
                    <span className="text-xs font-normal text-muted-foreground">
                      alternative explanations the model cannot distinguish
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-muted/40 rounded p-2">
                      <div className="text-muted-foreground mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Geocode conf (median)
                      </div>
                      <div className="font-mono font-semibold">
                        {flag.confounders.geocode_confidence_median}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        p25 {flag.confounders.geocode_confidence_p25} · p75 {flag.confounders.geocode_confidence_p75}
                      </div>
                    </div>
                    <div className="bg-muted/40 rounded p-2">
                      <div className="text-muted-foreground mb-1 flex items-center gap-1">
                        <Languages className="w-3 h-3" /> Language mix
                      </div>
                      <div className="font-mono font-semibold">
                        {flag.confounders.language_mix.map((l) => `${l.lang} ${(l.share * 100).toFixed(0)}%`).join(" · ")}
                      </div>
                    </div>
                    <div className="bg-muted/40 rounded p-2">
                      <div className="text-muted-foreground mb-1 flex items-center gap-1">
                        <Database className="w-3 h-3" /> Exposure inputs
                      </div>
                      <div className="font-mono font-semibold text-[11px]">
                        pop {flag.confounders.exposure_inputs.population.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        MMI {flag.confounders.exposure_inputs.mmi} · V {flag.confounders.exposure_inputs.vulnerability.toFixed(2)} · I {flag.confounders.exposure_inputs.infrastructure.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-muted/40 rounded p-2">
                      <div className="text-muted-foreground mb-1 flex items-center gap-1">
                        <Network className="w-3 h-3" /> Other
                      </div>
                      <div className="font-mono font-semibold text-[11px]">
                        Evac: {flag.confounders.evacuation_flag ? "Yes" : "No"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Unlocated: {(flag.unlocated_post_share * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  {flag.confounders.baseline_modeled_reason && (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                      <strong>Modeled baseline caveat:</strong>{" "}
                      {flag.confounders.baseline_modeled_reason}
                    </div>
                  )}
                </div>

                {/* Evidence Need Units */}
                <div className="bg-background border rounded-md p-3 space-y-2">
                  <div className="text-sm font-semibold">
                    Evidence — Need Units ({flag.evidence_need_unit_ids.length})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Top Need Units contributing to observed signal in this admin unit. Member post IDs available via the API.
                  </div>
                </div>

                <Separator />

                {/* Feedback */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Analyst feedback — required for live-precision tracking (PRD §7):
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onConfirm(flag.admin_unit_id, true)}
                    className="h-7"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onConfirm(flag.admin_unit_id, false)}
                    className="h-7"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Refute
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      {screened.length > 0 && (
        <Card className="p-3 border-dashed">
          <div className="text-sm font-semibold mb-1">Quiet, but not flagged</div>
          <div className="text-xs text-muted-foreground mb-2">
            The detectors raised these districts and a screen removed them. They are shown so the
            decision can be checked.
          </div>
          <div className="space-y-2">
            {screened.map((s) => (
              <div key={s.admin_unit_id} className="text-xs border rounded-md p-2 bg-background">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{s.admin_unit_name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {SCREEN_LABEL[s.status] ?? s.status}
                  </Badge>
                  <span className="text-muted-foreground">social score {s.score}</span>
                </div>
                <div className="text-muted-foreground mt-1">{s.reason}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function scoreColor(s: number): string {
  if (s >= 90) return "#7a0000";
  if (s >= 60) return "#c62828";
  if (s >= 30) return "#ef9a9a";
  return "#ffcdd2";
}
