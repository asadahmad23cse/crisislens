"use client";

import type { EventMeta } from "@/lib/crisislens/pipeline/types";
import { Activity, MapPin, Clock } from "lucide-react";

interface Props {
  event: EventMeta;
  districts: number;
  quietNotFlagged: number;
  evaluation: { true_silent_zones: string[]; tp: number; fp: number; fn: number } | null;
}

const HAZARD: Record<string, string> = { earthquake: "Earthquake", cyclone: "Cyclone", flood: "Flood" };

// Compact event header: what happened, then the numbers that matter.
export function EventHeader({ event, districts, quietNotFlagged, evaluation }: Props) {
  const impact = new Date(event.impact_utc).toISOString().slice(0, 16).replace("T", " ");
  return (
    <section className="rounded-xl bg-gradient-to-br from-primary via-primary to-[#1a4060] text-primary-foreground overflow-hidden">
      <div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-end gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white/15">
              {HAZARD[event.hazard_type] ?? event.hazard_type}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400 text-amber-950">
              Advisory · simulated data
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">{event.name}</h1>
          <p className="text-sm text-primary-foreground/80 mt-1">
            Which badly hit districts have gone quiet online in the first 72 hours?
          </p>
          {event.event_id === "kerala-2018" && (
            <p className="text-xs text-amber-200 mt-2">
              This is a synthetic 14-district demonstration. It does not show observed results for the 93 Alappuzha villages.
            </p>
          )}
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-primary-foreground/70 mt-3">
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Impact {impact} UTC</span>
            <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.country}</span>
            <span className="inline-flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> {districts} districts</span>
          </div>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 lg:text-right">
          <Kpi value={event.total_posts_ingested.toLocaleString()} label="posts analysed" />
          <Kpi value={event.total_relevant_posts.toLocaleString()} label="need reports" />
          <Kpi value={String(event.total_silent_zones)} label="Silent Zones flagged" highlight />
          <Kpi value={String(quietNotFlagged)} label="quiet, not flagged" />
        </dl>
      </div>
      {evaluation && (
        <div className="px-5 md:px-6 py-2.5 bg-black/20 text-xs text-primary-foreground/85 flex items-center gap-x-4 gap-y-1 flex-wrap">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-primary-foreground/60">Scored against the answer key</span>
          <span>{evaluation.tp} of {evaluation.tp + evaluation.fn} true Silent Zones found</span>
          <span>{evaluation.fp} false alarm{evaluation.fp === 1 ? "" : "s"}</span>
          <span className="text-primary-foreground/60">The pipeline never reads the answer key.</span>
        </div>
      )}
    </section>
  );
}

function Kpi({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div>
      <dd className={`text-2xl md:text-3xl font-bold tabular-nums leading-none ${highlight ? "text-amber-300" : ""}`}>{value}</dd>
      <dt className="text-[11px] uppercase tracking-wider text-primary-foreground/65 mt-1">{label}</dt>
    </div>
  );
}
