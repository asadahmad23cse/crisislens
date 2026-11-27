"""Build an Alappuzha working village layer from official administrative sources.

Input boundary archive: analysis/realdata/private/soi_kerala/KERALA.shp
The source layer is kept outside Git because it is a downloaded source file.
"""
from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path

import geopandas as gpd
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
SHAPE = ROOT / "analysis/realdata/private/soi_kerala/KERALA.shp"
ZONES = ROOT / "zones.csv"
CROSSWALK = ROOT / "analysis/realdata/alappuzha_admin_boundary_crosswalk.csv"
ADMIN_URL = "https://alappuzha.nic.in/en/villages/"
SOI_URL = "https://surveyofindia.gov.in/pages/village-boundary-data-base-of-entire-india"
TALUKS = ["Cherthala", "Ambalappuzha", "Kuttanad", "Karthikappally", "Chengannur", "Mavelikkara"]
EXPECTED_COUNTS = [21, 14, 14, 18, 11, 15]

# Name forms are paired only where the official district roster and Survey of
# India layer use transliteration/spelling variants for the same village.
ALIASES = {
    "Arookkutti": "Arookutty (CT)",
    "Kanjikuzhi": "Kanjikkuzhi (CT)",
    "Kodamthuruthu": "Kodamthuruth (CT)",
    "Kuthiyathode": "Kuthiathode (CT)",
    "Thanneermukkam North": "Thanneermukkam Vadakku (CT)",
    "Thanneermukkam South": "Thanneermukkam Thekku (CT)",
    "Thuravur South": "Thuravoor Thekku (CT)",
    "Thaikkattusseri": "Thykattussery (CT)",
    "Aryadu South": "Aryad South",
    "Karumadi": "Karumady (CT)",
    "Mannancherry": "Mannanchery (CT)",
    "Edathva": "Edathua",
    "Kainakari North": "Kainakary North",
    "Kainakari South": "Kainakary",
    "Nedumudi": "Nedumudy",
    "Neelamperur": "Neelamperoor",
    "Pulinkunnu": "Pulincunnu",
    "Ramankari": "Ramankary",
    "Veliyanadu": "Veliyanad",
    "Harippad": "Haripad",
    "Kandallur": "Kandalloor (CT)",
    "Pathiyur": "Pathiyoor (CT)",
    "Cheriyanadu": "Cheriyanad(CT)",
    "Pandanadu": "Pandanad (CT)",
    "Puliyur": "Puliyoor (CT)",
    "Thiruvanvandur": "Thiruvanvandoor(CT)",
    "Venmani": "Venmony",
    "Thazhakkara": "Thazhakara (CT)",
    "Thekkekkara": "Thekkekara (CT)",
    "Thripperunthura": "Thriperumthura(CT)",
}


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    value = re.sub(r"\s*\((?:ct|m|part)\)", "", value)
    return re.sub(r"[^a-z0-9]", "", value)


def read_admin_roster() -> list[dict[str, str]]:
    response = requests.get(ADMIN_URL, timeout=45)
    response.raise_for_status()
    soup = BeautifulSoup(response.content, "html.parser")
    tables = soup.select("table")
    if len(tables) != len(TALUKS):
        raise ValueError(f"Expected 6 taluk tables, got {len(tables)}")
    records = []
    for taluk, expected, table in zip(TALUKS, EXPECTED_COUNTS, tables):
        rows = []
        for tr in table.select("tr")[1:]:
            cells = tr.select("td, th")
            if len(cells) >= 2:
                rows.append(cells[1].get_text(" ", strip=True))
        if len(rows) != expected:
            raise ValueError(f"{taluk}: expected {expected} villages, found {len(rows)}")
        records.extend({"village_name": name, "taluk_name": taluk} for name in rows)
    if len(records) != 93 or len({norm(x["village_name"]) for x in records}) != 93:
        raise ValueError("Current district roster is not 93 unique villages")
    return records


