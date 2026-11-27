/**
 * Nepal 2015 Earthquake — Synthetic reference dataset
 *
 * Models the HumAID corpus structure (Alam et al., 2021). All posts are
 * synthetic, written for this build to demonstrate the CrisisLens pipeline
 * end-to-end without redistributing the actual HumAID tweet IDs.
 *
 * Scenario: M7.8 Gorkha earthquake, 25 April 2015, 06:11 UTC.
 * 14 severely-affected districts per Nepal PDNA report.
 * MMI values per district are modeled on the USGS ShakeMap.
 *
 * Two deliberately-injected Silent Zones:
 *   - Gorkha (epicenter, MMI 9, but cut off — low post volume)
 *   - Sindhupalchok (MMI 8.5, landslides blocked roads, almost no posts)
 *
 * Loud-but-less-affected unit for contrast:
 *   - Kathmandu (MMI 7, but dense urban connectivity → highest post volume)
 */

import type { AdminUnit, Post, EventMeta } from "../pipeline/types";
import type { EventDataset } from "./registry";

// ─── 14 affected districts (Nepal PDNA, April 2015) ──────────────────────────
// Coordinates are district centroids; svg_path is a hand-simplified polygon
// for the choropleth. Real GeoJSON would be used in production via GADM.
export const NEPAL_DISTRICTS: AdminUnit[] = [
  {
    id: "NP-GORKHA",
    name: "Gorkha",
    adm_level: "ADM2",
    lat: 28.29,
    lon: 84.62,
    // Simplified polygon — points around district centroid (SVG viewBox 0 0 600 600)
    svg_path: "M180,260 L240,250 L270,290 L260,340 L220,360 L190,330 Z",
    population: 271_000,
    mmi: 9.0,             // epicenter — severe shaking
    vulnerability: 1.32,  // mountainous, low HDI
    infrastructure: 1.41, // sparse road density
    internet_penetration: 0.18,
    urban_share: 0.14,
    empirical_baseline: 6.2,   // 6.2 unique authors/day pre-event
  },
  {
    id: "NP-SINDHUPALCHOK",
    name: "Sindhupalchok",
    adm_level: "ADM2",
    lat: 27.78,
    lon: 85.71,
    svg_path: "M340,250 L410,240 L440,280 L420,330 L370,340 L345,310 Z",
    population: 288_000,
    mmi: 8.5,
    vulnerability: 1.28,
    infrastructure: 1.45, // landslides cut the Arniko Highway
    internet_penetration: 0.21,
    urban_share: 0.11,
    empirical_baseline: 6.0,   // just above Detector B's 5/day minimum
  },
  {
    id: "NP-KATHMANDU",
    name: "Kathmandu",
    adm_level: "ADM2",
    lat: 27.70,
    lon: 85.32,
    svg_path: "M280,310 L355,300 L380,345 L350,390 L290,385 L270,350 Z",
    population: 1_744_000, // dense urban
    mmi: 7.0,              // strong but less than epicenter
    vulnerability: 0.92,
    infrastructure: 0.85,  // dense roads (relatively good access)
    internet_penetration: 0.71,
    urban_share: 0.96,
    empirical_baseline: 64.5,  // dense pre-event posting
  },
  {
    id: "NP-LALITPUR",
    name: "Lalitpur",
    adm_level: "ADM2",
    lat: 27.66,
    lon: 85.32,
    svg_path: "M270,395 L335,390 L360,425 L330,460 L280,455 L265,420 Z",
    population: 468_000,
    mmi: 6.9,
    vulnerability: 0.96,
    infrastructure: 0.92,
    internet_penetration: 0.66,
    urban_share: 0.82,
    empirical_baseline: 38.1,
  },
  {
    id: "NP-BHAKTAPUR",
    name: "Bhaktapur",
    adm_level: "ADM2",
    lat: 27.67,
    lon: 85.43,
    svg_path: "M355,335 L400,325 L420,365 L390,395 L355,390 L345,360 Z",
    population: 305_000,
    mmi: 7.2,
    vulnerability: 1.05,  // heritage site damage
    infrastructure: 0.94,
    internet_penetration: 0.62,
    urban_share: 0.88,
    empirical_baseline: 32.4,
  },
  {
    id: "NP-NUWAKOT",
    name: "Nuwakot",
    adm_level: "ADM2",
    lat: 27.92,
    lon: 85.11,
    svg_path: "M225,265 L280,260 L290,295 L265,325 L220,320 L210,290 Z",
    population: 288_000,
    mmi: 7.8,
    vulnerability: 1.18,
    infrastructure: 1.22,
    internet_penetration: 0.27,
    urban_share: 0.18,
    empirical_baseline: 9.1,
  },
  {
    id: "NP-DHADING",
    name: "Dhading",
    adm_level: "ADM2",
    lat: 27.88,
    lon: 84.91,
    svg_path: "M150,290 L215,280 L235,320 L210,360 L165,355 L145,325 Z",
    population: 338_000,
    mmi: 8.0,
    vulnerability: 1.20,
    infrastructure: 1.31,
    internet_penetration: 0.24,
    urban_share: 0.15,
    empirical_baseline: 8.4,
  },
  {
    id: "NP-RASUWA",
    name: "Rasuwa",
    adm_level: "ADM2",
    lat: 28.13,
    lon: 85.29,
    svg_path: "M255,225 L310,220 L325,255 L295,285 L255,275 L245,250 Z",
    population: 43_000,
    mmi: 8.2,
    vulnerability: 1.34,
    infrastructure: 1.48,
    internet_penetration: 0.16,
    urban_share: 0.08,
    empirical_baseline: 2.5,    // too thin for Detector B → flag would be skipped if Detector B alone
  },
  {
    id: "NP-KAVREPALANCHOK",
    name: "Kavrepalanchok",
    adm_level: "ADM2",
    lat: 27.55,
    lon: 85.55,
    svg_path: "M355,385 L420,380 L445,420 L420,460 L370,465 L350,425 Z",
    population: 382_000,
    mmi: 7.5,
    vulnerability: 1.10,
    infrastructure: 1.14,
    internet_penetration: 0.34,
    urban_share: 0.22,
    empirical_baseline: 14.8,
  },
  {
    id: "NP-DOLAKHA",
    name: "Dolakha",
    adm_level: "ADM2",
    lat: 27.99,
    lon: 86.07,
    svg_path: "M395,250 L460,250 L475,295 L450,335 L405,335 L385,295 Z",
    population: 186_000,
    mmi: 7.6,
    vulnerability: 1.22,
    infrastructure: 1.36,
    internet_penetration: 0.22,
    urban_share: 0.13,
    empirical_baseline: 7.5,
  },
  {
    id: "NP-MAKWANPUR",
    name: "Makwanpur",
    adm_level: "ADM2",
    lat: 27.43,
    lon: 85.04,
    svg_path: "M180,395 L255,390 L270,425 L245,465 L195,465 L170,425 Z",
    population: 420_000,
    mmi: 6.5,
    vulnerability: 1.04,
    infrastructure: 1.06,
    internet_penetration: 0.36,
    urban_share: 0.26,
    empirical_baseline: 16.7,
  },
  {
    id: "NP-SINDHULI",
    name: "Sindhuli",
    adm_level: "ADM2",
    lat: 27.28,
    lon: 85.96,
    svg_path: "M395,425 L470,420 L490,460 L465,500 L410,500 L390,460 Z",
    population: 314_000,
    mmi: 5.8,
    vulnerability: 1.10,
    infrastructure: 1.20,
    internet_penetration: 0.25,
    urban_share: 0.14,
    empirical_baseline: 6.9,
  },
  {
    id: "NP-OKHARDHUNGA",
    name: "Okhaldhunga",
    adm_level: "ADM2",
    lat: 27.32,
    lon: 86.50,
    svg_path: "M460,395 L520,390 L535,430 L515,470 L470,470 L450,430 Z",
    population: 147_000,
    mmi: 5.4,
    vulnerability: 1.16,
    infrastructure: 1.30,
    internet_penetration: 0.19,
    urban_share: 0.10,
    empirical_baseline: 3.6,
  },
  {
    id: "NP-RAMECHHAP",
    name: "Ramechhap",
    adm_level: "ADM2",
    lat: 27.59,
    lon: 86.05,
    svg_path: "M425,365 L490,360 L510,400 L485,440 L435,440 L415,400 Z",
    population: 202_000,
    mmi: 6.8,
    vulnerability: 1.14,
    infrastructure: 1.25,
    internet_penetration: 0.22,
    urban_share: 0.12,
    empirical_baseline: 5.5,
  },
];

