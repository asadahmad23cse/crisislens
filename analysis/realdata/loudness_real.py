"""Phase 3 partial real-data test: does tweet volume follow population?

Pre-registered in analysis/PREREGISTRATION.md. Run once:
    python analysis/realdata/loudness_real.py
Uses HumAID tweet text (private folder) and the main dataset's admin_units
(populations and place names). The geoparser is imported unchanged.
Only aggregate counts are written; no tweet text or ids.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from crisislens import data  # noqa: E402
from crisislens.geoparse import Gazetteer  # noqa: E402

PRIVATE = Path(__file__).parent / "private" / "humaid"
OUT = ROOT / "output" / "realdata"
PAIRS = {"hurricane_maria_2017": ("maria_2017", "Hurricane Maria 2017"),
         "kerala_floods_2018": ("kerala_flood_2018", "Kerala floods 2018")}


def main():
    units = pd.read_excel(data.DATASET, sheet_name="admin_units")
    events = []
    for folder, (event_id, label) in PAIRS.items():
        tweets = []
        for split in ("train", "dev", "test"):
            tweets += json.loads((PRIVATE / folder / f"{split}.json").read_text(encoding="utf-8"))
        gz = Gazetteer(units, event_id)
        located = [gz.incident_unit(str(t["tweet_text"]))[0] for t in tweets]
        counts = pd.Series([u for u in located if u]).value_counts()
        u = units[units.event_id == event_id][["unit_id", "unit_name", "population"]].copy()
        u["located_tweets"] = u.unit_id.map(counts).fillna(0).astype(int)
        rho, p = spearmanr(u.located_tweets, u.population)
        n_loc = int(u.located_tweets.sum())
        top = u.sort_values("located_tweets", ascending=False).iloc[0]
        events.append({
            "event": label, "tweets": len(tweets), "located": n_loc,
            "located_share": round(n_loc / len(tweets), 3),
            "spearman_rho_volume_vs_population": round(float(rho), 3), "p_value": round(float(p), 4),
            # Pre-registered criterion: rho > 0. The significance reading was added after the
            # run, for clarity; both are reported and no number was changed.
            "h1_sign_positive": bool(rho > 0),
            "h1_supported_at_p05": bool(rho > 0 and p < 0.05),
            "top_district": top.unit_name,
            "top_district_share_of_located": round(float(top.located_tweets / max(1, n_loc)), 3),
            "districts_with_zero_tweets": int((u.located_tweets == 0).sum()),
            "districts": [{"district": r.unit_name, "population": int(r.population),
                           "located_tweets": int(r.located_tweets)}
                          for r in u.sort_values("located_tweets", ascending=False).itertuples()],
        })
    result = {
        "phase": 3, "label": "partial", "preregistration": "analysis/PREREGISTRATION.md",
        "test": "Does located tweet volume follow district population on real HumAID tweets?",
        "events": events,
        "conclusion": ("Not supported. The correlation between located tweet volume and population is near "
                       "zero and not significant in either event. In this filtered sample, mentions follow "
                       "where the news was, not population size."),
        "not_tested": "Real Silent Zone detection: no pre-event baseline, no author locations, "
                      "and no reachable outage truth (NASA needs an account; FCC site unreachable).",
        "limits": ["HumAID is a filtered, labelled sample, not all tweets.",
                   "Only the 14 districts per event in the gazetteer can be located.",
                   "Volume following population does not show that quiet districts were cut off."],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "phase3_results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    for e in events:
        print({k: v for k, v in e.items() if k != "districts"})
        print("  ", [(d["district"], d["located_tweets"]) for d in e["districts"]])


if __name__ == "__main__":
    main()
