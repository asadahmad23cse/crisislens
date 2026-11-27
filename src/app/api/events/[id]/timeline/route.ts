import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/crisislens/pipeline/run";
import { geoparsePost } from "@/lib/crisislens/pipeline/geoparse";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = runPipeline(id);
  if (id !== result.event.event_id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const unitFilter = url.searchParams.get("unit");
  const impactMs = Date.parse(result.event.impact_utc);
  const startMs = impactMs - 7 * 24 * 60 * 60 * 1000;
  const endMs = impactMs + 72 * 60 * 60 * 1000;
  const bucketMs = 6 * 60 * 60 * 1000;

  let perUnitTimeline: { t: string; pre_event: boolean; unique_authors: number; posts: number }[] | null = null;
  if (unitFilter && result.perUnitTimeline.has(unitFilter)) {
    perUnitTimeline = result.perUnitTimeline.get(unitFilter)!;
  } else if (unitFilter) {
    const buckets: { t: string; pre_event: boolean; unique_authors: number; posts: number }[] = [];
    for (let t = startMs; t < endMs; t += bucketMs) {
      buckets.push({
        t: new Date(t).toISOString(),
        pre_event: t < impactMs,
        unique_authors: 0,
        posts: 0,
      });
    }
    const authorSetByBucket: Set<string>[] = buckets.map(() => new Set());
    for (const p of result.posts) {
      const tMs = Date.parse(p.created_at);
      if (tMs < startMs || tMs >= endMs) continue;
      const idx = Math.floor((tMs - startMs) / bucketMs);
      if (idx < 0 || idx >= buckets.length) continue;
      const g = geoparsePost(p, result.units);
      if (!g || g.admin_unit_id !== unitFilter) continue;
      buckets[idx].posts++;
      authorSetByBucket[idx].add(p.author_hash);
    }
    for (let i = 0; i < buckets.length; i++) {
      buckets[i].unique_authors = authorSetByBucket[i].size;
    }
    perUnitTimeline = buckets;
  }

  return NextResponse.json({
    regional: result.timeline,
    per_unit: perUnitTimeline,
    impact_utc: result.event.impact_utc,
    window_start_utc: result.event.window_start_utc,
    window_end_utc: result.event.window_end_utc,
  });
}
