"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import type { FindingSummary } from "@/lib/crisislens/pipeline/types";

interface Props {
  finding: FindingSummary;
}

export function FindingBanner({ finding }: Props) {
  const silent = finding.quietest_high_exposure_unit;
  const loud = finding.loudest_unit;
  return (
    <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-300 overflow-hidden">
      <div className="p-4 md:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-amber-900" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-amber-800 font-semibold mb-0.5">
              The CrisisLens formula
            </div>
            <div className="text-base md:text-lg font-semibold leading-snug text-foreground">
              <span className="text-destructive">High expected damage</span>
              <span className="mx-2 text-amber-700">+</span>
              <span className="text-primary">low social-media activity</span>
              <span className="mx-2 text-amber-700">=</span>
              <span className="text-accent">Silent Zone</span>
            </div>
          </div>
        </div>

        <div className="border-t border-amber-200 pt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Loudest */}
          <div className="bg-background/70 rounded-md p-3 border border-amber-200">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Loudest unit
            </div>
            <div className="font-semibold text-foreground">{loud.admin_unit_name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {loud.observed_reporters} reporters · damage percentile {Math.round(loud.damage_percentile * 100)}%
            </div>
            {loud.damage_percentile < 0.5 && (
              <Badge variant="secondary" className="mt-1.5 text-[10px] py-0 px-1.5">
                Below median damage — digital voice ≠ severity
              </Badge>
            )}
          </div>

          {/* Quietest high-exposure */}
          <div className="bg-background/70 rounded-md p-3 border border-destructive/30">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              Silent Zone — rank #1
            </div>
            <div className="font-semibold text-foreground">{silent.admin_unit_name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {silent.observed_reporters} reporters · damage percentile {Math.round(silent.damage_percentile * 100)}% · score {silent.score}
            </div>
            <Badge variant="destructive" className="mt-1.5 text-[10px] py-0 px-1.5">
              Severe exposure · near-silent reporting
            </Badge>
          </div>

          {/* Methodology */}
          <div className="bg-background/70 rounded-md p-3 border border-amber-200">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-accent" />
              CrisisLens vs fewest-posts ranking (ground truth)
            </div>
            <div className="text-lg font-bold text-foreground tabular-nums">
              +{finding.lift_points} pts
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              precision: CrisisLens {finding.crisislens_precision_at_10.toFixed(2)} vs fewest-posts {finding.inverted_volume_baseline_precision_at_10.toFixed(2)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5">
              {finding.flagged_share_of_need_posts !== undefined ? (
                <>
                  flagged districts wrote{" "}
                  <span className="font-mono">{(finding.flagged_share_of_need_posts * 100).toFixed(1)}%</span> of need
                  posts but hold{" "}
                  <span className="font-mono">{((finding.flagged_share_of_expected_need ?? 0) * 100).toFixed(0)}%</span> of
                  expected need
                </>
              ) : (
                <>
                  correlation score ↔ volume:{" "}
                  <span className="font-mono">{finding.correlation_silent_zone_vs_volume.toFixed(2)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-amber-200 pt-3 text-sm text-foreground leading-relaxed">
          <strong className="text-primary">Headline answer:</strong>{" "}
          {finding.headline}
        </div>
      </div>
    </Card>
  );
}
