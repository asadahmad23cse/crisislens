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
    event: result.event,
    units: result.units.map((u) => ({
      id: u.id,
      name: u.name,
      adm_level: u.adm_level,
      lat: u.lat,
      lon: u.lon,
      svg_path: u.svg_path,
      label_xy: u.label_xy ?? null,
      population: u.population,
      mmi: u.mmi,
      vulnerability: u.vulnerability,
      infrastructure: u.infrastructure,
      empirical_baseline: u.empirical_baseline,
    })),
    // Distinct authors per need type, over all Need Units (for the Overview chart)
    need_summary: Object.entries(
      result.needUnits.reduce<Record<string, number>>((acc, nu) => {
        for (const t of nu.need_types) acc[t] = (acc[t] ?? 0) + nu.n_unique_authors;
        return acc;
      }, {}),
    )
      .map(([need_type, authors]) => ({ need_type, authors }))
      .sort((x, y) => y.authors - x.authors),
    evaluation: result.evaluation ?? null,
    unlocated_post_share: result.event.unlocated_share,
    unlocated_post_count: result.unlocatedPostCount,
    pipeline_stages: [
      "ingest",
      "normalize_filter",
      "classify",
      "geoparse",
      "dedupe",
      "expected_need",
      "observed_signal",
      "baseline",
      "silent_zone_detect",
      "score_calibrate",
      "graph_build",
    ],
  });
}
