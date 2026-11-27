/**
 * Hurricane Maria 2017 — Synthetic reference dataset
 *
 * Scenario: Category 4 Hurricane Maria made landfall in Puerto Rico on
 * 20 September 2017 at ~10:15 UTC. Sustained winds ~155 mph (69 m/s).
 *
 * The canonical silent-zone case in crisis informatics literature:
 * Puerto Rico lost power grid and most cell towers, going digitally silent
 * for days despite catastrophic damage. The entire island was a silent zone
 * relative to its normal baseline.
 *
 * Municipalities (ADM2) modeled on Puerto Rico's 78 municipios; we model
 * the 14 most severely affected. Wind speeds are modeled on the NOAA wind
 * swath. Damage ratio uses the Emanuel (2011) wind→damage power law.
 *
 * Loud-but-less-affected unit for contrast:
 *   - San Juan (lower wind, dense urban connectivity → highest post volume)
 *
 * Silent Zone injections (high wind, very low post volume):
 *   - Yabucoa (landfall point, ~155 mph, communications destroyed)
 *   - Maunabo (east coast, direct hit, cut off for days)
 *   - Añasco (west, landslides + power loss)
 */

import type { AdminUnit, Post, EventMeta } from "../pipeline/types";
import type { EventDataset } from "./registry";

