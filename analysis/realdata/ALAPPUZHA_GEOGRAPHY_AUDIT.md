# Alappuzha geography and flood evidence audit

## Completed

- Built the root `zones.csv` as a 93-row working layer using the current Alappuzha District Administration village roster and the Survey of India Kerala village boundary layer.
- Matched all 93 current administrative names to unique coded polygons using a documented name crosswalk in `alappuzha_admin_boundary_crosswalk.csv`.
- Reprojected the actual source geometries to EPSG:4326 WKT; computed centroids from the source polygons and areas in the source projected CRS.
- Used Survey of India Land Governance Directory identifiers for the polygon features. `zone_id` is `ALP-LGD-<code>`; `village_code` is the LGD identifier, not a Census 2011 code.
- Added a source-linked flood evidence register combining the District Administration's qualitative 2018 report observations with an IIRS district-level remote-sensing estimate: `alappuzha_2018_flood_impact_evidence.csv`.
- Extracted Census 2011 population and area for 90 source units. Joined 85 rows to current zones only by exact location-code equality; left eight current zones null and preserved Census geography as a distinct historical data table.
- Audited the Alappuzha workbook README and post sheet: the base workbook's 528 posts/authors, NTL values, and outcomes are described by its own documentation as simulated. The 2,640-row expanded workbook is also synthetic, including resampled additions.
- Added a presentation prototype driven by the 93 current sourced village polygons. All village-level impact, social activity, digital-access, location-confidence, and candidate values in that prototype are generated synthetic scenario inputs; none are observed flood or social-media measurements.

## Geographic source and limits

The source layer is published by Survey of India as a village-boundary database. Its metadata describes processing in 2024, but does not give an effective boundary date. The dataset therefore leaves `boundary_year` empty and marks the 2018 match as unverified. It is suitable as a current working geography and for preparing explicit joins; it must not be described as a verified 2018 boundary set.

The current District Administration roster has 93 villages: Cherthala 21, Ambalappuzha 14, Kuttanad 14, Karthikappally 18, Chengannur 11, and Mavelikkara 15. Two extra features in the Survey of India district extract had placeholder LGD code `000000` (`Thumboli South` and `Cherthala (M)`); those were excluded because they do not match the district's 93-village roster. All retained shapes passed geometry validity checks and all LGD codes are unique.

The Kerala Soil Survey post-flood report reports 91 villages, while the Alappuzha Flood Report 2018 and the current district roster report 93. This discrepancy is unresolved; no two villages have been assumed to be additions or removals.

The Census 2011 population table is separate from the current polygon areas. The build script matched 85 of 93 current zones by exact six-digit equality between the Survey of India `Vill_LGD` value and the Census location code. It did not join by approximate name. Eight current zones remain missing Census values, and five source Census units do not match a current zone. Even an exact identifier match does not prove the 2011, 2018, and current geometries are identical; use Census values as 2011 context only.

`malayalam_name` and `panchayat_name` are blank because the source review did not establish a complete authoritative one-to-one table for those fields. The polygon layer's administrative name forms are retained in `alternative_names` where they differ from the district roster.

The original 528-post workbook is not a real-data sample: its README says all posts, authors, nighttime-light values, and outcomes are simulated. Its post volume, local-author activity, and impact fields are therefore suitable for pipeline demonstrations only. The separate HumAID Kerala corpus contains real public humanitarian tweets, but it has no reliable Alappuzha village geolocation, author residence, or local pre-flood baseline; it cannot validate the local silent-zone result.

## Flood evidence extracted

The official Alappuzha Flood Report describes the 2018 event in narrative terms, including flooding in named Gram Panchayats/localities, Kuttanad and Chengannur as the worst-affected taluks, and districtwide relief-camp totals. It does not supply a complete village-by-village flood-depth or damage table in the cited sections. The evidence file preserves each source's unit type and keeps taluk/GP/place evidence separate from village polygons. It now also includes the IIRS district-wide estimate of 272 km² inundated on 21 August 2018. This district total is not allocated to village polygons. No damage values are inferred for unmentioned locations.

The Alappuzha Flood Report states 710 district relief camps accommodated 301,719 people and describes a Kanichukulangara camp hosting more than 8,000 people evacuated from flooded Kuttanad. The camp-host location is not treated as the origin of the flood impact. IIRS independently estimates 272 km² inundated district-wide on 21 August 2018; that figure remains district-level evidence. IIRS independently estimates 272 km² inundated district-wide on 21 August 2018; that figure remains district-level evidence.

## Reproduction

1. Download the Kerala village-boundary archive from the Survey of India source below and extract `KERALA.shp` plus its sidecar files to `analysis/realdata/private/soi_kerala/`.
2. Run `python analysis/realdata/build_alappuzha_zones.py` from the repository root. The script reads the current official village roster, validates counts and IDs, and writes `zones.csv` and the crosswalk.
3. Run `python analysis/realdata/build_alappuzha_census2011.py` to extract Census 2011 population/area and the exact-code crosswalk (requires `xlrd`).
4. Run `python analysis/realdata/build_alappuzha_prototype.py` to generate the interactive presentation map data from `zones.csv` and the separate Census crosswalk. This builder creates deterministic synthetic metrics; it does not create empirical findings.
5. Raw source archives and the official flood-report PDF are stored under the ignored `analysis/realdata/private/` directory. Do not publish raw social-media text or error examples.

## Sources

- [Alappuzha District Administration: Villages](https://alappuzha.nic.in/en/villages/) — current roster and taluk groupings.
- [Survey of India: Village Boundary Data Base of Entire India](https://surveyofindia.gov.in/pages/village-boundary-data-base-of-entire-india) — download landing page for the Kerala polygon layer.
- [Alappuzha District Administration: Flood Report 2018](https://alappuzha.nic.in/en/document/flood-report-2018/) — report PDF, published 9 August 2019; cited pages in the evidence register.
- [IIRS/ISRO: Hydrological Study of August 2018 Kerala Floods](https://www.iirs.gov.in/iirs/sites/default/files/upload/document/Kerala_Flood_Sep18a.pdf) — reports 272 km² district-wide inundation in Alappuzha on 21 August 2018; this report table does not provide village allocation.
- [Kerala Soil Survey: Soil Health Status of Kerala in Post Flood Scenario](https://sdma.kerala.gov.in/wp-content/uploads/2020/08/Soil-Flood.pdf) — district post-flood summary and alternative village count.
- [Census of India: Alappuzha District Census Handbook 2011](https://www.censusindia.gov.in/nada/index.php/catalog/642) — 2011 population and area attributes are joined by exact location-code equality for 85 current working zones; this is not proof of boundary equivalence.

## Next data dependency

Resolve the remaining 2018 revenue-village / Gram Panchayat boundary crosswalk and retrieve village- or GP-level flood impact records. The existing social-media corpus lacks reliable Alappuzha village coordinates, local-author residence, and a pre-flood local posting baseline; the current synthetic workbook cannot fill those evidence gaps.
