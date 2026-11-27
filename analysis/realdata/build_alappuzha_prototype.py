"""Build the presentation-only Alappuzha village scenario.

Village polygons come from zones.csv. Scenario values are deterministic synthetic
inputs and are never presented as observed 2018 social-media or impact data.
"""
from __future__ import annotations

import csv
import json
import math
import random
from pathlib import Path

from shapely import wkt

ROOT = Path(__file__).resolve().parents[2]
ZONES = ROOT / "zones.csv"
CENSUS = ROOT / "analysis/realdata/alappuzha_census2011_population.csv"
OUT = ROOT / "src/lib/crisislens/data/alappuzha-prototype.json"
WIDTH, HEIGHT, PAD = 800, 860, 28
TALUK_IMPACT = {
    "Kuttanad": 0.84,
    "Chengannur": 0.80,
    "Mavelikkara": 0.67,
    "Karthikappally": 0.62,
    "Ambalappuzha": 0.58,
    "Cherthala": 0.53,
}


def rings_to_path(poly, project):
    pieces = []
    for ring in [poly.exterior, *poly.interiors]:
        coords = list(ring.coords)
        if len(coords) < 4:
            continue
        x, y = project(*coords[0])
        pieces.append(f"M{x:.1f},{y:.1f}")
        for lon, lat in coords[1:]:
            x, y = project(lon, lat)
            pieces.append(f"L{x:.1f},{y:.1f}")
        pieces.append("Z")
    return " ".join(pieces)


def geometry_path(geom, project):
    geom = geom.simplify(0.00045, preserve_topology=True)
    polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
    return " ".join(rings_to_path(poly, project) for poly in polys)


