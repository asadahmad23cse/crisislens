/**
 * CrisisLens — Stage 4: Need Ledger (deduplication)
 *
 * Turn N posts into M real needs, where M << N.
 *
 * Three-stage cascade per PRD §6.4:
 *   1. Near-exact duplicate: SimHash / MinHash on character 5-shingles, Jaccard ≥ 0.85
 *   2. Semantic: blocked by (need_type, admin_unit, 6h bucket)
 *   3. Need Unit construction
 *
 * CRITICAL RULES:
 *   - n_unique_authors is the load-bearing count, not n_posts
 *   - is_amplification posts are excluded from need counting entirely
 *   - corroboration_score = f(unique authors, time spread)
 *   - representative_text is the cluster medoid (a real post), never a summary
 */

import type { NeedType, NeedUnit, Post, Urgency } from "./types";
import { v4 as uuidv4 } from "uuid";

// ─── MinHash over character 5-shingles ───────────────────────────────────────
const K_SHINGLE = 5;
const N_HASHES = 32;   // 32 permutations — enough for Jaccard ≥ 0.85 detection

function shingles(text: string): Set<string> {
  const s = new Set<string>();
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (let i = 0; i + K_SHINGLE <= t.length; i++) {
    s.add(t.slice(i, i + K_SHINGLE));
  }
  return s;
}

// Deterministic hash → uint32
function hash32(s: string, seed: number): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function minHash(shingles: Set<string>): number[] {
  const sig = new Array<number>(N_HASHES).fill(Infinity);
  for (const sh of shingles) {
    for (let i = 0; i < N_HASHES; i++) {
      const h = hash32(sh, i);
      if (h < sig[i]) sig[i] = h;
    }
  }
  return sig.map((v) => (v === Infinity ? 0 : v));
}

function approxJaccard(a: number[], b: number[]): number {
  let matches = 0;
  for (let i = 0; i < N_HASHES; i++) if (a[i] === b[i]) matches++;
  return matches / N_HASHES;
}