// ─── 14 most-affected municipios ─────────────────────────────────────────────
export const MARIA_DISTRICTS: AdminUnit[] = [
  {
    id: "PR-YABUCOA",
    name: "Yabucoa",
    adm_level: "ADM2",
    lat: 18.05,
    lon: -65.88,
    svg_path: "M520,330 L580,335 L590,375 L565,400 L520,395 L510,360 Z",
    population: 37_000,
    mmi: 69,              // wind m/s (155 mph) — epicenter of landfall
    vulnerability: 1.35,  // high poverty, aging infrastructure
    infrastructure: 1.45, // coastal, road network脆弱
    internet_penetration: 0.42,
    urban_share: 0.62,
    empirical_baseline: 7.8,   // active digital population
  },
  {
    id: "PR-MAUNABO",
    name: "Maunabo",
    adm_level: "ADM2",
    lat: 18.00,
    lon: -65.89,
    svg_path: "M510,400 L565,400 L580,430 L555,460 L515,455 L500,425 Z",
    population: 12_000,
    mmi: 67,
    vulnerability: 1.40,
    infrastructure: 1.50,
    internet_penetration: 0.38,
    urban_share: 0.45,
    empirical_baseline: 6.2,
  },
  {
    id: "PR-SAN-JUAN",
    name: "San Juan",
    adm_level: "ADM2",
    lat: 18.47,
    lon: -66.11,
    svg_path: "M380,200 L450,200 L460,250 L430,285 L380,280 L365,235 Z",
    population: 395_000,        // dense urban capital
    mmi: 52,                    // ~115 mph winds — strong but less than landfall
    vulnerability: 0.95,
    infrastructure: 0.85,       // good road density
    internet_penetration: 0.78,
    urban_share: 0.99,
    empirical_baseline: 88.4,   // highly digitally active
  },
  {
    id: "PR-CAGUAS",
    name: "Caguas",
    adm_level: "ADM2",
    lat: 18.23,
    lon: -66.04,
    svg_path: "M410,290 L470,290 L480,330 L455,365 L410,360 L395,325 Z",
    population: 142_000,
    mmi: 60,
    vulnerability: 1.10,
    infrastructure: 0.98,
    internet_penetration: 0.71,
    urban_share: 0.93,
    empirical_baseline: 56.7,
  },
  {
    id: "PR-BAYAMON",
    name: "Bayamón",
    adm_level: "ADM2",
    lat: 18.40,
    lon: -66.16,
    svg_path: "M335,225 L390,225 L400,265 L375,300 L330,295 L320,255 Z",
    population: 175_000,
    mmi: 55,
    vulnerability: 1.02,
    infrastructure: 0.92,
    internet_penetration: 0.74,
    urban_share: 0.97,
    empirical_baseline: 68.3,
  },
  {
    id: "PR-CAROLINA",
    name: "Carolina",
    adm_level: "ADM2",
    lat: 18.38,
    lon: -65.96,
    svg_path: "M440,225 L500,225 L510,265 L485,295 L445,290 L435,255 Z",
    population: 176_000,
    mmi: 58,
    vulnerability: 1.00,
    infrastructure: 0.90,
    internet_penetration: 0.76,
    urban_share: 0.98,
    empirical_baseline: 72.1,
  },
  {
    id: "PR-PONCE",
    name: "Ponce",
    adm_level: "ADM2",
    lat: 18.01,
    lon: -66.61,
    svg_path: "M195,360 L260,360 L270,400 L245,435 L200,430 L185,395 Z",
    population: 132_000,
    mmi: 48,
    vulnerability: 1.05,
    infrastructure: 0.95,
    internet_penetration: 0.68,
    urban_share: 0.92,
    empirical_baseline: 48.5,
  },
  {
    id: "PR-ANASCO",
    name: "Añasco",
    adm_level: "ADM2",
    lat: 18.28,
    lon: -67.12,
    svg_path: "M85,330 L145,330 L155,365 L130,395 L85,390 L75,355 Z",
    population: 28_000,
    mmi: 62,
    vulnerability: 1.25,
    infrastructure: 1.32,
    internet_penetration: 0.48,
    urban_share: 0.65,
    empirical_baseline: 9.1,
  },
  {
    id: "PR-MAYAGUEZ",
    name: "Mayagüez",
    adm_level: "ADM2",
    lat: 18.20,
    lon: -67.14,
    svg_path: "M80,395 L140,395 L155,430 L130,465 L85,460 L70,425 Z",
    population: 89_000,
    mmi: 58,
    vulnerability: 1.12,
    infrastructure: 1.05,
    internet_penetration: 0.65,
    urban_share: 0.78,
    empirical_baseline: 24.6,
  },
  {
    id: "PR-ARECIBO",
    name: "Arecibo",
    adm_level: "ADM2",
    lat: 18.47,
    lon: -66.72,
    svg_path: "M165,200 L230,200 L240,240 L215,275 L170,270 L155,235 Z",
    population: 96_000,
    mmi: 56,
    vulnerability: 1.08,
    infrastructure: 1.10,
    internet_penetration: 0.63,
    urban_share: 0.75,
    empirical_baseline: 28.4,
  },
  {
    id: "PR-UTUADO",
    name: "Utuado",
    adm_level: "ADM2",
    lat: 18.27,
    lon: -66.70,
    svg_path: "M225,265 L285,265 L295,300 L270,335 L225,330 L215,295 Z",
    population: 42_000,
    mmi: 60,
    vulnerability: 1.30,        // mountainous, landslides
    infrastructure: 1.40,
    internet_penetration: 0.45,
    urban_share: 0.40,
    empirical_baseline: 8.7,
  },
  {
    id: "PR-LARES",
    name: "Lares",
    adm_level: "ADM2",
    lat: 18.29,
    lon: -66.87,
    svg_path: "M165,330 L220,330 L230,365 L205,395 L165,390 L155,360 Z",
    population: 31_000,
    mmi: 58,
    vulnerability: 1.22,
    infrastructure: 1.28,
    internet_penetration: 0.50,
    urban_share: 0.45,
    empirical_baseline: 7.5,
  },
  {
    id: "PR-HUMACAO",
    name: "Humacao",
    adm_level: "ADM2",
    lat: 18.15,
    lon: -65.83,
    svg_path: "M510,295 L575,295 L585,335 L560,365 L515,360 L500,325 Z",
    population: 60_000,
    mmi: 65,                    // east coast, direct hit
    vulnerability: 1.15,
    infrastructure: 1.10,
    internet_penetration: 0.62,
    urban_share: 0.80,
    empirical_baseline: 18.9,
  },
  {
    id: "PR-VIEQUES",
    name: "Vieques",
    adm_level: "ADM2",
    lat: 18.12,
    lon: -65.44,
    svg_path: "M590,365 L625,365 L635,395 L615,420 L590,415 L580,385 Z",
    population: 9_000,
    mmi: 64,
    vulnerability: 1.35,        // island, isolated
    infrastructure: 1.45,
    internet_penetration: 0.40,
    urban_share: 0.35,
    empirical_baseline: 3.2,    // thin baseline — Detector B won't fire alone
  },
];

