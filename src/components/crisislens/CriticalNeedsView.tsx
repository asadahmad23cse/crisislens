"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertOctagon, AlertTriangle, Clock, MapPin, Activity } from "lucide-react";
import type { CriticalUnmetNeed } from "@/lib/crisislens/pipeline/run";

interface Props {
  needs: CriticalUnmetNeed[];
}

const URGENCY_CONFIG = {
  critical: {
    label: "Critical",
    color: "#7a0000",
    bg: "bg-red-100",
    border: "border-red-400",
    icon: AlertOctagon,
  },
  high: {
    label: "High",
    color: "#d32f2f",
    bg: "bg-red-50",
    border: "border-red-300",
    icon: AlertTriangle,
  },
  moderate: {
    label: "Moderate",
    color: "#fb8c00",
    bg: "bg-amber-50",
    border: "border-amber-300",
    icon: Clock,
  },
};

export function CriticalNeedsView({ needs }: Props) {
  if (needs.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No critical unmet needs detected — every high-exposure admin unit has at least
        some social signal. The geocoder is working and no units are completely cut off.
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {/* Definition */}
      <Card className="p-4 bg-destructive/5 border-destructive/40">
        <div className="flex items-start gap-2">
          <AlertOctagon className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Critical Unmet Needs</strong> = high expected damage AND zero
            observed reporters. These are the absolute worst cases — either the area
            is fully cut off from communications (telecom failure, power loss) or
            the geocoder is failing catastrophically. <strong>Both require immediate
            analyst attention.</strong> These are NOT the same as silent zones — silent
            zones have a few reporters but anomalously few. Critical unmet needs
            have <em>none at all</em>.
          </div>
        </div>
      </Card>

      {/* Cards */}
      {needs.map((n) => {
        const cfg = URGENCY_CONFIG[n.urgency];
        const Icon = cfg.icon;
        return (
          <Card
            key={n.admin_unit_id}
            className={`p-4 ${cfg.bg} ${cfg.border}`}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                style={{ backgroundColor: cfg.color }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    {n.admin_unit_name}
                  </h3>
                  <Badge
                    style={{ backgroundColor: cfg.color, color: "white" }}
                    className="text-[10px]"
                  >
                    {cfg.label}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                  <div className="bg-background/70 rounded p-2 border">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Expected need</div>
                    <div className="font-semibold tabular-nums">{n.expected_need.toLocaleString()}</div>
                  </div>
                  <div className="bg-background/70 rounded p-2 border">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Observed reporters</div>
                    <div className="font-semibold tabular-nums text-destructive">{n.observed_reporters}</div>
                  </div>
                  <div className="bg-background/70 rounded p-2 border">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">MMI / intensity</div>
                    <div className="font-semibold tabular-nums">{n.mmi.toFixed(1)}</div>
                  </div>
                  <div className="bg-background/70 rounded p-2 border">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Damage percentile</div>
                    <div className="font-semibold tabular-nums">{Math.round(n.damage_percentile * 100)}%</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2 leading-relaxed bg-background/70 rounded p-2 border">
                  <strong className="text-foreground/80">Likely cause:</strong> {n.likely_cause}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
