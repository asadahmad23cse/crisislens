"""Extract official Census 2011 population and match by location code only."""
from __future__ import annotations

import csv
import json
import re
import zipfile
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / "analysis/realdata/private/alappuzha_census_2011_dchb.zip"
ZONES = ROOT / "zones.csv"
OUT = ROOT / "analysis/realdata/alappuzha_census2011_population.csv"
SUMMARY = ROOT / "analysis/realdata/alappuzha_census2011_population_summary.json"
SOURCE_URL = "https://www.censusindia.gov.in/nada/index.php/catalog/642"


def as_number(value):
    if isinstance(value, (float, int)):
        return float(value)
    match = re.search(r"[\d,]+", str(value))
    return float(match.group(0).replace(",", "")) if match else None


def read_census_units() -> dict[str, dict]:
    with zipfile.ZipFile(ARCHIVE) as archive:
        village_book = xlrd.open_workbook(
            file_contents=archive.read("3211-Alappuzha/Appendix_VD_3211.xls"),
            ignore_workbook_corruption=True,
        )
        village_sheet = village_book.sheet_by_index(0)
        units: dict[str, dict] = {}
        taluk = ""
        for i in range(village_sheet.nrows):
            name_value = village_sheet.cell_value(i, 1)
            code_value = village_sheet.cell_value(i, 2)
            if isinstance(name_value, str) and name_value.startswith("Name of Taluk"):
                taluk = name_value.split(":-")[-1].strip()
            if not isinstance(code_value, str) or not re.fullmatch(r"\d{6}", code_value):
                continue
            name = str(name_value).strip()
            area_km2 = as_number(village_sheet.cell_value(i, 3)) / 100 if as_number(village_sheet.cell_value(i, 3)) is not None else None
            population = as_number(village_sheet.cell_value(i, 4))
            units[code_value] = {
                "census_2011_code": code_value,
                "census_2011_name": name,
                "census_2011_taluk": taluk,
                "census_unit_type": "rural village directory",
                "census_population_2011": int(population) if population is not None else None,
                "census_area_km2_2011": area_km2,
            }

        town_book = xlrd.open_workbook(
            file_contents=archive.read("3211-Alappuzha/Town Statement-I_3211.xls"),
            ignore_workbook_corruption=True,
        )
        town_sheet = town_book.sheet_by_index(0)
        for i in range(5, town_sheet.nrows):
            full_code = str(town_sheet.cell_value(i, 2)).strip()
            if not re.fullmatch(r"\d{16}", full_code):
                continue
            parts = [part.strip().strip(",") for part in str(town_sheet.cell_value(i, 1)).splitlines() if part.strip()]
            name = parts[1] if len(parts) > 1 else str(town_sheet.cell_value(i, 1)).strip()
            code = full_code[-6:]
            area_km2 = as_number(town_sheet.cell_value(i, 5))
            population = as_number(town_sheet.cell_value(i, 20))
            if code in units:
                raise ValueError(f"Duplicate Census location code {code}")
            units[code] = {
                "census_2011_code": code,
                "census_2011_name": name,
                "census_2011_taluk": str(town_sheet.cell_value(i, 3)).strip(),
                "census_unit_type": "urban town statement",
                "census_population_2011": int(population) if population is not None else None,
                "census_area_km2_2011": area_km2,
            }
    return units


def main() -> None:
    units = read_census_units()
    if len(units) != 90:
        raise ValueError(f"Expected 90 Census units in Part A tables, got {len(units)}")
    with ZONES.open(encoding="utf-8", newline="") as f:
        zones = list(csv.DictReader(f))
    rows = []
    for zone in zones:
        # A code is accepted only if the current Survey of India Vill_LGD value
        # exactly equals a Census 2011 location code in the official directory.
        code = zone["village_code"]
        census = units.get(code)
        if census:
            population = census["census_population_2011"]
            area = census["census_area_km2_2011"]
            density = population / area if population is not None and area and area > 0 else None
            status = "exact location-code match; 2011 value only; geometry vintage not assumed"
            census_code = code
        else:
            census_code = ""
            population = area = density = None
            census = {}
            status = "no exact Census 2011 location-code match; fields left null"
        rows.append({
            "zone_id": zone["zone_id"],
            "village_name_current": zone["village_name"],
            "taluk_name_current": zone["taluk_name"],
            "survey_of_india_lgd_code": code,
            "census_2011_code": census_code,
            "census_2011_name": census.get("census_2011_name", ""),
            "census_2011_taluk": census.get("census_2011_taluk", ""),
            "census_unit_type": census.get("census_unit_type", ""),
            "census_population_2011": population if population is not None else "",
            "census_area_km2_2011": f"{area:.6f}" if area is not None else "",
            "census_population_density_per_km2_2011": f"{density:.3f}" if density is not None else "",
            "match_status": status,
            "source_url": SOURCE_URL,
            "data_quality": "Official Census 2011 value joined by exact 6-digit location-code equality; not a 2018 population estimate and not evidence that current polygon boundaries equal 2011 boundaries",
        })
    with OUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    matched = sum(bool(r["census_2011_code"]) for r in rows)
    summary = {
        "current_zone_rows": len(rows),
        "census_2011_units_in_source_tables": len(units),
        "exact_code_matches": matched,
        "unmatched_current_zones": len(rows) - matched,
        "boundary_year_for_current_zones": None,
        "census_data_year": 2011,
        "join_rule": "exact six-digit equality: Survey of India Vill_LGD to Census location code",
        "population_density_method": "Census 2011 population divided by Census 2011 unit area; no current polygon area used",
        "source_url": SOURCE_URL,
        "output": str(OUT.relative_to(ROOT)),
    }
    SUMMARY.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
