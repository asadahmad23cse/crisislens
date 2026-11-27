# CrisisLens Alappuzha execution status

## Work completed now

1. Retrieved and processed the official Survey of India Kerala village-boundary layer. `zones.csv` now covers the 93 villages in the current Alappuzha district roster, with valid polygon WKT in EPSG:4326, centroids, areas, unique LGD-based zone IDs, and a separate 93-row name/taluk crosswalk.
2. Retrieved the official Alappuzha Flood Report 2018 and extracted 19 source-linked observations; added an IIRS remote-sensing district estimate (272 km² on 21 August 2018) as the 20th record in `alappuzha_2018_flood_impact_evidence.csv`. This preserves report unit types and qualitative wording; it does not turn those narratives into invented village damage scores.
3. Audited both Alappuzha workbooks. The 528 rows in the base workbook are simulated; the 2,640-row version includes synthetic resampling. Neither is empirical evidence for the research claims.
4. Extracted the official Census 2011 population and area tables into a separate file. Exact six-digit location-code matches supply 2011 population and density for 85 of the 93 current zones; eight remain null. Census values are kept separate from current polygon areas and are not treated as 2018 estimates.
5. Clarified that the legacy Kerala 14-district scenario and satellite cross-check are simulated. It remains available as a separate dashboard view and does not contain observed results for the 93 Alappuzha villages.
6. Confirmed the existing dashboard is serving on `http://localhost:3000`; `/api/events` responds successfully and `/api/selfcheck` reports 42 districts with no mismatches. This is the existing CrisisLens demonstration dashboard, not a verified village-level Alappuzha analysis.
7. Added a presentation prototype as the dashboard's default **Alappuzha prototype** tab. It maps all 93 sourced current village polygons, allows taluk filtering and village selection, and demonstrates impact/signal layers, a baseline-adjusted timeline, a digital-access coverage screen, and a verification queue. All generated impact, online activity, access-proxy, confidence, and candidate values are explicitly labeled synthetic.

## Evidence available

- The Flood Report 2018 states that Alappuzha had 93 revenue villages and gives narrative accounts of flooding in specific taluks, Gram Panchayats, and localities. It also reports districtwide relief totals. IIRS estimates 272 km² inundated across the district on 21 August 2018. These are useful independent context, but they do not form a complete quantitative village-impact table.
- A Kerala post-flood soil assessment reports 91 Alappuzha villages, while the 2018 Flood Report and current district roster report 93. The count discrepancy is not explained in the retrieved sources. The IIRS inundation number is a district total and is not spatially apportioned to villages.
- The Survey of India boundary archive has 2024 processing metadata but no effective boundary date. Its polygons are current working boundaries; their exact match to 2018 is unverified.
- The 2011 District Census Handbook supplies 90 units in the extracted rural-village and town tables. Exact code equality links 85 to current zones; this links historical attributes but does not prove the polygon boundaries are unchanged. Eight current zones have no exact code match; five Census units do not join to a current zone.
- HumAID includes real, labeled humanitarian tweet text for the Kerala floods, but does not provide reliable village locations, author residence, or a local pre-event posting stream. It can support a limited classifier evaluation, not an Alappuzha silent-zone finding.

## Remaining work, in order

1. Reconcile 2011 Census villages, 2018 revenue villages, the 2018 Flood Report localities, and current Survey of India polygons. Keep separate IDs for Gram Panchayats and revenue villages where the boundaries do not coincide.
2. Obtain quantitative impact observations at a defensible village, Gram Panchayat, or taluk resolution. Prefer official flood assessment/relief records or independently processed satellite inundation. Keep source date, coverage, and missingness for each unit.
3. Obtain observed Kerala flood posts with timestamps and usable incident-location evidence, plus a comparable pre-flood period. Keep “mentions this place” separate from “posted from this place”; do not infer author residence from text mentions.
4. Add verified population/connectivity variables at the same geographic vintage. Keep poverty and internet-use proxies labeled as proxies and leave unsupported values missing.
5. Run the planned baseline-adjusted and raw social-activity comparisons only after the first four inputs are source-backed and crosswalked. Then display the observed-versus-simulated status in the dashboard and report.

## Reproduction and source files

- Rebuild zones: `python analysis/realdata/build_alappuzha_zones.py`
- Rebuild Census attributes: `python analysis/realdata/build_alappuzha_census2011.py` (requires `xlrd`)
- Census population and area crosswalk: `analysis/realdata/alappuzha_census2011_population.csv`
- Boundary/audit details: `analysis/realdata/ALAPPUZHA_GEOGRAPHY_AUDIT.md`
- Presentation prototype data builder: `python analysis/realdata/build_alappuzha_prototype.py`
- Prototype source data: `src/lib/crisislens/data/alappuzha-prototype.json`
- Dashboard: open `http://localhost:3000`; the Alappuzha prototype is the initial tab.
- Source checksums and acquisition URLs: `analysis/realdata/alappuzha_source_manifest.json`
- Private source archive and report PDF: `analysis/realdata/private/` (not for redistribution)

No simulated values have been relabeled as observed, and no village-level impact value has been imputed.

## Presentation framing

Describe this as a **working research prototype**. The map uses sourced village outlines, but the scenario is synthetic. Say that CrisisLens is designed to compare modeled impact with location-supported local voices, adjust activity against a local baseline, check digital-access and geolocation coverage, and send candidate gaps for human verification. Do not present the displayed village scores, candidate names, counts, or chart as historical findings.
