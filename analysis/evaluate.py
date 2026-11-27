"""CrisisLens evaluation on CrisisLens_dataset_v1.xlsx.

Run:  python analysis/evaluate.py
Writes analysis/output/{results.json, tables/*.csv, figures/*.png, CrisisLens_results.xlsx}

This is the ONLY module that reads the gold sheets (post_labels_gold,
unit_ground_truth). The pipeline itself (analysis/crisislens) never does.
"""
from __future__ import annotations

import json
import pickle
import re
import sys
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (cohen_kappa_score, f1_score, precision_recall_fscore_support,
                             roc_auc_score)
from sklearn.multiclass import OneVsRestClassifier
from sklearn.preprocessing import MultiLabelBinarizer

sys.path.insert(0, str(Path(__file__).parent))
from crisislens import classify, data, network, pipeline as P  # noqa: E402
from crisislens.geoparse import Gazetteer  # noqa: E402

warnings.filterwarnings("ignore")
OUT = Path(__file__).parent / "output"
FIG, TAB = OUT / "figures", OUT / "tables"
for d in (FIG, TAB):
    d.mkdir(parents=True, exist_ok=True)
CACHE = OUT / "processed.pkl"

EVENTS = ["nepal_eq_2015", "maria_2017", "kerala_flood_2018"]
SHORT = {"nepal_eq_2015": "Nepal 2015", "maria_2017": "Maria 2017", "kerala_flood_2018": "Kerala 2018"}

# Reference palette (dataviz skill, light mode)
C1, C2, C3 = "#2a78d6", "#eb6834", "#1baf7a"
INK, INK2, MUTED, GRID, SURF = "#0b0b0b", "#52514e", "#a3a29c", "#e4e3df", "#fcfcfb"
plt.rcParams.update({
    "figure.facecolor": SURF, "axes.facecolor": SURF, "savefig.facecolor": SURF,
    "axes.edgecolor": MUTED, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.8, "font.size": 10, "axes.titlesize": 12,
    "axes.titleweight": "bold", "axes.titlecolor": INK, "axes.titlelocation": "left",
    "legend.frameon": False, "font.family": "DejaVu Sans"})

R: dict = {}  # everything that goes into results.json


def prf(y, yhat):
    p, r, f, _ = precision_recall_fscore_support(y, yhat, average="binary", zero_division=0)
    return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(f, 3),
            "tp": int(((y == 1) & (yhat == 1)).sum()), "fp": int(((y == 0) & (yhat == 1)).sum()),
            "fn": int(((y == 1) & (yhat == 0)).sum())}


def save(fig, name):
    fig.savefig(FIG / name, dpi=200, bbox_inches="tight")
    plt.close(fig)


# =========================================================== load & process
def load():
    if CACHE.exists():
        return pickle.load(open(CACHE, "rb"))
    I = data.load_inputs()
    ev = I.events.set_index("event_id")
    processed = {e: P.process_posts(I.posts, I.units, ev.loc[e]) for e in EVENTS}
    pickle.dump((I, processed), open(CACHE, "wb"))
    return I, processed


I, PROC = load()
GOLD = data.load_gold()
gpost = GOLD["post_labels_gold"]
gunit = GOLD["unit_ground_truth"].set_index("unit_id")
posts = pd.concat(PROC.values()).merge(gpost, on=["post_id", "event_id"], how="left")
R["dataset"] = {
    "posts": int(len(posts)), "authors": int(posts.author_hash.nunique()),
    "per_event": {SHORT[e]: {"posts": int((posts.event_id == e).sum()),
                             "pre_event": int(((posts.event_id == e) & (posts.hours < 0)).sum()),
                             "post_event": int(((posts.event_id == e) & (posts.hours >= 0)).sum()),
                             "authors": int(posts[posts.event_id == e].author_hash.nunique())}
                  for e in EVENTS},
    "units": int(len(gunit)), "true_silent_zones": int(gunit.true_silent_zone.sum()),
    "true_silent_by_event": {SHORT[e]: int(gunit[gunit.event_id == e].true_silent_zone.sum()) for e in EVENTS},
    "languages": posts.lang.value_counts().to_dict(),
    "platforms": posts.platform.value_counts().to_dict(),
    "reposts": int(posts.is_repost.sum()),
    "with_coordinates": int(posts.latitude.notna().sum()),
}

