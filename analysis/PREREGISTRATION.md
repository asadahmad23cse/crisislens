# Pre-registration: partial real-data test (Phase 3)

Written on 2026-10-13, before the test below was run or its outcome seen.

## What cannot be tested, and why

A real test of Silent Zone detection needs three things for each district: a
pre-event activity baseline, post-event local voices, and independent truth
about communication loss. None is available yet:

- HumAID has no pre-event tweets and no author locations, so there is no
  baseline and no way to separate voices from a district from voices about it.
- Real outage truth is blocked: NASA night lights need an Earthdata account,
  and the FCC status reports could not be reached from this machine.

So no real Silent Zone test is run, and none is claimed.

## What can be tested: does post volume follow population on real tweets?

This is one component of loudness bias. It needs only tweet text and real
district populations.

- **Data.** HumAID tweets for Hurricane Maria 2017 and Kerala floods 2018 (all
  splits), as downloaded in Phase 1. Text only.
- **Units.** The 14 districts per event already in `admin_units` of the main
  dataset, with their populations (real census figures).
- **Method (frozen).** Each tweet is located with the unchanged
  `crisislens.geoparse.Gazetteer.incident_unit` on its text. A tweet counts for a
  district when the text names the district or one of its listed sub-localities.
  No thresholds are tuned. No classifier is involved.
- **Hypothesis H1.** For each event, the Spearman rank correlation between a
  district's located-tweet count and its population is positive.
- **Reported, whatever the outcome.** Spearman rho and its two-sided p-value per
  event; number and share of tweets located; the share of located tweets naming
  the single most-mentioned district; and the count for each district.
- **Run once.** The script `analysis/realdata/loudness_real.py` is run a single
  time and its output saved to `analysis/output/realdata/phase3_results.json`.

## Limits stated in advance

- HumAID is a filtered, sampled and labelled subset, not all tweets, so counts
  are small and not representative of total volume.
- Only 14 districts per event are in the gazetteer; tweets naming other places
  are not located.
- A positive correlation would show that mention volume tracks population. It
  would not show that quiet districts were cut off.
- The result is labelled "partial" wherever it is reported.
