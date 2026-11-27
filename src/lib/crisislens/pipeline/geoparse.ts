/**
 * CrisisLens — Stage 3: Geoparsing
 *
 * Toponym recognition → role classification → resolution → admin snapping.
 * Synthetic implementation: looks up district names in the post text, decides
 * content-vs-author location using trigger words ("in", "at", "from", "near"),
 * snaps to the matching AdminUnit, and assigns calibrated confidence.
 *
 * PRD §6.3 — the distinction that most systems get wrong:
 *   "Praying for everyone in Gorkha from London"
 *   → content_location = Gorkha, author_location = London
 */

import type { AdminUnit, GeocodeResult, Post } from "./types";

// Triggers that indicate AUTHOR location ("I am in", "from London", "tweeting from")
const AUTHOR_TRIGGERS = [
  "from ", "i am in ", "i'm in ", "tweeting from ", "live in ",
  "based in ", "currently in ",
];

// Triggers that indicate CONTENT location ("need help in", "trapped at", "in Gorkha")
const CONTENT_TRIGGERS = [
  "in ", "at ", "near ", "here in ", "around ", "village in ",
  "highway at ", "highway blocked at ", "clinic in ", "hospital in ",
];

export function geoparsePost(
  post: Post,
  districts: AdminUnit[],
): GeocodeResult | null {
  // 1. Geo point (rare but high-confidence)
  if (post.geo_point) {
    // Find nearest district by haversine
    let nearest = districts[0];
    let bestDist = Infinity;
    for (const d of districts) {
      const dx = d.lon - post.geo_point!.lon;
      const dy = d.lat - post.geo_point!.lat;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; nearest = d; }
    }
    return {
      admin_unit_id: nearest.id,
      admin_unit_name: nearest.name,
      resolution: nearest.adm_level,
      confidence: 0.95,
      content_location: true,
      lat: post.geo_point.lat,
      lon: post.geo_point.lon,
      source: "geo_point",
    };
  }

  const text = post.text.toLowerCase();

  // 2. Find district mentions
  const matches: { district: AdminUnit; index: number }[] = [];
  for (const d of districts) {
    const idx = text.indexOf(d.name.toLowerCase());
    if (idx >= 0) matches.push({ district: d, index: idx });
  }

  // Check author-declared location as fallback (lower confidence, ADM0/ADM1)
  let authorLocDistrict: AdminUnit | null = null;
  if (post.author_declared_loc) {
    const dl = post.author_declared_loc.toLowerCase();
    authorLocDistrict =
      districts.find((d) => dl.includes(d.name.toLowerCase())) ?? null;
  }

  if (matches.length === 0) {
    // No toponym in text — try author_loc fallback
    if (authorLocDistrict) {
      return {
        admin_unit_id: authorLocDistrict.id,
        admin_unit_name: authorLocDistrict.name,
        resolution: authorLocDistrict.adm_level,
        confidence: 0.42,  // low — author loc is weak proxy for content loc
        content_location: false,
        lat: authorLocDistrict.lat,
        lon: authorLocDistrict.lon,
        source: "author_loc",
      };
    }
    return null;
  }

  // 3. Role classification for each match — pick the BEST content_location candidate
  let bestContent: { district: AdminUnit; confidence: number } | null = null;
  let bestAuthor: { district: AdminUnit; confidence: number } | null = null;

  for (const m of matches) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    const after = text.slice(m.index + m.district.name.length, m.index + m.district.name.length + 30);
    const isAuthor =
      AUTHOR_TRIGGERS.some((t) => before.endsWith(t) || after.startsWith(" from"));
    const isContent =
      CONTENT_TRIGGERS.some((t) => before.endsWith(t)) ||
      // Default: a district mention in a humanitarian post is content location
      (!isAuthor && /help|trapped|need|urgent|collapsed|injured|missing|blocked|no\s|shelter|water|food|power|signal/i.test(before + after));

    if (isAuthor && !bestAuthor) {
      bestAuthor = { district: m.district, confidence: 0.55 };
    }
    if (isContent) {
      // Confidence depends on proximity to a humanitarian trigger word
      const triggerProximity = /help|trapped|urgent|injured|missing|blocked|collapsed|need|shelter|water|food|power|signal|highway|clinic|hospital/i
        .test(before + after) ? 0.85 : 0.70;
      if (!bestContent || triggerProximity > bestContent.confidence) {
        bestContent = { district: m.district, confidence: triggerProximity };
      }
    }
  }

  // 4. Snap to admin unit — prefer content location, fall back to author loc
  if (bestContent) {
    return {
      admin_unit_id: bestContent.district.id,
      admin_unit_name: bestContent.district.name,
      resolution: bestContent.district.adm_level,
      confidence: bestContent.confidence,
      content_location: true,
      lat: bestContent.district.lat,
      lon: bestContent.district.lon,
      source: "toponym_resolution",
    };
  }
  if (bestAuthor) {
    return {
      admin_unit_id: bestAuthor.district.id,
      admin_unit_name: bestAuthor.district.name,
      resolution: bestAuthor.district.adm_level,
      confidence: bestAuthor.confidence,
      content_location: false,
      lat: bestAuthor.district.lat,
      lon: bestAuthor.district.lon,
      source: "toponym_resolution",
    };
  }
  // 5. Mention exists but no role decided — treat as content location with low confidence
  const m = matches[0];
  return {
    admin_unit_id: m.district.id,
    admin_unit_name: m.district.name,
    resolution: m.district.adm_level,
    confidence: 0.50,
    content_location: true,
    lat: m.district.lat,
    lon: m.district.lon,
    source: "toponym_resolution",
  };
}

// Explicit test case from PRD §6.3 acceptance criteria
export function _gorkhaLondonTestCase(): boolean {
  const districts: AdminUnit[] = [
    { id: "GORKHA", name: "Gorkha", adm_level: "ADM2", lat: 28.29, lon: 84.62,
      svg_path: "", population: 271000, mmi: 9, vulnerability: 1.3,
      infrastructure: 1.4, internet_penetration: 0.18, urban_share: 0.14,
      empirical_baseline: 6 },
    { id: "LONDON", name: "London", adm_level: "ADM1", lat: 51.5, lon: -0.12,
      svg_path: "", population: 8000000, mmi: 0, vulnerability: 0.5,
      infrastructure: 0.5, internet_penetration: 0.95, urban_share: 1.0,
      empirical_baseline: 100 },
  ];
  const post: Post = {
    post_id: "test1",
    platform: "humaid",
    author_hash: "x",
    text: "Praying for everyone in Gorkha from London",
    created_at: new Date().toISOString(),
    lang: "en",
    geo_point: null,
    author_declared_loc: null,
    parent_id: null,
    is_amplification: false,
    event_id: "test",
  };
  const r = geoparsePost(post, districts);
  return r?.admin_unit_id === "GORKHA" && r.content_location === true;
}