# ============================================================ 1. classifier
print("1. classification")
y = posts.gold_relevant.astype(int)
gold_needs = posts.gold_need_labels.fillna("").map(lambda s: [x for x in s.split("|") if x])
mlb = MultiLabelBinarizer(classes=list(classify.NEEDS))
Yg = mlb.fit_transform(gold_needs)
cls = {}
for name, rel, needs, urg in [("v1 lexicon (original TS)", "relevant_v1", "needs_v1", "urgency_v1"),
                              ("v2 lexicon (revised)", "relevant", "needs", "urgency")]:
    Yp = mlb.transform(posts[needs])
    rel_m = prf(y, posts[rel].astype(int))
    mask = y == 1
    cls[name] = {
        "relevance": rel_m,
        "need_micro_f1": round(f1_score(Yg, Yp, average="micro", zero_division=0), 3),
        "need_macro_f1": round(f1_score(Yg, Yp, average="macro", zero_division=0), 3),
        "per_need_f1": dict(zip(mlb.classes_, np.round(f1_score(Yg, Yp, average=None, zero_division=0), 3).tolist())),
        "urgency_exact_acc_on_relevant": round(float((posts.loc[mask, urg] == posts.loc[mask, "gold_urgency"]).mean()), 3),
        "urgency_weighted_kappa": round(cohen_kappa_score(posts.gold_urgency, posts[urg], weights="quadratic"), 3),
        "negated_posts_correctly_not_relevant": round(float((~posts.loc[posts.gold_is_negated == 1, rel].astype(bool)).mean()), 3),
        "relevance_recall_by_lang": {lg: round(float(posts.loc[mask & (posts.lang == lg), rel].mean()), 3)
                                     for lg in posts.lang.unique()},
        "relevance_f1_by_event": {SHORT[e]: prf(y[posts.event_id == e], posts.loc[posts.event_id == e, rel].astype(int))["f1"]
                                  for e in EVENTS},
    }

# Supervised comparison: TF-IDF char n-grams + logistic regression,
# leave-one-event-out (train on two events, test on the third)
sup_rel, sup_need, sup_rows = [], [], []
for test in EVENTS:
    tr, te = posts.event_id != test, posts.event_id == test
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True)
    Xtr, Xte = vec.fit_transform(posts.text[tr]), vec.transform(posts.text[te])
    m = LogisticRegression(max_iter=2000, C=4).fit(Xtr, y[tr])
    pr = m.predict(Xte)
    mn = OneVsRestClassifier(LogisticRegression(max_iter=2000, C=4)).fit(Xtr[y[tr].values == 1], Yg[tr.values & (y == 1).values])
    Yp = mn.predict(Xte) * pr[:, None]
    r1, r2 = prf(y[te], pr), round(f1_score(Yg[te.values], Yp, average="micro", zero_division=0), 3)
    sup_rows.append({"test_event": SHORT[test], "relevance_f1": r1["f1"], "need_micro_f1": r2})
cls["TF-IDF + logistic regression (leave-one-event-out)"] = {
    "relevance_f1_by_event": {r["test_event"]: r["relevance_f1"] for r in sup_rows},
    "need_micro_f1_by_event": {r["test_event"]: r["need_micro_f1"] for r in sup_rows},
    "relevance_f1_mean": round(np.mean([r["relevance_f1"] for r in sup_rows]), 3),
    "need_micro_f1_mean": round(np.mean([r["need_micro_f1"] for r in sup_rows]), 3)}
R["classification"] = cls

# Error examples for the report (v2 lexicon)
fp = posts[(posts.relevant) & (y == 0)].text.drop_duplicates().head(5).tolist()
fn = posts[(~posts.relevant) & (y == 1)].text.drop_duplicates().head(5).tolist()
R["classification_errors_v2"] = {"false_positives": fp, "false_negatives": fn}

# ============================================================ 2. geolocation
print("2. geolocation")
loc = posts[(y == 1) & posts.gold_incident_unit.notna()].copy()
names = I.units.set_index("unit_id").unit_name
loc["pred_name"] = loc.unit_id.map(names)
loc["author_name"] = loc.author_unit.map(names)
geo = {"evaluated_posts": int(len(loc)),
       "incident_location_accuracy": round(float((loc.pred_name == loc.gold_incident_unit).mean()), 3),
       "accuracy_by_method": loc.assign(ok=loc.pred_name == loc.gold_incident_unit).groupby("loc_method").ok.agg(["mean", "size"]).round(3).to_dict("index"),
       "author_location_would_be_correct": round(float((loc.author_name == loc.gold_incident_unit).mean()), 3),
       "author_location_available": round(float(loc.author_name.notna().mean()), 3),
       "posts_by_outside_authors": round(float((loc.author_type == "outside").mean()), 3)}