// ─── Templates: hurricane-specific posts ──────────────────────────────────────
type Template = {
  text: string;
  need_types: string[];
  urgency: 0 | 1 | 2 | 3;
  district_ids: string[];
  is_amp: boolean;
};

const TEMPLATES: Template[] = [
  // rescue_and_trapped
  { text: "trapped under collapsed roof in Yabucoa after Maria please send help", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["PR-YABUCOA"], is_amp: false },
  { text: "people trapped in Maunabo homes destroyed by hurricane winds", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["PR-MAUNABO"], is_amp: false },
  { text: "tree fell on house in Humacao, family trapped inside need rescue", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["PR-HUMACAO"], is_amp: false },
  { text: "trapped under debris in Utuado mountain village, landslides blocking roads", need_types: ["rescue_and_trapped", "road_and_access_blocked"], urgency: 3, district_ids: ["PR-UTUADO"], is_amp: false },

  // medical_and_injury
  { text: "hospital in San Juan overwhelmed with injuries, no power for equipment", need_types: ["medical_and_injury", "power_and_energy"], urgency: 3, district_ids: ["PR-SAN-JUAN"], is_amp: false },
  { text: "injured in Caguas, no doctor available, clinic without power", need_types: ["medical_and_injury"], urgency: 2, district_ids: ["PR-CAGUAS"], is_amp: false },
  { text: "Bayamon hospital running on generator, fuel running low", need_types: ["medical_and_injury", "power_and_energy"], urgency: 2, district_ids: ["PR-BAYAMON"], is_amp: false },
  { text: "Ponce medical supplies running out, no refrigeration for insulin", need_types: ["medical_and_injury", "power_and_energy"], urgency: 3, district_ids: ["PR-PONCE"], is_amp: false },

  // shelter_and_displacement
  { text: "thousands at San Juan convention center shelter, no more capacity", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["PR-SAN-JUAN"], is_amp: false },
  { text: "house destroyed in Yabucoa, sleeping in car with three kids", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["PR-YABUCOA"], is_amp: false },
  { text: "shelter in Humacao at capacity, families still arriving", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["PR-HUMACAO"], is_amp: false },
  { text: "lost our home in Mayagüez, need temporary shelter urgently", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["PR-MAYAGUEZ"], is_amp: false },
  { text: "RT thousands at San Juan convention center shelter, no more capacity", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["PR-SAN-JUAN"], is_amp: true },

  // water_and_sanitation
  { text: "no running water in Caguas for four days, pipes damaged", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["PR-CAGUAS"], is_amp: false },
  { text: "water supply cut across Bayamon, no estimate on restoration", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["PR-BAYAMON"], is_amp: false },
  { text: "Ponce water contaminated, do not drink from the tap", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["PR-PONCE"], is_amp: false },
  { text: "no water in Añasco, well water also contaminated by flooding", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["PR-ANASCO"], is_amp: false },

  // food_and_nutrition
  { text: "running out of food in Humacao shelter, grocery stores closed", need_types: ["food_and_nutrition"], urgency: 2, district_ids: ["PR-HUMACAO"], is_amp: false },
  { text: "no food or water distribution in Utuado mountain areas, cut off", need_types: ["food_and_nutrition", "road_and_access_blocked"], urgency: 2, district_ids: ["PR-UTUADO"], is_amp: false },
  { text: "Carolina families need food, lines at open stores miles long", need_types: ["food_and_nutrition"], urgency: 1, district_ids: ["PR-CAROLINA"], is_amp: false },

  // power_and_energy — Maria's signature crisis
  { text: "entire island without power, San Juan grid completely down", need_types: ["power_and_energy"], urgency: 2, district_ids: ["PR-SAN-JUAN"], is_amp: false },
  { text: "no power in Caguas third day, generator fuel scarce", need_types: ["power_and_energy"], urgency: 2, district_ids: ["PR-CAGUAS"], is_amp: false },
  { text: "Bayamon blackout, hospitals desperate for diesel", need_types: ["power_and_energy", "medical_and_injury"], urgency: 3, district_ids: ["PR-BAYAMON"], is_amp: false },
  { text: "Ponce power grid destroyed, weeks to restore", need_types: ["power_and_energy"], urgency: 1, district_ids: ["PR-PONCE"], is_amp: false },
  { text: "Añasco no electricity, no cell signal either, completely cut off", need_types: ["power_and_energy", "telecom_outage"], urgency: 3, district_ids: ["PR-ANASCO"], is_amp: false },
  { text: "RT entire island without power, San Juan grid completely down", need_types: ["power_and_energy"], urgency: 2, district_ids: ["PR-SAN-JUAN"], is_amp: true },
  { text: "Mayagüez power lines down everywhere, transformer exploded", need_types: ["power_and_energy"], urgency: 1, district_ids: ["PR-MAYAGUEZ"], is_amp: false },

  // telecom_outage — Maria's defining silent-zone driver
  { text: "no cell service in Yabucoa for three days, family outside can't reach us", need_types: ["telecom_outage"], urgency: 3, district_ids: ["PR-YABUCOA"], is_amp: false },
  { text: "Maunabo cell tower destroyed, no communication with anyone outside", need_types: ["telecom_outage"], urgency: 3, district_ids: ["PR-MAUNABO"], is_amp: false },
  { text: "Añasco signal gone since hurricane, completely isolated", need_types: ["telecom_outage"], urgency: 3, district_ids: ["PR-ANASCO"], is_amp: false },
  { text: "intermittent signal in Humacao, often no bars for hours", need_types: ["telecom_outage"], urgency: 1, district_ids: ["PR-HUMACAO"], is_amp: false },
  { text: "Utuado telecom down, can't call for rescue", need_types: ["telecom_outage", "rescue_and_trapped"], urgency: 3, district_ids: ["PR-UTUADO"], is_amp: false },
  { text: "Vieques cell tower fell, island completely in the dark", need_types: ["telecom_outage", "power_and_energy"], urgency: 3, district_ids: ["PR-VIEQUES"], is_amp: false },

  // road_and_access_blocked
  { text: "highway to Yabucoa blocked by debris, no trucks getting through", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["PR-YABUCOA"], is_amp: false },
  { text: "mountain roads to Utuado impassable, landslides everywhere", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["PR-UTUADO"], is_amp: false },
  { text: "bridge washed out near Añasco, can't cross to Mayagüez", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["PR-ANASCO"], is_amp: false },
  { text: "road to Lares closed, village cut off for two days", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["PR-LARES"], is_amp: false },
  { text: "highway 2 blocked at Arecibo, fallen trees blocking all lanes", need_types: ["road_and_access_blocked"], urgency: 1, district_ids: ["PR-ARECIBO"], is_amp: false },

  // missing_persons
  { text: "looking for my mother in Yabucoa, last spoke to her before landfall", need_types: ["missing_persons"], urgency: 2, district_ids: ["PR-YABUCOA"], is_amp: false },
  { text: "lost contact with family in Maunabo, please share if you have news", need_types: ["missing_persons"], urgency: 2, district_ids: ["PR-MAUNABO"], is_amp: false },
  { text: "missing uncle in Humacao, was alone when storm hit", need_types: ["missing_persons"], urgency: 2, district_ids: ["PR-HUMACAO"], is_amp: false },

  // protection_and_safety
  { text: "shelter in San Juan reports safety concerns at night, need lighting", need_types: ["protection_and_safety"], urgency: 1, district_ids: ["PR-SAN-JUAN"], is_amp: false },
  { text: "unaccompanied children at Caguas shelter, need protection officers", need_types: ["protection_and_safety"], urgency: 2, district_ids: ["PR-CAGUAS"], is_amp: false },

  // amplifications + non-humanitarian
  { text: "RT no cell service in Yabucoa for three days, family outside can't reach us", need_types: ["telecom_outage"], urgency: 3, district_ids: ["PR-YABUCOA"], is_amp: true },
  { text: "RT mountain roads to Utuado impassable, landslides everywhere", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["PR-UTUADO"], is_amp: true },
  { text: "RT no running water in Caguas for four days, pipes damaged", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["PR-CAGUAS"], is_amp: true },
  { text: "RT hospital in San Juan overwhelmed with injuries, no power for equipment", need_types: ["medical_and_injury", "power_and_energy"], urgency: 3, district_ids: ["PR-SAN-JUAN"], is_amp: true },
  { text: "praying for everyone in Puerto Rico from Miami, stay safe", need_types: [], urgency: 0, district_ids: ["PR-SAN-JUAN"], is_amp: false },
  { text: "donate to Puerto Rico hurricane relief, link in bio", need_types: [], urgency: 0, district_ids: ["PR-SAN-JUAN"], is_amp: false },
  { text: "thoughts with everyone affected by Hurricane Maria", need_types: [], urgency: 0, district_ids: ["PR-SAN-JUAN"], is_amp: false },
];

