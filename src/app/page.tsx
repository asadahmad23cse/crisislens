"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Map as MapIcon,
  ClipboardList,
  AlertTriangle,
  Network,
  LayoutDashboard,
  ExternalLink,
  AlertCircle,
  Beaker,
  Satellite,
  FileText,
  Zap,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { OverviewHero } from "@/components/crisislens/OverviewHero";
import { FindingBanner } from "@/components/crisislens/FindingBanner";
import { CrisisMap } from "@/components/crisislens/CrisisMap";
import { NeedLedger } from "@/components/crisislens/NeedLedger";
import { SilentZoneList } from "@/components/crisislens/SilentZoneList";
import { KnowledgeGraphView } from "@/components/crisislens/KnowledgeGraphView";
import { EvidenceDrawer } from "@/components/crisislens/EvidenceDrawer";
import { AblationView } from "@/components/crisislens/AblationView";
import { ValidationView } from "@/components/crisislens/ValidationView";
import { PatternsView } from "@/components/crisislens/PatternsView";
import { CriticalNeedsView } from "@/components/crisislens/CriticalNeedsView";
import { BriefView } from "@/components/crisislens/BriefView";
import { PerUnitTimeline } from "@/components/crisislens/PerUnitTimeline";
import { EventSelector } from "@/components/crisislens/EventSelector";
import { AnalyzeView } from "@/components/crisislens/AnalyzeView";
import { SimulatorView } from "@/components/crisislens/SimulatorView";
import { ResearchView } from "@/components/crisislens/ResearchView";
import { Sparkles, SlidersHorizontal, FlaskConical, BookOpen } from "lucide-react";
import { EventHeader } from "@/components/crisislens/EventHeader";
import { OverviewDashboard } from "@/components/crisislens/OverviewDashboard";
import { AlappuzhaPrototype } from "@/components/crisislens/AlappuzhaPrototype";
import type {
  AdminUnit,
  ExpectedNeedRow,
  FindingSummary,
  KnowledgeGraph,
  NeedUnit,
  ObservedSignalRow,
  SilentZoneFlag,
  EventMeta,
  TimelinePoint,
} from "@/lib/crisislens/pipeline/types";
import type { AblationResult, NighttimeLightsResult, CoOccurrencePattern, CriticalUnmetNeed } from "@/lib/crisislens/pipeline/run";

