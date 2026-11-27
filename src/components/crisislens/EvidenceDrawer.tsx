"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, MapPin, TrendingUp, Activity, Clock } from "lucide-react";
import type {
  AdminUnit,
  ExpectedNeedRow,
  ObservedSignalRow,
  NeedUnit,
  SilentZoneFlag,
} from "@/lib/crisislens/pipeline/types";
import { NEED_TYPE_COLORS, NEED_TYPE_LABELS, URGENCY_LABELS } from "@/lib/crisislens/pipeline/types";

interface Props {
  open: boolean;
  onClose: () => void;
  unitId: string | null;
  units: AdminUnit[];
  expected: ExpectedNeedRow[];
  observed: ObservedSignalRow[];
  needUnits: NeedUnit[];
  silentZones: SilentZoneFlag[];
}

export function EvidenceDrawer({
  open,
  onClose,
  unitId,
  units,
  expected,
  observed,
  needUnits,
  silentZones,
}: Props) {
  const unit = unitId ? units.find((u) => u.id === unitId) : null;
  const exp = unitId ? expected.find((e) => e.admin_unit_id === unitId) : null;
  const obs = unitId ? observed.find((o) => o.admin_unit_id === unitId) : null;
  const sz = unitId ? silentZones.find((s) => s.admin_unit_id === unitId) : null;
  const nus = unitId ? needUnits.filter((nu) => nu.admin_unit_id === unitId) : [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto crisisislens-scroll">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent" />
            {unit?.name ?? "Loading..."}
            {sz && (
              <Badge variant="destructive" className="ml-1 text-[10px]">
                Silent Zone · #{sz.rank} · score {sz.score}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            ADM2 · {unit?.population.toLocaleString() ?? 0} population · MMI {unit?.mmi.toFixed(1)}
            {" · "}lat {unit?.lat.toFixed(2) ?? 0}, lon {unit?.lon.toFixed(2) ?? 0}
          </SheetDescription>
        </SheetHeader>

        {unit && (
          <div className="space-y-4 pt-4">
            {/* Expected vs observed */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/40 rounded-md p-3">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3" /> Expected need
                </div>
                <div className="text-xl font-bold tabular-nums text-primary">
                  {exp?.expected_need.toLocaleString() ?? "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  damage ratio {exp ? `${(exp.damage_ratio * 100).toFixed(0)}%` : "—"} · V {exp?.vulnerability.toFixed(2)}
                </div>
              </div>
              <div className="bg-muted/40 rounded-md p-3">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  <Activity className="w-3 h-3" /> Observed reporters
                </div>
                <div className="text-xl font-bold tabular-nums text-accent">
                  {obs?.observed_reporters ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  baseline {obs?.baseline_authors_per_day ?? 0}/day ({obs?.baseline_source ?? "—"})
                </div>
              </div>
            </div>

            {sz && (
              <>
                <Separator />
                <div className="bg-red-50 border border-destructive/30 rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    Silent Zone Flag — rank #{sz.rank}
                  </div>
                  <div className="text-2xl font-bold tabular-nums">
                    Score {sz.score}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      CI [{sz.ci_low}, {sz.ci_high}]
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Detector A</div>
                      <Badge variant={sz.detector_a_triggered ? "destructive" : "secondary"} className="text-[10px]">
                        {sz.detector_a_triggered ? "TRIGGERED" : "Not triggered"}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Detector B</div>
                      <Badge variant={sz.detector_b_triggered ? "destructive" : "secondary"} className="text-[10px]">
                        {sz.detector_b_triggered ? "TRIGGERED" : "Not triggered"}
                      </Badge>
                    </div>
                  </div>
                  {sz.dropoff_pct != null && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Post-event drop-off: {(sz.dropoff_pct * 100).toFixed(0)}%
                      {sz.change_point_utc && ` · change point ${new Date(sz.change_point_utc).toISOString().slice(0, 16).replace("T", " ")} UTC`}
                    </div>
                  )}
                  <div className="text-xs text-foreground/80 leading-relaxed">
                    {sz.explanation}
                  </div>
                </div>
              </>
            )}

            {!sz && exp && (
              <div className="bg-muted/30 border rounded-md p-3 text-xs text-muted-foreground">
                Not flagged as a silent zone. Observed reporters ({obs?.observed_reporters ?? 0}) are
                within or above the range predicted by exposure ({obs?.expected_reporters_from_baseline ?? 0} expected).
              </div>
            )}

            <Separator />

            {/* Need Units */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">
                Need Units in {unit.name} ({nus.length})
              </div>
              {nus.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No Need Units. If expected need is high but there are no Need Units here, that
                  is exactly the silent-zone signal.
                </div>
              )}
              <div className="space-y-2 max-h-72 overflow-y-auto crisisislens-scroll">
                {nus
                  .sort((a, b) => b.n_unique_authors - a.n_unique_authors)
                  .slice(0, 12)
                  .map((nu) => (
                    <div key={nu.need_unit_id} className="bg-background border rounded-md p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {nu.need_types.map((nt) => (
                            <span
                              key={nt}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{ backgroundColor: NEED_TYPE_COLORS[nt] }}
                            >
                              {NEED_TYPE_LABELS[nt]}
                            </span>
                          ))}
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {URGENCY_LABELS[nu.peak_urgency]}
                        </Badge>
                      </div>
                      <div className="text-foreground/80 italic">
                        &ldquo;{nu.representative_text}&rdquo;
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {nu.n_unique_authors} author{nu.n_unique_authors !== 1 ? "s" : ""}
                          {nu.n_amplifications > 0 && ` · ${nu.n_amplifications} amps excluded`}
                        </span>
                        <span>
                          corroboration {Math.round(nu.corroboration_score * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
