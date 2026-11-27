import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/crisislens/pipeline/run";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = runPipeline(id);
  if (id !== result.event.event_id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({
    bins: result.reliabilityDiagram,
    methodology:
      "Bins silent-zone scores into 20-point ranges. Reports empirical frequency of 'both detectors triggered' (high-confidence ground truth) in each bin. A well-calibrated model has empirical_frequency ≈ bin midpoint.",
  });
}