ev_mv = loc[loc.loc_method == "text_now_at"]
geo["evacuee_now_at_rule"] = {"posts": int(len(ev_mv)),
                              "accuracy": round(float((ev_mv.pred_name == ev_mv.gold_incident_unit).mean()), 3) if len(ev_mv) else None}
R["geolocation"] = geo

# ============================================================ 3. dedupe / spam
print("3. dedupe, spam")
dd = {"amplification": prf(posts.gold_is_amplification, posts.amplification.astype(int)),
      "copies": prf(posts.gold_is_copy, posts["copy"].astype(int)),
      "independent_report": prf(posts.gold_independent_report, posts.independent.astype(int))}
au = posts.groupby("author_hash").agg(pred=("spam", "max"), gold=("author_is_bot", "max"))
dd["spam_accounts"] = prf(au.gold, au.pred.astype(int))
dd["spam_accounts"]["n_gold_bot_accounts"] = int(au.gold.sum())
post_rel = posts[(posts.hours >= 0) & (y == 1)]
dd["inflation"] = {"relevant_posts": int(len(post_rel)),
                   "independent_reports_gold": int(post_rel.gold_independent_report.sum()),
                   "distinct_authors": int(post_rel.author_hash.nunique()),
                   "posts_per_independent_report": round(len(post_rel) / max(1, post_rel.gold_independent_report.sum()), 2)}
R["dedupe"] = dd

# ============================================================ 4. silent zones
print("4. silent zone detection")


def run_all(cfg):
    frames = []
    for e in EVENTS:
        r = P.run_event(I, e, cfg, processed=PROC[e])
        u = r.units.assign(event=SHORT[e], theta=r.meta["theta"])
        frames.append(u)
    u = pd.concat(frames).set_index("unit_id").join(gunit[["true_silent_zone", "true_comm_status", "gt_reason", "evacuated_share", "collection_gap_hours", "remoteness_index"]])
    return u


def score(u, col="flag"):
    out = {"pooled": prf(u.true_silent_zone, u[col].astype(int))}
    for ev, g in u.groupby("event"):
        out[ev] = prf(g.true_silent_zone, g[col].astype(int))
    out["flagged"] = sorted(u.index[u[col]].map(lambda i: u.loc[i, "unit_name"]).tolist())
    return out


def auc(u, col):
    try:
        per = [roc_auc_score(g.true_silent_zone, g[col]) for _, g in u.groupby("event")]
        return round(float(np.mean(per)), 3)
    except ValueError:
        return None


FULL = P.Config()
ladder = [
    ("1 Prototype as built (supplied baseline, need posts, v1 constants)", P.PROTOTYPE_V1, "flag"),
    ("2 + empirical baseline & 'voices from' counting", P.PROTOTYPE_V1.but(baseline="empirical", voices="from", observed_scope="all"), "flag"),
    ("3 + v2 calibration (fitted theta, peer surge, severity gate)", FULL.but(detectors="AB", confounder_screen=False, corroboration=False), "flag"),
    ("4 + zero-need-voice rule (Z)", FULL.but(detectors="ABZ", confounder_screen=False, corroboration=False), "flag"),
    ("5 + evacuation / data-gap screen", FULL.but(detectors="ABZ", corroboration=False), "flag"),
    ("6 + corroboration required (night lights / cell sites)", FULL.but(detectors="ABZ"), "flag"),
    ("7 + fusion rule F = final method", FULL, "flag"),
]
lad = {}
UNITS = {}
for name, cfg, col in ladder:
    u = run_all(cfg)
    UNITS[name] = u
    lad[name] = score(u, col)
R["ladder"] = lad
final = UNITS[ladder[-1][0]]

# Non-social baselines and ablations of the final method
base = {}
u0 = final.copy()
u0["vol_rank"] = u0.groupby("event").need_posts_all.rank(ascending=False)
for name, col, asc in [("Loudness dashboard: most need posts", "need_posts_all", False),
                       ("Inverse volume: fewest need posts", "need_posts_all", True),
                       ("Exposure only: highest expected need", "expected_need", False),
                       ("Social residual only (final method's score)", "residual", False),
                       ("Night-light drop only", "ntl_drop", False),
                       ("Cell sites down only", "cell_sites_down", False)]:
    s = u0[col].fillna(0) * (-1 if asc else 1)
    u0["_s"] = s
    k_flags = u0.groupby("event")["_s"].rank(ascending=False, method="first") <= u0.groupby("event").true_silent_zone.transform("sum")
    base[name] = {"auc_mean_over_events": auc(u0, "_s"), "r_precision": prf(u0.true_silent_zone, k_flags.astype(int))}
