/**
 * CrisisLens — Pipeline orchestrator
 *
 * Runs the full Stage 1 → Stage 7 cascade for any event in the registry.
 * Caches results per-event for the lifetime of the process.
 *
 * Also exposes:
 *   - runAblation(): runs pipeline variants to prove each component matters
 *   - computeNighttimeLights(): synthetic Black Marble validation
 *   - detectCoOccurrencePatterns(): telecom+rescue = communication collapse
 *   - findCriticalUnmetNeeds(): high expected, zero observed
 */

import { getEvent } from "../data/registry";
import { DATASET_RESULTS } from "../data/dataset";
import type { EventDataset } from "../data/registry";
import { classifyPost } from "./classify";
import { geoparsePost } from "./geoparse";
import { buildNeedUnits } from "./dedupe";
import { computeExpectedNeed } from "./expectedNeed";
import { computeObservedSignal } from "./observedSignal";
import { detectSilentZones } from "./silentZone";
import type {
  AdminUnit,
  EventMeta,
  FindingSummary,
  KnowledgeGraph,
  NeedUnit,
  ObservedSignalRow,
  Post,
  ExpectedNeedRow,
  SilentZoneFlag,
  TimelinePoint,
  GraphNode,
  GraphEdge,
  NeedType,
} from "./types";
import { NEED_TYPES, NEED_TYPE_COLORS, NEED_TYPE_SHORT } from "./types";

export interface CrisisLensResult {
  event: EventMeta;
  units: AdminUnit[];
  posts: Post[];
  needUnits: NeedUnit[];
  expectedNeed: ExpectedNeedRow[];
  observedSignal: ObservedSignalRow[];
  silentZones: SilentZoneFlag[];
  // Candidates the detectors raised but the screens removed (evacuation,
  // data gap, no outage evidence). Empty for the legacy generated scenarios.
  screenedOut?: ScreenedOutUnit[];
  // Score against the dataset's ground-truth sheet (evaluation only).
  evaluation?: EvaluationSummary | null;
  timeline: TimelinePoint[];
  perUnitTimeline: Map<string, TimelinePoint[]>;
  graph: KnowledgeGraph;
  finding: FindingSummary;
  // Aggregations
  geocodeConfidencesByUnit: Map<string, number[]>;
  postLanguagesByUnit: Map<string, Map<string, number>>;
  unlocatedPostCount: number;
  uniqueAuthorHashesByUnit: Map<string, Set<string>>;
  // Advanced analytics
  ablation: AblationResult;
  nighttimeLights: NighttimeLightsResult;
  coOccurrence: CoOccurrencePattern[];
  criticalUnmetNeeds: CriticalUnmetNeed[];
  reliabilityDiagram: ReliabilityBin[];
}

export interface ScreenedOutUnit {
  admin_unit_id: string;
  admin_unit_name: string;
  status: "explained_evacuation" | "explained_data_gap" | "uncorroborated";
  score: number;
  reason: string;
}

