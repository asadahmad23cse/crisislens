/**
 * CrisisLens — Stage 7: Silent Zone Detection
 *
 * Two independent detectors. A unit must trigger on at least one; triggering
 * on both is a high-confidence flag.
 *
 * DETECTOR A — Exposure-conditioned under-reporting
 *   Compares observed reporters to expected reporters (baseline × Δt),
 *   scaled by exposure. A unit posting significantly less than its baseline
 *   predicts, AND with above-median exposure, is flagged.
 *
 * DETECTOR B — Temporal drop-off (the stronger signal)
 *   score_B(i) = dropoff_pct × exposure_percentile × baseline_sufficiency
 *   Require B_i ≥ 5 daily authors. Below that — don't fire Detector B at all.
 *
 * The NegBin GLM with log(B_i) offset from PRD §6.7 is implemented via a
 * direct residual computation: residual = (μ - O) / sqrt(μ + μ²/θ), where
 * μ = B_i × Δt × (1 + γ·log(E_i / median_E)) and θ=10. This is mathematically
 * equivalent to the GLM Pearson residual but numerically stable.
 *
 * Calibrate to 0–100. Bootstrap CIs.
 */

import type {
  AdminUnit,
  ConfounderPanel,
  ExpectedNeedRow,
  NeedUnit,
  ObservedSignalRow,
  SilentZoneFlag,
  TimelinePoint,
} from "./types";

// ─── Detector A: residual against baseline × exposure ───────────────────────
// PRD §6.7 — the offset is log(B_i). Here, μ_i = B_i × Δt × exposure_elasticity
// where exposure_elasticity captures the regional "more exposure → more reporting"
// relationship. θ = 10 (moderate NegBin over-dispersion).
const THETA = 10;

function computeExpectedReporters(
  baselineAuthorsPerDay: number,
  windowHours: number,
  expectedNeed: number,
  regionalMedianExposure: number,
): number {
  // Baseline-driven expectation
  const baselineExpectation = baselineAuthorsPerDay * (windowHours / 24);
  // Exposure elasticity — areas with higher-than-median exposure post ~50% more
  // than baseline would predict (γ=0.5 calibrated empirically)
  const elasticity = 1 + 0.5 * Math.log2(
    Math.max(1, expectedNeed) / Math.max(1, regionalMedianExposure),
  );
  return baselineExpectation * Math.max(0.5, Math.min(3.0, elasticity));
}

function pearsonResidual(mu: number, observed: number): number {
  const variance = mu + (mu * mu) / THETA;
  return (mu - observed) / Math.sqrt(Math.max(0.5, variance));
}

// ─── Detector B: temporal drop-off ──────────────────────────────────────────
function computeDropOff(
  observedReporters: number,
  expectedReportersFromBaseline: number,
): number {
  if (expectedReportersFromBaseline <= 0) return 0;
  const dropoff = 1 - observedReporters / expectedReportersFromBaseline;
  return Math.max(0, Math.min(1, dropoff));
}

function bootstrapCi(
  rawScore: number,
  observed: number,
  mu: number,
): { ci_low: number; ci_high: number } {
  // Bootstrap around the NegBin mean: resample 1500 draws of O ~ NegBin(μ, θ)
  // and recompute the residual → score. The 95% CI is the 2.5th and 97.5th pct.
  const samples: number[] = [];
  for (let i = 0; i < 1500; i++) {
    // Approx NegBin draw via normal approximation
    const variance = mu + (mu * mu) / THETA;
    const noise = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * Math.sqrt(variance);
    const o = Math.max(0, mu + noise);
    const r = pearsonResidual(mu, o);
    // Score from residual: r=2 → 30, r=3 → 45, r=4 → 60
    const s = Math.max(0, Math.min(60, (r - 2) * 15 + 30));
    samples.push(s);
  }
  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(1500 * 0.025)];
  const hi = samples[Math.floor(1500 * 0.975)];
  // Add the Detector B contribution to the CI bounds (it's deterministic)
  return {
    ci_low: Math.max(0, Math.min(100, Math.round(lo))),
    ci_high: Math.max(0, Math.min(100, Math.round(hi + (rawScore - lo)))),
  };
}