R["ranking_baselines"] = base

abl = {}
for name, cfg in [
    ("Final method", FULL),
    ("count posts instead of authors", FULL.but(count="posts")),
    ("keep reposts, copies and spam", FULL.but(drop_amplification=False, drop_spam=False)),
    ("count voices ABOUT (any author location)", FULL.but(voices="about")),
    ("supplied baseline instead of empirical", FULL.but(baseline="supplied")),
    ("no local baseline (regional average)", FULL.but(baseline="none")),
    ("size gate (expected need) instead of severity gate", FULL.but(gate="size")),
    ("fixed theta = 10", FULL.but(fit_theta=False)),
    ("no peer surge factor", FULL.but(surge=False)),
    ("no confounder screen", FULL.but(confounder_screen=False)),
    ("no corroboration filter", FULL.but(corroboration=False)),
    ("Detector A only", FULL.but(detectors="A")),
    ("Detector B only", FULL.but(detectors="B")),
    ("Detector F only (fusion)", FULL.but(detectors="F")),
    ("Evidence only: outage evidence + severity, no social signal", FULL.but(detectors="E")),
]:
    u = run_all(cfg)
    s = score(u)
    abl[name] = {"precision": s["pooled"]["precision"], "recall": s["pooled"]["recall"],
                 "f1": s["pooled"]["f1"], "tp": s["pooled"]["tp"], "fp": s["pooled"]["fp"],
                 "residual_auc": auc(u.assign(_r=u.residual.where(u.gate, u.residual - 10)), "_r"),
                 "flagged": s["flagged"]}
R["ablation"] = abl

# Sensitivity: thresholds of the final method
print("   sensitivity")
sens = []
orig = (P.RESID_T, P.DROP_T, P.FUSION_T, P.CORR_T)
for rt in (1.5, 2.0, 2.5, 3.0):
    for ft in (0.5, 1.0, 1.5):
        for ct in (0.3, 0.5, 0.7):
            P.RESID_T, P.FUSION_T, P.CORR_T = rt, ft, ct
            s = score(run_all(FULL))["pooled"]
            sens.append({"resid_T": rt, "fusion_T": ft, "corr_T": ct, **{k: s[k] for k in ("precision", "recall", "f1")}})
P.RESID_T, P.DROP_T, P.FUSION_T, P.CORR_T = orig
sens = pd.DataFrame(sens)
sens.to_csv(TAB / "sensitivity.csv", index=False)
R["sensitivity"] = {"configs": len(sens), "f1_median": round(float(sens.f1.median()), 3),
                    "f1_min": round(float(sens.f1.min()), 3), "f1_max": round(float(sens.f1.max()), 3),
                    "share_f1_ge_0.8": round(float((sens.f1 >= 0.8).mean()), 3)}

# Unit table of the final method
keep = ["event", "unit_name", "population", "damage_ratio", "expected_need", "baseline_empirical",
        "supplied_baseline_daily_authors", "surge", "mu", "observed", "ratio", "residual", "dropoff",
        "need_voices", "voices_about", "need_posts_all", "gate", "det_A", "det_B", "det_Z", "det_F",
        "ntl_drop", "cell_sites_down", "evacuated_share_reported", "longest_zero_run_h",
        "possible_collection_gap", "evacuation_explains", "status", "flag", "score",
        "true_silent_zone", "true_comm_status", "gt_reason"]
final[keep].round(3).to_csv(TAB / "units_final.csv")
proto = UNITS[ladder[0][0]]
proto[keep].round(3).to_csv(TAB / "units_prototype_v1.csv")

# Detectability: minimum drop the residual test can see, given mu (Poisson)
final["min_detectable_drop"] = np.minimum(1, 2 / np.sqrt(final.mu.clip(lower=0.01)))
final["observed_drop"] = (1 - final.observed / final.mu).clip(lower=0)
det = final[final.true_silent_zone == 1][["event", "unit_name", "mu", "observed", "observed_drop", "min_detectable_drop", "flag"]]
R["detectability_true_silent"] = det.round(2).to_dict("records")

