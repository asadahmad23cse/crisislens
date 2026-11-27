/**
 * Kerala Floods 2018 — Synthetic reference dataset
 *
 * Scenario: August 2018, Kerala state (India) experienced the worst flooding
 * in nearly a century. Heavy monsoon rains + opening of dam shutters caused
 * widespread flooding across 14 districts from August 9–23.
 *
 * The canonical "evacuation-as-confounder" case: many severely-affected
 * areas had low post volume because residents had been evacuated BEFORE
 * the flooding peaked, not because communications failed. This is exactly
 * the confounder PRD §6.7 warns about — the system must surface the
 * evacuation flag rather than blindly marking these as silent zones.
 *
 * Silent Zone injections:
 *   - Idukki (origin of flooding, dam release, low post volume)
 *   - Pathanamthitta (downstream flooding, evacuation, near-silent)
 *
 * Evacuation-confounder case:
 *   - Alappuzha (Kuttanad lowlands, evacuated before flooding peaked → low
 *     post volume from residents, but system should flag evacuation rather
 *     than treat as telecom failure)
 *
 * Loud-but-affected unit:
 *   - Ernakulam (Kochi metro, dense urban connectivity → high post volume
 *     AND high flooding — but still ranks lower priority than absolute silent zones)
 */

import type { AdminUnit, Post, EventMeta } from "../pipeline/types";
import type { EventDataset } from "./registry";