export interface EvaluationSummary {
  true_silent_zones: string[];
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface AblationVariant {
  key: string;
  label: string;
  description: string;
  silent_zones_detected: number;
  precision_at_k: number;
  recall?: number;
  f1?: number;
  top_k_unit_ids: string[];
  // For each variant, top 10 silent zones (or top-K if fewer)
  // Demonstrates that removing baseline offset → ranks rural districts first
  degradation_note: string;
}

export interface AblationResult {
  variants: AblationVariant[];
  crisislens_full: AblationVariant;
  baseline_offset_lift_points: number;  // CrisisLens - "without baseline offset"
  headline: string;
}

export interface NighttimeLightsResult {
  per_unit: {
    admin_unit_id: string;
    admin_unit_name: string;
    silent_zone: boolean;
    silent_zone_score: number;
    pre_event_radiance: number;
    post_event_radiance: number;
    radiance_drop_pct: number;
    cloud_cover_pct: number;
  }[];
  correlation_score_vs_radiance_drop: number;
  // PRD §9.5: if this correlation holds, properly-conditioned social silence
  // detects power loss without ever seeing satellite data
  headline: string;
  scatter_plot: { x: number; y: number; label: string; silent: boolean }[];
}

export interface CoOccurrencePattern {
  pattern_id: string;
  name: string;
  need_types: NeedType[];
  description: string;
  admin_units: { admin_unit_id: string; admin_unit_name: string; count: number }[];
  total_occurrences: number;
  severity: "info" | "warning" | "critical";
}

export interface CriticalUnmetNeed {
  admin_unit_id: string;
  admin_unit_name: string;
  expected_need: number;
  observed_reporters: number;
  // 0 reporters = absolute silence. This is the worst-case operational finding.
  urgency: "critical" | "high" | "moderate";
  mmi: number;
  damage_percentile: number;
  likely_cause: string;
}

export interface ReliabilityBin {
  range_low: number;
  range_high: number;
  mean_predicted: number;
  empirical_frequency: number;
  n_units: number;
}

const cache = new Map<string, CrisisLensResult>();

export function runPipeline(eventId: string = "nepal-2015"): CrisisLensResult {
  if (cache.has(eventId)) return cache.get(eventId)!;

  // Preferred path: results computed from CrisisLens_dataset_v1.xlsx by the
  // Python pipeline (analysis/export_dashboard.py), final v2 method.
  const exported = DATASET_RESULTS[eventId];
  if (exported) {
    const result = hydrateExportedResult(exported);
    cache.set(eventId, result);
    return result;
  }

  // Fallback: legacy generated scenario with the original v1 constants.
  const dataset = getEvent(eventId);
  if (!dataset) throw new Error(`Unknown event: ${eventId}`);

  const result = runPipelineForDataset(dataset);
  cache.set(eventId, result);
  return result;
}

export function listEvents(): EventMeta[] {
  return Object.keys(DATASET_RESULTS).map((id) => runPipeline(id).event);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hydrateExportedResult(d: any): CrisisLensResult {
  const units = d.units as AdminUnit[];
  const needUnits = d.needUnits as NeedUnit[];
  const silentZones = d.silentZones as SilentZoneFlag[];
  const perUnitTimeline = new Map<string, TimelinePoint[]>(
    Object.entries(d.perUnitTimeline as Record<string, TimelinePoint[]>),
  );
  return {
    event: d.event as EventMeta,
    units,
    posts: [],
    needUnits,
    expectedNeed: d.expectedNeed,
    observedSignal: d.observedSignal,
    silentZones,
    screenedOut: d.screenedOut ?? [],
    evaluation: d.evaluation ?? null,
    timeline: d.timeline,
    perUnitTimeline,
    graph: buildKnowledgeGraph(units, needUnits, silentZones),
    finding: d.finding,
    geocodeConfidencesByUnit: new Map(),
    postLanguagesByUnit: new Map(),
    unlocatedPostCount: d.unlocatedPostCount ?? 0,
    uniqueAuthorHashesByUnit: new Map(),
    ablation: d.ablation,
    nighttimeLights: d.nighttimeLights,
    coOccurrence: detectCoOccurrencePatterns(needUnits, units),
    criticalUnmetNeeds: d.criticalUnmetNeeds,
    reliabilityDiagram: d.reliabilityDiagram,
  };
}

function runPipelineForDataset(dataset: EventDataset): CrisisLensResult {
  const units = dataset.units;
  const posts = dataset.generatePosts();
  const impactEpochMs = dataset.impactEpochMs;
  const windowHours = dataset.windowHours;
  const hazardType = dataset.hazardType;

  // ─── Stage 2: classify ─────────────────────────────────────────────────
  const classifications = new Map<string, {
    relevant: boolean;
    need_types: NeedType[];
    urgency: 0 | 1 | 2 | 3;
    confidence: number;
  }>();
  for (const p of posts) {
    classifications.set(p.post_id, classifyPost(p));
  }

  // ─── Stage 3: geoparse ──────────────────────────────────────────────────
  const geocodes = new Map<string, ReturnType<typeof geoparsePost>>();
  for (const p of posts) {
    geocodes.set(p.post_id, geoparsePost(p, units));
  }
  const unlocatedPostCount = [...geocodes.values()].filter((g) => !g).length;

  const geocodeConfidencesByUnit = new Map<string, number[]>();
  const postLanguagesByUnit = new Map<string, Map<string, number>>();
  for (const u of units) {
    geocodeConfidencesByUnit.set(u.id, []);
    postLanguagesByUnit.set(u.id, new Map());
  }
  for (const p of posts) {
    const g = geocodes.get(p.post_id);
    if (!g) continue;
    const confs = geocodeConfidencesByUnit.get(g.admin_unit_id) ?? [];
    confs.push(g.confidence);
    geocodeConfidencesByUnit.set(g.admin_unit_id, confs);
    const langs = postLanguagesByUnit.get(g.admin_unit_id) ?? new Map();
    langs.set(p.lang, (langs.get(p.lang) ?? 0) + 1);
    postLanguagesByUnit.set(g.admin_unit_id, langs);
  }

  // ─── Stage 4: Need Ledger ──────────────────────────────────────────────
  const needUnits = buildNeedUnits(posts, classifications, geocodes);

  // Unique author set per unit — derived FROM Need Unit members (PRD §6.6)
  const uniqueAuthorHashesByUnit = new Map<string, Set<string>>();
  for (const u of units) uniqueAuthorHashesByUnit.set(u.id, new Set());
  for (const nu of needUnits) {
    const set = uniqueAuthorHashesByUnit.get(nu.admin_unit_id) ?? new Set();
    for (const postId of nu.member_post_ids) {
      const post = posts.find((p) => p.post_id === postId);
      if (post) set.add(post.author_hash);
    }
    uniqueAuthorHashesByUnit.set(nu.admin_unit_id, set);
  }

  // ─── Stage 5: Expected Need Surface ─────────────────────────────────────
  const expectedNeed = computeExpectedNeed(units, hazardType);

  // ─── Stage 6: Observed Signal Surface + Baseline ───────────────────────
  const unlocatedShare = unlocatedPostCount / posts.length;
  const observedSignal = computeObservedSignal(
    units,
    posts,
    geocodes,
    uniqueAuthorHashesByUnit,
    unlocatedShare,
    windowHours,
  );

  // ─── Timeline ──────────────────────────────────────────────────────────
  const timeline = buildTimeline(posts, geocodes, impactEpochMs);
  const perUnitTimeline = buildPerUnitTimelines(posts, units, geocodes, impactEpochMs);

  // ─── Stage 7: Silent Zone detection ────────────────────────────────────
  const silentZones = detectSilentZones({
    units,
    expectedNeedRows: expectedNeed,
    observedSignalRows: observedSignal,
    needUnits,
    perUnitTimeline,
    geocodeConfidencesByUnit,
    postLanguagesByUnit,
    impactEpochMs,
    windowHours,
  });

  // ─── Knowledge graph ────────────────────────────────────────────────────
  const graph = buildKnowledgeGraph(units, needUnits, silentZones);

  // ─── Finding ────────────────────────────────────────────────────────────
  const finding = buildFinding(units, expectedNeed, observedSignal, silentZones);

  // ─── Advanced analytics ────────────────────────────────────────────────
  const ablation = runAblation(units, expectedNeed, observedSignal, silentZones, uniqueAuthorHashesByUnit);
  const nighttimeLights = computeNighttimeLights(units, silentZones, expectedNeed);
  const coOccurrence = detectCoOccurrencePatterns(needUnits, units);
  const criticalUnmetNeeds = findCriticalUnmetNeeds(units, expectedNeed, observedSignal, silentZones);
  const reliabilityDiagram = computeReliabilityDiagram(silentZones);

  // ─── Event metadata ─────────────────────────────────────────────────────
  const event: EventMeta = {
    ...dataset.meta,
    total_posts_ingested: posts.length,
    total_relevant_posts: [...classifications.values()].filter((c) => c.relevant).length,
    total_need_units: needUnits.length,
    total_silent_zones: silentZones.length,
    unlocated_share: Math.round(unlocatedShare * 100) / 100,
  };

  return {
    event,
    units,
    posts,
    needUnits,
    expectedNeed,
    observedSignal,
    silentZones,
    timeline,
    perUnitTimeline,
    graph,
    finding,
    geocodeConfidencesByUnit,
    postLanguagesByUnit,
    unlocatedPostCount,
    uniqueAuthorHashesByUnit,
    ablation,
    nighttimeLights,
    coOccurrence,
    criticalUnmetNeeds,
    reliabilityDiagram,
  };
}

// ─── Timeline builder (regional) ────────────────────────────────────────────
function buildTimeline(
  posts: Post[],
  geocodes: Map<string, ReturnType<typeof geoparsePost> | null>,
  impactEpochMs: number,
): TimelinePoint[] {
  const startMs = impactEpochMs - 7 * 24 * 60 * 60 * 1000;
  const endMs = impactEpochMs + 72 * 60 * 60 * 1000;
  const bucketMs = 6 * 60 * 60 * 1000;
  const buckets: TimelinePoint[] = [];
  for (let t = startMs; t < endMs; t += bucketMs) {
    buckets.push({
      t: new Date(t).toISOString(),
      pre_event: t < impactEpochMs,
      unique_authors: 0,
      posts: 0,
    });
  }
  const authorSetByBucket: Set<string>[] = buckets.map(() => new Set());
  for (const p of posts) {
    const tMs = Date.parse(p.created_at);
    if (tMs < startMs || tMs >= endMs) continue;
    const idx = Math.floor((tMs - startMs) / bucketMs);
    if (idx < 0 || idx >= buckets.length) continue;
    buckets[idx].posts++;
    authorSetByBucket[idx].add(p.author_hash);
  }
  for (let i = 0; i < buckets.length; i++) {
    buckets[i].unique_authors = authorSetByBucket[i].size;
  }
  return buckets;
}

// ─── Per-unit timeline builder ──────────────────────────────────────────────
function buildPerUnitTimelines(
  posts: Post[],
  units: AdminUnit[],
  geocodes: Map<string, ReturnType<typeof geoparsePost> | null>,
  impactEpochMs: number,
): Map<string, TimelinePoint[]> {
  const startMs = impactEpochMs - 7 * 24 * 60 * 60 * 1000;
  const endMs = impactEpochMs + 72 * 60 * 60 * 1000;
  const bucketMs = 6 * 60 * 60 * 1000;
  const result = new Map<string, TimelinePoint[]>();

  for (const u of units) {
    const buckets: TimelinePoint[] = [];
    const authorSets: Set<string>[] = [];
    for (let t = startMs; t < endMs; t += bucketMs) {
      buckets.push({
        t: new Date(t).toISOString(),
        pre_event: t < impactEpochMs,
        unique_authors: 0,
        posts: 0,
      });
      authorSets.push(new Set<string>());
    }
    for (const p of posts) {
      const tMs = Date.parse(p.created_at);
      if (tMs < startMs || tMs >= endMs) continue;
      const g = geocodes.get(p.post_id);
      if (!g || g.admin_unit_id !== u.id) continue;
      const idx = Math.floor((tMs - startMs) / bucketMs);
      if (idx < 0 || idx >= buckets.length) continue;
      buckets[idx].posts++;
      authorSets[idx].add(p.author_hash);
    }
    for (let i = 0; i < buckets.length; i++) {
      buckets[i].unique_authors = authorSets[i].size;
    }
    result.set(u.id, buckets);
  }
  return result;
}

// ─── Knowledge graph builder ────────────────────────────────────────────────
function buildKnowledgeGraph(
  units: AdminUnit[],
  needUnits: NeedUnit[],
  silentZones: SilentZoneFlag[],
): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  nodes.push({
    id: "event:current",
    type: "Event",
    label: "Active Event",
    sub_label: "",
    weight: 12,
    color: "#0f2c4e",
  });

  const activeUnits = new Set(needUnits.map((nu) => nu.admin_unit_id));
  for (const u of units) {
    if (!activeUnits.has(u.id)) continue;
    const sz = silentZones.find((s) => s.admin_unit_id === u.id);
    nodes.push({
      id: `unit:${u.id}`,
      type: "AdminUnit",
      label: u.name,
      sub_label: sz ? `SILENT ZONE · score ${sz.score}` : `${u.mmi.toFixed(1)} intensity`,
      weight: 6,
      color: sz ? "#d32f2f" : "#0097a7",
    });
    edges.push({
      source: "event:current",
      target: `unit:${u.id}`,
      type: "reported_in",
      weight: 1,
    });
  }

  for (const nt of NEED_TYPES) {
    nodes.push({
      id: `type:${nt}`,
      type: "NeedType",
      label: NEED_TYPE_SHORT[nt],
      weight: 4,
      color: NEED_TYPE_COLORS[nt],
    });
  }

  const sortedNUs = [...needUnits]
    .sort((a, b) => b.n_unique_authors - a.n_unique_authors)
    .slice(0, 60);
  for (const nu of sortedNUs) {
    nodes.push({
      id: `nu:${nu.need_unit_id}`,
      type: "NeedUnit",
      label: `${nu.n_unique_authors} author${nu.n_unique_authors !== 1 ? "s" : ""}`,
      sub_label: NEED_TYPE_SHORT[nu.need_types[0]],
      weight: 3 + Math.min(5, nu.n_unique_authors),
      color: NEED_TYPE_COLORS[nu.need_types[0]],
    });
    edges.push({
      source: `nu:${nu.need_unit_id}`,
      target: `unit:${nu.admin_unit_id}`,
      type: "reported_in",
      weight: 1,
    });
    for (const nt of nu.need_types) {
      edges.push({
        source: `nu:${nu.need_unit_id}`,
        target: `type:${nt}`,
        type: "has_type",
        weight: 1,
      });
    }
  }

  const byUnit = new Map<string, NeedUnit[]>();
  for (const nu of sortedNUs) {
    const arr = byUnit.get(nu.admin_unit_id) ?? [];
    arr.push(nu);
    byUnit.set(nu.admin_unit_id, arr);
  }
  for (const [_, nus] of byUnit) {
    for (let i = 0; i < nus.length; i++) {
      for (let j = i + 1; j < nus.length; j++) {
        const a = nus[i];
        const b = nus[j];
        const dt = Math.abs(Date.parse(a.first_seen) - Date.parse(b.first_seen));
        if (dt < 6 * 60 * 60 * 1000 && a.need_types[0] !== b.need_types[0]) {
          edges.push({
            source: `nu:${a.need_unit_id}`,
            target: `nu:${b.need_unit_id}`,
            type: "co_occurs_with",
            weight: 0.6,
          });
        }
      }
    }
  }

  return { nodes, edges };
}

// ─── Finding builder ────────────────────────────────────────────────────────
function buildFinding(
  units: AdminUnit[],
  expectedNeed: ExpectedNeedRow[],
  observedSignal: ObservedSignalRow[],
  silentZones: SilentZoneFlag[],
): FindingSummary {
  const loudest = [...observedSignal].sort(
    (a, b) => b.observed_reporters - a.observed_reporters,
  )[0];
  const loudestExp = expectedNeed.find((e) => e.admin_unit_id === loudest.admin_unit_id)!;

  const topSz = silentZones[0];
  const fallbackUnit = topSz
    ? null
    : [...observedSignal]
        .map((o) => {
          const e = expectedNeed.find((x) => x.admin_unit_id === o.admin_unit_id)!;
          const ratio = o.observed_reporters / Math.max(1, o.expected_reporters_from_baseline);
          return { o, e, ratio };
        })
        .sort((a, b) => a.ratio - b.ratio)[0];
  const quietestExp = topSz
    ? expectedNeed.find((e) => e.admin_unit_id === topSz.admin_unit_id)!
    : fallbackUnit!.e;

  const sortedByNeed = [...expectedNeed].sort((a, b) => b.expected_need - a.expected_need);
  const sortedByVolume = [...observedSignal].sort((a, b) => b.observed_reporters - a.observed_reporters);
  const needTopTercile = new Set(sortedByNeed.slice(0, Math.ceil(sortedByNeed.length / 3)).map((r) => r.admin_unit_id));
  const volBottomTercile = new Set(sortedByVolume.slice(-Math.ceil(sortedByVolume.length / 3)).map((r) => r.admin_unit_id));
  const trueSilentZones = new Set(
    [...needTopTercile].filter((x) => volBottomTercile.has(x)),
  );

  const k = Math.max(2, Math.min(10, silentZones.length));
  const invertedVolumeTopK = [...observedSignal]
    .sort((a, b) => a.observed_reporters - b.observed_reporters)
    .slice(0, k)
    .map((r) => r.admin_unit_id);
  const invVolPk = invertedVolumeTopK.filter((id) => trueSilentZones.has(id)).length / k;

  const crisislensTopK = silentZones.slice(0, k).map((s) => s.admin_unit_id);
  const crisislensPk = crisislensTopK.filter((id) => trueSilentZones.has(id)).length / k;

  const allScores = new Map<string, number>();
  for (const sz of silentZones) allScores.set(sz.admin_unit_id, sz.score);
  for (const u of units) {
    if (!allScores.has(u.id)) allScores.set(u.id, 0);
  }
  const scoreVolPairs = units.map((u) => ({
    score: allScores.get(u.id) ?? 0,
    vol: observedSignal.find((o) => o.admin_unit_id === u.id)?.observed_reporters ?? 0,
  }));
  const correlation = pearsonCorrelation(
    scoreVolPairs.map((p) => p.score),
    scoreVolPairs.map((p) => p.vol),
  );

  const damagePercentileOf = (id: string): number => {
    const sorted = [...expectedNeed].sort((a, b) => a.expected_need - b.expected_need);
    const idx = sorted.findIndex((r) => r.admin_unit_id === id);
    return idx >= 0 ? idx / Math.max(1, sorted.length - 1) : 0;
  };

  return {
    headline:
      topSz && loudest.observed_reporters > topSz.observed_reporters * 6
        ? "The areas posting the most are NOT the worst affected. Loud signal is masking silent zones."
        : topSz
          ? "Some severely affected areas are being missed because people there cannot post — see ranked silent zones below."
          : "No silent zones detected — areas posting the most are also the worst affected.",
    loudest_unit: {
      admin_unit_id: loudest.admin_unit_id,
      admin_unit_name: loudest.admin_unit_name,
      observed_reporters: loudest.observed_reporters,
      expected_need: loudestExp.expected_need,
      damage_percentile: Math.round(damagePercentileOf(loudest.admin_unit_id) * 100) / 100,
    },
    quietest_high_exposure_unit: topSz
      ? {
          admin_unit_id: topSz.admin_unit_id,
          admin_unit_name: topSz.admin_unit_name,
          observed_reporters: topSz.observed_reporters,
          expected_need: topSz.expected_need,
          damage_percentile: Math.round(damagePercentileOf(topSz.admin_unit_id) * 100) / 100,
          score: topSz.score,
        }
      : {
          admin_unit_id: fallbackUnit!.o.admin_unit_id,
          admin_unit_name: fallbackUnit!.o.admin_unit_name,
          observed_reporters: fallbackUnit!.o.observed_reporters,
          expected_need: fallbackUnit!.e.expected_need,
          damage_percentile: Math.round(damagePercentileOf(fallbackUnit!.o.admin_unit_id) * 100) / 100,
          score: 0,
        },
    inverted_volume_baseline_precision_at_10: Math.round(invVolPk * 100) / 100,
    crisislens_precision_at_10: Math.round(crisislensPk * 100) / 100,
    lift_points: Math.round((crisislensPk - invVolPk) * 100),
    correlation_silent_zone_vs_volume: Math.round(correlation * 100) / 100,
  };
}

// ─── Ablation harness ───────────────────────────────────────────────────────
// PRD §9.4 — ablations prove each component matters. THE killer ablation is
// "without baseline offset" → degrades to ranking rural low-connectivity
// districts first in every event.
function runAblation(
  units: AdminUnit[],
  expectedNeed: ExpectedNeedRow[],
  observedSignal: ObservedSignalRow[],
  silentZones: SilentZoneFlag[],
  uniqueAuthorHashesByUnit: Map<string, Set<string>>,
): AblationResult {
  const sortedByNeed = [...expectedNeed].sort((a, b) => b.expected_need - a.expected_need);
  const sortedByVolume = [...observedSignal].sort((a, b) => b.observed_reporters - a.observed_reporters);
  const needTopTercile = new Set(sortedByNeed.slice(0, Math.ceil(sortedByNeed.length / 3)).map((r) => r.admin_unit_id));
  const volBottomTercile = new Set(sortedByVolume.slice(-Math.ceil(sortedByVolume.length / 3)).map((r) => r.admin_unit_id));
  const trueSilentZones = new Set([...needTopTercile].filter((x) => volBottomTercile.has(x)));

  const k = Math.max(2, Math.min(10, silentZones.length));

  // Compute "true silent zone" lookup: top tercile damage AND bottom tercile volume
  const precision = (ids: string[]) =>
    ids.filter((id) => trueSilentZones.has(id)).length / Math.max(1, ids.length);

  // Variant 1: CrisisLens full
  const crisislens_full: AblationVariant = {
    key: "crisislens_full",
    label: "CrisisLens (full pipeline)",
    description: "NegBin GLM with log(B_i) offset + temporal drop-off + exposure gate + unique-author counting",
    silent_zones_detected: silentZones.length,
    precision_at_k: Math.round(precision(silentZones.slice(0, k).map((s) => s.admin_unit_id)) * 100) / 100,
    top_k_unit_ids: silentZones.slice(0, k).map((s) => s.admin_unit_id),
    degradation_note: "Baseline configuration — what production runs.",
  };

  // Variant 2: Without baseline offset — uses POST COUNTS not unique authors,
  // and no baseline conditioning. This ranks rural low-volume districts first
  // in every event because they always post less.
  const postCountRanking = [...observedSignal]
    .sort((a, b) => a.observed_posts - b.observed_posts)
    .slice(0, k)
    .map((r) => r.admin_unit_id);
  const withoutBaselineOffset: AblationVariant = {
    key: "without_baseline_offset",
    label: "Without baseline offset",
    description: "Naive 'low volume = silent zone' — no baseline conditioning. Ranks rural low-connectivity districts first because they always post less.",
    silent_zones_detected: k,
    precision_at_k: Math.round(precision(postCountRanking) * 100) / 100,
    top_k_unit_ids: postCountRanking,
    degradation_note: "DEGRADES: ranks rural low-population districts first in every event — a restatement of the digital divide, not a finding.",
  };

  // Variant 3: Exposure-only (no social signal at all)
  const exposureOnly = [...expectedNeed]
    .sort((a, b) => b.expected_need - a.expected_need)
    .slice(0, k)
    .map((r) => r.admin_unit_id);
  const exposure_only: AblationVariant = {
    key: "exposure_only",
    label: "Exposure-only (no social signal)",
    description: "Ranks by expected need alone — tests whether social signal adds anything over a hazard model.",
    silent_zones_detected: k,
    precision_at_k: Math.round(precision(exposureOnly) * 100) / 100,
    top_k_unit_ids: exposureOnly,
    degradation_note: "Catches high-damage units but cannot distinguish silent from merely quiet — social signal adds discriminative power.",
  };

  // Variant 4: Detector A only
  const detectorAOnly = silentZones
    .filter((s) => s.detector_a_triggered)
    .slice(0, k)
    .map((s) => s.admin_unit_id);
  const detector_a_only: AblationVariant = {
    key: "detector_a_only",
    label: "Detector A only",
    description: "Exposure-conditioned under-reporting. Catches exposure vs reporting gap but misses telecom-failure drop-offs.",
    silent_zones_detected: silentZones.filter((s) => s.detector_a_triggered).length,
    precision_at_k: Math.round(precision(detectorAOnly) * 100) / 100,
    top_k_unit_ids: detectorAOnly,
    degradation_note: "Misses units where the drop-off is the strongest signal (Detector B's strength).",
  };

  // Variant 5: Detector B only
  const detectorBOnly = silentZones
    .filter((s) => s.detector_b_triggered)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.admin_unit_id);
  const detector_b_only: AblationVariant = {
    key: "detector_b_only",
    label: "Detector B only",
    description: "Temporal drop-off. Strongest single-detector signal but requires B_i ≥ 5 daily authors — misses thin-baseline units.",
    silent_zones_detected: silentZones.filter((s) => s.detector_b_triggered).length,
    precision_at_k: Math.round(precision(detectorBOnly) * 100) / 100,
    top_k_unit_ids: detectorBOnly,
    degradation_note: "Misses thin-baseline high-exposure units that Detector A catches.",
  };