# ============================================================ 5. loudness bias
print("5. loudness bias")
lb = {}
for e in EVENTS:
    g = final[final.event == SHORT[e]]
    lb[SHORT[e]] = {
        "spearman_volume_vs_baseline": round(spearmanr(g.need_posts_all, g.baseline_empirical)[0], 3),
        "spearman_volume_vs_expected_need": round(spearmanr(g.need_posts_all, g.expected_need)[0], 3),
        "spearman_volume_vs_damage_ratio": round(spearmanr(g.need_posts_all, g.damage_ratio)[0], 3),
        "silent_zones_in_volume_top_half": int(((g.need_posts_all.rank(ascending=False) <= 7) & (g.true_silent_zone == 1)).sum()),
        "true_silent_zones": int(g.true_silent_zone.sum()),
        "share_of_need_posts_from_silent_zones": round(float(g.loc[g.true_silent_zone == 1, "need_posts_all"].sum() / g.need_posts_all.sum()), 3),
        "share_of_expected_need_in_silent_zones": round(float(g.loc[g.true_silent_zone == 1, "expected_need"].sum() / g.expected_need.sum()), 3),
    }
R["loudness_bias"] = lb

# ============================================================ 6. patterns
print("6. need co-occurrence")
rel = posts[(posts.relevant) & (posts.hours >= 0) & ~posts.amplification & ~posts.spam]
pairs = {}
lab = mlb.transform(rel.needs)
n = len(rel)
for i, a in enumerate(mlb.classes_):
    for j, b in enumerate(mlb.classes_):
        if j <= i:
            continue
        both = int((lab[:, i] & lab[:, j]).sum())
        if both >= 30:
            lift = both * n / (lab[:, i].sum() * lab[:, j].sum())
            pairs[f"{a}+{b}"] = {"posts": both, "lift": round(float(lift), 2)}
R["cooccurrence"] = dict(sorted(pairs.items(), key=lambda kv: -kv[1]["lift"]))

# "Echo" signal: share of posts ABOUT a unit (from elsewhere) that are
# telecom/missing ("can't reach my family in X") - silence seen from outside
about = posts[(posts.hours >= 0) & (posts.relevant) & ~posts.spam & posts.unit_id.notna()].copy()
about = about[about.author_kind.isin(["outside"]) | ((about.author_kind == "unit") & (about.author_unit != about.unit_id))]
about["echo"] = about.needs.map(lambda l: ("telecom" in l) or ("missing" in l))
echo = about.groupby("unit_id").echo.mean().rename("echo_share")
fe = final.join(echo).fillna({"echo_share": 0})
R["echo_signal"] = {
    "mean_echo_share_true_silent": round(float(fe.loc[fe.true_silent_zone == 1, "echo_share"].mean()), 3),
    "mean_echo_share_other": round(float(fe.loc[fe.true_silent_zone == 0, "echo_share"].mean()), 3),
    "auc_mean_over_events": auc(fe, "echo_share")}

# ============================================================ 7. networks
print("7. networks")
net = {}
amp_by_unit = []
for e in EVENTS:
    p = PROC[e]
    G, per_unit = network.amplification_network(p)
    indeg = pd.Series(dict(G.in_degree(weight="weight")))
    kinds = p.drop_duplicates("author_hash").set_index("author_hash")
    top = indeg.sort_values(ascending=False).head(20)
    wcc = sorted(nx.weakly_connected_components(G), key=len, reverse=True)
    u = final[final.event == SHORT[e]].copy()
    u["reposts_received"] = u.index.map(per_unit).fillna(0)
    amp_by_unit.append(u)
    gz = Gazetteer(I.units, e)
    C = network.coordination_network(p, gz.rx)
    comps = [c for c in nx.connected_components(C) if len(c) >= 3]
    in_comp = set().union(*comps) if comps else set()
    gold_bot = set(posts[(posts.event_id == e) & (posts.author_is_bot == 1)].author_hash)
    net[SHORT[e]] = {
        "amplification_nodes": G.number_of_nodes(), "amplification_edges": G.number_of_edges(),
        "largest_component_share": round(len(wcc[0]) / max(1, G.number_of_nodes()), 3) if wcc else 0,
        "gini_in_degree": round(network.gini(indeg.values), 3),
        "top20_share_of_reposts": round(float(top.sum() / max(1, indeg.sum())), 3),
        "gini_reposts_by_unit": round(network.gini(u.reposts_received.values), 3),
        "spearman_reposts_vs_baseline": round(spearmanr(u.reposts_received, u.baseline_empirical)[0], 3),
        "reposts_to_true_silent_zones_share": round(float(u.loc[u.true_silent_zone == 1, "reposts_received"].sum() / max(1, u.reposts_received.sum())), 3),
        "coordination_nodes": C.number_of_nodes(), "coordination_edges": C.number_of_edges(),
        "coordination_clusters_ge3": len(comps),
        "coordination_cluster_bot_precision": round(len(in_comp & gold_bot) / max(1, len(in_comp)), 3),
        "coordination_cluster_bot_recall": round(len(in_comp & gold_bot) / max(1, len(gold_bot)), 3),
        "top_amplified_authors_type": kinds.reindex(top.index).merge(
            gpost.drop_duplicates("post_id")[["post_id", "author_type"]], on="post_id", how="left")
            .author_type.value_counts().to_dict(),
    }
