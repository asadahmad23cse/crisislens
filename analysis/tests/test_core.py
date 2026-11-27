"""Unit tests for the CrisisLens pipeline.

Run:  python -m pytest analysis/tests -q
The last two tests need analysis/output/processed.pkl (written by evaluate.py)
and the dashboard export (written by export_dashboard.py); they are skipped if
those files are missing.
"""
import json
import pickle
import sys
from pathlib import Path

import pandas as pd
import pytest

ANALYSIS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYSIS))
from crisislens import classify, dedupe, pipeline as P  # noqa: E402
from crisislens.geoparse import Gazetteer  # noqa: E402

UNITS = pd.DataFrame([
    {"event_id": "nepal_eq_2015", "unit_id": "n1", "unit_name": "Gorkha", "centroid_lat": 28.0,
     "centroid_lon": 84.6, "sub_localities": "Barpak|Laprak"},
    {"event_id": "nepal_eq_2015", "unit_id": "n2", "unit_name": "Kathmandu", "centroid_lat": 27.7,
     "centroid_lon": 85.3, "sub_localities": "Thamel|Kalanki"},
])


# ------------------------------------------------------------ classifier
@pytest.mark.parametrize("text,needs,urgency", [
    ("People trapped under rubble in Barpak. Please send rescue teams now!", {"rescue"}, 3),
    ("No drinking water in Thamel since the quake. Please send water", {"water"}, 2),
    ("No signal in Gorkha. Cell tower down, can't call anyone", {"telecom"}, 1),
    ("Personas atrapadas en San Juan. Necesitamos rescate urgente", {"rescue"}, 3),
])
def test_need_reports(text, needs, urgency):
    relevant, labels, urg, negated = classify.classify_v2(text)
    assert relevant and not negated
    assert needs <= set(labels)
    assert urg == urgency


@pytest.mark.parametrize("text", [
    "Power is back in Thamel. No need to send generators here",   # negated
    "Praying for everyone affected by the earthquake in Gorkha",  # sympathy
    "Click to donate for earthquake victims in Gorkha bit.ly/abc",  # scam link
    "Festival preparations going on in Patan",                    # 'rations' inside a word
    "Football match tonight in Kathmandu",
])
def test_not_need_reports(text):
    assert classify.classify_v2(text)[0] is False


def test_hashtag_does_not_veto():
    # "#PrayForNepal" is a hashtag, not a prayer post
    assert classify.classify_v2("Can't reach my family in Gorkha since the quake #PrayForNepal")[0]


def test_v1_lexicon_has_no_negation_handling():
    # documents the original prototype's known weakness
    assert classify.classify_v1("Power is back in Thamel. No need to send generators here")[0]


# -------------------------------------------------------------- location
def test_incident_location_is_from_text_not_author():
    gz = Gazetteer(UNITS, "nepal_eq_2015")
    assert gz.incident_unit("Need help in Barpak, posted from London") == ("n1", "text")
    assert gz.author_place("London") == ("outside", None)
    assert gz.author_place("Thamel, Kathmandu") == ("unit", "n2")
    assert gz.author_place("Nepal") == ("region", None)


def test_evacuee_is_located_where_they_are_now():
    gz = Gazetteer(UNITS, "nepal_eq_2015")
    unit, rule = gz.incident_unit("We were evacuated from Barpak, Gorkha. Now at the relief camp in Kalanki, Kathmandu")
    assert (unit, rule) == ("n2", "text_now_at")


def test_coordinates_fallback_and_no_location():
    gz = Gazetteer(UNITS, "nepal_eq_2015")
    assert gz.incident_unit("Everything is shaking", 27.71, 85.31) == ("n2", "coords")
    assert gz.incident_unit("Everything is shaking") == (None, "none")