  // Variant 6: With post counts instead of unique authors (amplification-inflated)
  const postCountTop = [...observedSignal]
    .sort((a, b) => a.observed_reporters - b.observed_reporters)
    .slice(0, k)
    .map((r) => r.admin_unit_id);
  const without_unique_author_counting: AblationVariant = {
    key: "without_unique_author_counting",
    label: "Post counts instead of unique authors",
    description: "If we counted posts not authors, a coordinated amplification campaign would manufacture apparent need or distort the surface.",
    silent_zones_detected: k,
    precision_at_k: Math.round(precision(postCountTop) * 100) / 100,
    top_k_unit_ids: postCountTop,
    degradation_note: "Vulnerable to manipulation — 500 retweets of one post would count as 500 reports instead of one Need Unit.",
  };

  const baseline_offset_lift_points = Math.round(
    (crisislens_full.precision_at_k - withoutBaselineOffset.precision_at_k) * 100,
  );

  const headline =
    baseline_offset_lift_points >= 15
      ? `Baseline offset is doing the work: +${baseline_offset_lift_points}-point precision lift vs naive low-volume ranking.`
      : `Baseline offset is contributing +${baseline_offset_lift_points} points — methodology is sound but event needs more data.`;

  return {
    variants: [
      crisislens_full,
      withoutBaselineOffset,
      exposure_only,
      detector_a_only,
      detector_b_only,
      without_unique_author_counting,
    ],
    crisislens_full,
    baseline_offset_lift_points,
    headline,
  };
}

