import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/crisislens/pipeline/run";

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
  if (unitFilter) {
    const tl = result.perUnitTimeline.get(unitFilter) ?? [];
    const sz = result.silentZones.find((s) => s.admin_unit_id === unitFilter);
    return NextResponse.json({
      timeline: tl,
      silent_zone: sz ? {
        score: sz.score,
        ci: [sz.ci_low, sz.ci_high],
        change_point_utc: sz.change_point_utc,
        dropoff_pct: sz.dropoff_pct,
        detectors: { a: sz.detector_a_triggered, b: sz.detector_b_triggered },
      } : null,
    });
  }
  return NextResponse.json({
    timelines: Object.fromEntries(result.perUnitTimeline),
    regional: result.timeline,
  });
}