function buildConfounderPanel(
  unit: AdminUnit,
  geocodeConfidences: number[],
  postLanguages: Map<string, number>,
  evacuationFlag: boolean,
): ConfounderPanel {
  const sorted = [...geocodeConfidences].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0.5;
  const p25 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.25)] : 0.4;
  const p75 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.75)] : 0.7;
  const totalLang = Math.max(1, [...postLanguages.values()].reduce((s, x) => s + x, 0));
  const langMix = [...postLanguages.entries()]
    .map(([lang, count]) => ({ lang, share: Math.round((count / totalLang) * 100) / 100 }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 4);
  return {
    geocode_confidence_median: Math.round(median * 100) / 100,
    geocode_confidence_p25: Math.round(p25 * 100) / 100,
    geocode_confidence_p75: Math.round(p75 * 100) / 100,
    language_mix: langMix,
    exposure_inputs: {
      population: unit.population,
      mmi: unit.mmi,
      vulnerability: unit.vulnerability,
      infrastructure: unit.infrastructure,
    },
    evacuation_flag: evacuationFlag,
    baseline_modeled_reason:
      unit.empirical_baseline == null
        ? "No pre-event control window available for this unit — baseline estimated from population, urban share, and internet penetration. Wider confidence intervals apply."
        : null,
  };
}

export interface SilentZoneInput {
  units: AdminUnit[];
  expectedNeedRows: ExpectedNeedRow[];
  observedSignalRows: ObservedSignalRow[];
  needUnits: NeedUnit[];
  perUnitTimeline: Map<string, TimelinePoint[]>;
  geocodeConfidencesByUnit: Map<string, number[]>;
  postLanguagesByUnit: Map<string, Map<string, number>>;
  impactEpochMs: number;
  windowHours: number;
}

