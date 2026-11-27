"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Database, ExternalLink, Info, MapPinned, Satellite, Signal, Waves } from "lucide-react";
import scenario from "@/lib/crisislens/data/alappuzha-prototype.json";

type Village = (typeof scenario.villages)[number];
type Layer = "impactIndex" | "activityRatio" | "quietnessScore";

const TALUKS = ["All taluks", "Cherthala", "Ambalappuzha", "Kuttanad", "Karthikappally", "Chengannur", "Mavelikkara"];
const LAYERS: { id: Layer; label: string }[] = [
  { id: "impactIndex", label: "Modeled impact" },
  { id: "activityRatio", label: "Online signal" },
  { id: "quietnessScore", label: "Candidate gap" },
];

function colorFor(v: Village, layer: Layer) {
  if (layer === "impactIndex") {
    const x = v.impactIndex;
    return x >= 78 ? "#9f1239" : x >= 65 ? "#e11d48" : x >= 52 ? "#fb7185" : "#fecdd3";
  }
  if (layer === "activityRatio") {
    const x = v.activityRatio;
    return x < 0.45 ? "#9f1239" : x < 0.7 ? "#f97316" : x < 0.95 ? "#fbbf24" : "#14b8a6";
  }
  return v.candidate ? "#b91c1c" : v.quietnessScore >= 20 ? "#fb923c" : "#e2e8f0";
}