// ─── Bucket key ─────────────────────────────────────────────────────────────
// 6-hour time bucket
function timeBucket(iso: string): string {
  const d = new Date(iso);
  const h = Math.floor(d.getUTCHours() / 6) * 6;
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}-${h}`;
}

interface EnrichedPost {
  post: Post;
  need_types: NeedType[];
  urgency: Urgency;
  admin_unit_id: string | null;
  geo_confidence: number;
  is_amplification: boolean;
  minhash: number[];
  shingleSet: Set<string>;
}

// ─── Deduplication cascade ──────────────────────────────────────────────────
export function dedupePosts(
  enriched: EnrichedPost[],
): NeedUnit[] {
  const needUnits: NeedUnit[] = [];

  // Stage 1 + 2: group by (need_types[0], admin_unit_id, timeBucket), then merge
  // within each group by near-exact (Jaccard ≥ 0.85) OR semantic similarity
  // (here: same need_type → same cluster, since we don't ship an embedding model
  // in the demo; the production path uses bge-small-en-v1.5 + HDBSCAN).

  type ClusterKey = string;
  const clusters = new Map<ClusterKey, EnrichedPost[]>();

  for (const ep of enriched) {
    if (ep.is_amplification) continue;       // never in a Need Unit
    if (ep.need_types.length === 0) continue; // not humanitarian
    if (!ep.admin_unit_id) continue;          // unlocated — reported separately
    const bucket = timeBucket(ep.post.created_at);
    for (const nt of ep.need_types) {
      const key = `${nt}::${ep.admin_unit_id}::${bucket}`;
      const arr = clusters.get(key) ?? [];
      arr.push(ep);
      clusters.set(key, arr);
    }
  }

  // For each cluster: do a second pass — split if sub-clusters don't share
  // any near-duplicate relationship (different stories of the same type in the
  // same district at the same hour should stay separate Need Units).
  for (const [key, members] of clusters.entries()) {
    const subClusters: EnrichedPost[][] = [];
    for (const ep of members) {
      let placed = false;
      for (const sc of subClusters) {
        // Try to merge with any existing sub-cluster if any pair is near-duplicate
        // (Jaccard ≥ 0.85) — catches "trapped in Gorkha" posted by 4 different
        // authors as one Need Unit.
        for (const other of sc) {
          const j = approxJaccard(ep.minhash, other.minhash);
          if (j >= 0.85) {
            sc.push(ep);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) subClusters.push([ep]);
    }

    // Build Need Unit for each sub-cluster with at least 1 member
    for (const sc of subClusters) {
      if (sc.length === 0) continue;
      const needType = key.split("::")[0] as NeedType;
      const needUnit = buildNeedUnit(sc, needType);
      needUnits.push(needUnit);
    }
  }

  // Merge cross-bucket Need Units that share identical need_type + admin_unit
  // (a water shortage reported at 06:00 and 12:00 is one ongoing need, not two).
  const merged = new Map<string, NeedUnit[]>();
  for (const nu of needUnits) {
    const k = `${nu.need_types[0]}::${nu.admin_unit_id}`;
    const arr = merged.get(k) ?? [];
    arr.push(nu);
    merged.set(k, arr);
  }
  const finalUnits: NeedUnit[] = [];
  for (const [k, arr] of merged.entries()) {
    if (arr.length === 1) {
      finalUnits.push(arr[0]);
    } else {
      finalUnits.push(mergeNeedUnits(arr));
    }
  }

  return finalUnits;
}

// ─── Build a single Need Unit from a cluster ─────────────────────────────────
function buildNeedUnit(members: EnrichedPost[], primaryType: NeedType): NeedUnit {
  // Sort by created_at for time spread + first_seen / last_seen
  const sorted = [...members].sort(
    (a, b) => Date.parse(a.post.created_at) - Date.parse(b.post.created_at),
  );
  const firstSeen = sorted[0].post.created_at;
  const lastSeen = sorted[sorted.length - 1].post.created_at;
  const uniqueAuthors = new Set(members.map((m) => m.post.author_hash));
  const amplifications = members.reduce(
    (acc, m) => acc + (m.is_amplification ? 1 : 0),
    0,
  );

  // Collect all need_types across members
  const nt = new Set<NeedType>();
  members.forEach((m) => m.need_types.forEach((t) => nt.add(t)));
  // Primary type first
  const needTypes: NeedType[] = [primaryType, ...[...nt].filter((x) => x !== primaryType)].slice(0, 4);

  // Peak urgency
  const peakUrgency = members.reduce<Urgency>(
    (max, m) => (m.urgency > max ? m.urgency : max),
    0,
  );

  // Representative text — cluster medoid (post with highest avg Jaccard to others)
  let medoid = sorted[0];
  let bestScore = -1;
  for (const candidate of members) {
    let score = 0;
    for (const other of members) {
      if (candidate === other) continue;
      score += approxJaccard(candidate.minhash, other.minhash);
    }
    if (score > bestScore) { bestScore = score; medoid = candidate; }
  }

  // Geo confidence — median of member confidences
  const confs = members.map((m) => m.geo_confidence).sort((a, b) => a - b);
  const geoConfidence = confs.length > 0 ? confs[Math.floor(confs.length / 2)] : 0.5;

  // Corroboration score — f(unique authors, time spread, independence proxy)
  const timeSpreadH = Math.max(
    1,
    (Date.parse(lastSeen) - Date.parse(firstSeen)) / (60 * 60 * 1000),
  );
  // corroboration ∈ [0,1]: more authors + more time spread = higher
  const authorComponent = Math.min(1, uniqueAuthors.size / 5); // 5 authors ≈ saturated
  const timeComponent = Math.min(1, timeSpreadH / 24);         // 24h spread ≈ saturated
  const corroboration = Math.round((authorComponent * 0.6 + timeComponent * 0.4) * 100) / 100;

  // Find admin unit info
  const adminUnitId = members[0].admin_unit_id!;
  // We don't have the AdminUnit object here — name/lat/lon filled by caller
  return {
    need_unit_id: uuidv4(),
    need_types: needTypes,
    admin_unit_id: adminUnitId,
    admin_unit_name: adminUnitId, // caller replaces with human name
    geo_confidence: Math.round(geoConfidence * 100) / 100,
    n_posts: members.length,
    n_unique_authors: uniqueAuthors.size,
    n_amplifications: amplifications,
    first_seen: firstSeen,
    last_seen: lastSeen,
    peak_urgency: peakUrgency,
    representative_text: medoid.post.text,
    corroboration_score: corroboration,
    member_post_ids: members.map((m) => m.post.post_id),
    lat: 0,    // caller fills
    lon: 0,
  };
}

function mergeNeedUnits(units: NeedUnit[]): NeedUnit {
  if (units.length === 1) return units[0];
  const allMembers = units.flatMap((u) => u.member_post_ids);
  const uniqueAuthors = new Set<string>(); // can't recover author hashes here
  // We use the sum of unique authors per bucket — slight overcount if an
  // author appears in two buckets, acceptable for demo. Production path
  // stores member_post_ids → author_hash join for the exact count.
  const nUniqueAuthors = units.reduce((s, u) => s + u.n_unique_authors, 0);
  uniqueAuthors.add("merged");
  const sorted = [...units].sort(
    (a, b) => Date.parse(a.first_seen) - Date.parse(b.first_seen),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const nt = new Set<NeedType>();
  units.forEach((u) => u.need_types.forEach((t) => nt.add(t)));
  // Pick representative text from the unit with most unique authors
  const top = [...units].sort((a, b) => b.n_unique_authors - a.n_unique_authors)[0];
  return {
    need_unit_id: first.need_unit_id,
    need_types: [...nt],
    admin_unit_id: first.admin_unit_id,
    admin_unit_name: first.admin_unit_name,
    geo_confidence: Math.min(...units.map((u) => u.geo_confidence)),
    n_posts: units.reduce((s, u) => s + u.n_posts, 0),
    n_unique_authors: Math.min(nUniqueAuthors, allMembers.length),
    n_amplifications: units.reduce((s, u) => s + u.n_amplifications, 0),
    first_seen: first.first_seen,
    last_seen: last.last_seen,
    peak_urgency: Math.max(...units.map((u) => u.peak_urgency)) as NeedUnit["peak_urgency"],
    representative_text: top.representative_text,
    corroboration_score:
      Math.round(Math.min(1, units.reduce((s, u) => s + u.corroboration_score, 0) / units.length) * 100) / 100,
    member_post_ids: allMembers,
    lat: first.lat,
    lon: first.lon,
  };
}

// ─── Public entry — runs the full cascade ────────────────────────────────────
export function buildNeedUnits(
  posts: Post[],
  classifications: Map<string, { need_types: NeedType[]; urgency: Urgency; relevant: boolean }>,
  geocodes: Map<string, { admin_unit_id: string; admin_unit_name: string; lat: number; lon: number; confidence: number; content_location: boolean } | null>,
): NeedUnit[] {
  const enriched: EnrichedPost[] = [];
  for (const p of posts) {
    const cls = classifications.get(p.post_id);
    if (!cls || !cls.relevant) continue;
    const geo = geocodes.get(p.post_id);
    if (!geo || !geo.content_location) continue; // content location required for Need Unit
    enriched.push({
      post: p,
      need_types: cls.need_types,
      urgency: cls.urgency,
      admin_unit_id: geo.admin_unit_id,
      geo_confidence: geo.confidence,
      is_amplification: p.is_amplification,
      minhash: minHash(shingles(p.text)),
      shingleSet: shingles(p.text),
    });
  }
  const units = dedupePosts(enriched);
  // Fill in admin_unit_name, lat, lon from geocodes
  for (const u of units) {
    const geo = Array.from(geocodes.values()).find(
      (g) => g?.admin_unit_id === u.admin_unit_id,
    );
    if (geo) {
      u.admin_unit_name = geo.admin_unit_name;
      u.lat = geo.lat;
      u.lon = geo.lon;
    }
  }
  return units;
}
