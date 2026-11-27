"""Robustness of the main-dataset result (no method changes).

Run:  python analysis/robustness.py
Writes analysis/output/realdata/phase4_results.json (read by the dashboard and report).

1. Bootstrap confidence intervals: resample the 42 districts with replacement,
   stratified by event, and recompute precision, recall and F1 of the frozen
   final method and of the original prototype.
2. Detection timeline: rerun the frozen method with the observation window cut
   to 6, 12, ... 72 hours after impact, using only the evidence available by
   then, and record the first hour at which each district is flagged.

The pipeline code, thresholds and rules are imported unchanged.
"""
from __future__ import annotations

import copy
import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from crisislens import data, pipeline as P  # noqa: E402

HERE = Path(__file__).parent
OUT = HERE / "output" / "realdata"
EVENTS = {"nepal_eq_2015": "Nepal 2015", "maria_2017": "Maria 2017", "kerala_flood_2018": "Kerala 2018"}
SEED, N_BOOT = 2026, 5000

I, PROC = pickle.load(open(HERE / "output" / "processed.pkl", "rb"))
GOLD = data.load_gold()["unit_ground_truth"].set_index("unit_id")


def flags(cfg, inputs=I) -> pd.DataFrame:
    rows = []
    for e in EVENTS:
        u = P.run_event(inputs, e, cfg, processed=PROC[e]).units
        rows.append(u[["unit_id", "unit_name", "flag"]].assign(event=EVENTS[e]))
    return pd.concat(rows).set_index("unit_id").join(GOLD[["true_silent_zone"]])


def prf(flag: np.ndarray, truth: np.ndarray) -> tuple[float, float, float]:
    tp = int((flag & truth).sum())
    fp = int((flag & ~truth).sum())
    fn = int((~flag & truth).sum())
    p = tp / (tp + fp) if tp + fp else np.nan
    r = tp / (tp + fn) if tp + fn else np.nan
    f = 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else np.nan
    return p, r, f


def bootstrap(u: pd.DataFrame) -> dict:
    rng = np.random.default_rng(SEED)
    groups = [g for _, g in u.groupby("event")]
    draws = []
    for _ in range(N_BOOT):
        s = pd.concat([g.iloc[rng.integers(0, len(g), len(g))] for g in groups])
        draws.append(prf(s.flag.to_numpy(bool), (s.true_silent_zone == 1).to_numpy()))
    d = np.array(draws, dtype=float)
    point = prf(u.flag.to_numpy(bool), (u.true_silent_zone == 1).to_numpy())
    out = {}
    for i, name in enumerate(("precision", "recall", "f1")):
        col = d[:, i]
        out[name] = {"point": round(point[i], 3),
                     "ci_low": round(float(np.nanpercentile(col, 2.5)), 3),
                     "ci_high": round(float(np.nanpercentile(col, 97.5)), 3),
                     "undefined_draws": int(np.isnan(col).sum())}
    return out


def timeline() -> dict:
    hours = list(range(6, 73, 6))
    first: dict[str, dict] = {}
    per_hour = []
    for h in hours:
        inp = copy.copy(I)
        ev = I.events.copy()
        ev["window_hours"] = h
        inp.events = ev
        # only the evidence days that have started by hour h
        inp.evidence = I.evidence[I.evidence.day_offset <= (h - 1) // 24]
        u = flags(P.Config(), inp)
        truth = u.true_silent_zone == 1
        per_hour.append({"hour": h, "found": int((u.flag & truth).sum()),
                         "false_alarms": int((u.flag & ~truth).sum())})
        for uid, r in u[u.flag].iterrows():
            first.setdefault(uid, {"unit": r.unit_name, "event": r.event,
                                   "true_silent_zone": bool(r.true_silent_zone == 1), "first_flag_hour": h})
    final = flags(P.Config())
    rows = []
    for uid, r in final[final.true_silent_zone == 1].iterrows():
        rows.append({"unit": r.unit_name, "event": r.event,
                     "first_flag_hour": first.get(uid, {}).get("first_flag_hour"),
                     "flagged_at_72h": bool(r.flag)})
    early_false = [v for v in first.values() if not v["true_silent_zone"]]
    return {"hours": hours, "per_hour": per_hour,
            "true_silent_zones": sorted(rows, key=lambda x: (x["first_flag_hour"] is None, x["first_flag_hour"] or 0)),
            "districts_flagged_early_but_not_truly_silent": early_false}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    final, proto = flags(P.Config()), flags(P.PROTOTYPE_V1)
    result = {
        "phase": 4, "seed": SEED, "bootstrap_draws": N_BOOT,
        "method_note": "Frozen final method and original prototype; no thresholds or rules changed.",
        "bootstrap": {"final_method": bootstrap(final), "prototype_v1": bootstrap(proto),
                      "resampling": "districts resampled with replacement within each event"},
        "timeline": timeline(),
        "blocked": {"fresh_seed_check": "generate_dataset.py is not in the repository"},
    }
    (OUT / "phase4_results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result["bootstrap"], indent=1))
    print(json.dumps(result["timeline"]["per_hour"]))
    for r in result["timeline"]["true_silent_zones"]:
        print(r)
    print("early non-silent flags:", result["timeline"]["districts_flagged_early_but_not_truly_silent"])


if __name__ == "__main__":
    main()
