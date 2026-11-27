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
    items: result.silentZones,
    total: result.silentZones.length,
    screened_out: result.screenedOut ?? [],
    methodology: {
      detector_a: "Residual of observed local voices vs baseline x 3 days x regional surge > 2 (theta fitted from pre-event days), damage ratio at or above the regional median",
      detector_b: "More than 50% below expected voices, with at least 5 expected voices in the window",
      detector_z: "No local need voices at all, with at least 3 expected voices",
      detector_f: "Independent outage evidence (night lights or cell sites down >= 50%) and residual > 1",
      screens: "Evacuation-adjusted re-test; data-gap test; outage evidence required for a final flag",
      calibration: "0-100 scale; interval from Poisson uncertainty in the observed count",
      confidence_sort_order: [
        "both_detectors AND empirical baseline",
        "both_detectors AND modeled baseline",
        "single detector AND empirical baseline",
        "single detector AND modeled baseline (sorted by score)",
      ],
    },
  });
}