# ------------------------------------------------------------- dedupe
def test_reposts_and_copies():
    assert dedupe.is_amplification("RT @user1: trapped in Gorkha", 0)
    assert dedupe.is_amplification("trapped in Gorkha", 1)
    assert not dedupe.is_amplification("trapped in Gorkha", 0)
    assert dedupe.is_copy("Please share: trapped in Gorkha")
    assert dedupe.core_text("RT @u: Sharing: trapped in Gorkha") == "trapped in Gorkha"


def test_minhash_near_duplicates():
    a = dedupe.minhash("People trapped under rubble in Barpak, Gorkha. Please send rescue teams now!")
    b = dedupe.minhash("People trapped under rubble in Barpak, Gorkha. Please send rescue teams now!!")
    c = dedupe.minhash("Football match tonight in Kathmandu")
    assert dedupe.jaccard_est(a, b) >= dedupe.THRESHOLD
    assert dedupe.jaccard_est(a, c) < 0.3


# ------------------------------------------------------- damage curves
def test_damage_curves():
    assert P.mmi_to_damage(9) == 0.75
    assert P.mmi_to_damage(3) == 0.001
    assert P.wind_to_damage(200) == 0.9          # capped
    assert P.wind_to_damage(50) == pytest.approx(1.0, abs=0.11)
    assert P.depth_to_damage(0) == 0
    assert P.depth_to_damage(100) == 0.8         # capped


def test_thresholds_are_frozen():
    assert (P.RESID_T, P.DROP_T, P.FUSION_T, P.CORR_T, P.BASE_MIN) == (2.0, 0.5, 1.0, 0.5, 5.0)


# ------------------------------------------ full pipeline and dashboard parity
PROCESSED = ANALYSIS / "output" / "processed.pkl"
INSIGHTS = ANALYSIS.parent / "src" / "lib" / "crisislens" / "data" / "dataset" / "insights.json"
BASELINE = ANALYSIS / "output" / "results_baseline.json"


@pytest.mark.skipif(not PROCESSED.exists(), reason="run analysis/evaluate.py first")
def test_final_method_flags_are_unchanged():
    inputs, processed = pickle.load(open(PROCESSED, "rb"))
    flagged = set()
    for e in ("nepal_eq_2015", "maria_2017", "kerala_flood_2018"):
        u = P.run_event(inputs, e, P.Config(), processed=processed[e]).units
        flagged |= set(u.unit_name[u.flag])
    assert flagged == {"Gorkha", "Sindhupalchok", "Humacao", "Yabucoa", "Utuado", "Guayama", "Vieques",
                       "Idukki", "Pathanamthitta"}
    if BASELINE.exists():
        base = json.loads(BASELINE.read_text(encoding="utf-8"))
        assert set(base["ladder"]["7 + fusion rule F = final method"]["flagged"]) == flagged


@pytest.mark.skipif(not (PROCESSED.exists() and INSIGHTS.exists()), reason="run evaluate.py and export_dashboard.py first")
def test_dashboard_export_matches_pipeline():
    """The per-district status the dashboard shows equals a fresh pipeline run,
    and the browser's lexicon patterns are the Python ones. (The browser-side
    decision rules are checked against these statuses by /api/selfcheck.)"""
    inputs, processed = pickle.load(open(PROCESSED, "rb"))
    ins = json.loads(INSIGHTS.read_text(encoding="utf-8"))
    exported = {u["id"]: u["status"] for u in ins["units"]}
    assert len(exported) == 42
    for e in ("nepal_eq_2015", "maria_2017", "kerala_flood_2018"):
        u = P.run_event(inputs, e, P.Config(), processed=processed[e]).units
        for r in u.itertuples():
            assert exported[r.unit_id] == r.status, r.unit_name
    for need in classify.NEEDS:
        assert ins["lexicon"]["needs"][need] == classify.V2_LEXICON[need].pattern
    t = ins["thresholds"]
    assert (t["resid"], t["drop"], t["fusion"], t["corr"]) == (P.RESID_T, P.DROP_T, P.FUSION_T, P.CORR_T)
