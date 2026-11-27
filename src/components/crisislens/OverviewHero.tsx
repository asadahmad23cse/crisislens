"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Search,
  Network,
  ClipboardList,
  MapPin,
  BarChart3,
  Target,
  LayoutDashboard,
  ArrowRight,
  Database,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Users,
} from "lucide-react";
import type { EventMeta } from "@/lib/crisislens/pipeline/types";

interface Props {
  event: EventMeta;
}

const PIPELINE_STAGES = [
  { icon: MessageSquare, label: "Dataset Posts", color: "#0f2c4e" },
  { icon: Search, label: "Need Detection", color: "#0f2c4e" },
  { icon: Network, label: "Duplicate Clustering", color: "#0097a7" },
  { icon: ClipboardList, label: "Need Units", color: "#0097a7" },
  { icon: MapPin, label: "Location Extraction", color: "#0f2c4e" },
  { icon: BarChart3, label: "Expected Impact", color: "#0f2c4e" },
  { icon: Target, label: "Silent Zone Detection", color: "#d32f2f" },
  { icon: LayoutDashboard, label: "Map & Dashboard", color: "#0f2c4e" },
];

export function OverviewHero({ event }: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-primary via-primary to-[#1a4060] text-primary-foreground p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="bg-white/15 text-primary-foreground border-white/20 text-[10px]">
                Computational Social Media · Decision-Support Tool
              </Badge>
              <Badge variant="secondary" className="bg-amber-400/90 text-amber-950 border-amber-300 text-[10px]">
                ADVISORY · v1.0
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              CrisisLens
            </h1>
            <p className="text-primary-foreground/80 italic mt-1 text-sm md:text-base">
              Finding silent zones in disaster social media
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-5 text-primary-foreground">
            <Metric label="Posts ingested" value={event.total_posts_ingested.toLocaleString()} />
            <Metric label="Relevant" value={event.total_relevant_posts.toLocaleString()} />
            <Metric label="Need Units" value={event.total_need_units.toLocaleString()} />
            <Metric label="Silent zones" value={event.total_silent_zones.toString()} accent="amber" />
            <Metric label="Unlocated" value={`${Math.round(event.unlocated_share * 100)}%`} accent="amber" />
            <Metric label="Hazard" value={event.hazard_type.toUpperCase()} />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 text-xs text-primary-foreground/70 flex flex-wrap gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {event.name}
          </span>
          <span>·</span>
          <span>
            Impact {new Date(event.impact_utc).toISOString().replace("T", " ").slice(0, 16)} UTC
          </span>
          <span>·</span>
          <span>
            Epicenter {event.epicenter_lat.toFixed(2)}, {event.epicenter_lon.toFixed(2)}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {event.country}
          </span>
        </div>
      </div>

      {/* Pipeline */}
      <div className="p-5 bg-background">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Pipeline — simple flow
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {PIPELINE_STAGES.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-2 md:gap-3">
                <div className="flex flex-col items-center gap-1 min-w-[78px]">
                  <div
                    className="w-10 h-10 rounded-lg border-2 flex items-center justify-center"
                    style={{ borderColor: s.color, color: s.color, backgroundColor: `${s.color}08` }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] text-center text-muted-foreground leading-tight">
                    {s.label}
                  </span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Methodology cards */}
      <div className="border-t bg-muted/30 p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <MethodCard
          icon={ClipboardList}
          color="#0f2c4e"
          title="Need Ledger"
          description="Deduplicate posts into real humanitarian Need Units. Count unique authors — never posts. One person posting 40 times is one report, not forty."
          bullets={[
            "MinHash near-duplicate clustering (Jaccard ≥ 0.85)",
            "Blocked by (need_type, admin_unit, 6h bucket)",
            "Reposts, copies and spam accounts excluded",
            "Voices FROM a district kept apart from voices ABOUT it",
          ]}
        />
        <MethodCard
          icon={BarChart3}
          color="#0097a7"
          title="Expected Need Surface"
          description="Estimate how much each admin unit SHOULD be posting given its exposure and pre-event baseline — not just how much it is posting."
          bullets={[
            "E_i = Σ pop × H(hazard) × V × I",
            "Damage curve per hazard: shaking, wind, flood depth",
            "Population × vulnerability × infrastructure",
            "Baseline measured from the 7 pre-event days × regional surge",
          ]}
        />
        <MethodCard
          icon={AlertTriangle}
          color="#d32f2f"
          title="Residual Analysis"
          description="Four rules flag badly hit districts that are quieter than their own normal. Evacuation and data gaps are screened out, and a flag needs independent outage evidence."
          bullets={[
            "A: residual > 2 · B: more than 50% below expected",
            "Z: no local need voices · F: outage evidence + shortfall",
            "Severity gate: damage ratio at or above the regional median",
            "Every flag ships with its evidence and confounder panel",
          ]}
        />
      </div>
    </Card>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "amber" }) {
  return (
    <div>
      <div
        className={`text-xl md:text-2xl font-bold tabular-nums ${
          accent === "amber" ? "text-amber-300" : "text-primary-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] md:text-xs uppercase tracking-wider text-primary-foreground/60">
        {label}
      </div>
    </div>
  );
}

function MethodCard({
  icon: Icon,
  color,
  title,
  description,
  bullets,
}: {
  icon: any;
  color: string;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="bg-background border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: color }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span className="font-semibold" style={{ color }}>
          {title}
        </span>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </div>
      <ul className="space-y-1 pt-1">
        {bullets.map((b, i) => (
          <li key={i} className="text-[11px] text-foreground/80 flex items-start gap-1.5">
            <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
