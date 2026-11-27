# Real-data evaluation (separate from the primary simulation)

Run from the repository root using the existing Python environment:

```powershell
python analysis/evaluate.py
# Create results_baseline.json only on the first run; do not replace the frozen baseline.
python analysis/realdata/download_humaid.py
python analysis/realdata/evaluate_humaid.py
python analysis/evaluate.py
python analysis/realdata/check_regression.py
Invoke-RestMethod http://localhost:3000/api/selfcheck
```

Dependencies: existing analysis requirements plus requests and threadpoolctl.
No paid services, account creation, model downloads, or live social-platform access.
The mirror download is approximately 21 MB. Reproduction uses a pinned revision
and SHA-256 file checks. The official archive downloaded during discovery is not
used in scoring. Consult MAPPING.md before interpreting results.

Outputs in `analysis/output/realdata/`:

- `phase1_results.json`: source audit, per-event metrics, topic-proxy hit rates,
  historical simulated comparison, and limitations.
- `phase1_metrics.csv`: real and simulated precision/recall/F1 with denominators.
- `private/phase1_error_examples.json`: local-only errors with handles/URLs removed;
  remaining text is still confidential and must not be published.

The simulation comparison uses original workbook rows and true relevance labels;
HumAID uses documented class-derived targets. Absolute scores are not a like-for-like
measure of generalization. The new capped TF-IDF baseline has its own name and does
not replace the historical uncapped baseline. Lexicons and detector rules are frozen.

## How to explain these components

- Downloader: fetch a fixed version, validate its structure, record hashes, and keep
  tweets private. It does not contact Twitter/X or obtain author identities.
- Mapping: a broad topic cannot tell us exactly which needs remain unmet. Restrict
  the primary comparison to defensible positive/negative topic groups and report
  how much data that excludes. Show a broader target separately.
- Evaluation: hold out an entire disaster, learn vocabulary and coefficients only
  from other disasters, and exclude matching held-out texts from training. Fixed
  settings prevent tuning on the event being scored. The two lexicons do not train.
- Regression check: compare every main JSON value with the saved baseline and stop
  on any difference. New evidence is not allowed to silently change old results.

Phase 1 does not establish real Silent Zone detection. HumAID's curated, labeled
sample and missing author/time/location metadata cannot substitute for a municipal
pre-event baseline or independent Silent Zone truth.

The mirror does include tweet IDs (these are post IDs, not author identifiers).
Their timestamp encoding could support a separately validated time reconstruction;
there is no explicit timestamp column. That possibility does not establish sampling
completeness, author counts, author residence, or a representative pre-event stream.
