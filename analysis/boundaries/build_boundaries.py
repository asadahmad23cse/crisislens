"""Select and simplify real district boundaries for the dashboard map.

Source: geoBoundaries (gbOpen), release 9469f09.
  Nepal ADM2 and Puerto Rico ADM2: public domain.
  India ADM2: Open Data Commons Open Database License 1.0 (attribution required).
Run once after downloading the three *_simplified.geojson files into this folder
as NPL.geojson, PRI.geojson and IND.geojson (see README.md here):

    python analysis/boundaries/build_boundaries.py

Writes selected.json: for each event, the 14 districts of the dataset (matched by
name and nearest centroid) plus neighbouring districts for context, simplified.
The large raw files are not committed; selected.json is.
"""
from __future__ import annotations

import json
import unicodedata
from pathlib import Path

import pandas as pd
from shapely.geometry import mapping, shape

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
SOURCES = {"nepal_eq_2015": "NPL", "maria_2017": "PRI", "kerala_flood_2018": "IND"}
ALIASES = {"kavrepalanchok": "kabherepalanchok", "makwanpur": "makawanpur"}
TOLERANCE = {"NPL": 0.004, "PRI": 0.0015, "IND": 0.004}   # degrees
CONTEXT_PAD = 0.25                                        # degrees around the 14 districts


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace(" ", "")
    return ALIASES.get(s, s)


def main():
    units = pd.read_excel(ROOT / "CrisisLens_dataset_v1.xlsx", sheet_name="admin_units")
    out = {}
    for event_id, code in SOURCES.items():
        feats = json.loads((HERE / f"{code}.geojson").read_text(encoding="utf-8"))["features"]
        geoms = [(norm(f["properties"]["shapeName"]), f["properties"]["shapeName"], shape(f["geometry"])) for f in feats]
        chosen, used = {}, set()
        for r in units[units.event_id == event_id].itertuples():
            cands = [(i, g) for i, (n, _, g) in enumerate(geoms) if n == norm(r.unit_name)]
            if not cands:
                raise SystemExit(f"No boundary named like {r.unit_name}")
            i, g = min(cands, key=lambda c: (c[1].centroid.x - r.centroid_lon) ** 2 + (c[1].centroid.y - r.centroid_lat) ** 2)
            used.add(i)
            chosen[r.unit_id] = mapping(g.simplify(TOLERANCE[code], preserve_topology=True))
        xs = [c for g in chosen.values() for c in shape(g).bounds[0::2]]
        ys = [c for g in chosen.values() for c in shape(g).bounds[1::2]]
        box = (min(xs) - CONTEXT_PAD, min(ys) - CONTEXT_PAD, max(xs) + CONTEXT_PAD, max(ys) + CONTEXT_PAD)
        context = []
        for i, (_, name, g) in enumerate(geoms):
            c = g.centroid
            if i not in used and box[0] <= c.x <= box[2] and box[1] <= c.y <= box[3]:
                context.append({"name": name, "geometry": mapping(g.simplify(TOLERANCE[code] * 2, preserve_topology=True))})
        out[event_id] = {"source": f"geoBoundaries gbOpen {code} ADM2", "units": chosen, "context": context}
        print(event_id, "districts:", len(chosen), "context:", len(context))
    (HERE / "selected.json").write_text(json.dumps(out), encoding="utf-8")
    print("wrote", HERE / "selected.json", (HERE / "selected.json").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