def main() -> None:
    if not SHAPE.exists():
        raise FileNotFoundError(f"Extract the official Survey of India Kerala layer first: {SHAPE}")
    source = gpd.read_file(SHAPE)
    if source.crs is None or "meter" not in str(source.crs).lower():
        raise ValueError(f"Expected the source layer's projected metre CRS, got {source.crs}")
    source = source[source["District"].astype(str).str.casefold() == "alappuzha"].copy()
    # The official source includes two extra features with placeholder LGD IDs;
    # neither is in the district administration's current 93-village roster.
    source = source[source["Vill_LGD"].astype(str) != "000000"].copy()
    if len(source) != 93 or source["Vill_LGD"].astype(str).nunique() != 93:
        raise ValueError(f"Expected 93 unique coded Alappuzha boundaries, got {len(source)}")
    boundary_by_name = {norm(str(row.Vill_name)): row for row in source.itertuples()}
    roster = read_admin_roster()
    rows = []
    crosswalk = []
    for admin in roster:
        name = admin["village_name"]
        candidate = ALIASES.get(name, name)
        boundary = boundary_by_name.get(norm(candidate))
        if boundary is None:
            raise ValueError(f"No official polygon match for {name!r} (tried {candidate!r})")
        original = str(boundary.Vill_name)
        code = str(boundary.Vill_LGD)
        if not code.isdigit() or code == "000000":
            raise ValueError(f"Invalid LGD identifier for {name}: {code!r}")
        if original != name and original not in ("" , None):
            alternative_names = original
        else:
            alternative_names = ""
        rows.append({
            "zone_id": f"ALP-LGD-{code}",
            "village_code": code,
            "village_name": name,
            "alternative_names": alternative_names,
            "malayalam_name": "",
            "panchayat_name": "",
            "taluk_name": admin["taluk_name"],
            "district_name": "Alappuzha",
            "state_name": "Kerala",
            "_geometry": boundary.geometry,
            "boundary_year": "",
            "source_url": f"{ADMIN_URL}; {SOI_URL}",
            "data_origin": "Survey of India Kerala village boundary layer (metadata processing date 2024; effective date unspecified); current District Administration Alappuzha village roster",
            "data_quality": "Official polygon and current roster match; LGD code (not Census code); processing metadata dated 2024, effective boundary year unavailable; 2018 concordance unverified",
            "_boundary_name": original,
            "_code": code,
            "_taluk": str(boundary.Sub_dist),
            "_category": str(boundary.Vill_Cat),
        })
        crosswalk.append({
            "village_name_current_admin": name,
            "taluk_current_admin": admin["taluk_name"],
            "survey_of_india_boundary_name": original,
            "survey_of_india_taluk": str(boundary.Sub_dist),
            "village_lgd_code": code,
            "survey_of_india_category": str(boundary.Vill_Cat),
            "match_basis": "explicit official-source spelling/transliteration crosswalk" if candidate != name else "normalized name match",
            "boundary_year": "unknown; processing metadata dated 2024",
            "notes": "Current administrative roster match; 2018 status not verified",
        })

    if len({r["_code"] for r in rows}) != 93:
        raise ValueError("LGD codes are not unique after crosswalk")
    if {r["_taluk"] for r in rows} != set(TALUKS):
        raise ValueError("Taluk relationships disagree between district roster and boundary source")

    # Source geometries are already projected; compute planar areas/centroids
    # before projecting WKT and centroid coordinates to EPSG:4326.
    geometries = gpd.GeoSeries([r["_geometry"] for r in rows], crs=source.crs)
    wgs_geometries = geometries.to_crs("EPSG:4326")
    centroid_points = gpd.GeoSeries([g.centroid for g in geometries], crs=source.crs).to_crs("EPSG:4326")
    for i, row in enumerate(rows):
        geom = wgs_geometries.iloc[i]
        point = centroid_points.iloc[i]
        if geom.is_empty or not geom.is_valid or geom.geom_type not in {"Polygon", "MultiPolygon"}:
            raise ValueError(f"Invalid polygon for {row['village_name']}")
        if not (-180 <= point.x <= 180 and -90 <= point.y <= 90):
            raise ValueError(f"Centroid outside EPSG:4326 bounds for {row['village_name']}")
        row["centroid_latitude"] = f"{point.y:.7f}"
        row["centroid_longitude"] = f"{point.x:.7f}"
        row["area_km2"] = f"{geometries.iloc[i].area / 1_000_000:.6f}"
        row["geometry_wkt"] = geom.wkt

    columns = ["zone_id", "village_code", "village_name", "alternative_names", "malayalam_name",
               "panchayat_name", "taluk_name", "district_name", "state_name", "centroid_latitude",
               "centroid_longitude", "area_km2", "geometry_wkt", "boundary_year", "source_url",
               "data_origin", "data_quality"]
    ZONES.parent.mkdir(parents=True, exist_ok=True)
    with ZONES.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in columns})
    CROSSWALK.parent.mkdir(parents=True, exist_ok=True)
    with CROSSWALK.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(crosswalk[0]))
        writer.writeheader()
        writer.writerows(crosswalk)
    print(f"Wrote {len(rows)} zones to {ZONES}")
    print(f"Wrote {len(crosswalk)} administrative crosswalk rows to {CROSSWALK}")
    print(f"Taluk counts: { {t: sum(x['taluk_name'] == t for x in rows) for t in TALUKS} }")
    print(f"Geometry validity: {sum(r['_geometry'].is_valid for r in rows)}/{len(rows)}")


if __name__ == "__main__":
    main()