def main():
    with ZONES.open(encoding="utf-8-sig", newline="") as f:
        zones = list(csv.DictReader(f))
    with CENSUS.open(encoding="utf-8-sig", newline="") as f:
        census = {r["zone_id"]: r for r in csv.DictReader(f)}

    shapes = [(r, wkt.loads(r["geometry_wkt"])) for r in zones]
    minx = min(g.bounds[0] for _, g in shapes)
    miny = min(g.bounds[1] for _, g in shapes)
    maxx = max(g.bounds[2] for _, g in shapes)
    maxy = max(g.bounds[3] for _, g in shapes)
    scale = min((WIDTH - PAD * 2) / (maxx - minx), (HEIGHT - PAD * 2) / (maxy - miny))
    draw_w, draw_h = (maxx - minx) * scale, (maxy - miny) * scale
    offset_x, offset_y = (WIDTH - draw_w) / 2, (HEIGHT - draw_h) / 2

    def project(lon, lat):
        return offset_x + (lon - minx) * scale, HEIGHT - offset_y - (lat - miny) * scale

    villages = []
    for row, geom in shapes:
        rng = random.Random(int(row["village_code"]))
        base = TALUK_IMPACT[row["taluk_name"]]
        impact = max(0.32, min(0.97, base + rng.uniform(-0.18, 0.16)))
        baseline = rng.randint(8, 26)
        expected = round(baseline * (1 + impact * 1.8) * 5)
        digital_access = rng.randint(28, 91)
        activity_ratio = max(0.16, min(1.35, rng.uniform(0.38, 1.12) * (0.55 + digital_access / 200)))
        # A subset of higher-impact areas gets deliberately lower attention to
        # demonstrate how the two signals are compared in the method.
        if impact > 0.72 and int(row["village_code"][-1]) in {1, 4, 7}:
            activity_ratio *= 0.45
        observed = max(0, round(expected * activity_ratio))
        gap = max(0.0, 1 - observed / max(expected, 1))
        score = round(100 * impact * gap)
        pop = census.get(row["zone_id"], {}).get("census_population_2011") or None
        # Synthetic need category chosen for the demonstration only.
        need = ["Shelter", "Food", "Water", "Medical", "Road access"][int(row["village_code"]) % 5]
        point = geom.representative_point()
        villages.append({
            "zoneId": row["zone_id"],
            "code": row["village_code"],
            "name": row["village_name"],
            "taluk": row["taluk_name"],
            "path": geometry_path(geom, project),
            "areaKm2": round(float(row["area_km2"]), 2),
            "centroid": [round(point.y, 5), round(point.x, 5)],
            "population2011": int(pop) if pop else None,
            "impactIndex": round(impact * 100),
            "baselineAuthorsPerDay": baseline,
            "digitalAccessIndex": digital_access,
            "locationConfidence": round(rng.uniform(0.56, 0.96), 2),
            "expectedAuthors": expected,
            "observedAuthors": observed,
            "activityRatio": round(observed / max(expected, 1), 2),
            "syntheticPosts": observed + rng.randint(0, max(1, observed)),
            "quietnessScore": score,
            "topNeed": need,
            # Illustration threshold only: high modeled impact plus a large
            # simulated shortfall. This is not a calibrated decision rule.
            "candidate": impact >= 0.75 and gap >= 0.60,
        })

    candidates = sum(v["candidate"] for v in villages)
    avg_baseline = sum(v["baselineAuthorsPerDay"] for v in villages) / len(villages)
    avg_expected = sum(v["expectedAuthors"] / 5 for v in villages) / len(villages)
    avg_observed = sum(v["observedAuthors"] / 5 for v in villages) / len(villages)
    timeline = []
    for day in range(-14, 5):
        if day < 0:
            wobble = 1 + 0.08 * math.sin(day * 0.8) + 0.04 * math.cos(day * 1.4)
            value = avg_baseline * wobble
            timeline.append({"day": str(day), "expected": round(value), "observed": round(value)})
        else:
            expected = avg_expected * (0.94 + 0.03 * day)
            observed = avg_observed * [0.96, 1.02, 0.89, 0.76, 0.82][day]
            timeline.append({"day": f"+{day + 1}", "expected": round(expected), "observed": round(observed)})
    output = {
        "meta": {
            "title": "Alappuzha Floods · Village Prototype",
            "boundarySource": "Survey of India Kerala village boundary layer; current vintage, 2018 match unverified",
            "rosterSource": "https://alappuzha.nic.in/en/villages/",
            "floodContextSource": "https://alappuzha.nic.in/en/document/flood-report-2018/",
            "satelliteSource": "https://www.iirs.gov.in/iirs/sites/default/files/upload/document/Kerala_Flood_Sep18a.pdf",
            "satelliteDistrictKm2": 272,
            "synthetic": True,
            "notice": "Presentation prototype. Village boundaries are sourced; every 2018 village impact index, post count, author count, baseline and candidate score below is synthetic scenario data, not an observed finding.",
            "method": "Illustrative comparison of modeled impact need with simulated observed local voices, adjusted against a simulated pre-event baseline.",
            "scenarioRules": [
                "Synthetic baseline authors/day are generated deterministically and are not observed platform activity.",
                "Synthetic expected event voices = baseline authors/day × (1 + 1.8 × modeled impact index) × a 5-day illustrative window.",
                "Synthetic observed voices use a deterministic activity multiplier that partly varies with a synthetic digital-access proxy.",
                "Illustrative gap score = modeled impact index × (1 − simulated observed/expected voices), scaled 0–100.",
                "Candidate rule for this demo: impact index ≥75 and simulated observed voices ≤40% of modeled expectation; not a calibrated threshold.",
            ],
            "districtPopulationCensus2011Matched": sum(v["population2011"] is not None for v in villages),
            "candidateCount": candidates,
            "simulatedBaselineMeanAuthorsPerDay": round(avg_baseline),
            "simulatedExpectedMeanAuthorsPerDay": round(avg_expected),
            "simulatedObservedMeanAuthorsPerDay": round(avg_observed),
            "viewBox": f"0 0 {WIDTH} {HEIGHT}",
        },
        "villages": villages,
        "timeline": timeline,
    }
    OUT.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(villages)} village shapes; {candidates} synthetic candidate flags; {OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
