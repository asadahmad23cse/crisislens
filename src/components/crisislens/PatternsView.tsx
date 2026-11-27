"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  Network,
  Zap,
  Hospital,
  Truck,
  Wifi,
  ShieldAlert,
} from "lucide-react";
import type { CoOccurrencePattern } from "@/lib/crisislens/pipeline/run";

interface Props {
  patterns: CoOccurrencePattern[];
}

const PATTERN_ICONS: Record<string, any> = {
  pattern_telecom_outage_rescue_and_trapped: Wifi,
  pattern_telecom_outage_power_and_energy: Zap,
  pattern_water_and_sanitation_shelter_and_displacement: Network,
  pattern_power_and_energy_medical_and_injury: Hospital,
  pattern_road_and_access_blocked_food_and_nutrition: Truck,
  pattern_road_and_access_blocked_medical_and_injury: Hospital,
  pattern_shelter_and_displacement_protection_and_safety: ShieldAlert,
  pattern_water_and_sanitation_medical_and_injury: AlertOctagon,
};

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    color: "#d32f2f",
    bg: "bg-red-50",
    border: "border-red-300",
    icon: AlertOctagon,
  },
  warning: {
    label: "Warning",
    color: "#fb8c00",
    bg: "bg-amber-50",
    border: "border-amber-300",
    icon: AlertTriangle,
  },
  info: {
    label: "Info",
    color: "#0f2c4e",
    bg: "bg-blue-50",
    border: "border-blue-300",
    icon: Info,
  },
};

export function PatternsView({ patterns }: Props) {
  if (patterns.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <Network className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No co-occurrence patterns detected in this event.
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {/* Intro */}
      <Card className="p-4 bg-muted/30 border-amber-300">
        <div className="flex items-start gap-2">
          <Network className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-foreground/80 leading-relaxed">
            <strong>Crisis signatures hidden in the choropleth.</strong> These patterns
            are detected by looking at which Need Unit types co-occur in the same admin
            unit within a 6-hour window. They surface crisis signatures that responders
            recognize and can act on directly — e.g., <em>telecom outage + rescue requests
            = communication collapse</em>, meaning people are trapped but cannot call for help.
          </div>
        </div>
      </Card>

      {/* Pattern cards */}
      {patterns.map((p) => {
        const Icon = PATTERN_ICONS[p.pattern_id] ?? AlertTriangle;
        const sev = SEVERITY_CONFIG[p.severity];
        const SevIcon = sev.icon;
        return (
          <Card
            key={p.pattern_id}
            className={`p-4 ${sev.bg} ${sev.border}`}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: sev.color }}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  <Badge
                    style={{ backgroundColor: sev.color, color: "white" }}
                    className="text-[10px]"
                  >
                    <SevIcon className="w-3 h-3 mr-1" />
                    {sev.label}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {p.total_occurrences} occurrences
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {p.admin_units.length} unit{p.admin_units.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">
                  {p.description}
                </p>
                <Separator className="my-2" />
                <div className="flex flex-wrap gap-1">
                  {p.need_types.map((nt) => (
                    <span
                      key={nt}
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-background border"
                    >
                      {nt.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Detected in:
                  {" "}
                  {p.admin_units.slice(0, 5).map((u, i) => (
                    <span key={u.admin_unit_id}>
                      {i > 0 && ", "}
                      <strong className="text-foreground/80">{u.admin_unit_name}</strong>
                      {" "}
                      <span className="text-muted-foreground">({u.count})</span>
                    </span>
                  ))}
                  {p.admin_units.length > 5 && (
                    <span className="text-muted-foreground"> +{p.admin_units.length - 5} more</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
