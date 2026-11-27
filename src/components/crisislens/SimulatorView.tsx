"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, Check, X, RotateCcw, Eye } from "lucide-react";
import { decide, inputsOf, UNITS, THRESHOLDS, STATUS_LABEL, type DecisionInput } from "@/lib/crisislens/live";

interface Props {
  eventId: string;
}

const STATUS_STYLE: Record<string, string> = {
  silent_zone: "bg-red-700 text-white",
  explained_evacuation: "bg-amber-500 text-white",
  explained_data_gap: "bg-amber-500 text-white",
  uncorroborated: "bg-slate-500 text-white",
  not_flagged: "bg-emerald-600 text-white",
};

export function SimulatorView({ eventId }: Props) {
  const eventUnits = useMemo(() => UNITS.filter((u) => u.event_id === eventId), [eventId]);
  const [unitId, setUnitId] = useState(eventUnits[0]?.id ?? "");
  const unit = eventUnits.find((u) => u.id === unitId) ?? eventUnits[0];
  const [inp, setInp] = useState<DecisionInput | null>(unit ? inputsOf(unit) : null);
  const [showTruth, setShowTruth] = useState(false);

  // The parent remounts this view per event (key={eventId}); picking a
  // district loads that district's values from the dataset.
  const pickUnit = (id: string) => {
    const u = eventUnits.find((x) => x.id === id);
    if (!u) return;
    setUnitId(id);
    setInp(inputsOf(u));
    setShowTruth(false);
  };

  if (!unit || !inp) return null;
  const d = decide(inp);
  const original = decide(inputsOf(unit));
  const set = (patch: Partial<DecisionInput>) => setInp({ ...inp, ...patch });
  const maxVoices = Math.max(20, Math.ceil(Math.max(d.mu, unit.mu) * 1.6));
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const changed = JSON.stringify(inp) !== JSON.stringify(inputsOf(unit));

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary to-[#1a4060] text-primary-foreground p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-primary-foreground/70 font-semibold mb-1">
              What-if simulator
            </div>
            <div className="text-base md:text-lg font-semibold leading-snug">
              Pick a district, change what we know about it, and watch the decision change.
            </div>
            <div className="text-sm text-primary-foreground/80 mt-1">
              The sliders start at the district&apos;s values in the dataset. The rules are the ones the pipeline uses.
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Controls */}
        <Card className="p-4 lg:col-span-2 space-y-5">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1.5">District</div>
              <Select value={unit.id} onValueChange={pickUnit}>
                <SelectTrigger aria-label="District"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {eventUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}{u.flag ? " · flagged" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9" disabled={!changed} onClick={() => setInp(inputsOf(unit))}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
            </Button>
          </div>

          <Group title="Social signal">
            <Control label="Normal local voices per day" value={inp.baseline.toFixed(1)} hint="Measured over the 7 days before impact">
              <Slider aria-label="Normal local voices per day" min={0} max={Math.max(30, Math.ceil(unit.baseline * 2))} step={0.5} value={[inp.baseline]} onValueChange={([v]) => set({ baseline: v })} />
            </Control>
            <Control label="Local voices heard in 72 hours" value={String(inp.observed)} hint={`Expected: ${d.mu.toFixed(1)}`}>
              <Slider aria-label="Local voices heard in 72 hours" min={0} max={maxVoices} step={1} value={[inp.observed]} onValueChange={([v]) => set({ observed: v, needVoices: Math.min(inp.needVoices, v) })} />
            </Control>
            <Control label="Of those, local need reports" value={String(inp.needVoices)} hint="Zero triggers the zero-voice rule">
              <Slider aria-label="Local need reports" min={0} max={Math.max(1, inp.observed)} step={1} value={[inp.needVoices]} onValueChange={([v]) => set({ needVoices: v })} />
            </Control>
          </Group>

          <Group title="How hard it was hit">
            <Control label="Damage ratio" value={pct(inp.damageRatio)} hint={`Regional median: ${pct(inp.medianDamage)}`}>
              <Slider aria-label="Damage ratio" min={0} max={1} step={0.01} value={[inp.damageRatio]} onValueChange={([v]) => set({ damageRatio: v })} />
            </Control>
          </Group>

          <Group title="Other explanations and outside evidence">
            <Control label="Population evacuated" value={pct(inp.evacuatedShare)}>
              <Slider aria-label="Population evacuated" min={0} max={0.9} step={0.01} value={[inp.evacuatedShare]} onValueChange={([v]) => set({ evacuatedShare: v })} />
            </Control>
            <Control label="Night lights down" value={pct(inp.ntlDrop ?? 0)}>
              <Slider aria-label="Night lights down" min={0} max={1} step={0.01} value={[inp.ntlDrop ?? 0]} onValueChange={([v]) => set({ ntlDrop: v })} />
            </Control>
            <Control label="Cell sites down" value={pct(inp.cellSitesDown ?? 0)}>
              <Slider aria-label="Cell sites down" min={0} max={1} step={0.01} value={[inp.cellSitesDown ?? 0]} onValueChange={([v]) => set({ cellSitesDown: v })} />
            </Control>
            <div className="flex items-center justify-between">
              <label htmlFor="gap" className="text-sm">Hole in data collection</label>
              <Switch id="gap" checked={inp.dataGap} onCheckedChange={(v) => set({ dataGap: v })} />
            </div>
          </Group>
        </Card>

        {/* Outcome */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision for {unit.name}</div>
                <div className={`inline-block mt-1.5 px-3 py-1.5 rounded-md text-lg font-bold ${STATUS_STYLE[d.status]}`}>
                  {STATUS_LABEL[d.status]}
                </div>
              </div>
              {changed && (
                <div className="text-xs text-muted-foreground text-right">
                  With the dataset&apos;s values:
                  <div className="font-semibold text-foreground">{STATUS_LABEL[original.status]}</div>
                </div>
              )}
            </div>
            <p className="text-sm leading-relaxed mt-3">{d.explanation}</p>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <Metric label="Expected voices" value={d.mu.toFixed(1)} sub={`${inp.baseline.toFixed(1)}/day × 3 × ${inp.surge.toFixed(2)}`} />
              <Metric label="Below expected" value={pct(d.shortfall)} sub={`detectable from ${pct(d.minDetectableDrop)}`} />
              <Metric label="Residual" value={d.residual.toFixed(2)} sub={`flag above ${THRESHOLDS.resid}`} />
            </div>

            <div className="mt-4 space-y-2">
              <Bar label="Expected" value={d.mu} max={Math.max(d.mu, inp.observed, 1)} color="#0f2c4e" />
              <Bar label="Heard" value={inp.observed} max={Math.max(d.mu, inp.observed, 1)} color={d.status === "silent_zone" ? "#b91c1c" : "#0097a7"} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Step by step</div>
            <div className="space-y-1.5">
              <Rule ok={d.gate} title="Badly hit" detail={`Damage ${pct(inp.damageRatio)} ${d.gate ? "≥" : "<"} regional median ${pct(inp.medianDamage)}`} />
              <Rule ok={d.A} title="Rule A — too quiet to be chance" detail={`Residual ${d.residual.toFixed(2)} ${d.A ? ">" : "≤"} ${THRESHOLDS.resid}`} />
              <Rule ok={d.B} title="Rule B — large drop" detail={`${pct(d.shortfall)} below expected (needs more than ${pct(THRESHOLDS.drop)} and at least ${THRESHOLDS.min_mu_b} expected voices)`} />
              <Rule ok={d.Z} title="Rule Z — no local need reports" detail={`${inp.needVoices} need reports (needs zero and at least ${THRESHOLDS.min_mu_z} expected voices)`} />
              <Rule ok={d.F} title="Rule F — outage evidence + shortfall" detail={`Evidence ${d.corroborated ? "present" : "absent"}, residual ${d.residual.toFixed(2)} (needs more than ${THRESHOLDS.fusion})`} />
              <div className="border-t my-2" />
              <Rule ok={!d.evacuationExplains} neutral={!d.raised} title="Not explained by evacuation" detail={`${pct(inp.evacuatedShare)} evacuated${d.evacuationExplains ? ": enough to explain the quiet" : ""}`} />
              <Rule ok={!inp.dataGap} neutral={!d.raised} title="Not a data-collection gap" detail={inp.dataGap ? "Outsiders' posts vanish too" : "Outsiders keep posting about the district"} />
              <Rule ok={d.corroborated} neutral={!d.raised} title="Outage evidence" detail={`Night lights down ${pct(inp.ntlDrop ?? 0)}, cell sites down ${pct(inp.cellSitesDown ?? 0)} (needs ${pct(THRESHOLDS.corr)} on either)`} />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="font-semibold">Answer key</span>
              <span className="text-muted-foreground"> · the dataset&apos;s ground truth, which the pipeline never reads</span>
              {showTruth && (
                <div className="mt-1.5">
                  <Badge variant={unit.truth_silent ? "destructive" : "secondary"}>
                    {unit.truth_silent ? "Truly a Silent Zone" : "Not a Silent Zone"}
                  </Badge>
                  <span className="text-muted-foreground ml-2">{unit.truth_reason}</span>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowTruth(!showTruth)}>
              <Eye className="w-3.5 h-3.5 mr-1" /> {showTruth ? "Hide" : "Reveal"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Control({ label, value, hint, children }: { label: string; value: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-sm font-semibold">{value}</span>
      </div>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right font-mono">{Number.isInteger(value) ? value : value.toFixed(1)}</span>
    </div>
  );
}

function Rule({ ok, neutral, title, detail }: { ok: boolean; neutral?: boolean; title: string; detail: string }) {
  return (
    <div className={`flex items-start gap-2 text-sm ${neutral ? "opacity-50" : ""}`}>
      <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? "bg-emerald-600" : "bg-slate-300"}`}>
        {ok ? <Check className="w-3 h-3 text-white" /> : <X className="w-3 h-3 text-white" />}
      </span>
      <div>
        <span className="font-semibold">{title}</span>
        <span className="text-muted-foreground"> · {detail}</span>
      </div>
    </div>
  );
}
