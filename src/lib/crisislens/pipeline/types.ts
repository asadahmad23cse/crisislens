/**
 * CrisisLens — Core Type System
 *
 * Implements the canonical schemas from PRD section 6.1, 6.4, and 6.7.
 * Every silent-zone score ships with a confidence interval and confounder panel.
 */

// ─── Need Type Ontology (PRD §6.2) ────────────────────────────────────────────
export type NeedType =
  | "rescue_and_trapped"
  | "water_and_sanitation"
  | "medical_and_injury"
  | "food_and_nutrition"
  | "shelter_and_displacement"
  | "power_and_energy"
  | "telecom_outage"
  | "road_and_access_blocked"
  | "missing_persons"
  | "protection_and_safety";

export const NEED_TYPES: NeedType[] = [
  "rescue_and_trapped",
  "water_and_sanitation",
  "medical_and_injury",
  "food_and_nutrition",
  "shelter_and_displacement",
  "power_and_energy",
  "telecom_outage",
  "road_and_access_blocked",
  "missing_persons",
  "protection_and_safety",
];

export const NEED_TYPE_LABELS: Record<NeedType, string> = {
  rescue_and_trapped: "Rescue & Trapped",
  water_and_sanitation: "Water & Sanitation",
  medical_and_injury: "Medical & Injury",
  food_and_nutrition: "Food & Nutrition",
  shelter_and_displacement: "Shelter & Displacement",
  power_and_energy: "Power & Energy",
  telecom_outage: "Telecom Outage",
  road_and_access_blocked: "Road & Access Blocked",
  missing_persons: "Missing Persons",
  protection_and_safety: "Protection & Safety",
};

// Short labels for compact chart axes
export const NEED_TYPE_SHORT: Record<NeedType, string> = {
  rescue_and_trapped: "Rescue",
  water_and_sanitation: "Water",
  medical_and_injury: "Medical",
  food_and_nutrition: "Food",
  shelter_and_displacement: "Shelter",
  power_and_energy: "Power",
  telecom_outage: "Telecom",
  road_and_access_blocked: "Roads",
  missing_persons: "Missing",
  protection_and_safety: "Safety",
};

// Colorblind-safe palette (navy, teal, amber, magenta, slate, plus 5 hues)
export const NEED_TYPE_COLORS: Record<NeedType, string> = {
  rescue_and_trapped: "#d32f2f",
  water_and_sanitation: "#0097a7",
  medical_and_injury: "#e91e63",
  food_and_nutrition: "#ffc107",
  shelter_and_displacement: "#0f2c4e",
  power_and_energy: "#fb8c00",
  telecom_outage: "#7b1fa2",
  road_and_access_blocked: "#555555",
  missing_persons: "#00838f",
  protection_and_safety: "#689f38",
};

// ─── Urgency head (PRD §6.2) ─────────────────────────────────────────────────
export type Urgency = 0 | 1 | 2 | 3; // informational | concerning | urgent | life-threatening
export const URGENCY_LABELS: Record<Urgency, string> = {
  0: "Informational",
  1: "Concerning",
  2: "Urgent",
  3: "Life-threatening",
};

// ─── Post / canonical record (PRD §6.1) ─────────────────────────────────────
export interface Post {
  post_id: string;             // platform-prefixed, e.g. "humaid:..."
  platform: "humaid" | "bluesky" | "reddit" | "telegram";
  author_hash: string;         // HMAC-SHA256 of author id, salted
  text: string;
  created_at: string;          // ISO-8601 UTC
  lang: string;
  geo_point: { lat: number; lon: number } | null;
  author_declared_loc: string | null;
  parent_id: string | null;
  is_amplification: boolean;   // retweet / crosspost — excluded from need counting
  event_id: string;
}

// ─── Geoparsing artifacts (PRD §6.3) ────────────────────────────────────────
export interface GeocodeResult {
  admin_unit_id: string;
  admin_unit_name: string;
  resolution: "ADM1" | "ADM2" | "ADM0";
  confidence: number;          // [0, 1]
  content_location: boolean;   // true = where the need is; false = author location
  lat: number;
  lon: number;
  source: "geo_point" | "toponym_resolution" | "author_loc";
}

// ─── Need Unit (PRD §6.4) ──────────────────────────────────────────────────
export interface NeedUnit {
  need_unit_id: string;
  need_types: NeedType[];
  admin_unit_id: string;
  admin_unit_name: string;
  geo_confidence: number;
  n_posts: number;
  n_unique_authors: number;    // load-bearing count
  n_amplifications: number;
  first_seen: string;
  last_seen: string;
  peak_urgency: Urgency;
  representative_text: string;  // cluster medoid
  corroboration_score: number; // [0, 1]
  member_post_ids: string[];
  lat: number;
  lon: number;
}

