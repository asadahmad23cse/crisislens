# CrisisLens analysis on `CrisisLens_dataset_v1.xlsx`

Runs the CrisisLens Silent Zone method on the v1 evaluation dataset. The method is tested against ground truth that the pipeline never reads.

> **Evidence status:** the multi-event dashboard and `CrisisLens_dataset_v1.xlsx` are synthetic demonstrations. The Alappuzha workbooks are also synthetic (the base file has 528 generated posts; the expanded file has 2,640). Their detection scores, post activity, outages, and night-light correlations are not empirical findings. HumAID supplies real humanitarian text for limited classifier evaluation only; it does not validate Alappuzha village-level silence.

For the Alappuzha study files, see [ALAPPUZHA_EXECUTION_STATUS.md](realdata/ALAPPUZHA_EXECUTION_STATUS.md). The current geography and flood-source audit is in [ALAPPUZHA_GEOGRAPHY_AUDIT.md](realdata/ALAPPUZHA_GEOGRAPHY_AUDIT.md).

The dashboard now opens on the Alappuzha village prototype. It uses real current village boundaries and a generated synthetic scenario to demonstrate the intended workflow; its village scores, activity series, digital-access proxies, and candidate list are not historical results. Rebuild the presentation inputs with `python analysis/realdata/build_alappuzha_prototype.py`.

```
python analysis/evaluate.py       # ~8 min: pipeline + evaluation + figures
python analysis/build_report.py   # writes output/CrisisLens_Final_Report.docx
python analysis/export_dashboard.py  # writes src/lib/crisislens/data/dataset/*.json for the dashboard
npm install && npx next dev -p 3000  # dashboard at http://localhost:3000

# Added evaluations (all keep the main dataset and method unchanged)
python analysis/robustness.py                    # bootstrap intervals + detection timeline
python analysis/realdata/download_humaid.py      # real tweets (HumAID), into a private folder
python analysis/realdata/evaluate_humaid.py      # classifiers on real tweets
python analysis/realdata/loudness_real.py        # pre-registered partial test (see PREREGISTRATION.md)
python analysis/realdata/export_deliverables.py  # numbers for the dashboard's Research tab
python analysis/realdata/check_regression.py     # main-dataset results must equal results_baseline.json
python -m pytest analysis/tests analysis/realdata/test_protocol.py -q
```

Needs Python 3.10+, pandas, openpyxl, numpy, scipy, scikit-learn, networkx, matplotlib, python-docx.

## Layout

| Path | What it does |
|---|---|
| `crisislens/data.py` | Loads the workbook. `load_inputs()` reads only the 4 input sheets. `load_gold()` is for evaluation only. |
| `crisislens/classify.py` | Relevance, 10 needs and urgency. v1 is a port of the original TS lexicon; v2 is the revised lexicon. |
| `crisislens/geoparse.py` | Incident location (not author location); author location kind. |
| `crisislens/dedupe.py` | Reposts, copies, spam accounts, MinHash Need Units. |
| `crisislens/pipeline.py` | Expected need, baseline, local voices, detectors A/B/Z/F, evacuation and data-gap screen, corroboration. `PROTOTYPE_V1` = the original constants. |
| `crisislens/network.py` | Repost amplification network and coordinated link-sharing network. |
| `evaluate.py` | The only file that reads the gold sheets. Writes `output/results.json`, `output/tables/*.csv`, `output/figures/*.png`, `output/CrisisLens_results.xlsx`. |
| `build_report.py` | Builds the report from `results.json`. |
| `export_dashboard.py` | Exports the final method's results per event to the dashboard (flags, screened-out districts, evidence, evaluation), plus `insights.json`: the lexicon, gazetteer and per-district inputs that the Analyze and What-if tabs run in the browser. |

The dashboard's `/api/selfcheck` confirms the browser-side rules give the same status as Python for all 42 districts.

## Headline results (42 districts, 10 true Silent Zones)

| | TP | FP | F1 |
|---|---|---|---|
| Prototype as built | 4 | 1 | 0.53 |
| Final method | 9 | 0 | 0.95 |
| Outage evidence only (no social signal) | 10 | 7 | 0.74 |
| Ranking by post volume ("loudness dashboard") | AUC 0.05 | | |

**Caveat to say out loud:** every step after the prototype was designed after seeing this dataset's results, so the final scores are optimistic. The clean estimates are the prototype row and the leave-one-event-out classifier. The next step is to confirm the method on a fresh dataset.

## Separate real-data evaluation

The primary workbook and the default classifier/detector are preserved. HumAID
code lives in `realdata/`; its outputs live in `output/realdata/` and never replace
`output/results.json`. See [realdata/README.md](realdata/README.md) for reproduction
commands and short explanations, and [realdata/MAPPING.md](realdata/MAPPING.md)
for the class mapping and experiment settings fixed before scoring.

```powershell
python analysis/realdata/download_humaid.py
python analysis/realdata/evaluate_humaid.py
python analysis/realdata/summarize_phase1.py
python analysis/evaluate.py
python analysis/realdata/check_regression.py
```

`output/results_baseline.json` is the frozen Rule Zero reference. Do not overwrite
it during later runs. The check compares every saved JSON value, including the
classifier, ladder, and ablation tables. HumAID raw tweets and local error examples
are confidential and ignored by Git; only aggregate outputs are shareable.

HumAID provides humanitarian topics, not exhaustive unmet-need labels, municipal
baseline streams, or Silent Zone truth. Its classification results must not be
presented as real-world validation of the full silence detector. The new capped
TF-IDF comparison is a separate baseline, not a replacement for the historical
classifier table above.

## Added evaluations: how to explain each one

| Component | What it does | How to explain it |
|---|---|---|
| `robustness.py` | Resamples the 42 districts 5,000 times and rescores the frozen method; reruns it on windows of 6 to 72 hours. | "We asked how much the score depends on which districts we happened to have, and how early a Silent Zone shows up. Final F1 0.95, interval 0.80–1.00; 9 of 10 seen by hour 12." |
| `realdata/evaluate_humaid.py` | Scores the two keyword lists and a trained model on 76,484 real tweets, holding out each disaster in turn. | "On real tweets the keyword lists score 0.32–0.63 and a trained model 0.71. The revised list was fitted to the simulation." |
| `PREREGISTRATION.md` + `realdata/loudness_real.py` | A test written down before it was run: does real tweet volume follow district population? | "It did not (correlation about zero). We report it as it is. Real tweets have no author locations, so mentions of a place are not voices from it." |
| `output/realdata/phase2_results.json` | Lists the real evidence sources that could not be obtained. | "NASA night lights need an account; the FCC site was unreachable. We entered no real values and invented none." |
| `tests/test_core.py` | Unit tests for the classifier, locator, dedupe, damage curves, final flags, and dashboard export. | "24 tests; the last two confirm the dashboard shows exactly what the pipeline computes." |
| Dashboard upload (Analyze tab) | Reads a CSV or text file of posts in the browser and classifies and locates each one. | "Uploads get needs, urgency and place. No Silent Zone decision, because that needs each district's normal activity." |

Still blocked: real night lights (Earthdata account), FCC outage reports (site unreachable; download the PDFs
manually into `analysis/realdata/private/fcc/`), a fresh-seed check (needs `generate_dataset.py`), a multilingual
transformer baseline (no model available offline).

The map uses real district borders from geoBoundaries; see `analysis/boundaries/README.md`.
