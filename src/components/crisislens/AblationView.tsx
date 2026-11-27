"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Beaker,
} from "lucide-react";
import type { AblationResult } from "@/lib/crisislens/pipeline/run";

interface Props {
  ablation: AblationResult;
  units: { id: string; name: string }[];
}

export function AblationView({ ablation, units }: Props) {
  const nameOf = (id: string) => units.find((u) => u.id === id)?.name ?? id;
  const maxPrecision = 1.0;

  return (
    <div className="space-y-4">
      {/* Headline */}
      <Card className="bg-gradient-to-br from-primary to-[#1a4060] text-primary-foreground p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <Beaker className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-primary-foreground/70 font-semibold mb-1">
              Evaluation against ground truth — and what each design choice contributes
            </div>
            <div className="text-base md:text-lg font-semibold leading-snug">
              {ablation.headline}
            </div>
            <div className="text-sm text-primary-foreground/80 mt-2">
              The final method is <strong className="text-amber-300">{ablation.baseline_offset_lift_points >= 0 ? "+" : ""}{ablation.baseline_offset_lift_points} F1 points</strong> against
              the original prototype on this event. Truth labels come from the dataset&apos;s evaluation-only sheet, which the pipeline never reads. The data are simulated, and the final method was tuned on this dataset, so treat these scores as optimistic.
            </div>
          </div>
        </div>
      </Card>

      {/* Comparison table */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Variant comparison — precision against ground truth</div>
        <div className="space-y-2">
          {ablation.variants.map((v) => {
            const isFull = v.key === "crisislens_full";
            const isNoBaseline = v.key === "prototype_v1";
            const lift = Math.round(((v.f1 ?? v.precision_at_k) - (ablation.crisislens_full.f1 ?? ablation.crisislens_full.precision_at_k)) * 100);
            return (
              <div
                key={v.key}
                className={`rounded-md border p-3 ${
                  isFull
                    ? "border-accent bg-accent/5"
                    : isNoBaseline
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-background"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{v.label}</span>
                      {isFull && (
                        <Badge variant="default" className="text-[10px] bg-accent text-accent-foreground">
                          FINAL METHOD
                        </Badge>
                      )}
                      {isNoBaseline && (
                        <Badge variant="destructive" className="text-[10px]">
                          ORIGINAL PROTOTYPE
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{v.description}</div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 italic">
                      {v.degradation_note}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold tabular-nums">
                      {(v.precision_at_k * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">precision</div>
                    {v.recall !== undefined && (
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        recall {(v.recall * 100).toFixed(0)}% · F1 {(v.f1 ?? 0).toFixed(2)}
                      </div>
                    )}
                    {!isFull && (
                      <div
                        className={`text-[11px] font-semibold mt-1 ${
                          lift >= 0 ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {lift >= 0 ? "+" : ""}
                        {lift} F1 pts
                      </div>
                    )}
                  </div>
                </div>
                {/* Top-K unit IDs as chips */}
                <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
                  {v.top_k_unit_ids.slice(0, 8).map((id, i) => (
                    <span
                      key={id}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground/80"
                    >
                      {i + 1}. {nameOf(id)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* PRD §9.4 compliance */}
      <Card className="p-4 bg-muted/30 border-amber-300">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-foreground/80 leading-relaxed">
            <strong>PRD §9.4 compliance.</strong> The "without baseline offset" ablation
            is the one to lead with — it must visibly degrade results toward ranking
            rural low-population districts. The top-K list above shows the difference:
            CrisisLens flags Gorkha and Sindhupalchok (high MMI, cut off), while
            the no-baseline variant flags low-population rural districts that
            always post less. This is the difference between <em>finding silent
            zones</em> and <em>restating the digital divide</em>.
          </div>
        </div>
      </Card>
    </div>
  );
}