export default function Home() {
  const [eventId, setEventId] = useState<string>("kerala-2018");
  const [drawerUnit, setDrawerUnit] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("prototype");

  // Fetch list of available events
  const eventsList = useFetch<{ event_id: string; name: string; hazard_type: string; country: string; impact_utc: string }[]>(
    "/api/events",
  );

  // Fetch data for the selected event
  const summary = useFetch<{
    event: EventMeta;
    units: AdminUnit[];
    unlocated_post_share: number;
    unlocated_post_count: number;
    need_summary?: { need_type: string; authors: number }[];
    evaluation?: { true_silent_zones: string[]; tp: number; fp: number; fn: number } | null;
  }>(`/api/events/${eventId}/summary`);
  const needUnitsData = useFetch<{ items: NeedUnit[] }>(`/api/events/${eventId}/need-units?limit=200`);
  const expectedData = useFetch<{ features: any[] }>(`/api/events/${eventId}/surfaces/expected`);
  const observedData = useFetch<{ features: any[] }>(`/api/events/${eventId}/surfaces/observed`);
  const silentZonesData = useFetch<{ items: SilentZoneFlag[]; screened_out?: { admin_unit_id: string; admin_unit_name: string; status: string; score: number; reason: string }[] }>(`/api/events/${eventId}/silent-zones`);
  const graphData = useFetch<KnowledgeGraph>(`/api/events/${eventId}/graph`);
  const findingData = useFetch<{ finding: FindingSummary }>(`/api/events/${eventId}/finding`);
  const ablationData = useFetch<AblationResult>(`/api/events/${eventId}/ablation`);
  const validationData = useFetch<NighttimeLightsResult & { reliability_diagram?: any[] }>(`/api/events/${eventId}/validation`);
  const patternsData = useFetch<{ items: CoOccurrencePattern[] }>(`/api/events/${eventId}/patterns`);
  const criticalNeedsData = useFetch<{ items: CriticalUnmetNeed[] }>(`/api/events/${eventId}/critical-needs`);
  const perUnitTimelineData = useFetch<{ timeline: TimelinePoint[]; silent_zone: any }>(
    drawerUnit ? `/api/events/${eventId}/per-unit-timeline?unit=${drawerUnit}` : null,
  );

  // Rebuild ExpectedNeedRow[] / ObservedSignalRow[] from GeoJSON feature props
  const expected: ExpectedNeedRow[] = (expectedData.data?.features ?? []).map((f: any) => ({
    admin_unit_id: f.properties.admin_unit_id,
    admin_unit_name: f.properties.admin_unit_name,
    expected_need: f.properties.expected_need,
    population_exposed: f.properties.population_exposed,
    hazard_intensity: f.properties.hazard_intensity,
    damage_ratio: f.properties.damage_ratio,
    vulnerability: f.properties.vulnerability,
    infrastructure: f.properties.infrastructure,
    exposure_percentile: f.properties.exposure_percentile,
  }));
  const observed: ObservedSignalRow[] = (observedData.data?.features ?? []).map((f: any) => ({
    admin_unit_id: f.properties.admin_unit_id,
    admin_unit_name: f.properties.admin_unit_name,
    observed_reporters: f.properties.observed_reporters,
    observed_posts: f.properties.observed_posts,
    baseline_source: f.properties.baseline_source,
    baseline_authors_per_day: f.properties.baseline_authors_per_day,
    expected_reporters_from_baseline: f.properties.expected_reporters_from_baseline,
    unlocated_post_share: f.properties.unlocated_post_share,
  }));

  const needUnits = needUnitsData.data?.items ?? [];
  const silentZones = silentZonesData.data?.items ?? [];
  const units = summary.data?.units ?? [];
  const event = summary.data?.event;
  const finding = findingData.data?.finding;
  const ablation = ablationData.data;
  const validation = validationData.data;
  const patterns = patternsData.data?.items ?? [];
  const criticalNeeds = criticalNeedsData.data?.items ?? [];

  const handleFeedback = async (unitId: string, confirmed: boolean) => {
    try {
      const r = await fetch(`/api/events/${eventId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unit_id: unitId, confirmed }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const { toast } = await import("sonner");
      toast.success(
        `Feedback recorded: ${confirmed ? "CONFIRMED" : "REFUTED"} silent zone ${unitId}`,
        {
          description: `Stored at ${new Date(data.ts).toISOString().slice(0, 19).replace("T", " ")} UTC — feeds live-precision tracking (PRD §10)`,
        },
      );
    } catch (e: any) {
      const { toast } = await import("sonner");
      toast.error("Failed to record feedback", { description: e?.message });
    }
  };

  const loading =
    summary.loading ||
    needUnitsData.loading ||
    expectedData.loading ||
    observedData.loading ||
    silentZonesData.loading ||
    graphData.loading;

  if (loading && !event) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <div className="text-sm text-muted-foreground">Running CrisisLens pipeline...</div>
          <div className="text-xs text-muted-foreground">
            ingest → classify → geoparse → dedupe → expected need → observed signal → baseline → silent zone detect
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm flex-shrink-0">CrisisLens</span>
            <span className="text-xs text-muted-foreground hidden md:inline">· advisory decision-support</span>
            {tab !== "prototype" && eventsList.data && eventsList.data.length > 0 && (
              <div className="ml-auto md:ml-4">
                <EventSelector
                  events={eventsList.data}
                  currentEventId={eventId}
                  onSelect={setEventId}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" asChild>
              <a href="/api/events" target="_blank" rel="noopener">
                <ExternalLink className="w-3 h-3 mr-1" /> API
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/api/health" target="_blank" rel="noopener">
                <LayoutDashboard className="w-3 h-3 mr-1" /> Health
              </a>
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col w-full gap-0">
        {/* Section navigation */}
        <nav className="sticky top-[45px] z-20 bg-background/95 backdrop-blur border-b" aria-label="Sections">
          <div className="max-w-7xl mx-auto px-4">
            <TabsList className="h-auto w-full flex-wrap justify-start items-center gap-x-1 gap-y-1 bg-transparent p-0 py-1.5 rounded-none">
              <NavGroup label="Situation" />
              <NavTab value="prototype" icon={MapIcon} label="Alappuzha prototype" />
              <NavTab value="overview" icon={LayoutDashboard} label="Overview" />
              <NavTab value="silent" icon={AlertTriangle} label="Silent Zones" count={tab === "prototype" ? undefined : silentZones.length} tone="bg-destructive text-destructive-foreground" />
              <NavTab value="critical" icon={Zap} label="No reports" count={criticalNeeds.length} tone="bg-red-700 text-white" />
              <NavTab value="ledger" icon={ClipboardList} label="Need ledger" />
              <NavTab value="patterns" icon={Network} label="Patterns" count={tab === "prototype" ? undefined : patterns.length} tone="bg-amber-500 text-white" />
              <NavGroup label="Explore" />
              <NavTab value="analyze" icon={Sparkles} label="Analyse posts" />
              <NavTab value="simulator" icon={SlidersHorizontal} label="What-if" />
              <NavGroup label="Evidence" />
              <NavTab value="ablation" icon={Beaker} label="Evaluation" />
              <NavTab value="validation" icon={Satellite} label="Outage evidence" />
              <NavTab value="research" icon={FlaskConical} label="Research" />
              <NavTab value="brief" icon={FileText} label="Brief" />
              <NavTab value="method" icon={BookOpen} label="Method" />
            </TabsList>
          </div>
        </nav>

        <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-5 space-y-5">
          {event && tab !== "prototype" && (
            <EventHeader
              event={event}
              districts={units.length}
              quietNotFlagged={silentZonesData.data?.screened_out?.length ?? 0}
              evaluation={summary.data?.evaluation ?? null}
            />
          )}

          <TabsContent value="prototype" className="mt-0">
            <AlappuzhaPrototype />
          </TabsContent>

          <TabsContent value="overview" className="mt-0">
            {event && (
              <OverviewDashboard
                eventId={eventId}
                event={event}
                units={units}
                expected={expected}
                observed={observed}
                needUnits={needUnits}
                silentZones={silentZones}
                screened={silentZonesData.data?.screened_out ?? []}
                finding={finding}
                needSummary={summary.data?.need_summary ?? []}
                onUnitClick={(id) => setDrawerUnit(id)}
                onNavigate={setTab}
              />
            )}
          </TabsContent>

          <TabsContent value="method" className="mt-0 space-y-5">
            {event && <OverviewHero event={event} />}
            {finding && <FindingBanner finding={finding} />}
          </TabsContent>

          <TabsContent value="ledger" className="mt-0">
            <NeedLedger needUnits={needUnits} onUnitClick={(id) => setDrawerUnit(id)} />
          </TabsContent>

          <TabsContent value="silent" className="mt-0">
            <div className="space-y-3">
              <Card className="p-3 bg-amber-50 border-amber-200">
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong>Advisory output.</strong> Silent Zone flags are candidates for
                  assessment, never assertions of damage. Sorted by score. A flag needs a significant shortfall in local voices, a damage ratio at or above the regional median, and independent outage evidence; evacuation and data gaps are screened out. Every score ships with its interval, evidence and confounder panel.
                </div>
              </Card>
              <SilentZoneList flags={silentZones} screened={silentZonesData.data?.screened_out ?? []} onConfirm={handleFeedback} />
            </div>
          </TabsContent>

          <TabsContent value="critical" className="mt-0">
            <CriticalNeedsView needs={criticalNeeds} />
          </TabsContent>

          <TabsContent value="patterns" className="mt-0">
            <PatternsView patterns={patterns} />
          </TabsContent>

          <TabsContent value="analyze" className="mt-0">
            <AnalyzeView eventId={eventId} />
          </TabsContent>

          <TabsContent value="simulator" className="mt-0">
            <SimulatorView key={eventId} eventId={eventId} />
          </TabsContent>

          <TabsContent value="research" className="mt-0">
            <ResearchView />
          </TabsContent>

          <TabsContent value="ablation" className="mt-0">
            {ablation && (
              <AblationView ablation={ablation} units={units} />
            )}
          </TabsContent>

          <TabsContent value="validation" className="mt-0">
            {validation && <ValidationView validation={validation} />}
          </TabsContent>

          <TabsContent value="brief" className="mt-0">
            {event && (
              <BriefView eventId={eventId} eventName={event.name} />
            )}
          </TabsContent>
        </div>
      </Tabs>

      <EvidenceDrawer
        open={!!drawerUnit}
        onClose={() => setDrawerUnit(null)}
        unitId={drawerUnit}
        units={units}
        expected={expected}
        observed={observed}
        needUnits={needUnits}
        silentZones={silentZones}
      />

      {/* Per-unit timeline panel — appears when a unit is selected */}
      {drawerUnit && event && perUnitTimelineData.data && (
        <div className="fixed bottom-4 left-4 z-40 max-w-[600px]">
          <PerUnitTimeline
            timeline={perUnitTimelineData.data.timeline}
            silentZone={silentZones.find((s) => s.admin_unit_id === drawerUnit)}
            impactUtc={event.impact_utc}
            unitName={units.find((u) => u.id === drawerUnit)?.name ?? drawerUnit}
          />
        </div>
      )}

      <footer className="border-t bg-muted/20 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>
            CrisisLens v2 · advisory decision-support · data: {tab === "prototype" ? "current village boundaries + synthetic scenario values" : "CrisisLens Evaluation Dataset v1.0 (simulated)"} · related work: Samuels et al. (2020), Alam et al. (2021), Román et al. (2019)
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span>Author IDs hashed (HMAC-SHA256)</span>
            <span>·</span>
            <span>Outage evidence used only as corroboration</span>
            <span>·</span>
            <span>Borders: geoBoundaries (India: ODbL)</span>
            <span>·</span>
            <span>Colorblind-safe palette</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function NavGroup({ label }: { label: string }) {
  return (
    <span className="pl-3 pr-1 first:pl-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 select-none whitespace-nowrap">
      {label}
    </span>
  );
}

function NavTab({
  value, icon: Icon, label, count, tone,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  tone?: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="flex-none text-xs px-2.5 py-1.5 rounded-md whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
    >
      <Icon className="w-3.5 h-3.5 mr-1.5" />
      {label}
      {count !== undefined && count > 0 && (
        <span className={`ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold ${tone ?? "bg-muted text-foreground"}`}>
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}