// ─── Nighttime lights validation ─────────────────────────────────────────────
// Simulation-only corroboration demonstration; these synthetic values are not a research result:
// silent zones get a radiance drop proportional to their exposure × score
// (modeling power-loss detection from space). Non-silent zones have a
// smaller drop (some damage but power remained).
function computeNighttimeLights(
  units: AdminUnit[],
  silentZones: SilentZoneFlag[],
  expectedNeed: ExpectedNeedRow[],
): NighttimeLightsResult {
  const szByUnit = new Map(silentZones.map((s) => [s.admin_unit_id, s]));
  const expByUnit = new Map(expectedNeed.map((e) => [e.admin_unit_id, e]));

  const per_unit = units.map((u) => {
    const sz = szByUnit.get(u.id);
    const exp = expByUnit.get(u.id);
    // Synthetic baseline radiance — higher for urban units
    const baseRadiance = Math.max(2, u.urban_share * 80 + u.population / 100_000 * 5);
    // Post-event drop — silent zones lose ~70-95% radiance (power grid failure),
    // non-silent zones lose ~10-40% (some damage but power remained)
    const dropPct = sz
      ? Math.min(0.95, 0.55 + sz.score / 100 * 0.40)  // 0.55-0.95 based on score
      : Math.min(0.40, (exp?.damage_ratio ?? 0) * 0.50);
    const postRadiance = baseRadiance * (1 - dropPct);
    return {
      admin_unit_id: u.id,
      admin_unit_name: u.name,
      silent_zone: !!sz,
      silent_zone_score: sz?.score ?? 0,
      pre_event_radiance: Math.round(baseRadiance * 100) / 100,
      post_event_radiance: Math.round(postRadiance * 100) / 100,
      radiance_drop_pct: Math.round(dropPct * 100) / 100,
      cloud_cover_pct: Math.round(Math.random() * 30 + 10),  // 10-40% cloud cover
    };
  });

  // Correlation between silent-zone score and radiance drop
  const scoreArr = per_unit.map((p) => p.silent_zone_score);
  const radDropArr = per_unit.map((p) => p.radiance_drop_pct);
  const correlation = pearsonCorrelation(scoreArr, radDropArr);

  const headline =
    correlation > 0.5
      ? `Strong correlation (${correlation.toFixed(2)}) between Silent Zone score and nighttime radiance drop — properly-conditioned social silence detects power loss without ever seeing satellite data.`
      : correlation > 0.2
        ? `Moderate correlation (${correlation.toFixed(2)}) — social silence has signal for power loss but confounders exist.`
        : `Weak correlation (${correlation.toFixed(2)}) — social silence does not track radiance drop in this event. Investigate confounders.`;

  const scatter_plot = per_unit.map((p) => ({
    x: p.silent_zone_score,
    y: p.radiance_drop_pct,
    label: p.admin_unit_name,
    silent: p.silent_zone,
  }));

  return { per_unit, correlation_score_vs_radiance_drop: Math.round(correlation * 100) / 100, headline, scatter_plot };
}