// ─── Pre-group templates by district ─────────────────────────────────────────
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
    `news from ${districtName} after Maria`,
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

// ─── Author hash ────────────────────────────────────────────────────────────
function hmacSha256Like(input: string, salt: string): string {
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
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

const SALT = "crisislens-maria-2017-v1";

function isoTimePlus(baseEpochMs: number, deltaMs: number): string {
  return new Date(baseEpochMs + deltaMs).toISOString();
}

// ─── Per-district post counts ──────────────────────────────────────────────
// Modeled on real HumAID Puerto Rico volumes. San Juan is loud, Yabucoa/Maunabo
// are silent (high wind, cut-off communications).
const DISTRICT_POST_COUNTS: Record<string, number> = {
  "PR-SAN-JUAN": 480,
  "PR-CAGUAS": 195,
  "PR-BAYAMON": 175,
  "PR-CAROLINA": 165,
  "PR-PONCE": 130,
  "PR-MAYAGUEZ": 95,
  "PR-ARECIBO": 85,
  "PR-HUMACAO": 75,
  // Silent zones
  "PR-YABUCOA": 7,    // baseline 7.8/day × 3 = 23.4 expected; observed ~6
  "PR-MAUNABO": 5,    // baseline 6.2 × 3 = 18.6; observed ~4
  "PR-ANASCO": 6,     // baseline 9.1 × 3 = 27.3; observed ~5
  "PR-UTUADO": 30,    // mountain but some signal
  "PR-LARES": 22,
  "PR-VIEQUES": 4,    // too thin for Detector B alone, but Detector A catches it
};

// ─── Post generator ──────────────────────────────────────────────────────────
export function generatePosts(): Post[] {
  const posts: Post[] = [];
  const impactEpoch = Date.UTC(2017, 8, 20, 10, 15, 0);
  const windowStart = impactEpoch - 14 * 24 * 60 * 60 * 1000;
  const windowEnd = impactEpoch + 96 * 60 * 60 * 1000;  // 4-day post-event window (Maria crisis lasted longer)

  // Pre-event chatter for baseline
  for (const d of MARIA_DISTRICTS) {
    if (d.empirical_baseline == null) continue;
    const perDay = Math.max(1, Math.round(d.empirical_baseline));
    const sampleDays = 5;
    for (let dayIdx = 0; dayIdx < sampleDays; dayIdx++) {
      const dayStart = windowStart + dayIdx * 24 * 60 * 60 * 1000;
      for (let i = 0; i < perDay; i++) {
        const ts = dayStart + Math.floor(Math.random() * 24 * 60 * 60 * 1000);
        const chatter = [
          `morning in ${d.name}, calm weather`,
          `life update from ${d.name}`,
          `weekend vibes in ${d.name}`,
          `weekend in ${d.name}, Puerto Rico`,
          `thinking about ${d.name} today`,
        ];
        posts.push({
          post_id: `maria:pre-${d.id}-${dayIdx}-${i}`,
          platform: "humaid",
          author_hash: hmacSha256Like(`pre-${d.id}-${dayIdx}-${i}-auth${Math.floor(Math.random() * perDay * 3)}`, SALT),
          text: chatter[Math.floor(Math.random() * chatter.length)],
          created_at: isoTimePlus(ts, 0),
          lang: "en",
          geo_point: null,
          author_declared_loc: d.name,
          parent_id: null,
          is_amplification: false,
          event_id: "maria-2017",
        });
      }
    }
  }

  // Post-event
  let counter = 0;
  for (const d of MARIA_DISTRICTS) {
    const n = DISTRICT_POST_COUNTS[d.id] ?? 20;
    const districtTemplates = TEMPLATES_BY_DISTRICT.get(d.id) ?? [];
    for (let i = 0; i < n; i++) {
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
      // Hour offset — post-event 96h
      const hourOffset = Math.floor(Math.pow(Math.random(), 1.6) * 96);
      const ts = impactEpoch + hourOffset * 60 * 60 * 1000;
      const authorIdx = Math.floor(i / 1.4) + Math.floor(Math.random() * 3);
      posts.push({
        post_id: `maria:post-${d.id}-${counter++}`,
        platform: "humaid",
        author_hash: hmacSha256Like(`${d.id}-auth${authorIdx}`, SALT),
        text: t.text,
        created_at: isoTimePlus(ts, Math.floor(Math.random() * 60 * 1000)),
        lang: "en",
        geo_point: null,
        author_declared_loc: d.name,
        parent_id: t.is_amp ? `maria:post-${d.id}-${Math.max(0, i - 5)}` : null,
        is_amplification: t.is_amp,
        event_id: "maria-2017",
      });
    }
  }

  return posts;
}

// ─── Event dataset export ────────────────────────────────────────────────────
const MARIA_2017_META: EventMeta = {
  event_id: "maria-2017",
  name: "Hurricane Maria 2017 (Puerto Rico)",
  hazard_type: "cyclone",
  country: "Puerto Rico",
  epicenter_lat: 18.05,
  epicenter_lon: -65.88,
  impact_utc: new Date(Date.UTC(2017, 8, 20, 10, 15, 0)).toISOString(),
  window_start_utc: new Date(Date.UTC(2017, 8, 20, 10, 15, 0) - 14 * 24 * 60 * 60 * 1000).toISOString(),
  window_end_utc: new Date(Date.UTC(2017, 8, 20, 10, 15, 0) + 96 * 60 * 60 * 1000).toISOString(),
  total_posts_ingested: 0,
  total_relevant_posts: 0,
  total_need_units: 0,
  total_silent_zones: 0,
  unlocated_share: 0,
};

export const MARIA_2017: EventDataset = {
  meta: MARIA_2017_META,
  units: MARIA_DISTRICTS,
  generatePosts,
  impactEpochMs: Date.UTC(2017, 8, 20, 10, 15, 0),
  windowHours: 96,
  hazardType: "cyclone",
};
