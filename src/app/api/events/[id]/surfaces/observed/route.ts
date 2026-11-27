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
    type: "FeatureCollection",
    features: result.observedSignal.map((row) => {
      const unit = result.units.find((u) => u.id === row.admin_unit_id)!;
      return {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: parseSvgPathToPolygon(unit.svg_path),
        },
        properties: {
          admin_unit_id: row.admin_unit_id,
          admin_unit_name: row.admin_unit_name,
          observed_reporters: row.observed_reporters,
          observed_posts: row.observed_posts,
          baseline_source: row.baseline_source,
          baseline_authors_per_day: row.baseline_authors_per_day,
          expected_reporters_from_baseline: row.expected_reporters_from_baseline,
          unlocated_post_share: row.unlocated_post_share,
          lat: unit.lat,
          lon: unit.lon,
        },
      };
    }),
    model_version: "v1-unique-authors",
    data_version: "2015-04-25T06:11:26Z",
  });
}

function parseSvgPathToPolygon(path: string): number[][][] {
  const tokens = path.replace(/M|L|Z|,/gi, " ").trim().split(/\s+/);
  const ring: number[][] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const x = parseFloat(tokens[i]);
    const y = parseFloat(tokens[i + 1]);
    const lon = 83.5 + (x / 600) * 4;
    const lat = 28.8 - (y / 600) * 1.8;
    ring.push([lon, lat]);
  }
  if (ring.length > 0) ring.push(ring[0]);
  return [ring];
}
