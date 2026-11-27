"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine, AreaChart, Area,
} from "recharts";
import { AlertTriangle, ArrowRight, ChevronRight, Satellite, RadioTower, Megaphone } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { CrisisMap } from "@/components/crisislens/CrisisMap";
import { UNITS } from "@/lib/crisislens/live";
import { NEED_TYPE_LABELS, NEED_TYPE_COLORS } from "@/lib/crisislens/pipeline/types";
import type {
  AdminUnit, EventMeta, ExpectedNeedRow, FindingSummary, NeedType, NeedUnit, ObservedSignalRow, SilentZoneFlag, TimelinePoint,
} from "@/lib/crisislens/pipeline/types";

export interface ScreenedOut {
  admin_unit_id: string;
  admin_unit_name: string;
  status: string;
  score: number;
  reason: string;
}

interface Props {
  eventId: string;
  event: EventMeta;
  units: AdminUnit[];
  expected: ExpectedNeedRow[];
  observed: ObservedSignalRow[];
  needUnits: NeedUnit[];
  silentZones: SilentZoneFlag[];
  screened: ScreenedOut[];
  finding?: FindingSummary;
  needSummary: { need_type: string; authors: number }[];
  onUnitClick: (unitId: string) => void;
  onNavigate: (tab: string) => void;
}

const SCREEN_LABEL: Record<string, string> = {
  explained_evacuation: "Explained by evacuation",
  explained_data_gap: "Likely data gap",
  uncorroborated: "No outage evidence",
};
const RED = "#b91c1c";
const AMBER = "#d97706";
const SLATE = "#94a3b8";
const pct = (x: number | null | undefined) => (x == null ? "n/a" : `${Math.round(x * 100)}%`);

