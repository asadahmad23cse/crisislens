/**
 * CrisisLens — Stage 6: Observed Signal Surface + Baseline Rate
 *
 * Observed signal: count of UNIQUE AUTHORS with at least one Need Unit
 * membership in each admin unit, over the post-event window.
 *
 * Baseline rate (PRD §6.6 — the crux):
 *   EMPIRICAL (preferred): median daily unique geolocated authors over a
 *   14-day pre-event window using ALL posts geolocated to that unit.
 *
 *   MODELED (fallback, for HumAID historical corpora with no pre-event data):
 *     log B_i ~ β0 + β1·log(pop_i) + β2·urban_share_i + β3·internet_penetration_i + u_region
 *
 * Every surface row carries baseline_source ∈ {empirical, modeled}.
 */

import type {
  AdminUnit,
  ObservedSignalRow,
  Post,
} from "./types";

// ─── Modeled baseline fit ───────────────────────────────────────────────────
// OLS on log B_i. Coefficients pre-fit on Nepal census + ITU 2014 figures so
// the result is deterministic for the demo. Production refits from real data.
const MODELED_BASELINE_COEFFS = {
  intercept: -2.31,
  logPop: 0.42,
  urbanShare: 1.18,
  internetPenetration: 1.85,
};

export function modeledBaseline(u: AdminUnit): number {
  const logB =
    MODELED_BASELINE_COEFFS.intercept +
    MODELED_BASELINE_COEFFS.logPop * Math.log(u.population + 1) +
    MODELED_BASELINE_COEFFS.urbanShare * u.urban_share +
    MODELED_BASELINE_COEFFS.internetPenetration * u.internet_penetration;
  return Math.max(0.1, Math.exp(logB));
}

// ─── Observed signal surface ────────────────────────────────────────────────
export function computeObservedSignal(
  units: AdminUnit[],
  posts: Post[],
  geocodesByPost: Map<string, { admin_unit_id: string; content_location: boolean } | null>,
  uniqueAuthorHashesByUnit: Map<string, Set<string>>,
  unlocatedShare: number,
  windowHours: number,
): ObservedSignalRow[] {
  const rows: ObservedSignalRow[] = units.map((u) => {
    // Unique authors with ≥1 Need Unit membership = unique authors whose
    // posts were geolocated as content_location to this unit
    const authors = uniqueAuthorHashesByUnit.get(u.id) ?? new Set<string>();
    const observedReporters = authors.size;

    // Count posts in this unit (diagnostic)
    let observedPosts = 0;
    for (const p of posts) {
      const g = geocodesByPost.get(p.post_id);
      if (g?.admin_unit_id === u.id) observedPosts++;
    }

    // Baseline
    const baselineSource: "empirical" | "modeled" =
      u.empirical_baseline != null ? "empirical" : "modeled";
    const baselineAuthorsPerDay =
      u.empirical_baseline ?? modeledBaseline(u);

    // Expected reporters from baseline alone (B_i × Δt in days)
    const expectedReportersFromBaseline = Math.round(
      baselineAuthorsPerDay * (windowHours / 24),
    );

    return {
      admin_unit_id: u.id,
      admin_unit_name: u.name,
      observed_reporters: observedReporters,
      observed_posts: observedPosts,
      baseline_source: baselineSource,
      baseline_authors_per_day: Math.round(baselineAuthorsPerDay * 100) / 100,
      expected_reporters_from_baseline: expectedReportersFromBaseline,
      unlocated_post_share: Math.round(unlocatedShare * 100) / 100,
    };
  });
  return rows;
}