R["network"] = net

# Save one network drawing (Nepal amplification) later in figures section
G_np, _ = network.amplification_network(PROC["nepal_eq_2015"])

# ============================================================ 8. figures
print("8. figures")


def fig_ladder():
    names = [k.split(" ", 1)[1] for k in lad]
    rec = [lad[k]["pooled"]["recall"] for k in lad]
    pre = [lad[k]["pooled"]["precision"] for k in lad]
    f1 = [lad[k]["pooled"]["f1"] for k in lad]
    fig, ax = plt.subplots(figsize=(9, 4.6))
    yy = np.arange(len(names))[::-1]
    h = 0.26
    for off, vals, c, lbl in [(h, pre, C1, "Precision"), (0, rec, C2, "Recall"), (-h, f1, C3, "F1")]:
        ax.barh(yy + off, vals, height=h - 0.03, color=c, label=lbl)
        for yv, v in zip(yy + off, vals):
            ax.text(v + 0.01, yv, f"{v:.2f}", va="center", fontsize=8, color=INK2)
    ax.set_yticks(yy, [textwrap(n, 46) for n in names], fontsize=8.5)
    ax.set_xlim(0, 1.12)
    ax.set_xlabel(f"Score against independent ground truth ({len(gunit)} districts, {int(gunit.true_silent_zone.sum())} true Silent Zones)")
    ax.set_title("From prototype to final method: each step evaluated on gold labels")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.13), ncol=3)
    ax.grid(axis="y", visible=False)
    save(fig, "fig_ladder.png")


def textwrap(s, w):
    import textwrap as tw
    return "\n".join(tw.wrap(s, w))


def fig_obs_exp():
    fig, axes = plt.subplots(1, 3, figsize=(12, 4.2), sharey=False)
    for ax, (ev, g) in zip(axes, final.groupby("event", sort=False)):
        x = g.mu.clip(lower=0.5)
        yv = g.observed.clip(lower=0.5)
        sz = g.true_silent_zone == 1
        ax.scatter(x[~sz], yv[~sz], s=46, color=MUTED, edgecolor=SURF, linewidth=1.5, label="Not silent (truth)", zorder=3)
        ax.scatter(x[sz], yv[sz], s=60, color=C2, marker="D", edgecolor=SURF, linewidth=1.5, label="True Silent Zone", zorder=4)
        fl = g.flag
        ax.scatter(x[fl], yv[fl], s=170, facecolor="none", edgecolor=C1, linewidth=1.6, label="Flagged by CrisisLens", zorder=5)
        lim = [0.4, max(x.max(), yv.max()) * 1.6]
        ax.plot(lim, lim, color=INK2, lw=1, ls="--", zorder=2)
        ax.plot(lim, [l * 0.5 for l in lim], color=MUTED, lw=1, ls=":", zorder=2)
        ax.set_xscale("log"); ax.set_yscale("log")
        ax.set_xlim(lim); ax.set_ylim(lim)
        for i, r in g.iterrows():
            if r.true_silent_zone or r.flag or r.unit_name in ("Kathmandu", "San Juan", "Ernakulam", "Alappuzha"):
                ax.annotate(r.unit_name, (max(r.mu, .5), max(r.observed, .5)), xytext=(4, -10),
                            textcoords="offset points", fontsize=7.5, color=INK2)
        ax.set_title(ev)
    fig.supxlabel("Expected local voices in 72 h (pre-event baseline x 3 days x regional surge)", color=INK2, fontsize=10)
    axes[0].set_ylabel("Observed local voices, 72 h after impact")
    axes[0].legend(loc="upper left", fontsize=8)
    fig.suptitle("Observed vs expected voices: dashed = as expected, dotted = half of expected",
                 x=0.01, y=1.03, ha="left", fontsize=10, color=INK2)
    save(fig, "fig_observed_vs_expected.png")


