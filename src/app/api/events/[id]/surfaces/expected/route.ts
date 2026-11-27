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
    features: result.expectedNeed.map((row) => {
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
          expected_need: row.expected_need,
          population_exposed: row.population_exposed,
          hazard_intensity: row.hazard_intensity,
          damage_ratio: row.damage_ratio,
          vulnerability: row.vulnerability,
          infrastructure: row.infrastructure,
          exposure_percentile: row.exposure_percentile,
          lat: unit.lat,
          lon: unit.lon,
        },
      };
    }),
    model_version: "v1-deterministic",
    data_version: "2015-04-25T06:11:26Z",
  });
}

function parseSvgPathToPolygon(path: string): number[][][] {
  // Convert simplified SVG path to a polygon ring in lon/lat space.
  // For demo: we map SVG x ∈ [0,600] to lon ∈ [83.5, 87.5] and y ∈ [0,600] to lat ∈ [27.0, 28.8].
  // In production, real GeoJSON comes from GADM/geoBoundaries.
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
