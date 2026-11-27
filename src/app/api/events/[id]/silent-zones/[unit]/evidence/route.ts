import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/crisislens/pipeline/run";
import { geoparsePost } from "@/lib/crisislens/pipeline/geoparse";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; unit: string }> },
) {
  const { id, unit } = await params;
  const result = runPipeline(id);
  if (id !== result.event.event_id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const flag = result.silentZones.find((s) => s.admin_unit_id === unit);
  if (!flag) {
    return NextResponse.json(
      { error: "No silent zone flag for this unit" },
      { status: 404 },
    );
  }
  const evidenceNeedUnits = result.needUnits
    .filter((nu) => nu.admin_unit_id === unit)
    .sort((a, b) => b.n_unique_authors - a.n_unique_authors);
  const adminUnit = result.units.find((u) => u.id === unit)!;
  const geocodeConfs = result.geocodeConfidencesByUnit.get(unit) ?? [];
  const langMix = result.postLanguagesByUnit.get(unit) ?? new Map();
  const totalLang = Math.max(1, [...langMix.values()].reduce((s, x) => s + x, 0));
  const langs = [...langMix.entries()]
    .map(([lang, count]) => ({
      lang,
      share: Math.round((count / totalLang) * 1000) / 1000,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Build per-unit timeline by re-deriving geocodes for each post
  const impactMs = Date.parse(result.event.impact_utc);
  const startMs = impactMs - 7 * 24 * 60 * 60 * 1000;
  const endMs = impactMs + 72 * 60 * 60 * 1000;
  const bucketMs = 6 * 60 * 60 * 1000;
  const buckets: { t: string; pre_event: boolean; unique_authors: number; posts: number }[] = [];
  for (let t = startMs; t < endMs; t += bucketMs) {
    buckets.push({
      t: new Date(t).toISOString(),
      pre_event: t < impactMs,
      unique_authors: 0,
      posts: 0,
    });
  }
  const precomputed = result.perUnitTimeline.get(unit);
  if (precomputed && result.posts.length === 0) {
    // Dataset events: local-voice timeline computed by the Python pipeline
    buckets.splice(0, buckets.length, ...precomputed);
  } else {
    const authorSetByBucket: Set<string>[] = buckets.map(() => new Set());
    for (const p of result.posts) {
      const tMs = Date.parse(p.created_at);
      if (tMs < startMs || tMs >= endMs) continue;
      const idx = Math.floor((tMs - startMs) / bucketMs);
      if (idx < 0 || idx >= buckets.length) continue;
      const g = geoparsePost(p, result.units);
      if (!g || g.admin_unit_id !== unit) continue;
      buckets[idx].posts++;
      authorSetByBucket[idx].add(p.author_hash);
    }
    for (let i = 0; i < buckets.length; i++) {
      buckets[i].unique_authors = authorSetByBucket[i].size;
    }
  }

  return NextResponse.json({
    flag,
    admin_unit: adminUnit,
    evidence_need_units: evidenceNeedUnits,
    geocode_confidence_distribution: {
      n: geocodeConfs.length,
      median: geocodeConfs.length ? quantile(geocodeConfs, 0.5) : flag.confounders.geocode_confidence_median,
      p25: geocodeConfs.length ? quantile(geocodeConfs, 0.25) : flag.confounders.geocode_confidence_p25,
      p75: geocodeConfs.length ? quantile(geocodeConfs, 0.75) : flag.confounders.geocode_confidence_p75,
      p90: geocodeConfs.length ? quantile(geocodeConfs, 0.9) : flag.confounders.geocode_confidence_p75,
    },
    language_mix: langs.length ? langs : flag.confounders.language_mix.map((l) => ({ ...l, count: 0 })),
    timeline: buckets,
    // Privacy: we do not expose raw post text + author hash together (PRD §12.3).
    // Member posts are only accessible via the Need Unit's representative_text.
  });
}

function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}