def fig_loudness():
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.9))
    for ax, (ev, g) in zip(axes, final.groupby("event", sort=False)):
        g = g.sort_values("need_posts_all")
        cols = [C2 if s else MUTED for s in g.true_silent_zone]
        ax.barh(g.unit_name, g.need_posts_all, color=cols, height=0.7)
        ax.set_title(ev)
        ax.tick_params(axis="y", labelsize=7.5)
        ax.grid(axis="y", visible=False)
        ax.set_xlabel("Need posts in first 72 h (raw volume)")
    from matplotlib.patches import Patch
    axes[2].legend([Patch(color=C2), Patch(color=MUTED)], ["True Silent Zone", "Other district"], loc="lower right", fontsize=8)
    fig.suptitle("Loudness bias: a volume-ranked dashboard puts the cut-off districts at the bottom",
                 x=0.01, y=1.04, ha="left", fontsize=11, fontweight="bold", color=INK)
    save(fig, "fig_loudness_bias.png")


def fig_ablation():
    d = pd.DataFrame(abl).T
    d = d.iloc[::-1]
    fig, ax = plt.subplots(figsize=(8.5, 5))
    cols = [C1 if i == len(d) - 1 else MUTED for i in range(len(d))]
    ax.barh(d.index, d.f1.astype(float), color=cols, height=0.65)
    for i, (v, tp, fp) in enumerate(zip(d.f1, d.tp, d.fp)):
        ax.text(float(v) + 0.01, i, f"F1 {float(v):.2f}  (TP {tp}, FP {fp})", va="center", fontsize=8, color=INK2)
    ax.set_xlim(0, 1.25)
    ax.set_xlabel("Pooled F1 against ground truth")
    ax.set_title("Ablation: remove one design choice at a time")
    ax.grid(axis="y", visible=False)
    ax.tick_params(axis="y", labelsize=8.5)
    save(fig, "fig_ablation.png")


def fig_baselines():
    d = pd.DataFrame(base).T
    fig, ax = plt.subplots(figsize=(8, 3.4))
    d = d.sort_values("auc_mean_over_events")
    cols = [C1 if "Social" in i else (C3 if "Night" in i or "Cell" in i else MUTED) for i in d.index]
    ax.barh(d.index, d.auc_mean_over_events.astype(float), color=cols, height=0.6)
    ax.axvline(0.5, color=INK2, ls="--", lw=1)
    ax.text(0.505, -0.6, "random", fontsize=8, color=INK2)
    for i, v in enumerate(d.auc_mean_over_events):
        ax.text(float(v) + 0.01, i, f"{float(v):.2f}", va="center", fontsize=8.5, color=INK2)
    ax.set_xlim(0, 1.1)
    ax.set_xlabel("Ranking AUC for true Silent Zones (mean of 3 events)")
    ax.set_title("Which ranking finds cut-off districts?")
    ax.grid(axis="y", visible=False)
    save(fig, "fig_ranking_baselines.png")


def fig_timeline():
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.4), sharey=True)
    picks = [("nepal_eq_2015", "nepal_01", "nepal_07"), ("maria_2017", "maria_10", "maria_01"), ("kerala_flood_2018", "kerala_05", "kerala_12")]
    for ax, (e, s_id, n_id) in zip(axes, picks):
        r = P.run_event(I, e, FULL, processed=PROC[e])
        for uid, c, lbl in [(s_id, C2, "silent"), (n_id, C1, "connected")]:
            row = r.hourly.loc[uid]
            base = row[row.index < 0].mean()
            sm = row.rolling(12, center=True, min_periods=1).mean() / max(base, 1e-9)
            name = r.units.set_index("unit_id").unit_name[uid]
            ax.plot(sm.index, sm.values, color=c, lw=2, label=f"{name} ({lbl})")
        ax.axvline(0, color=INK2, lw=1, ls="--")
        ax.axhline(1, color=MUTED, lw=1)
        ax.set_title(SHORT[e])
        ax.set_xlabel("Hours since impact")
        ax.legend(fontsize=8, loc="upper left")
    axes[0].set_ylabel("Local voices / pre-event hourly mean\n(12 h rolling)")
    save(fig, "fig_timelines.png")


