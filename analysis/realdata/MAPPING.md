# HumAID evaluation contract (written before model outcomes)

The frozen CrisisLens lexicons identify need-related posts. HumAID provides one
humanitarian topic per tweet, not a complete list of unmet needs. A humanitarian
topic is therefore not interchangeable with CrisisLens relevance.

| HumAID class | Restricted relevance | Broad humanitarian relevance | Need interpretation |
|---|---|---|---|
| requests_or_urgent_needs | positive | positive | Need unspecified; no ten-way gold label |
| displaced_people_and_evacuations | positive | positive | Shelter topic proxy only; preventive/completed evacuation may not imply unmet shelter |
| injured_or_dead_people | unknown | positive | Medical topic proxy only; deaths do not establish medical need |
| missing_or_found_people | unknown | positive | Missing topic proxy only; found people may have no ongoing need |
| infrastructure_and_utility_damage | unknown | positive | Could concern power, telecom, road, water, shelter; cannot disaggregate |
| rescue_volunteering_or_donation_effort | unknown | positive | Mixes rescue, offers, fundraising; cannot assign rescue need |
| caution_and_advice | unknown | positive | Advice is not necessarily a safety/protection need |
| other_relevant_information | unknown | positive | Insufficient detail for need relevance |
| not_humanitarian | negative | negative | No mapped need |
| sympathy_and_support | negative | negative | Expressive support, not evidence of a need |
| dont_know_cant_judge | unknown | unknown | Excluded from both targets |

Restricted relevance is a **partial, class-derived proxy**, not direct validation
of unmet needs. Coverage and excluded class counts must accompany every score.
Broad relevance is a secondary domain-shift diagnostic: lexicons were not designed
to retrieve every informative humanitarian post. Neither target validates urgency.

No class provides exhaustive labels for the ten needs. Report only positive-class
hit rates for shelter/medical/missing proxies, not ten-need precision or F1. In
particular, do not label all other needs negative on a single-label HumAID tweet.

## Frozen experiment

Seed 20261013. Evaluate v1 and v2 without changes. For each of 19 held-out events,
train only on other events (all original splits pooled; the event is the split
unit). Remove training texts matching any held-out text after lowercasing,
whitespace normalization, URL replacement, and mention replacement. Deduplicate
within each event; remove conflicting-label normalized texts within an event.
Do not select hyperparameters using held-out events.

TF-IDF character word-boundary ngrams 2–5, min_df=2, sublinear TF, maximum 60,000
features; logistic regression C=4, liblinear, max_iter=2000, fixed seed. Fit a
separate model per relevance target and held-out event. Apply this same baseline
configuration to the simulated workbook with leave-one-event-out as a separate
comparison; it is not the uncapped historical supervised baseline in results.json.
Always label simulation-trained and HumAID-trained scores separately.

Error examples remain in ignored local outputs, with handles and URLs removed.
No author IDs are supplied by the mirror; do not infer identity from mentions.
HumAID is English-only and cannot validate multilingual performance. No suitable
cached multilingual encoder was identified; CUDA is unavailable. A transformer
benchmark is deferred, not replaced by an English model or an untrained head.

## Sources and retention

- Official dataset: https://crisisnlp.qcri.org/humaid_dataset
- Paper verified: https://doi.org/10.1609/icwsm.v15i1.18116 (Alam, Qazi, Imran, Ofli, ICWSM 2021).
- Pinned mirror: https://huggingface.co/datasets/QCRI/HumAID-events/tree/2e7ea23332006f075068b90d401b178d847b447a
- Terms: https://crisisnlp.qcri.org/terms-of-use.html

The mirror's card has inconsistent license declarations (CC BY-NC-SA metadata,
CC BY-NC prose). Use the stricter original confidentiality/retention conditions:
keep raw content and examples local, do not redistribute them, delete when the
research finishes or the provider requests it. Aggregate metrics may be exported.
The initial official set1 archive is retained privately for provenance, but is
not mixed into the mirror evaluation.