export function AlappuzhaPrototype() {
  const [layer, setLayer] = useState<Layer>("quietnessScore");
  const [taluk, setTaluk] = useState("All taluks");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => scenario.villages.filter((v) => taluk === "All taluks" || v.taluk === taluk),
    [taluk],
  );
  const selected = filtered.find((v) => v.zoneId === selectedId) ?? filtered[0];
  const ranked = [...filtered].filter((v) => v.candidate).sort((a, b) => b.quietnessScore - a.quietnessScore);
  const candidates = scenario.villages.filter((v) => v.candidate).length;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl bg-[#0b2340] text-white shadow-lg">
        <div className="absolute inset-0 opacity-20" aria-hidden="true">
          <div className="absolute -right-10 -top-32 h-96 w-96 rounded-full border border-cyan-300/50" />
          <div className="absolute -right-2 -top-24 h-80 w-80 rounded-full border border-cyan-300/40" />
          <div className="absolute -right-[-1rem] -top-16 h-64 w-64 rounded-full border border-cyan-300/30" />
        </div>
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-100">CrisisLens · Research prototype</span>
              <span className="rounded-full bg-amber-300 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-950">Simulated scenario</span>
            </div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">Finding places the signal may miss</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 md:text-base">
              A village-level demonstration for the 2018 Kerala floods in Alappuzha: compare modeled impact with local online activity, then surface places that deserve a closer field check.
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wider text-slate-300">Study area</div>
            <div className="mt-1 font-semibold">Alappuzha district · Kerala, India</div>
            <div className="mt-1 text-xs text-slate-300">Event window illustrated: August 2018</div>
          </div>
        </div>
      </section>

      <section className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm" role="note">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <div className="text-sm font-bold">Geography is sourced; scenario metrics are simulated.</div>
          <p className="mt-1 text-xs leading-5 md:text-sm">Village shapes come from Survey of India boundaries and the district roster. Every village impact score, post and author count, baseline, and candidate flag on this screen is synthetic for demonstration. It is not an observed research finding.</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={MapPinned} label="Village polygons" value="93" note="Current official roster" accent="text-blue-700 bg-blue-50" />
        <Metric icon={Waves} label="Taluks covered" value="6" note="Whole district" accent="text-cyan-700 bg-cyan-50" />
        <Metric icon={Satellite} label="Satellite context" value="272 km²" note="District total · 21 Aug 2018" accent="text-violet-700 bg-violet-50" />
        <Metric icon={AlertTriangle} label="Scenario candidates" value={String(candidates)} note="Synthetic flags · verify in field" accent="text-rose-700 bg-rose-50" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Alappuzha village signal map</div>
              <div className="mt-0.5 text-xs text-slate-500">Select a village · actual boundaries · simulated indicators</div>
            </div>
            <select aria-label="Filter by taluk" className="h-9 rounded-md border bg-white px-3 text-xs text-slate-800" value={taluk} onChange={(e) => { setTaluk(e.target.value); setSelectedId(null); }}>
              {TALUKS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {LAYERS.map((l) => (
              <button key={l.id} onClick={() => setLayer(l.id)} className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${layer === l.id ? "border-[#0b2340] bg-[#0b2340] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                {l.label}
              </button>
            ))}
          </div>
          <div className="relative mx-auto max-h-[660px] w-full max-w-[690px] p-2">
            <svg viewBox={scenario.meta.viewBox} className="h-[560px] w-full" role="group" aria-roledescription="interactive map" aria-label="Alappuzha's 93 village boundaries colored by simulated candidate score">
              <defs><pattern id="alp-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e7eef3" strokeWidth=".7" /></pattern></defs>
              <rect width="800" height="860" fill="url(#alp-grid)" />
              {filtered.map((v) => (
                <path key={v.zoneId} d={v.path} fill={colorFor(v, layer)} fillOpacity={selected?.zoneId === v.zoneId ? 1 : 0.83} stroke={selected?.zoneId === v.zoneId ? "#082f49" : "#ffffff"} strokeWidth={selected?.zoneId === v.zoneId ? 2.2 : 1.15} className="cursor-pointer transition-opacity hover:opacity-100 focus-visible:outline-none" role="button" tabIndex={0} aria-label={`Select ${v.name}, ${v.taluk} taluk`} onClick={() => setSelectedId(v.zoneId)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedId(v.zoneId); }}>
                  <title>{v.name} · {v.taluk} · {layer === "impactIndex" ? `modeled impact ${v.impactIndex}/100` : layer === "activityRatio" ? `${Math.round(v.activityRatio * 100)}% simulated activity` : `scenario score ${v.quietnessScore}/100`}</title>
                </path>
              ))}
            </svg>
            <div className="absolute bottom-5 left-5 rounded-lg border bg-white/95 p-3 text-xs shadow-sm">
              <div className="mb-2 font-semibold text-slate-800">{LAYERS.find((l) => l.id === layer)?.label}</div>
              <Legend layer={layer} />
            </div>
            <div className="absolute right-5 top-5 rounded-md border border-amber-300 bg-amber-50/95 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">Scenario view · simulated</div>
          </div>
          <div className="border-t bg-slate-50 px-4 py-2 text-[11px] text-slate-500">Boundary effective year unavailable; 2018 boundary match is not yet verified. Source: <a className="underline" href="https://surveyofindia.gov.in/pages/village-boundary-data-base-of-entire-india" target="_blank" rel="noreferrer">Survey of India</a>.</div>
        </div>

        <div className="space-y-4">
          {selected && <VillageDetail village={selected} />}
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div><div className="text-sm font-semibold">Illustrative verification queue</div><div className="mt-0.5 text-xs text-slate-500">High modeled impact + simulated voices at ≤40% of expectation</div></div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">{ranked.length} candidates</span>
            </div>
            <div className="divide-y">
              {ranked.slice(0, 6).map((v, i) => (
                <button key={v.zoneId} onClick={() => setSelectedId(v.zoneId)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{i + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{v.name}</span><span className="text-[11px] text-slate-500">{v.taluk} taluk · simulated scenario</span></span>
                  <span className="text-right"><span className="block text-sm font-bold tabular-nums text-rose-700">{v.quietnessScore}</span><span className="text-[10px] uppercase text-slate-400">score</span></span>
                </button>
              ))}
            </div>
            <div className="border-t bg-slate-50 px-4 py-2 text-[11px] leading-4 text-slate-500">These are demo outputs used to show the review workflow. The list must not be interpreted as confirmed under-reporting.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">How the comparison works</h2><p className="mt-1 text-xs text-slate-500">The prototype flow; values shown above are simulated.</p></div><Signal className="h-5 w-5 text-cyan-700" /></div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Step number="01" title="Estimate need" body="Use impact evidence to estimate where need may be high." />
            <Step number="02" title="Measure voices" body="Count distinct, location-supported reports against a local baseline." />
            <Step number="03" title="Check bias, review" body="Account for connectivity and location coverage, then verify candidate gaps with people on the ground." />
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong>Interpretation:</strong> a low online signal is not proof of unmet need. Evacuation, weak connectivity, language, platform coverage, and location uncertainty can all affect the signal.</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold text-slate-900">Evidence status</h2><p className="mt-1 text-xs text-slate-500">What is sourced and what the next study needs</p></div><Database className="h-5 w-5 text-blue-700" /></div>
          <div className="mt-4 space-y-3">
            <EvidenceRow status="Sourced" title="Village geography" detail="93 current village polygons; 2018 concordance pending" href="https://surveyofindia.gov.in/pages/village-boundary-data-base-of-entire-india" />
            <EvidenceRow status="Sourced" title="Flood context" detail="Official district report; narrative place evidence" href="https://alappuzha.nic.in/en/document/flood-report-2018/" />
            <EvidenceRow status="Sourced" title="Satellite context" detail="272 km² district estimate on 21 Aug 2018; not village allocated" href="https://www.iirs.gov.in/iirs/sites/default/files/upload/document/Kerala_Flood_Sep18a.pdf" />
            <EvidenceRow status="Needed" title="Observed local signal" detail="Geolocated posts and a comparable pre-event baseline" />
            <EvidenceRow status="Needed" title="Village impact validation" detail="Impact observations at matching village or GP geography" />
          </div>
        </div>
      </section>
      <section className="rounded-xl border bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">Digital inequality and signal coverage</h2><p className="mt-1 text-xs text-slate-500">A bias check the study would use to interpret low online activity.</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-900">Synthetic access proxy</span></div>
        <CoverageLens />
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">Connectivity and location-confidence values are simulated placeholders. The real study must replace them with sourced measures where available and report missing coverage explicitly; low online activity alone is not evidence of silence.</p>
      </section>
      <section className="rounded-xl border bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-slate-900">Baseline-adjusted activity · district-wide illustration</h2><p className="mt-1 text-xs text-slate-500">A sample of the before/event comparison the research would run after observed data are collected.</p></div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-900">Synthetic series</span>
        </div>
        <TrendChart />
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-600">
          <span><strong className="text-slate-800">Pre-event average:</strong> {scenario.meta.simulatedBaselineMeanAuthorsPerDay} simulated local authors/day</span>
          <span><strong className="text-slate-800">Modeled expectation:</strong> {scenario.meta.simulatedExpectedMeanAuthorsPerDay}/day in the event window</span>
          <span><strong className="text-slate-800">Scenario signal:</strong> {scenario.meta.simulatedObservedMeanAuthorsPerDay}/day</span>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-600">
        <span>Prototype build · real village outlines · simulated analytical values · no individual-level data</span>
        <span className="inline-flex gap-3"><a className="inline-flex items-center gap-1 underline" href="https://alappuzha.nic.in/en/villages/" target="_blank" rel="noreferrer">District village roster <ExternalLink className="h-3 w-3" /></a><a className="inline-flex items-center gap-1 underline" href="https://alappuzha.nic.in/en/document/flood-report-2018/" target="_blank" rel="noreferrer">Flood report <ExternalLink className="h-3 w-3" /></a></span>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note, accent }: { icon: typeof Activity; label: string; value: string; note: string; accent: string }) {
  return <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{label}</span><span className={`rounded-lg p-2 ${accent}`}><Icon className="h-4 w-4" /></span></div><div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</div><div className="mt-1 text-[11px] text-slate-500">{note}</div></div>;
}

function Legend({ layer }: { layer: Layer }) {
  const items = layer === "impactIndex"
    ? [["#9f1239", "Very high"], ["#e11d48", "High"], ["#fb7185", "Moderate"], ["#fecdd3", "Lower"]]
    : layer === "activityRatio"
      ? [["#9f1239", "<45%"], ["#f97316", "45–69%"], ["#fbbf24", "70–94%"], ["#14b8a6", "≥95%"]]
      : [["#b91c1c", "Candidate"], ["#fb923c", "Some gap"], ["#e2e8f0", "Lower gap"]];
  return <div className="space-y-1.5">{items.map(([color, label]) => <div key={label} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} /><span>{label}</span></div>)}</div>;
}

function VillageDetail({ village: v }: { village: Village }) {
  return <div className="rounded-xl border bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Selected revenue village</div><h2 className="mt-1 text-lg font-bold text-slate-900">{v.name}</h2><div className="text-xs text-slate-500">{v.taluk} taluk · {v.areaKm2} km²</div></div><MapPinned className="h-5 w-5 text-blue-700" /></div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <DetailMetric label="Modeled impact" value={`${v.impactIndex}/100`} />
      <DetailMetric label="Gap score" value={`${v.quietnessScore}/100`} tone="text-rose-700" />
      <DetailMetric label="Expected voices" value={String(v.expectedAuthors)} />
      <DetailMetric label="Simulated voices" value={String(v.observedAuthors)} tone="text-cyan-800" />
      <DetailMetric label="Digital access proxy" value={`${v.digitalAccessIndex}/100`} tone="text-violet-700" />
      <DetailMetric label="Location confidence proxy" value={`${Math.round(v.locationConfidence * 100)}%`} tone="text-blue-700" />
    </div>
    <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs"><div className="flex items-center justify-between"><span className="text-slate-600">Simulated pre-event baseline</span><span className="font-semibold tabular-nums text-slate-800">{v.baselineAuthorsPerDay}/day</span></div><div className="flex items-center justify-between"><span className="text-slate-600">2011 Census population</span><span className="font-semibold tabular-nums text-slate-800">{v.population2011?.toLocaleString("en-IN") ?? "Unavailable"}</span></div></div>
    <div className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-amber-900"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>All impact and online-activity values here are synthetic. Census value, when present, is historical 2011 context only.</span></div>
  </div>;
}

function DetailMetric({ label, value, tone = "text-slate-900" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div><div className={`mt-0.5 text-base font-bold tabular-nums ${tone}`}>{value}</div></div>;
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return <div className="rounded-lg border p-3"><div className="text-[10px] font-bold tracking-wider text-cyan-700">{number}</div><div className="mt-1 text-xs font-semibold text-slate-900">{title}</div><p className="mt-1 text-[11px] leading-4 text-slate-500">{body}</p></div>;
}

function EvidenceRow({ status, title, detail, href }: { status: "Sourced" | "Needed"; title: string; detail: string; href?: string }) {
  const sourced = status === "Sourced";
  return <div className="flex gap-3"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${sourced ? "bg-emerald-500" : "bg-amber-500"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-800">{title}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${sourced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{status}</span></div><div className="mt-0.5 text-[11px] text-slate-500">{detail}{href && <> · <a className="underline" href={href} target="_blank" rel="noreferrer">source</a></>}</div></div></div>;
}

function TrendChart() {
  const points = scenario.timeline;
  const width = 760, height = 220, left = 42, right = 14, top = 12, bottom = 34;
  const maxValue = Math.ceil(Math.max(...points.flatMap((p) => [p.expected, p.observed])) / 10) * 10;
  const x = (i: number) => left + i * (width - left - right) / (points.length - 1);
  const y = (value: number) => top + (maxValue - value) * (height - top - bottom) / maxValue;
  const expectedLine = points.map((p, i) => `${x(i)},${y(p.expected)}`).join(" ");
  const observedLine = points.map((p, i) => `${x(i)},${y(p.observed)}`).join(" ");
  const eventX = x(14) - (x(1) - x(0)) / 2;
  return <div className="mt-3 overflow-x-auto">
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] min-w-[620px] w-full" role="img" aria-label="Synthetic illustration comparing expected and observed local authors before and during a flood event">
      <rect x={eventX} y={top} width={width - right - eventX} height={height - top - bottom} fill="#fff7ed" />
      {[0, 0.33, 0.66, 1].map((ratio) => {
        const value = Math.round(maxValue * ratio), yy = y(value);
        return <g key={ratio}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#e2e8f0" strokeDasharray="3 4" /><text x={left - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="#64748b">{value}</text></g>;
      })}
      <line x1={eventX} x2={eventX} y1={top} y2={height - bottom} stroke="#f59e0b" strokeDasharray="4 4" />
      <text x={(eventX + width - right) / 2} y={top + 13} textAnchor="middle" fontSize="10" fontWeight="600" fill="#9a3412">Illustrative event window</text>
      <polyline fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={expectedLine} />
      <polyline fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={observedLine} />
      {points.map((p, i) => <g key={p.day}><circle cx={x(i)} cy={y(p.expected)} r="2.8" fill="#0f766e"><title>{p.day}: expected {p.expected}</title></circle><circle cx={x(i)} cy={y(p.observed)} r="2.8" fill="#e11d48"><title>{p.day}: simulated observed {p.observed}</title></circle>{i % 2 === 0 && <text x={x(i)} y={height - 12} textAnchor="middle" fontSize="9" fill="#64748b">{p.day}</text>}</g>)}
    </svg>
    <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-600"><span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-teal-700" />Expected local voices (modeled)</span><span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-rose-600" />Simulated observed voices</span><span className="ml-auto text-slate-400">Relative day · illustrative window</span></div>
  </div>;
}

function CoverageLens() {
  const bands = [
    { label: "Lower access · <45", min: 0, max: 44, color: "#b91c1c" },
    { label: "Limited · 45–59", min: 45, max: 59, color: "#ea580c" },
    { label: "Moderate · 60–74", min: 60, max: 74, color: "#d97706" },
    { label: "Higher · 75+", min: 75, max: 100, color: "#0f766e" },
  ].map((band) => {
    const villages = scenario.villages.filter((v) => v.digitalAccessIndex >= band.min && v.digitalAccessIndex <= band.max);
    return { ...band, count: villages.length, candidates: villages.filter((v) => v.candidate).length };
  });
  const lowerAccess = bands.slice(0, 2);
  return <div className="mt-4 grid gap-5 md:grid-cols-[1.2fr_1fr]">
    <div className="space-y-3">{bands.map((band) => <div key={band.label} className="grid grid-cols-[130px_1fr_58px] items-center gap-3"><div className="text-[11px] text-slate-600">{band.label}</div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(3, band.count / scenario.villages.length * 100)}%`, backgroundColor: band.color }} /></div><div className="text-right text-[11px] tabular-nums text-slate-500">{band.count} zones</div></div>)}</div>
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">Scenarios with lower access</div><div className="mt-1 text-xl font-bold text-slate-900">{lowerAccess.reduce((n, b) => n + b.count, 0)}</div><div className="text-[10px] text-slate-500">of 93 village scenarios</div></div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">Candidates in those bands</div><div className="mt-1 text-xl font-bold text-rose-700">{lowerAccess.reduce((n, b) => n + b.candidates, 0)}</div><div className="text-[10px] text-slate-500">synthetic workflow output</div></div>
    </div>
  </div>;
}
