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
    finding: result.finding,
    loudest_unit: result.finding.loudest_unit,
    quietest_high_exposure_unit: result.finding.quietest_high_exposure_unit,
    precision_at_10_comparison: {
      inverted_volume_baseline: result.finding.inverted_volume_baseline_precision_at_10,
      crisislens: result.finding.crisislens_precision_at_10,
      lift_points_absolute: result.finding.lift_points,
    },
    correlation_silent_zone_score_vs_observed_volume:
      result.finding.correlation_silent_zone_vs_volume,
    methodology: {
      ground_truth: "Top tercile of expected need AND bottom tercile of observed unique-author volume",
      metric: "precision@10 — fraction of top-10 ranked units that are true silent zones",
      ablation_keys: [
        "without_baseline_offset",
        "without_dedup",
        "without_amplification_filter",
        "without_exposure_gate",
        "modeled_baseline_substituted_for_empirical",
      ],
    },
  });
}