// The landing view: where to look first, on one screen.
export function OverviewDashboard(p: Props) {
  const timeline = useFetch<{ regional: TimelinePoint[] }>(`/api/events/${p.eventId}/timeline`);

  const districts = useMemo(
    () =>
      UNITS.filter((u) => u.event_id === p.eventId)
        .map((u) => ({
          id: u.id,
          name: u.name,
          share: u.mu > 0 ? Math.min(250, Math.round((u.observed / u.mu) * 100)) : 0,
          heard: u.observed,
          expected: u.mu,
          status: u.status,
        }))
        .sort((a, b) => a.share - b.share),
    [p.eventId],
  );
  const regional = (timeline.data?.regional ?? []).map((t) => ({
    hour: Math.round((Date.parse(t.t) - Date.parse(p.event.impact_utc)) / 3_600_000),
    voices: t.unique_authors,
  }));
  const maxNeed = Math.max(1, ...p.needSummary.map((n) => n.authors));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Map */}
        <Card className="p-4 xl:col-span-2 flex flex-col h-[620px]">
          <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
            <h2 className="text-sm font-semibold">Where to look first</h2>
            <span className="text-xs text-muted-foreground">Click a district for its evidence.</span>
          </div>
          <div className="flex-1 min-h-0">
            <CrisisMap
              units={p.units}
              expected={p.expected}
              observed={p.observed}
              needUnits={p.needUnits}
              silentZones={p.silentZones}
              epicenter={p.event.epicenter_svg}
              contextPaths={p.event.context_paths}
              mapSource={p.event.map_source}
              viewBox={p.event.map_viewbox}
              onUnitClick={p.onUnitClick}
            />
          </div>
        </Card>

        {/* Priority list */}
        <Card className="p-4 flex flex-col h-[620px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Silent Zones to verify
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => p.onNavigate("silent")}>
              Details <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Badly hit, far quieter than their own normal, with outage evidence. Check through another channel before acting.
          </p>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {p.silentZones.length === 0 && (
              <div className="text-sm text-muted-foreground">No district is flagged for this event.</div>
            )}
            {p.silentZones.map((z) => {
              const share = z.expected_reporters > 0 ? Math.min(1, z.observed_reporters / z.expected_reporters) : 0;
              return (
                <button
                  key={z.admin_unit_id}
                  onClick={() => p.onUnitClick(z.admin_unit_id)}
                  className="w-full text-left rounded-lg border p-3 hover:border-destructive/50 hover:bg-destructive/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">
                      <span className="text-muted-foreground font-normal mr-1.5">#{z.rank}</span>
                      {z.admin_unit_name}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {z.observed_reporters} heard / {z.expected_reporters} expected
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
                    <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: RED }} />
                  </div>
                  {z.evidence && (
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center gap-1"><Satellite className="w-3 h-3" /> lights down {pct(z.evidence.ntl_drop)}</span>
                      <span className="inline-flex items-center gap-1"><RadioTower className="w-3 h-3" /> cell sites down {pct(z.evidence.cell_sites_down)}</span>
                      <span className="inline-flex items-center gap-1"><Megaphone className="w-3 h-3" /> {z.evidence.voices_about} asking from elsewhere</span>
                    </div>
                  )}
                </button>
              );
            })}
            {p.screened.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Quiet, but not flagged
                </div>
                {p.screened.map((s) => (
                  <button
                    key={s.admin_unit_id}
                    onClick={() => p.onUnitClick(s.admin_unit_id)}
                    title={s.reason}
                    className="w-full text-left rounded-lg border border-dashed p-2.5 mb-1.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{s.admin_unit_name}</span>
                      <Badge variant="secondary" className="text-[10px]">{SCREEN_LABEL[s.status] ?? s.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {p.finding?.flagged_share_of_need_posts !== undefined && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 leading-relaxed">
              <span className="font-semibold">Loudness bias here: </span>
              the flagged districts wrote {(p.finding.flagged_share_of_need_posts * 100).toFixed(1)}% of the need posts but
              hold {Math.round((p.finding.flagged_share_of_expected_need ?? 0) * 100)}% of the expected need. The loudest
              district is {p.finding.loudest_unit.admin_unit_name}.
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Heard vs expected */}
        <Card className="p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold">Voices heard, as a share of expected</h2>
          <p className="text-xs text-muted-foreground mb-2">
            100% means as loud as the district&apos;s own normal predicts.
          </p>
          <div style={{ height: 330 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districts} layout="vertical" margin={{ left: 4, right: 24, top: 4 }}>
                <CartesianGrid horizontal={false} stroke="#e4e3df" />
                <XAxis type="number" domain={[0, "dataMax"]} unit="%" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 10 }} interval={0} />
                <Tooltip
                  formatter={(v: number, _n, item) => [`${v}% (${item.payload.heard} heard, ${item.payload.expected} expected)`, "Share"]}
                />
                <ReferenceLine x={100} stroke="#52514e" strokeDasharray="4 3" />
                <Bar dataKey="share" radius={[0, 3, 3, 0]} onClick={(d: { id?: string }) => d.id && p.onUnitClick(d.id)} cursor="pointer">
                  {districts.map((d) => (
                    <Cell key={d.id} fill={d.status === "silent_zone" ? RED : d.status === "not_flagged" ? SLATE : AMBER} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
            <Legend color={RED} label="Silent Zone" />
            <Legend color={AMBER} label="Quiet, not flagged" />
            <Legend color={SLATE} label="Other" />
          </div>
        </Card>

        {/* Needs */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">What people say they need</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => p.onNavigate("ledger")}>
              Need ledger <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Distinct people per need, reposts and spam removed.</p>
          <div className="space-y-2">
            {p.needSummary.map((n) => (
              <div key={n.need_type} className="flex items-center gap-2 text-xs">
                <span className="w-36 truncate">{NEED_TYPE_LABELS[n.need_type as NeedType] ?? n.need_type}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(n.authors / maxNeed) * 100}%`, backgroundColor: NEED_TYPE_COLORS[n.need_type as NeedType] ?? "#0097a7" }}
                  />
                </div>
                <span className="w-10 text-right font-mono">{n.authors.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Timeline */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Voices over time, whole region</h2>
          <p className="text-xs text-muted-foreground mb-2">
            Distinct people posting per 6 hours. The region gets louder after impact, which is why silence stands out.
          </p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={regional} margin={{ left: 0, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} stroke="#e4e3df" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} unit="h" type="number" domain={[-168, 72]} ticks={[-168, -120, -72, -24, 0, 24, 48, 72]} />
                <YAxis tick={{ fontSize: 10 }} width={36} />
                <Tooltip formatter={(v: number) => [v, "People posting"]} labelFormatter={(h) => `${h} h from impact`} />
                <ReferenceLine x={0} stroke={RED} strokeDasharray="4 3" label={{ value: "impact", fontSize: 10, fill: RED, position: "insideTopRight" }} />
                <Area type="monotone" dataKey="voices" stroke="#0f2c4e" fill="#0f2c4e" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Next steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <NextStep title="Analyse a post" text="Type or upload posts and see how each is read, located and counted." onClick={() => p.onNavigate("analyze")} />
        <NextStep title="Run a what-if" text="Change a district's numbers and watch the decision and its reasons change." onClick={() => p.onNavigate("simulator")} />
        <NextStep title="Check the evidence" text="See the scores against the answer key, the limits, and the real-tweet test." onClick={() => p.onNavigate("research")} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} /> {label}
    </span>
  );
}

function NextStep({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{text}</p>
    </button>
  );
}