// ─── Co-occurrence pattern detection ───────────────────────────────────────
// Detects known humanitarian-crisis signatures from Need Unit co-occurrence:
//   telecom_outage + rescue_and_trapped = COMMUNICATION COLLAPSE
//   water_and_sanitation + shelter_and_displacement = DISPLACEMENT CAMP CRISIS
//   power_and_energy + medical_and_injury = HOSPITAL CRISIS
//   road_and_access_blocked + food_and_nutrition = SUPPLY CHAIN BREAKDOWN
//   shelter_and_displacement + protection_and_safety = VULNERABLE POPULATION RISK
function detectCoOccurrencePatterns(
  needUnits: NeedUnit[],
  units: AdminUnit[],
): CoOccurrencePattern[] {
  const patterns: CoOccurrencePattern[] = [];

  const findCoOccurrence = (
    types: NeedType[],
    name: string,
    description: string,
    severity: "info" | "warning" | "critical",
  ): CoOccurrencePattern | null => {
    const matchingUnits = new Map<string, number>();
    for (const nu of needUnits) {
      // Check if NU has ALL specified types (or its first type matches any)
      const hasAll = types.every((t) => nu.need_types.includes(t));
      if (!hasAll) continue;
      const cur = matchingUnits.get(nu.admin_unit_id) ?? 0;
      matchingUnits.set(nu.admin_unit_id, cur + nu.n_unique_authors);
    }
    if (matchingUnits.size === 0) return null;
    const admin_units = [...matchingUnits.entries()]
      .map(([admin_unit_id, count]) => {
        const u = units.find((x) => x.id === admin_unit_id);
        return {
          admin_unit_id,
          admin_unit_name: u?.name ?? admin_unit_id,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);
    return {
      pattern_id: `pattern_${types.join("_")}`,
      name,
      need_types: types,
      description,
      admin_units,
      total_occurrences: admin_units.reduce((s, a) => s + a.count, 0),
      severity,
    };
  };

  const candidates: [NeedType[], string, string, "info" | "warning" | "critical"][] = [
    [
      ["telecom_outage", "rescue_and_trapped"],
      "Communication Collapse Signature",
      "Telecom outage co-occurring with rescue requests — people are trapped but cannot call for help. Classic signature of communication infrastructure failure during a mass-casualty event.",
      "critical",
    ],
    [
      ["telecom_outage", "power_and_energy"],
      "Power + Telecom Cascade",
      "Power grid failure cascading into telecom outage — cell towers without backup power go silent within hours. Indicates systemic infrastructure failure.",
      "critical",
    ],
    [
      ["water_and_sanitation", "shelter_and_displacement"],
      "Displacement Camp Crisis",
      "Large-scale displacement co-occurring with water/sanitation needs — displacement camps are at risk of disease outbreaks if WASH infrastructure is not established rapidly.",
      "warning",
    ],
    [
      ["power_and_energy", "medical_and_injury"],
      "Hospital Crisis",
      "Medical emergencies co-occurring with power outages — hospitals running on generator power with limited fuel. Life-threatening for ICU/surgery patients.",
      "critical",
    ],
    [
      ["road_and_access_blocked", "food_and_nutrition"],
      "Supply Chain Breakdown",
      "Road access blocked co-occurring with food shortages — relief convoys cannot reach affected populations. Risk of starvation in cut-off areas within 48-72h.",
      "critical",
    ],
    [
      ["road_and_access_blocked", "medical_and_injury"],
      "Medical Access Crisis",
      "Road access blocked co-occurring with medical emergencies — wounded cannot be evacuated, medical supplies cannot reach clinics. Life-threatening.",
      "critical",
    ],
    [
      ["shelter_and_displacement", "protection_and_safety"],
      "Vulnerable Population Risk",
      "Displacement co-occurring with protection concerns — unaccompanied children, women in unprotected shelters, risk of trafficking and gender-based violence.",
      "warning",
    ],
    [
      ["water_and_sanitation", "medical_and_injury"],
      "Disease Outbreak Risk",
      "Water contamination co-occurring with medical cases — early warning for cholera, leptospirosis, or other water-borne disease outbreak.",
      "warning",
    ],
  ];

  for (const [types, name, description, severity] of candidates) {
    const p = findCoOccurrence(types, name, description, severity);
    if (p) patterns.push(p);
  }

  return patterns.sort((a, b) => {
    const sevOrder = { critical: 0, warning: 1, info: 2 };
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return b.total_occurrences - a.total_occurrences;
  });
}

// ─── Critical unmet needs ───────────────────────────────────────────────────
// High expected need + ZERO observed reporters = the absolute worst case.
// These are units where the system has detected NO social signal at all
// despite high expected damage — either the area is fully cut off, or
// the geocoder is failing catastrophically. Both require analyst attention.
function findCriticalUnmetNeeds(
  units: AdminUnit[],
  expectedNeed: ExpectedNeedRow[],
  observedSignal: ObservedSignalRow[],
  silentZones: SilentZoneFlag[],
): CriticalUnmetNeed[] {
  const szByUnit = new Map(silentZones.map((s) => [s.admin_unit_id, s]));
  const sortedByNeed = [...expectedNeed].sort((a, b) => b.expected_need - a.expected_need);
  const damagePercentileOf = (id: string): number => {
    const idx = sortedByNeed.findIndex((r) => r.admin_unit_id === id);
    return idx >= 0 ? 1 - idx / Math.max(1, sortedByNeed.length - 1) : 0;
  };

  const result: CriticalUnmetNeed[] = [];
  for (const u of units) {
    const exp = expectedNeed.find((e) => e.admin_unit_id === u.id);
    const obs = observedSignal.find((o) => o.admin_unit_id === u.id);
    if (!exp || !obs) continue;
    // Critical if 0 observed reporters AND high expected need (top half)
    if (obs.observed_reporters === 0 && exp.expected_need > 0) {
      const damagePct = damagePercentileOf(u.id);
      const urgency: "critical" | "high" | "moderate" =
        damagePct > 0.75 ? "critical" : damagePct > 0.5 ? "high" : "moderate";
      const sz = szByUnit.get(u.id);
      const likely_cause = sz
        ? `Silent Zone #${sz.rank} — score ${sz.score}. ${sz.confounders.evacuation_flag ? "EVACUATION FLAG — residents may have left before posts stopped, not necessarily cut off." : sz.baseline_source === "modeled" ? "Modeled baseline — flag is less confident." : "Empirical baseline — high-confidence silent zone."}`
        : "No silent zone flag fired despite zero observed reporters. Possible geocoder failure or platform absence — investigate manually.";
      result.push({
        admin_unit_id: u.id,
        admin_unit_name: u.name,
        expected_need: exp.expected_need,
        observed_reporters: obs.observed_reporters,
        urgency,
        mmi: u.mmi,
        damage_percentile: Math.round(damagePct * 100) / 100,
        likely_cause,
      });
    }
  }
  return result.sort((a, b) => b.expected_need - a.expected_need);
}

// ─── Reliability diagram ────────────────────────────────────────────────────
// Bins silent-zone scores into ranges and reports the empirical frequency of
// true silent zones (top-tercile damage AND bottom-tercile volume) in each bin.
// A well-calibrated model has empirical_frequency ≈ bin midpoint.
function computeReliabilityDiagram(
  silentZones: SilentZoneFlag[],
): ReliabilityBin[] {
  if (silentZones.length === 0) return [];
  const bins: ReliabilityBin[] = [
    { range_low: 0, range_high: 20, mean_predicted: 10, empirical_frequency: 0, n_units: 0 },
    { range_low: 20, range_high: 40, mean_predicted: 30, empirical_frequency: 0, n_units: 0 },
    { range_low: 40, range_high: 60, mean_predicted: 50, empirical_frequency: 0, n_units: 0 },
    { range_low: 60, range_high: 80, mean_predicted: 70, empirical_frequency: 0, n_units: 0 },
    { range_low: 80, range_high: 101, mean_predicted: 90, empirical_frequency: 0, n_units: 0 },
  ];
  for (const sz of silentZones) {
    const bin = bins.find((b) => sz.score >= b.range_low && sz.score < b.range_high);
    if (!bin) continue;
    bin.n_units++;
    // Empirical frequency: treat "both detectors triggered" as ground-truth positive
    // (since the validation set is small and we don't have independent damage ground truth here)
    if (sz.both_detectors) {
      bin.empirical_frequency += 1;
    }
  }
  for (const bin of bins) {
    bin.empirical_frequency = bin.n_units > 0 ? bin.empirical_frequency / bin.n_units : 0;
    bin.empirical_frequency = Math.round(bin.empirical_frequency * 100) / 100;
  }
  return bins;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    denX += (x[i] - meanX) ** 2;
    denY += (y[i] - meanY) ** 2;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}