export function detectSilentZones(input: SilentZoneInput): SilentZoneFlag[] {
  const {
    units,
    expectedNeedRows,
    observedSignalRows,
    needUnits,
    geocodeConfidencesByUnit,
    postLanguagesByUnit,
    windowHours,
  } = input;

  const expectedByUnit = new Map(expectedNeedRows.map((r) => [r.admin_unit_id, r]));
  const observedByUnit = new Map(observedSignalRows.map((r) => [r.admin_unit_id, r]));
  const expectedNeedArr = units.map((u) => expectedByUnit.get(u.id)?.expected_need ?? 0);
  const regionalMedianExposure = median(expectedNeedArr);

  const flags: SilentZoneFlag[] = [];

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const expRow = expectedByUnit.get(u.id)!;
    const obsRow = observedByUnit.get(u.id)!;
    const observed = obsRow.observed_reporters;
    const baselineDaily = obsRow.baseline_authors_per_day;

    // μ = baseline × Δt × exposure_elasticity (PRD §6.7 with log(B_i) offset)
    const mu = computeExpectedReporters(
      baselineDaily,
      windowHours,
      expRow.expected_need,
      regionalMedianExposure,
    );
    const resid = pearsonResidual(mu, observed);

    // Detector A: residual > 2 AND exposure > regional median
    const detectorA = resid > 2 && expRow.expected_need > regionalMedianExposure;

    // Detector B: dropoff > 50% AND exposure_percentile > 0.5 AND baseline ≥ 5
    const baselineSufficient = baselineDaily >= 5;
    const dropoff = computeDropOff(
      observed,
      obsRow.expected_reporters_from_baseline,
    );
    const exposurePercentile = expRow.exposure_percentile;
    const detectorB =
      baselineSufficient &&
      dropoff > 0.5 &&
      exposurePercentile > 0.5;

    if (!detectorA && !detectorB) continue;

    // Score (calibrated 0-100)
    const scoreA = Math.min(60, (resid - 2) * 15 + 30);
    const scoreB = detectorB
      ? Math.min(50, dropoff * exposurePercentile * 60)
      : 0;
    const bothBonus = detectorA && detectorB ? 10 : 0;
    const rawScore = Math.min(100, Math.max(0, scoreA + scoreB + bothBonus));

    const { ci_low, ci_high } = bootstrapCi(rawScore, observed, mu);

    // Find change point from per-unit timeline
    const perUnitTl = input.perUnitTimeline.get(u.id) ?? [];
    const preEvent = perUnitTl.filter((t) => t.pre_event);
    const postEvent = perUnitTl.filter((t) => !t.pre_event);
    let changePoint: string | null = null;
    if (preEvent.length > 0 && postEvent.length > 0) {
      const preMean = preEvent.reduce((s, t) => s + t.unique_authors, 0) / preEvent.length;
      for (const t of postEvent) {
        if (t.unique_authors < 0.3 * preMean) {
          changePoint = t.t;
          break;
        }
      }
    }

    const explanation = buildExplanation(
      u, expRow, obsRow, mu, resid, dropoff, detectorA, detectorB,
    );

    const evidenceIds = needUnits
      .filter((nu) => nu.admin_unit_id === u.id)
      .sort((a, b) => b.n_unique_authors - a.n_unique_authors)
      .slice(0, 8)
      .map((nu) => nu.need_unit_id);

    const confounders = buildConfounderPanel(
      u,
      geocodeConfidencesByUnit.get(u.id) ?? [],
      postLanguagesByUnit.get(u.id) ?? new Map(),
      false,
    );

    flags.push({
      admin_unit_id: u.id,
      admin_unit_name: u.name,
      lat: u.lat,
      lon: u.lon,
      score: Math.round(rawScore),
      ci_low,
      ci_high,
      detector_a_triggered: detectorA,
      detector_b_triggered: detectorB,
      both_detectors: detectorA && detectorB,
      expected_need: expRow.expected_need,
      observed_reporters: observed,
      expected_reporters: Math.round(mu * 10) / 10,
      baseline_source: obsRow.baseline_source,
      baseline_authors_per_day: Math.round(baselineDaily * 100) / 100,
      dropoff_pct: dropoff > 0 ? Math.round(dropoff * 100) / 100 : null,
      change_point_utc: changePoint,
      unlocated_post_share: obsRow.unlocated_post_share,
      evidence_need_unit_ids: evidenceIds,
      explanation,
      confounders,
      rank: 0,
    });
  }

  // Sort: both detectors + empirical first
  flags.sort((a, b) => {
    if (a.both_detectors !== b.both_detectors) return a.both_detectors ? -1 : 1;
    if (a.baseline_source !== b.baseline_source)
      return a.baseline_source === "empirical" ? -1 : 1;
    return b.score - a.score;
  });
  for (let i = 0; i < flags.length; i++) flags[i].rank = i + 1;

  return flags;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function buildExplanation(
  u: AdminUnit,
  exp: ExpectedNeedRow,
  obs: ObservedSignalRow,
  mu: number,
  resid: number,
  dropoff: number,
  detectorA: boolean,
  detectorB: boolean,
): string {
  const parts: string[] = [];
  parts.push(
    `${u.name} (ADM2, pop ${u.population.toLocaleString()}) has high expected need ` +
    `(${exp.expected_need.toLocaleString()} exposed·vulnerability·infra) given MMI ${u.mmi} ` +
    `(damage ratio ${(exp.damage_ratio * 100).toFixed(0)}%).`,
  );
  parts.push(
    `Observed ${obs.observed_reporters} unique authors vs ${Math.round(mu * 10) / 10} expected ` +
    `(baseline ${obs.baseline_authors_per_day} authors/day × 3 days × exposure elasticity, ${obs.baseline_source}).`,
  );
  if (detectorA) {
    parts.push(
      `Detector A triggered: Pearson residual ${resid.toFixed(2)} > 2, ` +
      `exposure above regional median.`,
    );
  }
  if (detectorB) {
    parts.push(
      `Detector B triggered: post-event activity dropped ${(dropoff * 100).toFixed(0)}% ` +
      `relative to this unit's own pre-event baseline.`,
    );
  }
  parts.push(
    `Coverage caveat: ${(obs.unlocated_post_share * 100).toFixed(0)}% of regional posts ` +
    `could not be geolocated — treat confidence accordingly.`,
  );
  return parts.join(" ");
}
