# District boundaries for the dashboard map

Source: geoBoundaries (gbOpen), release 9469f09, ADM2 simplified files.

| Region | Licence | Districts used |
|---|---|---|
| Nepal | Public domain | 14 of 75, plus 13 neighbours for context |
| Puerto Rico | Public domain | 14 of 78, plus 64 for context |
| India (Kerala) | Open Data Commons Open Database License 1.0 (attribution required) | 14, plus 17 neighbours for context |

Attribution: Runfola, D. et al. (2020), geoBoundaries: A global database of political administrative
boundaries. PLoS ONE 15(4). India source: Pathways Data Pvt. Ltd., lgdirectory.gov.in.

To rebuild `selected.json`, download the three simplified ADM2 GeoJSON files listed in the `meta_*.json`
files here, save them as `NPL.geojson`, `PRI.geojson` and `IND.geojson`, then run
`python analysis/boundaries/build_boundaries.py` and `python analysis/export_dashboard.py`.

Two Nepal names differ from the dataset: Kavrepalanchok is "Kabherepalanchok" and Makwanpur is "Makawanpur".
Borders are simplified for display, and islets under 2% of a district's area are dropped.