// ─── Post generator ──────────────────────────────────────────────────────────
// Generates ~2000 synthetic posts modeled on the HumAID label distribution.
// The label mix roughly mirrors Alam et al. (2021) Table 3.

type Template = {
  text: string;
  need_types: string[];
  urgency: 0 | 1 | 2 | 3;
  district_ids: string[]; // districts this template refers to
  is_amp: boolean;
};

const TEMPLATES: Template[] = [
  // ── rescue_and_trapped (high urgency) ────────────────────────────────────
  { text: "trapped under rubble in Gorkha please send help now #nepalearthquake", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["NP-GORKHA"], is_amp: false },
  { text: "people trapped in collapsed building Sindhupalchok need rescue team urgently", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["NP-SINDHUPALCHOK"], is_amp: false },
  { text: "house collapsed in Bhaktapur old town, family trapped inside please help", need_types: ["rescue_and_trapped", "shelter_and_displacement"], urgency: 3, district_ids: ["NP-BHAKTAPUR"], is_amp: false },
  { text: "trapped under collapsed home in Nuwakot village, anyone nearby please come", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["NP-NUWAKOT"], is_amp: false },
  { text: "my neighbor is trapped in Dhading, rescue team has not arrived yet", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["NP-DHADING"], is_amp: false },
  { text: "RT trapped under rubble in Gorkha please send help now #nepalearthquake", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["NP-GORKHA"], is_amp: true },
  { text: "many trapped in Kavre building collapse, need urgent rescue", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["NP-KAVREPALANCHOK"], is_amp: false },
  { text: "old temple collapsed in Lalitpur, people under debris", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["NP-LALITPUR"], is_amp: false },
  { text: "Rasuwa landslides buried homes, no one can reach the village yet", need_types: ["rescue_and_trapped", "road_and_access_blocked"], urgency: 3, district_ids: ["NP-RASUWA"], is_amp: false },

  // ── medical_and_injury ──────────────────────────────────────────────────
  { text: "injured people being carried to hospital in Kathmandu, no beds left", need_types: ["medical_and_injury"], urgency: 3, district_ids: ["NP-KATHMANDU"], is_amp: false },
  { text: "we need medical supplies in Sindhupalchok, clinic destroyed", need_types: ["medical_and_injury"], urgency: 3, district_ids: ["NP-SINDHUPALCHOK"], is_amp: false },
  { text: "broken leg here in Bhaktapur, no doctor available for two days", need_types: ["medical_and_injury"], urgency: 2, district_ids: ["NP-BHAKTAPUR"], is_amp: false },
  { text: "many wounded in Gorkha, hospital running out of bandages", need_types: ["medical_and_injury"], urgency: 3, district_ids: ["NP-GORKHA"], is_amp: false },
  { text: "Dhading health post no medicine, send doctors and supplies", need_types: ["medical_and_injury"], urgency: 2, district_ids: ["NP-DHADING"], is_amp: false },
  { text: "Lalitpur hospital full, patients on the floor", need_types: ["medical_and_injury"], urgency: 2, district_ids: ["NP-LALITPUR"], is_amp: false },
  { text: "Kavre mobile clinic needed, many fractures reported", need_types: ["medical_and_injury"], urgency: 2, district_ids: ["NP-KAVREPALANCHOK"], is_amp: false },

  // ── shelter_and_displacement ────────────────────────────────────────────
  { text: "thousands sleeping in open fields in Kathmandu tonight, tents needed", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["NP-KATHMANDU"], is_amp: false },
  { text: "my house in Bhaktapur is gone, sleeping under tarpaulin", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["NP-BHAKTAPUR"], is_amp: false },
  { text: "displaced families in Sindhupalchok need shelter, monsoon coming", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["NP-SINDHUPALCHOK"], is_amp: false },
  { text: "tent camp growing in Tundikhel Kathmandu, thousands here", need_types: ["shelter_and_displacement"], urgency: 1, district_ids: ["NP-KATHMANDU"], is_amp: false },
  { text: "Lalitpur Patan area homes damaged, families on streets", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["NP-LALITPUR"], is_amp: false },
  { text: "Nuwakot village destroyed, we have no roof left", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["NP-NUWAKOT"], is_amp: false },
  { text: "Kavrepalanchok shelter shortage, need tarpaulins urgently", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["NP-KAVREPALANCHOK"], is_amp: false },
  { text: "RT thousands sleeping in open fields in Kathmandu tonight, tents needed", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["NP-KATHMANDU"], is_amp: true },
  { text: "Dolakha families displaced, need temporary shelter", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["NP-DOLAKHA"], is_amp: false },

  // ── water_and_sanitation ────────────────────────────────────────────────
  { text: "no clean water in Gorkha for three days, pipes broken", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["NP-GORKHA"], is_amp: false },
  { text: "Kathmandu water shortage, please share if you have supply", need_types: ["water_and_sanitation"], urgency: 1, district_ids: ["NP-KATHMANDU"], is_amp: false },
  { text: "Lalitpur no water, tanker trucks not coming", need_types: ["water_and_sanitation"], urgency: 1, district_ids: ["NP-LALITPUR"], is_amp: false },
  { text: "Bhaktapur sanitation crisis, open defecation risk of disease", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["NP-BHAKTAPUR"], is_amp: false },
  { text: "Sindhupalchok water source contaminated by landslide", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["NP-SINDHUPALCHOK"], is_amp: false },

  // ── food_and_nutrition ─────────────────────────────────────────────────
  { text: "running out of food in Kavrepalanchok, shops closed since quake", need_types: ["food_and_nutrition"], urgency: 2, district_ids: ["NP-KAVREPALANCHOK"], is_amp: false },
  { text: "no food in Sindhuli village for two days, please help", need_types: ["food_and_nutrition"], urgency: 2, district_ids: ["NP-SINDHULI"], is_amp: false },
  { text: "Dhading food stocks running low, distribution needed", need_types: ["food_and_nutrition"], urgency: 1, district_ids: ["NP-DHADING"], is_amp: false },
  { text: "Ramechhap families need food, no road access to bring supplies", need_types: ["food_and_nutrition", "road_and_access_blocked"], urgency: 2, district_ids: ["NP-RAMECHHAP"], is_amp: false },

  // ── power_and_energy ────────────────────────────────────────────────────
  { text: "power cut across Kathmandu valley, third night without electricity", need_types: ["power_and_energy"], urgency: 1, district_ids: ["NP-KATHMANDU"], is_amp: false },
  { text: "no electricity in Lalitpur since Saturday, charging phones is hard", need_types: ["power_and_energy"], urgency: 1, district_ids: ["NP-LALITPUR"], is_amp: false },
  { text: "Bhaktapur power lines down, no light in old town", need_types: ["power_and_energy"], urgency: 1, district_ids: ["NP-BHAKTAPUR"], is_amp: false },
  { text: "Gorkha no power, no cell signal either, can't reach anyone", need_types: ["power_and_energy", "telecom_outage"], urgency: 2, district_ids: ["NP-GORKHA"], is_amp: false },
  { text: "Nuwakot blackout, only solar lamps working", need_types: ["power_and_energy"], urgency: 1, district_ids: ["NP-NUWAKOT"], is_amp: false },

  // ── telecom_outage ─────────────────────────────────────────────────────
  { text: "no cell service in Sindhupalchok for hours, only got through now", need_types: ["telecom_outage"], urgency: 2, district_ids: ["NP-SINDHUPALCHOK"], is_amp: false },
  { text: "Gorkha telecom down, family cannot reach us", need_types: ["telecom_outage"], urgency: 2, district_ids: ["NP-GORKHA"], is_amp: false },
  { text: "Rasuwa signal gone since morning, completely isolated", need_types: ["telecom_outage", "power_and_energy"], urgency: 3, district_ids: ["NP-RASUWA"], is_amp: false },
  { text: "Dolakha cell tower fell, no communication for two days", need_types: ["telecom_outage"], urgency: 2, district_ids: ["NP-DOLAKHA"], is_amp: false },
  { text: "intermittent signal in Dhading, often no bars for hours", need_types: ["telecom_outage"], urgency: 1, district_ids: ["NP-DHADING"], is_amp: false },

  // ── road_and_access_blocked ────────────────────────────────────────────
  { text: "Arniko highway blocked at Sindhupalchok, landslides everywhere", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["NP-SINDHUPALCHOK"], is_amp: false },
  { text: "Prithvi highway to Kathmandu blocked by rockfall near Mugling", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["NP-MAKWANPUR"], is_amp: false },
  { text: "roads to Gorkha district cut off, no relief trucks arriving", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["NP-GORKHA"], is_amp: false },
  { text: "Rasuwa road gone, villages completely isolated by landslides", need_types: ["road_and_access_blocked"], urgency: 3, district_ids: ["NP-RASUWA"], is_amp: false },
  { text: "Dolakha road blocked at Bhote Koshi bridge collapse", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["NP-DOLAKHA"], is_amp: false },
  { text: "Ramechhap access blocked, can't get supplies through", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["NP-RAMECHHAP"], is_amp: false },

  // ── missing_persons ────────────────────────────────────────────────────
  { text: "looking for my sister in Kathmandu, last seen near Dharahara tower", need_types: ["missing_persons"], urgency: 2, district_ids: ["NP-KATHMANDU"], is_amp: false },
  { text: "lost contact with family in Gorkha, anyone heard from Barpak village?", need_types: ["missing_persons"], urgency: 2, district_ids: ["NP-GORKHA"], is_amp: false },
  { text: "missing uncle in Sindhupalchok, was in Chautara when quake hit", need_types: ["missing_persons"], urgency: 2, district_ids: ["NP-SINDHUPALCHOK"], is_amp: false },

  // ── protection_and_safety ──────────────────────────────────────────────
  { text: "women in Kathmandu relief camp feel unsafe at night, need lighting", need_types: ["protection_and_safety"], urgency: 1, district_ids: ["NP-KATHMANDU"], is_amp: false },
  { text: "unaccompanied children in Bhaktapur camp, need protection officers", need_types: ["protection_and_safety"], urgency: 2, district_ids: ["NP-BHAKTAPUR"], is_amp: false },
  { text: "Lalitpur reports of trafficking attempts at relief sites", need_types: ["protection_and_safety"], urgency: 2, district_ids: ["NP-LALITPUR"], is_amp: false },

  // ── amplification / not_humanitarian / informational ─────────────────────
  { text: "RT house collapsed in Bhaktapur old town, family trapped inside please help", need_types: ["rescue_and_trapped", "shelter_and_displacement"], urgency: 3, district_ids: ["NP-BHAKTAPUR"], is_amp: true },
  { text: "RT no clean water in Gorkha for three days, pipes broken", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["NP-GORKHA"], is_amp: true },
  { text: "RT Arniko highway blocked at Sindhupalchok, landslides everywhere", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["NP-SINDHUPALCHOK"], is_amp: true },
  { text: "RT injured people being carried to hospital in Kathmandu, no beds left", need_types: ["medical_and_injury"], urgency: 3, district_ids: ["NP-KATHMANDU"], is_amp: true },
  { text: "RT no food in Sindhuli village for two days, please help", need_types: ["food_and_nutrition"], urgency: 2, district_ids: ["NP-SINDHULI"], is_amp: true },
  { text: "RT thousands sleeping in open fields in Kathmandu tonight, tents needed", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["NP-KATHMANDU"], is_amp: true },
  { text: "RT power cut across Kathmandu valley, third night without electricity", need_types: ["power_and_energy"], urgency: 1, district_ids: ["NP-KATHMANDU"], is_amp: true },
  { text: "RT looking for my sister in Kathmandu, last seen near Dharahara tower", need_types: ["missing_persons"], urgency: 2, district_ids: ["NP-KATHMANDU"], is_amp: true },
  { text: "praying for Nepal from London, stay safe everyone", need_types: [], urgency: 0, district_ids: ["NP-KATHMANDU"], is_amp: false },
  { text: "thoughts with everyone affected by the earthquake in Nepal", need_types: [], urgency: 0, district_ids: ["NP-KATHMANDU"], is_amp: false },
  { text: "donate to Nepal earthquake relief, link in bio", need_types: [], urgency: 0, district_ids: ["NP-KATHMANDU"], is_amp: false },
];

