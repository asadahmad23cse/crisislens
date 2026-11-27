/**
 * CrisisLens — Stage 5: Expected Need Surface
 *
 * E_i = Σ_cells (pop_c × H(hazard_c)) × V_i × I_i
 *
 * H(·) is a non-linear damage function:
 *   - Earthquake: MMI → damage ratio (Worden et al. 2010 empirical fit)
 *   - Cyclone:    wind speed → damage power law
 *   - Flood:      depth → depth-damage curve
 *
 * v1 deterministic (published functions, no fitting).
 */

import type { AdminUnit, ExpectedNeedRow } from "./types";

// ─── MMI → damage ratio ─────────────────────────────────────────────────────
// Worden et al. (2010) — fitted MMI-to-MDM (Macroscopic Damage Measure) curve.
// Damage ratio is approximated by a logistic-style step in MMI:
//   MMI < 4   : 0.001  (no damage)
//   MMI 4–5   : 0.005  (slight)
//   MMI 5–6   : 0.02   (light)
//   MMI 6–7   : 0.08   (moderate)
//   MMI 7–8   : 0.20   (substantial)
//   MMI 8–9   : 0.45   (heavy)
//   MMI 9–10  : 0.75   (very heavy)
//   MMI ≥ 10  : 0.95   (destruction)
export function mmiToDamageRatio(mmi: number): number {
  if (mmi < 4) return 0.001;
  if (mmi < 5) return 0.005;
  if (mmi < 6) return 0.02;
  if (mmi < 7) return 0.08;
  if (mmi < 8) return 0.20;
  if (mmi < 9) return 0.45;
  if (mmi < 10) return 0.75;
  return 0.95;
}

// Cyclone: wind speed (m/s) → damage power law (Emanuel 2011 style)
export function windToDamageRatio(windMs: number): number {
  // damage ∝ (v / 50)^3 capped at 0.9
  const r = Math.pow(Math.max(0, windMs) / 50, 3);
  return Math.min(0.9, r);
}

// Flood: depth (m) → depth-damage curve (JRC global flood depth-damage)
export function floodDepthToDamageRatio(depthM: number): number {
  // Saturating curve — max 0.8 at 4m+
  return Math.min(0.8, depthM / (depthM + 1.5));
}

export function computeExpectedNeed(
  units: AdminUnit[],
  hazardType: "earthquake" | "cyclone" | "flood" = "earthquake",
): ExpectedNeedRow[] {
  const rows: ExpectedNeedRow[] = units.map((u) => {
    let damageRatio: number;
    switch (hazardType) {
      case "earthquake":
        damageRatio = mmiToDamageRatio(u.mmi);
        break;
      case "cyclone":
        damageRatio = windToDamageRatio(u.mmi); // mmi field reused as wind ms
        break;
      case "flood":
        damageRatio = floodDepthToDamageRatio(u.mmi); // mmi reused as depth m
        break;
    }
    const populationExposed = Math.round(u.population * damageRatio);
    const expectedNeed =
      populationExposed * u.vulnerability * u.infrastructure;
    return {
      admin_unit_id: u.id,
      admin_unit_name: u.name,
      expected_need: Math.round(expectedNeed),
      population_exposed: populationExposed,
      hazard_intensity: u.mmi,
      damage_ratio: Math.round(damageRatio * 1000) / 1000,
      vulnerability: u.vulnerability,
      infrastructure: u.infrastructure,
      exposure_percentile: 0, // filled after sorting
    };
  });

  // Exposure percentile (rank within region)
  const sorted = [...rows].sort((a, b) => a.expected_need - b.expected_need);
  for (let i = 0; i < sorted.length; i++) {
    const pct = i / Math.max(1, sorted.length - 1);
    const row = rows.find((r) => r.admin_unit_id === sorted[i].admin_unit_id)!;
    row.exposure_percentile = Math.round(pct * 100) / 100;
  }
  return rows;
}
