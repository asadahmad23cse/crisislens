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
    ...result.nighttimeLights,
    methodology: {
      source: "unit_daily_evidence sheet of CrisisLens_dataset_v1.xlsx (simulated night-light radiance in VNP46A2 units)",
      pre_event_window: "7 days before impact, cloud-masked days skipped",
      post_event_window: "3 days after impact, cloud-masked days skipped",
      independence: "Radiance is not used to compute the social shortfall. The final method uses it afterwards as corroboration before flagging.",
      correlation_metric: "Pearson r between social shortfall (share below expected voices) and per-unit radiance drop",
      headline_interpretation:
        "A positive r means districts that went quiet also went dark. It is supporting evidence on simulated data, not proof of real-world detection.",
    },
    reliability_diagram: result.reliabilityDiagram,
  });
}