// ─── 14 affected districts (Kerala government report) ──────────────────────
export const KERALA_DISTRICTS: AdminUnit[] = [
  {
    id: "IN-Idukki",
    name: "Idukki",
    adm_level: "ADM2",
    lat: 9.85,
    lon: 76.97,
    svg_path: "M340,260 L410,255 L425,295 L400,330 L345,325 L330,290 Z",
    population: 1_107_000,
    mmi: 4.5,              // flood depth m (mmi field reused for cyclone/flood)
    vulnerability: 1.20,  // hilly terrain, landslide-prone
    infrastructure: 1.25,
    internet_penetration: 0.42,
    urban_share: 0.18,
    empirical_baseline: 11.5,
  },
  {
    id: "IN-Pathanamthitta",
    name: "Pathanamthitta",
    adm_level: "ADM2",
    lat: 9.27,
    lon: 76.79,
    svg_path: "M345,330 L410,335 L425,375 L405,405 L350,400 L335,365 Z",
    population: 1_195_000,
    mmi: 5.2,
    vulnerability: 1.18,
    infrastructure: 1.20,
    internet_penetration: 0.45,
    urban_share: 0.15,
    empirical_baseline: 10.8,
  },
  {
    id: "IN-Alappuzha",
    name: "Alappuzha",
    adm_level: "ADM2",
    lat: 9.49,
    lon: 76.33,
    svg_path: "M250,365 L320,360 L335,395 L315,425 L260,420 L245,390 Z",
    population: 2_121_000,
    mmi: 4.8,
    vulnerability: 1.32,  // Kuttanad lowlands, evacuation ordered
    infrastructure: 1.10,
    internet_penetration: 0.55,
    urban_share: 0.40,
    empirical_baseline: 18.6,
  },
  {
    id: "IN-Ernakulam",
    name: "Ernakulam",
    adm_level: "ADM2",
    lat: 10.01,
    lon: 76.27,
    svg_path: "M215,295 L285,290 L300,330 L280,365 L220,360 L205,325 Z",
    population: 3_279_000,        // Kochi metro — dense urban
    mmi: 3.8,
    vulnerability: 0.95,
    infrastructure: 0.85,
    internet_penetration: 0.78,
    urban_share: 0.68,
    empirical_baseline: 92.3,
  },
  {
    id: "IN-Kottayam",
    name: "Kottayam",
    adm_level: "ADM2",
    lat: 9.59,
    lon: 76.52,
    svg_path: "M285,335 L345,330 L355,365 L335,395 L285,390 L275,360 Z",
    population: 1_945_000,
    mmi: 4.2,
    vulnerability: 1.05,
    infrastructure: 1.00,
    internet_penetration: 0.58,
    urban_share: 0.28,
    empirical_baseline: 24.8,
  },
  {
    id: "IN-Thrissur",
    name: "Thrissur",
    adm_level: "ADM2",
    lat: 10.52,
    lon: 76.21,
    svg_path: "M180,235 L255,230 L270,275 L250,310 L195,305 L175,265 Z",
    population: 3_110_000,
    mmi: 3.5,
    vulnerability: 1.00,
    infrastructure: 0.92,
    internet_penetration: 0.65,
    urban_share: 0.35,
    empirical_baseline: 38.2,
  },
  {
    id: "IN-Palakkad",
    name: "Palakkad",
    adm_level: "ADM2",
    lat: 10.79,
    lon: 76.65,
    svg_path: "M270,180 L345,180 L360,225 L340,260 L280,255 L265,215 Z",
    population: 1_321_000,
    mmi: 3.0,
    vulnerability: 1.02,
    infrastructure: 1.05,
    internet_penetration: 0.50,
    urban_share: 0.25,
    empirical_baseline: 19.4,
  },
  {
    id: "IN-Malappuram",
    name: "Malappuram",
    adm_level: "ADM2",
    lat: 11.05,
    lon: 76.07,
    svg_path: "M180,135 L255,130 L270,175 L250,210 L195,205 L175,165 Z",
    population: 4_112_000,
    mmi: 3.2,
    vulnerability: 1.08,
    infrastructure: 1.08,
    internet_penetration: 0.55,
    urban_share: 0.28,
    empirical_baseline: 28.6,
  },
  {
    id: "IN-Kozhikode",
    name: "Kozhikode",
    adm_level: "ADM2",
    lat: 11.25,
    lon: 75.78,
    svg_path: "M95,115 L170,110 L185,155 L165,190 L110,185 L90,150 Z",
    population: 3_086_000,
    mmi: 3.4,
    vulnerability: 1.05,
    infrastructure: 1.00,
    internet_penetration: 0.62,
    urban_share: 0.40,
    empirical_baseline: 32.5,
  },
  {
    id: "IN-Kannur",
    name: "Kannur",
    adm_level: "ADM2",
    lat: 11.87,
    lon: 75.37,
    svg_path: "M40,75 L120,70 L135,115 L115,150 L55,145 L35,110 Z",
    population: 2_523_000,
    mmi: 2.8,
    vulnerability: 1.00,
    infrastructure: 1.05,
    internet_penetration: 0.58,
    urban_share: 0.32,
    empirical_baseline: 22.7,
  },
  {
    id: "IN-Wayanad",
    name: "Wayanad",
    adm_level: "ADM2",
    lat: 11.69,
    lon: 76.25,
    svg_path: "M170,90 L240,85 L255,125 L235,160 L180,155 L165,120 Z",
    population: 846_000,
    mmi: 3.6,                    // hilly, landslides
    vulnerability: 1.22,
    infrastructure: 1.32,
    internet_penetration: 0.40,
    urban_share: 0.10,
    empirical_baseline: 7.5,
  },
  {
    id: "IN-Kollam",
    name: "Kollam",
    adm_level: "ADM2",
    lat: 8.89,
    lon: 76.61,
    svg_path: "M340,395 L415,395 L430,435 L405,470 L345,465 L325,425 Z",
    population: 2_635_000,
    mmi: 3.5,
    vulnerability: 1.02,
    infrastructure: 1.00,
    internet_penetration: 0.60,
    urban_share: 0.30,
    empirical_baseline: 26.4,
  },
  {
    id: "IN-Thiruvananthapuram",
    name: "Thiruvananthapuram",
    adm_level: "ADM2",
    lat: 8.52,
    lon: 76.94,
    svg_path: "M380,440 L455,440 L470,475 L445,510 L390,505 L370,470 Z",
    population: 3_301_000,         // state capital
    mmi: 2.5,
    vulnerability: 0.95,
    infrastructure: 0.88,
    internet_penetration: 0.72,
    urban_share: 0.55,
    empirical_baseline: 48.6,
  },
  {
    id: "IN-Kasaragod",
    name: "Kasaragod",
    adm_level: "ADM2",
    lat: 12.50,
    lon: 74.99,
    svg_path: "M40,30 L115,25 L130,65 L110,100 L55,95 L35,60 Z",
    population: 1_307_000,
    mmi: 2.6,
    vulnerability: 1.00,
    infrastructure: 1.05,
    internet_penetration: 0.55,
    urban_share: 0.25,
    empirical_baseline: 14.8,
  },
];

// ─── Templates: flood-specific posts ─────────────────────────────────────────
type Template = {
  text: string;
  need_types: string[];
  urgency: 0 | 1 | 2 | 3;
  district_ids: string[];
  is_amp: boolean;
};