// ─── HumAID-class-weighted draw ─────────────────────────────────────────────
// Approximate label frequencies from Alam et al. (2021) Table 3, normalised.
// We draw templates in proportion so the dataset has the same shape.
const LABEL_WEIGHTS: Record<string, number> = {
  rescue_and_trapped: 0.04,
  medical_and_injury: 0.10,
  shelter_and_displacement: 0.18,
  water_and_sanitation: 0.08,
  food_and_nutrition: 0.06,
  power_and_energy: 0.07,
  telecom_outage: 0.05,
  road_and_access_blocked: 0.06,
  missing_persons: 0.04,
  protection_and_safety: 0.03,
  // not_humanitarian — including prayers, donation pushes, RTs of irrelevant content
  not_humanitarian: 0.29,
};

function pickTemplate(): Template {
  const keys = Object.keys(LABEL_WEIGHTS);
  const total = keys.reduce((s, k) => s + LABEL_WEIGHTS[k], 0);
  let r = Math.random() * total;
  let chosen_key = "not_humanitarian";
  for (const k of keys) {
    r -= LABEL_WEIGHTS[k];
    if (r <= 0) { chosen_key = k; break; }
  }
  if (chosen_key === "not_humanitarian") {
    // half of the non-humanitarian stream is amplifications of relevant posts,
    // the other half is prayer/donation/info posts (already in TEMPLATES)
    if (Math.random() < 0.5) {
      const amp = TEMPLATES.filter((t) => t.is_amp);
      return amp[Math.floor(Math.random() * amp.length)];
    } else {
      const info = TEMPLATES.filter((t) => t.need_types.length === 0);
      return info[Math.floor(Math.random() * info.length)];
    }
  }
  const candidates = TEMPLATES.filter((t) =>
    t.need_types.includes(chosen_key as any) && !t.is_amp,
  );
  if (candidates.length === 0) {
    // fallback — pick any non-amp template containing this label
    const wider = TEMPLATES.filter((t) => t.need_types.includes(chosen_key as any));
    return wider[Math.floor(Math.random() * wider.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ─── Author hash generator (PRD §6.1 + §12.3 privacy) ──────────────────────
function hmacSha256Like(input: string, salt: string): string {
  // Lightweight hash for synthetic data. Production uses HMAC-SHA256.
  // We mix the salt in via FNV-1a over the concatenated string for a stable,
  // non-reversible identifier. NOT cryptographically secure; sufficient for
  // an advisory tool's analytics surface.
  const s = `${salt}::${input}`;
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = (h1 + ((h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24))) >>> 0;
  }
  let h2 = 0x1000193;
  for (let i = s.length - 1; i >= 0; i--) {
    h2 ^= s.charCodeAt(i);
    h2 = (h2 * 0x1000193) >>> 0;
  }
  return (
    h1.toString(16).padStart(8, "0") +
    h2.toString(16).padStart(8, "0")
  );
}

// ─── Post generation ────────────────────────────────────────────────────────
const SALT = "crisislens-nepal-2015-v1";

function isoTimePlus(baseEpochMs: number, deltaMs: number): string {
  return new Date(baseEpochMs + deltaMs).toISOString();
}

/**
 * Generates the synthetic post corpus.
 *
 * Volume tuning (per district, post-event 72h window):
 *   - Kathmandu:   ~520 posts   (dense connectivity, lots of amplification)
 *   - Lalitpur:    ~210
 *   - Bhaktapur:   ~165
 *   - Kavre:       ~110
 *   - Sindhuli:    ~ 80
 *   - Makwanpur:   ~ 95
 *   - Nuwakot:     ~ 85
 *   - Dhading:     ~ 70
 *   - Dolakha:     ~ 55
 *   - Ramechhap:   ~ 38
 *   - Sindhupalchok: ~22  (SILENT — high MMI, low volume)
 *   - Gorkha:      ~ 18   (SILENT — epicenter, cut off)
 *   - Rasuwa:      ~ 12   (SILENT-ish — too thin for Detector B alone)
 *   - Okhaldhunga: ~ 20
 *
 * Total ≈ 1500 ingested posts, ~860 relevant after filter.
 */
const DISTRICT_POST_COUNTS: Record<string, number> = {
  "NP-KATHMANDU": 520,
  "NP-LALITPUR": 210,
  "NP-BHAKTAPUR": 165,
  "NP-KAVREPALANCHOK": 110,
  "NP-SINDHULI": 80,
  "NP-MAKWANPUR": 95,
  "NP-NUWAKOT": 85,
  "NP-DHADING": 70,
  "NP-DOLAKHA": 55,
  "NP-RAMECHHAP": 38,
  // SILENT ZONES — high MMI, very few posts
  "NP-SINDHUPALCHOK": 6,    // baseline 4.8/day × 3 days = 14.4 expected; observed ~5
  "NP-GORKHA": 5,            // baseline 6.2/day × 3 days = 18.6 expected; observed ~4
  "NP-RASUWA": 4,            // baseline 2.5/day × 3 = 7.5 expected; observed ~3 (too thin for Detector B)
  "NP-OKHARDHUNGA": 20,
};

export function generatePosts(): Post[] {
  const posts: Post[] = [];
  // Earthquake: 2015-04-25 06:11:26 UTC
  const impactEpoch = Date.UTC(2015, 3, 25, 6, 11, 26);
  const windowStart = impactEpoch - 14 * 24 * 60 * 60 * 1000; // 14 days pre-event
  const windowEnd = impactEpoch + 72 * 60 * 60 * 1000;        // 72h post-event

  // ─── Pre-event posts (for empirical baseline) ─────────────────────────────
  // Sparse baseline volume — only generate enough to estimate B_i.
  // Kathmandu: ~64/day × 14 = 896 — too many to materialise. Instead we
  // store the empirical_baseline directly on AdminUnit and synthesise a
  // smaller representative sample for the timeline chart.
  for (const d of NEPAL_DISTRICTS) {
    if (d.empirical_baseline == null) continue;
    const perDay = Math.max(1, Math.round(d.empirical_baseline));
    const sampleDays = 5; // materialise only 5 days × perDay posts for the chart
    for (let dayIdx = 0; dayIdx < sampleDays; dayIdx++) {
      const dayStart = windowStart + dayIdx * 24 * 60 * 60 * 1000;
      for (let i = 0; i < perDay; i++) {
        const ts = dayStart + Math.floor(Math.random() * 24 * 60 * 60 * 1000);
        // Pre-event posts are mostly not humanitarian — daily chatter
        const chatter = [
          "morning in " + d.name + ", quiet day",
          "tea shop talk in " + d.name,
          "weather update from " + d.name,
          "school holidays started in " + d.name,
          "farm work in " + d.name + " today",
        ];
        posts.push({
          post_id: `humaid:pre-${d.id}-${dayIdx}-${i}`,
          platform: "humaid",
          author_hash: hmacSha256Like(`pre-${d.id}-${dayIdx}-${i}-auth${Math.floor(Math.random() * perDay * 3)}`, SALT),
          text: chatter[Math.floor(Math.random() * chatter.length)],
          created_at: isoTimePlus(ts, 0),
          lang: "en",
          geo_point: null,
          author_declared_loc: d.name,
          parent_id: null,
          is_amplification: false,
          event_id: "nepal-2015",
        });
      }
    }
  }

  // ─── Post-event posts — district-specific templates only ─────────────────
  let counter = 0;
  for (const d of NEPAL_DISTRICTS) {
    const n = DISTRICT_POST_COUNTS[d.id] ?? 20;
    const districtTemplates = TEMPLATES_BY_DISTRICT.get(d.id) ?? [];
    for (let i = 0; i < n; i++) {
      // Pick a template that mentions this district (or generic chatter)
      let t: Template;
      if (districtTemplates.length > 0) {
        const nonAmp = districtTemplates.filter((x) => !x.is_amp);
        const amp = districtTemplates.filter((x) => x.is_amp);
        if (amp.length > 0 && Math.random() < 0.25) {
          t = amp[Math.floor(Math.random() * amp.length)];
        } else if (nonAmp.length > 0) {
          t = nonAmp[Math.floor(Math.random() * nonAmp.length)];
        } else {
          t = districtTemplates[Math.floor(Math.random() * districtTemplates.length)];
        }
      } else {
        t = genericChatter(d.name);
      }
      const hourOffset = Math.floor(Math.pow(Math.random(), 1.6) * 72);
      const ts = impactEpoch + hourOffset * 60 * 60 * 1000;
      const authorIdx = Math.floor(i / 1.4) + Math.floor(Math.random() * 3);
      posts.push({
        post_id: `humaid:post-${d.id}-${counter++}`,
        platform: "humaid",
        author_hash: hmacSha256Like(`${d.id}-auth${authorIdx}`, SALT),
        text: t.text,
        created_at: isoTimePlus(ts, Math.floor(Math.random() * 60 * 1000)),
        lang: "en",
        geo_point: null,
        author_declared_loc: d.name,
        parent_id: t.is_amp ? `humaid:post-${d.id}-${Math.max(0, i - 5)}` : null,
        is_amplification: t.is_amp,
        event_id: "nepal-2015",
      });
    }
  }

  return posts;
}

// ─── Pre-group templates by district ──────────────────────────────────────
const TEMPLATES_BY_DISTRICT: Map<string, Template[]> = (() => {
  const m = new Map<string, Template[]>();
  for (const t of TEMPLATES) {
    for (const did of t.district_ids) {
      const arr = m.get(did) ?? [];
      arr.push(t);
      m.set(did, arr);
    }
  }
  return m;
})();

function genericChatter(districtName: string): Template {
  const lines = [
    `update from ${districtName}`,
    `situation still developing in ${districtName}`,
    `news from ${districtName} after the earthquake`,
    `awaiting information from ${districtName}`,
  ];
  return {
    text: lines[Math.floor(Math.random() * lines.length)],
    need_types: [],
    urgency: 0,
    district_ids: [],
    is_amp: false,
  };
}

// ─── Event dataset export ────────────────────────────────────────────────────
const NEPAL_2015_META: EventMeta = {
  event_id: "nepal-2015",
  name: "Nepal Earthquake 2015 (Gorkha)",
  hazard_type: "earthquake",
  country: "Nepal",
  epicenter_lat: 28.23,
  epicenter_lon: 84.73,
  impact_utc: new Date(Date.UTC(2015, 3, 25, 6, 11, 26)).toISOString(),
  window_start_utc: new Date(Date.UTC(2015, 3, 25, 6, 11, 26) - 14 * 24 * 60 * 60 * 1000).toISOString(),
  window_end_utc: new Date(Date.UTC(2015, 3, 25, 6, 11, 26) + 72 * 60 * 60 * 1000).toISOString(),
  total_posts_ingested: 0, // filled at runtime
  total_relevant_posts: 0,
  total_need_units: 0,
  total_silent_zones: 0,
  unlocated_share: 0,
};

export const NEPAL_2015: EventDataset = {
  meta: NEPAL_2015_META,
  units: NEPAL_DISTRICTS,
  generatePosts,
  impactEpochMs: Date.UTC(2015, 3, 25, 6, 11, 26),
  windowHours: 72,
  hazardType: "earthquake",
};