// ─── Admin unit + expected/observed surfaces ────────────────────────────────
export interface AdminUnit {
  id: string;
  name: string;
  adm_level: "ADM1" | "ADM2";
  lat: number;
  lon: number;
  // SVG path for the simplified choropleth
  svg_path: string;
  // Label anchor inside the district, in SVG viewBox coordinates (real borders)
  label_xy?: [number, number] | null;
  population: number;
  // Hazard (earthquake: mean MMI within the unit, 1–10 scale)
  mmi: number;
  // Vulnerability multiplier V_i (mean 1.0)
  vulnerability: number;
  // Infrastructure fragility I_i (mean 1.0)
  infrastructure: number;
  // Pre-event internet penetration [0,1] (used for modeled baseline)
  internet_penetration: number;
  // Urban share [0,1]
  urban_share: number;
  // Empirical daily baseline — unique authors per day in 14-day pre-event window.
  // null when no pre-event data exists for this unit (modeled fallback).
  empirical_baseline: number | null;
}

export interface ExpectedNeedRow {
  admin_unit_id: string;
  admin_unit_name: string;
  // E_i = sum_cells(pop_c × H(hazard_c)) × V_i × I_i  (PRD §6.5)
  expected_need: number;
  population_exposed: number;
  hazard_intensity: number;     // raw MMI
  damage_ratio: number;        // H(hazard) — non-linear MMI→damage curve
  vulnerability: number;
  infrastructure: number;
  exposure_percentile: number; // rank within region, [0,1]
}

export interface ObservedSignalRow {
  admin_unit_id: string;
  admin_unit_name: string;
  observed_reporters: number;  // unique authors with ≥1 Need Unit membership
  observed_posts: number;      // diagnostic only
  baseline_source: "empirical" | "modeled";
  baseline_authors_per_day: number;
  expected_reporters_from_baseline: number;  // B_i × Δt
  unlocated_post_share: number;  // coverage caveat
}

// ─── Silent Zone flag (PRD §6.7) ────────────────────────────────────────────
export interface SilentZoneFlag {
  admin_unit_id: string;
  admin_unit_name: string;
  lat: number;
  lon: number;
  score: number;               // calibrated 0–100
  ci_low: number;
  ci_high: number;
  detector_a_triggered: boolean;
  detector_b_triggered: boolean;
  both_detectors: boolean;      // high-confidence
  detector_z_triggered?: boolean; // zero local need voices
  detector_f_triggered?: boolean; // fusion: outage evidence + modest social shortfall
  // Independent evidence (never used to compute the social score)
  evidence?: {
    ntl_drop: number | null;
    cell_sites_down: number | null;
    evacuated_share: number | null;
    voices_about: number;
  };
  expected_need: number;
  observed_reporters: number;
  expected_reporters: number;
  baseline_source: "empirical" | "modeled";
  baseline_authors_per_day: number;
  dropoff_pct: number | null;
  change_point_utc: string | null;
  unlocated_post_share: number;
  evidence_need_unit_ids: string[];
  explanation: string;
  confounders: ConfounderPanel;
  // rank within event, 1 = highest priority
  rank: number;
}

export interface ConfounderPanel {
  geocode_confidence_median: number;
  geocode_confidence_p25: number;
  geocode_confidence_p75: number;
  language_mix: { lang: string; share: number }[];
  exposure_inputs: {
    population: number;
    mmi: number;
    vulnerability: number;
    infrastructure: number;
  };
  evacuation_flag: boolean;     // from GDACS feed
  baseline_modeled_reason: string | null;
}

// ─── Event metadata ─────────────────────────────────────────────────────────
export interface EventMeta {
  event_id: string;
  name: string;
  hazard_type: "earthquake" | "cyclone" | "flood";
  country: string;
  epicenter_lat: number;
  epicenter_lon: number;
  // Epicentre projected into the map's 600x600 SVG viewBox (dataset events)
  epicenter_svg?: [number, number];
  // Neighbouring districts drawn faintly behind the map, and where borders come from
  context_paths?: string[];
  map_source?: string;
  map_viewbox?: string;
  data_source?: string;
  // v2 calibration estimated from the event's own unlabelled data
  surge?: number;
  theta?: number;
  impact_utc: string;
  window_start_utc: string;
  window_end_utc: string;
  total_posts_ingested: number;
  total_relevant_posts: number;
  total_need_units: number;
  total_silent_zones: number;
  unlocated_share: number;
}

// ─── Timeline + Knowledge graph (PRD §8) ────────────────────────────────────
export interface TimelinePoint {
  t: string;                   // ISO timestamp of bucket start
  pre_event: boolean;
  unique_authors: number;
  posts: number;
}

export interface GraphNode {
  id: string;
  type: "Event" | "AdminUnit" | "NeedUnit" | "NeedType" | "Post";
  label: string;
  sub_label?: string;
  weight: number;
  color?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "reported_in" | "has_type" | "member_of" | "co_occurs_with";
  weight: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Final finding (PRD headline question) ───────────────────────────────────
export interface FindingSummary {
  headline: string;
  loudest_unit: {
    admin_unit_id: string;
    admin_unit_name: string;
    observed_reporters: number;
    expected_need: number;
    damage_percentile: number;
  };
  quietest_high_exposure_unit: {
    admin_unit_id: string;
    admin_unit_name: string;
    observed_reporters: number;
    expected_need: number;
    damage_percentile: number;
    score: number;
  };
  inverted_volume_baseline_precision_at_10: number;
  crisislens_precision_at_10: number;
  lift_points: number;
  correlation_silent_zone_vs_volume: number;  // negative = inverse (good)
  // Loudness bias in one number (dataset events)
  flagged_share_of_need_posts?: number;
  flagged_share_of_expected_need?: number;
}