const TEMPLATES: Template[] = [
  // rescue_and_trapped — flood-specific (rooftop rescues)
  { text: "trapped on rooftop in Alappuzha Kuttanad, water rising fast please send boat", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["IN-Alappuzha"], is_amp: false },
  { text: "family stuck on second floor in Pathanamthitta, floodwater entering ground floor", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["IN-Pathanamthitta"], is_amp: false },
  { text: "stranded in Idukki hills, landslides cut off all routes, need helicopter rescue", need_types: ["rescue_and_trapped", "road_and_access_blocked"], urgency: 3, district_ids: ["IN-Idukki"], is_amp: false },
  { text: "elderly parents trapped in Wayanad house, water all around, no boat yet", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["IN-Wayanad"], is_amp: false },
  { text: "RT trapped on rooftop in Alappuzha Kuttanad, water rising fast please send boat", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["IN-Alappuzha"], is_amp: true },

  // medical_and_injury
  { text: "snake bite in Ernakulam relief camp, no antivenom available", need_types: ["medical_and_injury"], urgency: 3, district_ids: ["IN-Ernakulam"], is_amp: false },
  { text: "injured during evacuation in Kottayam, need medical attention", need_types: ["medical_and_injury"], urgency: 2, district_ids: ["IN-Kottayam"], is_amp: false },
  { text: "Thrissur hospital flooded ground floor, patients moved upstairs", need_types: ["medical_and_injury"], urgency: 2, district_ids: ["IN-Thrissur"], is_amp: false },
  { text: "running out of insulin in Pathanamthitta camp, diabetic patients urgent", need_types: ["medical_and_injury"], urgency: 3, district_ids: ["IN-Pathanamthitta"], is_amp: false },

  // shelter_and_displacement — Kerala's massive displacement (1M+ in camps)
  { text: "thousands in Ernakulam relief camps, need more space and bedding", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["IN-Ernakulam"], is_amp: false },
  { text: "Alappuzha camps overflowing, families sleeping in school corridors", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["IN-Alappuzha"], is_amp: false },
  { text: "Pathanamthitta relief camp needs more tents, people keep arriving", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["IN-Pathanamthitta"], is_amp: false },
  { text: "Kottayam shelter shortage, monsoon rains making it worse", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["IN-Kottayam"], is_amp: false },
  { text: "RT thousands in Ernakulam relief camps, need more space and bedding", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["IN-Ernakulam"], is_amp: true },

  // water_and_sanitation — flood-contaminated water is the post-flood killer
  { text: "drinking water contaminated in Alappuzha, wells flooded, need bottled water", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["IN-Alappuzha"], is_amp: false },
  { text: "no clean water in Pathanamthitta camps, diarrhea cases rising", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["IN-Pathanamthitta"], is_amp: false },
  { text: "Idukki water sources contaminated by landslide debris", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["IN-Idukki"], is_amp: false },
  { text: "Kottayam sanitation crisis in camps, need toilets urgently", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["IN-Kottayam"], is_amp: false },
  { text: "leptospirosis risk in Ernakulam floodwater, need preventive medication", need_types: ["water_and_sanitation", "medical_and_injury"], urgency: 2, district_ids: ["IN-Ernakulam"], is_amp: false },

  // food_and_nutrition
  { text: "no food in Pathanamthitta relief camp for 24 hours", need_types: ["food_and_nutrition"], urgency: 2, district_ids: ["IN-Pathanamthitta"], is_amp: false },
  { text: "Ernakulam camps need baby food and milk, running out", need_types: ["food_and_nutrition"], urgency: 2, district_ids: ["IN-Ernakulam"], is_amp: false },
  { text: "Alappuzha families stranded without food for two days", need_types: ["food_and_nutrition"], urgency: 2, district_ids: ["IN-Alappuzha"], is_amp: false },
  { text: "Wayanad tribal villages cut off, no food supplies reaching them", need_types: ["food_and_nutrition", "road_and_access_blocked"], urgency: 2, district_ids: ["IN-Wayanad"], is_amp: false },

  // power_and_energy
  { text: "no power in Ernakulam since transformer submerged, third day", need_types: ["power_and_energy"], urgency: 1, district_ids: ["IN-Ernakulam"], is_amp: false },
  { text: "Kottayam electricity cut, substation flooded", need_types: ["power_and_energy"], urgency: 1, district_ids: ["IN-Kottayam"], is_amp: false },
  { text: "Idukki power grid damaged, restoring will take days", need_types: ["power_and_energy"], urgency: 1, district_ids: ["IN-Idukki"], is_amp: false },

  // telecom_outage
  { text: "no cell signal in Idukki hills for two days, completely cut off", need_types: ["telecom_outage"], urgency: 3, district_ids: ["IN-Idukki"], is_amp: false },
  { text: "Pathanamthitta cell tower underwater, intermittent signal only", need_types: ["telecom_outage"], urgency: 2, district_ids: ["IN-Pathanamthitta"], is_amp: false },
  { text: "Wayanad signal lost since landslide, no way to call for rescue", need_types: ["telecom_outage"], urgency: 3, district_ids: ["IN-Wayanad"], is_amp: false },
  { text: "intermittent signal in Alappuzha, hard to coordinate rescue", need_types: ["telecom_outage"], urgency: 1, district_ids: ["IN-Alappuzha"], is_amp: false },

  // road_and_access_blocked — flood-specific (roads submerged, bridges washed out)
  { text: "Munnar road washed away, Idukki hill stations completely cut off", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["IN-Idukki"], is_amp: false },
  { text: "MC Road blocked at Kottayam by landslide, no traffic moving", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["IN-Kottayam"], is_amp: false },
  { text: "NH66 flooded in Alappuzha, no vehicles getting through", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["IN-Alappuzha"], is_amp: false },
  { text: "Wayanad ghat road blocked by landslides, district cut off", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["IN-Wayanad"], is_amp: false },
  { text: "bridge collapsed in Pathanamthitta, isolating villages", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["IN-Pathanamthitta"], is_amp: false },
  { text: "RT Munnar road washed away, Idukki hill stations completely cut off", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["IN-Idukki"], is_amp: true },

  // missing_persons
  { text: "looking for my brother in Alappuzha, last seen near Pamba river", need_types: ["missing_persons"], urgency: 2, district_ids: ["IN-Alappuzha"], is_amp: false },
  { text: "lost contact with family in Idukki, anyone heard from them?", need_types: ["missing_persons"], urgency: 2, district_ids: ["IN-Idukki"], is_amp: false },
  { text: "missing uncle in Pathanamthitta, was near flooded area", need_types: ["missing_persons"], urgency: 2, district_ids: ["IN-Pathanamthitta"], is_amp: false },

  // protection_and_safety
  { text: "women's safety concern in Ernakulam relief camp, need separate facilities", need_types: ["protection_and_safety"], urgency: 1, district_ids: ["IN-Ernakulam"], is_amp: false },
  { text: "unaccompanied children in Alappuzha camps, need protection officers", need_types: ["protection_and_safety"], urgency: 2, district_ids: ["IN-Alappuzha"], is_amp: false },

  // amplifications + non-humanitarian
  { text: "RT trapped on rooftop in Alappuzha Kuttanad, water rising fast please send boat", need_types: ["rescue_and_trapped"], urgency: 3, district_ids: ["IN-Alappuzha"], is_amp: true },
  { text: "RT no clean water in Pathanamthitta camps, diarrhea cases rising", need_types: ["water_and_sanitation"], urgency: 2, district_ids: ["IN-Pathanamthitta"], is_amp: true },
  { text: "RT Munnar road washed away, Idukki hill stations completely cut off", need_types: ["road_and_access_blocked"], urgency: 2, district_ids: ["IN-Idukki"], is_amp: true },
  { text: "RT thousands in Ernakulam relief camps, need more space and bedding", need_types: ["shelter_and_displacement"], urgency: 2, district_ids: ["IN-Ernakulam"], is_amp: true },
  { text: "praying for Kerala from Bangalore, stay safe everyone", need_types: [], urgency: 0, district_ids: ["IN-Ernakulam"], is_amp: false },
  { text: "donate to Kerala flood relief, link in bio", need_types: [], urgency: 0, district_ids: ["IN-Ernakulam"], is_amp: false },
  { text: "thoughts with everyone affected by Kerala floods", need_types: [], urgency: 0, district_ids: ["IN-Ernakulam"], is_amp: false },
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
    `monsoon news from ${districtName}`,
    `awaiting information from ${districtName}`,
    `weather report ${districtName}`,
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

const SALT = "crisislens-kerala-2018-v1";

function isoTimePlus(baseEpochMs: number, deltaMs: number): string {
  return new Date(baseEpochMs + deltaMs).toISOString();
}

// ─── Per-district post counts ──────────────────────────────────────────────
// Ernakulam is loud (Kochi metro, dense connectivity). Idukki and Pathanamthitta
// are silent (high flooding, cut-off communications). Alappuzha is the
// evacuation-confounder case (residents evacuated before flooding peaked).
const DISTRICT_POST_COUNTS: Record<string, number> = {
  "IN-Ernakulam": 510,
  "IN-Thrissur": 195,
  "IN-Kottayam": 165,
  "IN-Kollam": 130,
  "IN-Thiruvananthapuram": 145,
  "IN-Kozhikode": 105,
  "IN-Malappuram": 95,
  "IN-Palakkad": 85,
  "IN-Kannur": 75,
  "IN-Alappuzha": 8,      // EVACUATION case — should be flagged with evacuation
  // silent zones
  "IN-Idukki": 6,
  "IN-Pathanamthitta": 7,
  "IN-Wayanad": 35,       // some signal but partial
  "IN-Kasaragod": 65,
};

// ─── Post generator ──────────────────────────────────────────────────────────
export function generatePosts(): Post[] {
  const posts: Post[] = [];
  // Peak flooding: August 16, 2018 (Idukki dam release + heavy rains)
  const impactEpoch = Date.UTC(2018, 7, 16, 6, 0, 0);
  const windowStart = impactEpoch - 14 * 24 * 60 * 60 * 1000;
  const windowEnd = impactEpoch + 96 * 60 * 60 * 1000;

  // Pre-event chatter
  for (const d of KERALA_DISTRICTS) {
    if (d.empirical_baseline == null) continue;
    const perDay = Math.max(1, Math.round(d.empirical_baseline));
    const sampleDays = 5;
    for (let dayIdx = 0; dayIdx < sampleDays; dayIdx++) {
      const dayStart = windowStart + dayIdx * 24 * 60 * 60 * 1000;
      for (let i = 0; i < perDay; i++) {
        const ts = dayStart + Math.floor(Math.random() * 24 * 60 * 60 * 1000);
        const chatter = [
          `morning in ${d.name}, normal day`,
          `monsoon rain update ${d.name}`,
          `life in ${d.name}, Kerala`,
          `tea time in ${d.name}`,
          `${d.name} news today`,
        ];
        posts.push({
          post_id: `kerala:pre-${d.id}-${dayIdx}-${i}`,
          platform: "humaid",
          author_hash: hmacSha256Like(`pre-${d.id}-${dayIdx}-${i}-auth${Math.floor(Math.random() * perDay * 3)}`, SALT),
          text: chatter[Math.floor(Math.random() * chatter.length)],
          created_at: isoTimePlus(ts, 0),
          lang: "en",
          geo_point: null,
          author_declared_loc: d.name,
          parent_id: null,
          is_amplification: false,
          event_id: "kerala-2018",
        });
      }
    }
  }

  // Post-event
  let counter = 0;
  for (const d of KERALA_DISTRICTS) {
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
      const hourOffset = Math.floor(Math.pow(Math.random(), 1.6) * 96);
      const ts = impactEpoch + hourOffset * 60 * 60 * 1000;
      const authorIdx = Math.floor(i / 1.4) + Math.floor(Math.random() * 3);
      posts.push({
        post_id: `kerala:post-${d.id}-${counter++}`,
        platform: "humaid",
        author_hash: hmacSha256Like(`${d.id}-auth${authorIdx}`, SALT),
        text: t.text,
        created_at: isoTimePlus(ts, Math.floor(Math.random() * 60 * 1000)),
        lang: "en",
        geo_point: null,
        author_declared_loc: d.name,
        parent_id: t.is_amp ? `kerala:post-${d.id}-${Math.max(0, i - 5)}` : null,
        is_amplification: t.is_amp,
        event_id: "kerala-2018",
      });
    }
  }

  return posts;
}

// ─── Event dataset export ────────────────────────────────────────────────────
const KERALA_2018_META: EventMeta = {
  event_id: "kerala-2018",
  name: "Kerala Floods 2018 (India)",
  hazard_type: "flood",
  country: "India",
  epicenter_lat: 9.85,
  epicenter_lon: 76.97,
  impact_utc: new Date(Date.UTC(2018, 7, 16, 6, 0, 0)).toISOString(),
  window_start_utc: new Date(Date.UTC(2018, 7, 16, 6, 0, 0) - 14 * 24 * 60 * 60 * 1000).toISOString(),
  window_end_utc: new Date(Date.UTC(2018, 7, 16, 6, 0, 0) + 96 * 60 * 60 * 1000).toISOString(),
  total_posts_ingested: 0,
  total_relevant_posts: 0,
  total_need_units: 0,
  total_silent_zones: 0,
  unlocated_share: 0,
};

export const KERALA_2018: EventDataset = {
  meta: KERALA_2018_META,
  units: KERALA_DISTRICTS,
  generatePosts,
  impactEpochMs: Date.UTC(2018, 7, 16, 6, 0, 0),
  windowHours: 96,
  hazardType: "flood",
};