def fig_detectability():
    fig, ax = plt.subplots(figsize=(7.5, 4.2))
    xs = np.linspace(1, 400, 400)
    ax.plot(xs, np.minimum(1, 2 / np.sqrt(xs)), color=INK2, lw=1.5, label="Minimum detectable drop (residual > 2, Poisson)")
    sz = final.true_silent_zone == 1
    ax.scatter(final.mu[~sz], final.observed_drop[~sz], s=36, color=MUTED, edgecolor=SURF, label="Other district", zorder=3)
    ax.scatter(final.mu[sz], final.observed_drop[sz], s=56, color=C2, marker="D", edgecolor=SURF, label="True Silent Zone", zorder=4)
    for _, r in final[sz].iterrows():
        ax.annotate(r.unit_name, (r.mu, r.observed_drop), xytext=(4, 3), textcoords="offset points", fontsize=7.5, color=INK2)
    ax.set_xscale("log")
    ax.set_xlabel("Expected local voices in 72 h (mu)")
    ax.set_ylabel("Observed drop below expectation")
    ax.set_title("Small places can only be heard going silent if the silence is near-total")
    ax.legend(fontsize=8, loc="upper right")
    save(fig, "fig_detectability.png")


def fig_classifier():
    names = list(cls)[:2]
    fig, ax = plt.subplots(figsize=(8, 3.6))
    keys = list(classify.NEEDS)
    x = np.arange(len(keys))
    w = 0.38
    for off, nm, c in [(-w / 2, names[0], MUTED), (w / 2, names[1], C1)]:
        ax.bar(x + off, [cls[nm]["per_need_f1"][k] for k in keys], width=w - 0.04, color=c, label=nm)
    ax.set_xticks(x, keys, fontsize=8.5)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("F1 vs gold need labels")
    ax.set_title("Need classification per category: original vs revised lexicon")
    ax.legend(fontsize=8, loc="lower left")
    ax.grid(axis="x", visible=False)
    save(fig, "fig_classifier.png")


def fig_network():
    G = G_np
    und = G.to_undirected()
    big = max(nx.connected_components(und), key=len)
    H = G.subgraph(big).copy()
    pos = nx.spring_layout(H, seed=7, k=0.25)
    indeg = dict(H.in_degree(weight="weight"))
    fig, ax = plt.subplots(figsize=(7, 6))
    nx.draw_networkx_edges(H, pos, ax=ax, edge_color=GRID, width=0.5, arrows=False)
    sizes = [8 + 6 * indeg[n] for n in H.nodes]
    cols = [C2 if indeg[n] >= 5 else C1 for n in H.nodes]
    nx.draw_networkx_nodes(H, pos, ax=ax, node_size=sizes, node_color=cols, linewidths=0)
    ax.set_title(f"Nepal repost network, largest component ({H.number_of_nodes()} accounts)")
    ax.axis("off")
    save(fig, "fig_network_nepal.png")


for f in (fig_ladder, fig_obs_exp, fig_loudness, fig_ablation, fig_baselines, fig_timeline,
          fig_detectability, fig_classifier, fig_network):
    f()

# ============================================================ write
amp = pd.concat(amp_by_unit)
amp[["event", "unit_name", "reposts_received", "baseline_empirical", "true_silent_zone"]].to_csv(TAB / "amplification_by_unit.csv")
pd.DataFrame(abl).T.to_csv(TAB / "ablation.csv")
pd.DataFrame({k: v["pooled"] for k, v in lad.items()}).T.to_csv(TAB / "ladder.csv")
pd.DataFrame(base).T.to_csv(TAB / "ranking_baselines.csv")
(OUT / "results.json").write_text(json.dumps(R, indent=2, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
with pd.ExcelWriter(OUT / "CrisisLens_results.xlsx") as xw:
    final[keep].round(3).to_excel(xw, sheet_name="final_method_units")
    proto[keep].round(3).to_excel(xw, sheet_name="prototype_v1_units")
    pd.DataFrame({k: v["pooled"] for k, v in lad.items()}).T.to_excel(xw, sheet_name="ladder")
    pd.DataFrame(abl).T.to_excel(xw, sheet_name="ablation")
    pd.DataFrame(base).T.to_excel(xw, sheet_name="ranking_baselines")
    sens.to_excel(xw, sheet_name="sensitivity", index=False)
print(json.dumps({k: R[k] for k in ("ladder",)}, indent=1)[:3000])
print("done ->", OUT)
