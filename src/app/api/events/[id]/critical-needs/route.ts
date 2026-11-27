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
    items: result.criticalUnmetNeeds,
    total: result.criticalUnmetNeeds.length,
    definition:
      "Critical Unmet Need = high expected damage AND zero observed reporters. These are the absolute worst cases — either fully cut off from communications or the geocoder is failing catastrophically. Both require immediate analyst attention.",
    urgency_levels: {
      critical: "Top quartile of expected damage (damage percentile > 0.75)",
      high: "Top half of expected damage (damage percentile > 0.50)",
      moderate: "Below median but still has zero observed signal",
    },
  });
}
