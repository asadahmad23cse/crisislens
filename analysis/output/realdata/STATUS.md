# Work status

## Phase 1 — completed, with an optional baseline deferred

Ran the pinned HumAID download, all 19 leave-one-event-out folds for two explicitly
different relevance targets, frozen v1/v2 lexicons, and the new capped TF-IDF LR
baseline. Ran the same baseline configuration on three simulated events. Full
precision/recall/F1, support, coverage, three partial need-topic hit rates, and
local error examples are saved. See PHASE1_SUMMARY.md and phase1_results.json.

Passed: 57 source-file checksums; all fits completed without convergence errors;
four protocol tests; full main-results JSON equality; dashboard selfcheck with
42 districts, no mismatches, and lexicon_ok=true. Main results remain 9/10 true
Silent Zones, zero false alarms, F1 0.947. All ladder, ablation and classifier
values are unchanged. The primary workbook and pipeline match snapshot e7fd2b2.

Failed/limited: the initial downloader assumed JSON Lines but the mirror uses
JSON arrays; corrected before evaluation. The optional multilingual transformer
was not run: no suitable cached encoder was identified and CUDA is unavailable;
model download was not authorized. Complete ten-need and urgency scores cannot
be established from HumAID's single topic labels. No manual gold relabeling was
performed, and no real-world Silent Zone accuracy is claimed.

Error review: inspected the first deterministic v2 restricted-target errors for
Maria and Kerala. Generic appeals can lack the lexicon's specific cues, while
political/support posts can contain food or shelter terms. Some disagreements
also reflect imperfect correspondence between HumAID topics and CrisisLens needs;
they are proxy-label errors, not adjudicated mistakes about actual unmet need.
The 704 local examples cover available errors across models/events/targets;
they are illustrative, not a random sample of all errors.

## Phase 2 — blocked (no real values collected)

NASA night lights need an Earthdata account. The FCC status reports could not be reached from
this machine by page reader, direct request or browser. Evacuation and camp figures found describe
dates after the 72-hour window and were not used. See phase2_results.json. Nothing was imputed.

## Phase 3 — partial test run once, hypothesis not supported

Pre-registered in analysis/PREREGISTRATION.md (commit 5ee9418) before running. Located tweet volume
did not follow district population: Spearman 0.03 (Maria) and -0.05 (Kerala), neither significant.
No real Silent Zone test is possible without a baseline, author locations and outage truth.

## Phase 4 — done without the generator

Bootstrap over districts: final method F1 0.947 (0.80-1.00), prototype 0.533 (0.17-0.80).
Detection timeline: 5 true Silent Zones flagged by hour 6, 9 by hour 12; brief false alarms at
hour 6 (Wayanad) and hour 42 (Alappuzha). Fresh-seed check blocked: generate_dataset.py missing.

## Phase 5 — done except real boundaries

Upload-posts flow in the Analyze tab; TypeScript and lint clean; 24 tests pass; /api/selfcheck
reports 42 districts, no mismatches. Real administrative boundaries not attempted.

## Phase 6 — done

Report, Research tab and deck (16 slides) carry the robustness and real-data results, each
labelled real or simulated. Main-dataset results equal results_baseline.json.
