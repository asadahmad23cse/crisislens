"""Export the final CrisisLens results to the dashboard.

Run after evaluate.py:  python analysis/export_dashboard.py
Writes src/lib/crisislens/data/dataset/<event>.json, which the Next.js
dashboard loads instead of generating scenario posts.

Everything under the "evaluation" key (and the ablation / reliability blocks)
uses the gold sheets. The rest comes from the pipeline inputs only.
"""
from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import Voronoi

sys.path.insert(0, str(Path(__file__).parent))
from crisislens import data, dedupe, pipeline as P  # noqa: E402

HERE = Path(__file__).parent
DEST = HERE.parent / "src" / "lib" / "crisislens" / "data" / "dataset"
DEST.mkdir(parents=True, exist_ok=True)

EVENT_IDS = {"nepal_eq_2015": "nepal-2015", "maria_2017": "maria-2017", "kerala_flood_2018": "kerala-2018"}
NEED_LONG = {"rescue": "rescue_and_trapped", "water": "water_and_sanitation", "medical": "medical_and_injury",
             "food": "food_and_nutrition", "shelter": "shelter_and_displacement", "power": "power_and_energy",
             "telecom": "telecom_outage", "road": "road_and_access_blocked", "missing": "missing_persons",
             "safety": "protection_and_safety"}
FULL = P.Config()
BUCKET_H = 6

I, PROC = pickle.load(open(HERE / "output" / "processed.pkl", "rb"))
GOLD = data.load_gold()["unit_ground_truth"].set_index("unit_id")


def iso(ts) -> str:
    return pd.Timestamp(ts).strftime("%Y-%m-%dT%H:%M:%SZ")


def r2(x, d=2):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), d)


# ------------------------------------------------------------------ map
def project(units: pd.DataFrame, ev) -> tuple[np.ndarray, list[float]]:
    """Equirectangular projection of centroids into the 600x600 SVG viewBox."""
    lat, lon = units.centroid_lat.to_numpy(), units.centroid_lon.to_numpy()
    k = np.cos(np.radians(lat.mean()))
    x, y = lon * k, -lat
    span = max(x.max() - x.min(), y.max() - y.min())
    s = 470 / span
    cx, cy = (x.max() + x.min()) / 2, (y.max() + y.min()) / 2
    pts = np.c_[300 + (x - cx) * s, 300 + (y - cy) * s]
    epi = [300 + (ev.epicentre_lon * k - cx) * s, 300 + (-ev.epicentre_lat - cy) * s]
    return pts, [float(np.clip(epi[0], 20, 580)), float(np.clip(epi[1], 20, 580))]


def voronoi_paths(pts: np.ndarray) -> list[str]:
    """One polygon per district: Voronoi cell of its centroid, clipped to a
    padded box by mirroring the points. A schematic map, not real borders."""
    lo, hi = pts.min(0) - 45, pts.max(0) + 45
    mirrored = [pts]
    for ax in (0, 1):
        for b in (lo, hi):
            m = pts.copy()
            m[:, ax] = 2 * b[ax] - m[:, ax]
            mirrored.append(m)
    vor = Voronoi(np.vstack(mirrored))
    out = []
    for i in range(len(pts)):
        poly = vor.vertices[vor.regions[vor.point_region[i]]]
        c = poly.mean(0)
        ang = np.arctan2(poly[:, 1] - c[1], poly[:, 0] - c[0])
        poly = poly[np.argsort(ang)]
        poly = c + (poly - c) * 0.96            # small gap between districts
        out.append("M" + " L".join(f"{x:.0f},{y:.0f}" for x, y in poly) + " Z")
    return out


BOUNDARIES = HERE / "boundaries" / "selected.json"


def real_paths(units: pd.DataFrame, ev, event_key: str):
    """Real district borders (geoBoundaries) as SVG paths in the 600x600 viewBox.
    Returns (paths in unit order, epicentre xy, context paths, label xy per unit),
    or None if analysis/boundaries/selected.json has not been built."""
    if not BOUNDARIES.exists():
        return None
    from shapely.geometry import shape
    sel = json.loads(BOUNDARIES.read_text(encoding="utf-8")).get(event_key)
    if not sel:
        return None
    geoms = {uid: shape(g) for uid, g in sel["units"].items()}
    k = np.cos(np.radians(np.mean([g.centroid.y for g in geoms.values()])))
    b = np.array([g.bounds for g in geoms.values()])
    x0, x1, y0, y1 = b[:, 0].min() * k, b[:, 2].max() * k, b[:, 1].min(), b[:, 3].max()
    scale = 540 / max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

    def xy(lon, lat):
        return 300 + (lon * k - cx) * scale, 300 - (lat - cy) * scale

    def path(geom) -> str:
        polys = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
        big = max(p.area for p in polys)
        parts = []
        for p in polys:
            if p.area < 0.02 * big:      # drop slivers and tiny islets
                continue
            pts = [xy(lon, lat) for lon, lat in p.exterior.coords]
            parts.append("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z")
        return " ".join(parts)

    paths = [path(geoms[uid]) for uid in units.unit_id]
    labels = []
    for uid in units.unit_id:
        c = geoms[uid].representative_point() if not geoms[uid].contains(geoms[uid].centroid) else geoms[uid].centroid
        labels.append([round(v, 1) for v in xy(c.x, c.y)])
    ex, ey = xy(ev.epicentre_lon, ev.epicentre_lat)
    epi = [float(np.clip(ex, 15, 585)), float(np.clip(ey, 15, 585))]
    from shapely.geometry import shape as _shape
    context = [path(_shape(c["geometry"])) for c in sel["context"]]
    # Frame the map on the 14 districts (plus the epicentre), not on a fixed square
    corners = [xy(x, y) for g in geoms.values() for x, y in ((g.bounds[0], g.bounds[1]), (g.bounds[2], g.bounds[3]))]
    vx = [c[0] for c in corners] + [epi[0]]
    vy = [c[1] for c in corners] + [epi[1]]
    pad = 28
    viewbox = [round(min(vx) - pad), round(min(vy) - pad), round(max(vx) - min(vx) + 2 * pad), round(max(vy) - min(vy) + 2 * pad)]
    return paths, epi, context, labels, viewbox


# ------------------------------------------------------------ need units
def need_units(p: pd.DataFrame, units: pd.DataFrame, impact) -> list[dict]:
    r = p[p.relevant & ~p.spam & p.unit_id.notna() & (p.hours >= 0)].copy()
    r["needs_key"] = r.needs.map(lambda l: "|".join(sorted(l)))
    r["core"] = r.text.map(dedupe.core_text)
    r["sig"] = r.core.map(dedupe.minhash)
    r["block"] = list(zip(r.unit_id, r.needs_key, (r.hours // BUCKET_H).astype(int)))
    r = r.reset_index(drop=True)
    r["cluster"] = dedupe.cluster_need_units(r)
    u = units.set_index("unit_id")
    out = []
    for cid, g in r.groupby("cluster"):
        orig = g[~g.amplification & ~g["copy"]]
        rep = (orig if len(orig) else g).iloc[0]
        uid = rep.unit_id
        n_auth = int(orig.author_hash.nunique())
        out.append({
            "need_unit_id": f"nu_{uid}_{cid}",
            "need_types": [NEED_LONG[n] for n in rep.needs],
            "admin_unit_id": uid, "admin_unit_name": u.unit_name[uid],
            "geo_confidence": 0.9 if rep.loc_method.startswith("text") else 0.6,
            "n_posts": int(len(g)), "n_unique_authors": max(n_auth, 1),
            "n_amplifications": int((g.amplification | g["copy"]).sum()),
            "first_seen": iso(g.created_at_utc.min()), "last_seen": iso(g.created_at_utc.max()),
            "peak_urgency": int(g.urgency.max()),
            "representative_text": rep.core,
            "corroboration_score": round(min(1.0, n_auth / 5), 2),
            "member_post_ids": g.post_id.head(20).tolist(),
            "lat": float(u.centroid_lat[uid]), "lon": float(u.centroid_lon[uid]),
        })
    out.sort(key=lambda d: -d["n_unique_authors"])
    return out


# -------------------------------------------------------------- timelines
def timeline(df: pd.DataFrame, impact) -> list[dict]:
    b = np.floor(df.hours / BUCKET_H).astype(int)
    g = df.assign(b=b).groupby("b").agg(a=("author_hash", "nunique"), n=("post_id", "size"))
    rows = []
    for k in range(-7 * 24 // BUCKET_H, 72 // BUCKET_H):
        rows.append({"t": iso(impact + pd.Timedelta(hours=k * BUCKET_H)), "pre_event": k < 0,
                     "unique_authors": int(g.a.get(k, 0)), "posts": int(g.n.get(k, 0))})
    return rows


def change_point(tl: list[dict]) -> str | None:
    pre = [t["unique_authors"] for t in tl if t["pre_event"]]
    m = np.mean(pre) if pre else 0
    for t in tl:
        if not t["pre_event"] and t["unique_authors"] < 0.3 * m:
            return t["t"]
    return None


# ------------------------------------------------------------------ flags
def score_ci(mu, obs, theta, det_b_part, rng) -> tuple[int, int]:
    """95% interval of the 0-100 score from Poisson uncertainty in the observed count."""
    o = rng.poisson(max(obs, 0.5), 2000)
    resid = (mu - o) / np.sqrt(np.maximum(0.5, mu + mu ** 2 / theta))
    s = np.clip(np.clip((resid - 2) * 15 + 30, 0, 60) + det_b_part, 0, 100)
    return int(np.percentile(s, 2.5)), int(np.percentile(s, 97.5))


def explain(r) -> str:
    rules = [n for n, f in (("A (residual)", r.det_A), ("B (drop)", r.det_B),
                            ("Z (zero need voices)", r.det_Z), ("F (fusion with outage evidence)", r.det_F)) if f]
    ev = []
    if not np.isnan(r.ntl_drop):
        ev.append(f"night lights down {r.ntl_drop:.0%}")
    if not np.isnan(r.cell_sites_down):
        ev.append(f"{r.cell_sites_down:.0%} of cell sites reported down")
    return (f"{r.unit_name} (pop {int(r.population):,}) has a damage ratio of {r.damage_ratio:.0%}, at or above the "
            f"regional median. Its pre-event baseline was {r.baseline:.1f} local voices/day; allowing for the "
            f"regional surge (x{r.surge:.2f}) we expected {r.mu:.1f} voices in 72 h and heard {int(r.observed)} "
            f"({r.dropoff:.0%} below expectation, residual {r.residual:.2f}). Rules fired: {', '.join(rules)}. "
            f"Independent evidence: {'; '.join(ev) or 'none available'}. "
            f"Reported evacuation: {r.evacuated_share_reported:.0%} of population; after removing evacuees the "
            f"district is still too quiet. Advisory flag: verify through another channel before acting.")


def screened_reason(r) -> str:
    if r.status == "explained_evacuation" and r.det_Z and not (r.det_A or r.det_B or r.det_F):
        return (f"No local need reports at all ({int(r.observed)} local voices of any kind, about {r.mu:.1f} expected). "
                f"With the {r.evacuated_share_reported:.0%} reported evacuees removed, the expectation falls below the "
                f"3 voices the zero-voice rule needs, so it is not flagged. Baseline too thin to be sure: check manually.")
    if r.status == "explained_evacuation":
        return (f"Quiet ({int(r.observed)} voices vs {r.mu:.0f} expected), but {r.evacuated_share_reported:.0%} of the "
                f"population was reported evacuated. With evacuees removed the shortfall is no longer significant.")
    if r.status == "explained_data_gap":
        return (f"A {int(r.longest_zero_run_h)}-hour hole in which posts about the district from outsiders also "
                f"vanish: this looks like a data-collection gap, not a communication cut-off.")
    return (f"Quieter than peers ({int(r.observed)} voices vs {r.mu:.0f} expected), but no independent outage "
            f"evidence (night lights down {r.ntl_drop:.0%}, cell sites down {r.cell_sites_down:.0%}).")


# ------------------------------------------------------------------ export
def run_cfg(e, cfg):
    return P.run_event(I, e, cfg, processed=PROC[e]).units.set_index("unit_id").join(GOLD[["true_silent_zone", "gt_reason"]])


def prf(u, col="flag"):
    tp = int((u[col] & (u.true_silent_zone == 1)).sum())
    fp = int((u[col] & (u.true_silent_zone == 0)).sum())
    fn = int((~u[col] & (u.true_silent_zone == 1)).sum())
    p = tp / (tp + fp) if tp + fp else 0.0
    rc = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * rc / (p + rc) if p + rc else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": round(p, 2), "recall": round(rc, 2), "f1": round(f1, 2)}


def export(e: str):
    rng = np.random.default_rng(2026)
    ev = I.events.set_index("event_id").loc[e]
    p = PROC[e]
    res = P.run_event(I, e, FULL, processed=p)
    u = res.units.set_index("unit_id", drop=False).join(GOLD[["true_silent_zone", "gt_reason", "true_comm_status"]])
    impact = ev.impact_utc
    win = p[(p.hours >= -168) & (p.hours < 72)]
    voices = win[P.voice_mask(win, FULL)]

    real = real_paths(res.units, ev, e)
    if real:
        paths, epi, context_paths, labels, viewbox = real
        map_source = "District borders: geoBoundaries (gbOpen), simplified"
    else:  # schematic fallback: Voronoi cells around district centres
        pts, epi = project(res.units, ev)
        paths, context_paths, labels, viewbox = voronoi_paths(pts), [], [None] * len(res.units), [0, 0, 600, 600]
        map_source = "Schematic map (cells around district centres)"
    units_json = [{
        "id": r.unit_id, "name": r.unit_name, "adm_level": "ADM2",
        "lat": float(r.centroid_lat), "lon": float(r.centroid_lon), "svg_path": paths[i], "label_xy": labels[i],
        "population": int(r.population), "mmi": float(r.hazard_intensity),
        "vulnerability": float(r.vulnerability), "infrastructure": float(r.infrastructure_factor),
        "internet_penetration": float(r.internet_penetration), "urban_share": float(r.urban_share),
        "empirical_baseline": r2(r.baseline_empirical),
    } for i, r in enumerate(res.units.itertuples())]

    nus = need_units(p, res.units, impact)
    per_unit_tl = {uid: timeline(voices[voices.unit_id == uid], impact) for uid in u.index}
    unlocated = float(win.unit_id.isna().mean())

    expected = [{
        "admin_unit_id": r.unit_id, "admin_unit_name": r.unit_name, "expected_need": int(r.expected_need),
        "population_exposed": int(r.pop_exposed), "hazard_intensity": float(r.hazard_intensity),
        "damage_ratio": r2(r.damage_ratio, 3), "vulnerability": float(r.vulnerability),
        "infrastructure": float(r.infrastructure_factor), "exposure_percentile": r2(r.exposure_pct),
    } for r in u.itertuples()]
    observed = [{
        "admin_unit_id": r.unit_id, "admin_unit_name": r.unit_name, "observed_reporters": int(r.observed),
        "observed_posts": int(r.need_posts_all), "baseline_source": "empirical",
        "baseline_authors_per_day": r2(r.baseline), "expected_reporters_from_baseline": int(round(r.mu)),
        "unlocated_post_share": r2(unlocated),
    } for r in u.itertuples()]

    flags = []
    for r in u[u.flag].sort_values("score", ascending=False).itertuples():
        b_part = min(50, r.dropoff * r.exposure_pct * 60) if r.det_B else 0
        lo, hi = score_ci(r.mu, r.observed, r.theta, b_part + (10 if r.det_A and r.det_B else 0), rng)
        sub = win[win.unit_id == r.unit_id]
        langs = sub.lang.value_counts(normalize=True).head(4)
        conf = np.where(sub.loc_method.str.startswith("text"), 0.9, 0.6)
        flags.append({
            "admin_unit_id": r.unit_id, "admin_unit_name": r.unit_name,
            "lat": float(r.centroid_lat), "lon": float(r.centroid_lon),
            "score": int(r.score), "ci_low": min(lo, int(r.score)), "ci_high": max(hi, int(r.score)),
            "detector_a_triggered": bool(r.det_A), "detector_b_triggered": bool(r.det_B),
            "both_detectors": bool(r.det_A and r.det_B),
            "detector_z_triggered": bool(r.det_Z), "detector_f_triggered": bool(r.det_F),
            "expected_need": int(r.expected_need), "observed_reporters": int(r.observed),
            "expected_reporters": r2(r.mu, 1), "baseline_source": "empirical",
            "baseline_authors_per_day": r2(r.baseline), "dropoff_pct": r2(r.dropoff) if r.dropoff > 0 else None,
            "change_point_utc": change_point(per_unit_tl[r.unit_id]),
            "unlocated_post_share": r2(unlocated),
            "evidence_need_unit_ids": [n["need_unit_id"] for n in nus if n["admin_unit_id"] == r.unit_id][:8],
            "explanation": explain(r),
            "evidence": {"ntl_drop": r2(r.ntl_drop), "cell_sites_down": r2(r.cell_sites_down),
                         "evacuated_share": r2(r.evacuated_share_reported), "voices_about": int(r.voices_about)},
            "confounders": {
                "geocode_confidence_median": r2(np.median(conf)) if len(conf) else 0.5,
                "geocode_confidence_p25": r2(np.percentile(conf, 25)) if len(conf) else 0.4,
                "geocode_confidence_p75": r2(np.percentile(conf, 75)) if len(conf) else 0.7,
                "language_mix": [{"lang": k, "share": r2(v)} for k, v in langs.items()],
                "exposure_inputs": {"population": int(r.population), "mmi": float(r.hazard_intensity),
                                    "vulnerability": float(r.vulnerability),
                                    "infrastructure": float(r.infrastructure_factor)},
                "evacuation_flag": bool(r.evacuated_share_reported >= 0.05),
                "baseline_modeled_reason": None,
            },
            "rank": len(flags) + 1,
        })

    screened = [{"admin_unit_id": r.unit_id, "admin_unit_name": r.unit_name, "status": r.status,
                 "score": int(r.score), "reason": screened_reason(r)}
                for r in u[u.flag_social & ~u.flag].sort_values("score", ascending=False).itertuples()]

    critical = [{
        "admin_unit_id": r.unit_id, "admin_unit_name": r.unit_name, "expected_need": int(r.expected_need),
        "observed_reporters": int(r.need_voices),
        "urgency": "critical" if r.damage_ratio > 0.75 else "high" if r.damage_ratio > 0.4 else "moderate",
        "mmi": float(r.hazard_intensity), "damage_percentile": r2(r.exposure_pct),
        "likely_cause": (f"No local need reports at all in 72 h ({r.mu:.1f} local voices expected). "
                         + ("Outage evidence supports a cut-off: " if r.corroborated else "No outage evidence: ")
                         + f"night lights down {r.ntl_drop:.0%}, cell sites down {r.cell_sites_down:.0%}. "
                         + f"{int(r.voices_about)} people elsewhere posted about this district."),
    } for r in u[u.det_Z].sort_values("expected_need", ascending=False).itertuples()]

    # Independent evidence tab (night lights from the evidence sheet; never used to compute the social score)
    erows = I.evidence[I.evidence.event_id == e]
    ntl = []
    for r in u.itertuples():
        x = erows[erows.unit_id == r.unit_id]
        clear = x[x.ntl_cloud_masked == 0]
        ntl.append({
            "admin_unit_id": r.unit_id, "admin_unit_name": r.unit_name, "silent_zone": bool(r.flag),
            "silent_zone_score": int(r.score),
            "pre_event_radiance": r2(clear[clear.day_offset < 0].ntl_radiance_nw_cm2_sr.mean()) or 0,
            "post_event_radiance": r2(clear[clear.day_offset >= 0].ntl_radiance_nw_cm2_sr.mean()) or 0,
            "radiance_drop_pct": r2(max(0.0, r.ntl_drop)) if not np.isnan(r.ntl_drop) else 0,
            "cloud_cover_pct": int(round(100 * x.ntl_cloud_masked.mean())),
            "cell_sites_down_pct": r2(r.cell_sites_down),
            "social_shortfall_pct": r2(r.dropoff),
        })
    ok = u.ntl_drop.notna()
    corr = float(np.corrcoef(u.dropoff[ok], u.ntl_drop[ok])[0, 1])
    lights = {
        "per_unit": ntl, "correlation_score_vs_radiance_drop": round(corr, 2),
        "headline": (f"Social shortfall and night-light drop correlate at r = {corr:.2f} across {int(ok.sum())} districts. "
                     f"The radiance values come from the dataset's independent-evidence sheet and are never used to "
                     f"compute the social shortfall, so this check is not circular. The data are still simulated."),
        "scatter_plot": [{"x": int(round(100 * n["social_shortfall_pct"])), "y": n["radiance_drop_pct"],
                          "label": n["admin_unit_name"], "silent": n["silent_zone"]} for n in ntl],
    }

    # Evaluation against ground truth (gold sheet) -- Ablation tab
    variants = []
    k = int(u.flag.sum())

    def add(key, label, desc, uu, col="flag"):
        m = prf(uu, col)
        variants.append({
            "key": key, "label": label, "description": desc,
            "silent_zones_detected": int(uu[col].sum()), "precision_at_k": m["precision"],
            "recall": m["recall"], "f1": m["f1"],
            "top_k_unit_ids": uu.index[uu[col]].tolist(),
            "degradation_note": f"{m['tp']} correct, {m['fp']} false alarm(s), {m['fn']} missed.",
        })

    add("crisislens_full", "CrisisLens final method",
        "Local voices vs own baseline x regional surge; severity gate; rules A/B/Z/F; evacuation and data-gap screen; outage evidence required.", u)
    add("prototype_v1", "Original prototype (v1 constants)",
        "Supplied baseline, need-post authors from anywhere, theta = 10, fixed exposure elasticity, population-weighted gate.",
        run_cfg(e, P.PROTOTYPE_V1))
    add("voices_about", "Count voices ABOUT the district", "Any author location counts, including other districts and abroad.",
        run_cfg(e, FULL.but(voices="about")))
    add("size_gate", "Population-weighted exposure gate", "Gate on total expected need instead of damage ratio.",
        run_cfg(e, FULL.but(gate="size")))
    add("post_counts", "Post counts instead of distinct authors", "One person posting many times counts many times.",
        run_cfg(e, FULL.but(count="posts")))
    add("no_screen", "No evacuation / data-gap screen", "Evacuated districts are flagged as silent.",
        run_cfg(e, FULL.but(confounder_screen=False)))
    add("evidence_only", "Outage evidence only (no social signal)", "Flags every badly hit district with night-light or cell-site loss.",
        run_cfg(e, FULL.but(detectors="E")))
    vol = u.assign(_f=u.need_posts_all.rank(ascending=False, method="first") <= max(k, 1))
    add("loudest", "Loudness dashboard (most need posts)", f"Top {max(k, 1)} districts by raw need-post volume.", vol, "_f")
    inv = u.assign(_f=u.need_posts_all.rank(ascending=True, method="first") <= max(k, 1))
    add("inverse_volume", "Inverse volume (fewest need posts)", f"Bottom {max(k, 1)} districts by raw need-post volume.", inv, "_f")
    full, proto = variants[0], variants[1]
    lift = int(round(100 * (full["f1"] - proto["f1"])))
    truth = u.unit_name[u.true_silent_zone == 1].tolist()
    ablation = {
        "variants": variants, "crisislens_full": full, "baseline_offset_lift_points": lift,
        "headline": (f"Scored against the dataset's ground truth ({len(truth)} true Silent Zones: {', '.join(truth)}). "
                     f"Final method F1 {full['f1']:.2f} vs original prototype {proto['f1']:.2f}."),
    }

    bins = []
    for lo in range(0, 100, 20):
        g = u[(u.score >= lo) & (u.score < lo + 20 + (1 if lo == 80 else 0))]
        if len(g):
            bins.append({"range_low": lo, "range_high": lo + 20, "mean_predicted": r2(g.score.mean() / 100),
                         "empirical_frequency": r2(g.true_silent_zone.mean()), "n_units": int(len(g))})

    loud = u.sort_values("observed", ascending=False).iloc[0]
    top = u[u.flag].sort_values("score", ascending=False)
    q = top.iloc[0] if len(top) else u.sort_values("ratio").iloc[0]
    m_full, m_inv = prf(u), prf(inv, "_f")
    finding = {
        "headline": ("The areas posting the most are NOT the worst affected. Loud signal is masking silent zones."
                     if len(top) else "No silent zones detected in this event."),
        "loudest_unit": {"admin_unit_id": loud.unit_id, "admin_unit_name": loud.unit_name,
                         "observed_reporters": int(loud.observed), "expected_need": int(loud.expected_need),
                         "damage_percentile": r2(loud.exposure_pct)},
        "quietest_high_exposure_unit": {"admin_unit_id": q.unit_id, "admin_unit_name": q.unit_name,
                                        "observed_reporters": int(q.observed), "expected_need": int(q.expected_need),
                                        "damage_percentile": r2(q.exposure_pct), "score": int(q.score)},
        "inverted_volume_baseline_precision_at_10": m_inv["precision"],
        "crisislens_precision_at_10": m_full["precision"],
        "lift_points": int(round(100 * (m_full["precision"] - m_inv["precision"]))),
        "correlation_silent_zone_vs_volume": r2(np.corrcoef(u.score, u.need_posts_all)[0, 1]),
        "flagged_share_of_need_posts": r2(u.need_posts_all[u.flag].sum() / max(1, u.need_posts_all.sum()), 3),
        "flagged_share_of_expected_need": r2(u.expected_need[u.flag].sum() / max(1, u.expected_need.sum()), 3),
    }

    eid = EVENT_IDS[e]
    out = {
        "event": {
            "event_id": eid, "name": ev.event_name, "hazard_type": ev.hazard_type, "country": ev.country,
            "epicenter_lat": float(ev.epicentre_lat), "epicenter_lon": float(ev.epicentre_lon),
            "epicenter_svg": [round(epi[0]), round(epi[1])],
            "context_paths": context_paths, "map_source": map_source,
            "map_viewbox": " ".join(str(v) for v in viewbox),
            "impact_utc": iso(impact), "window_start_utc": iso(impact),
            "window_end_utc": iso(impact + pd.Timedelta(hours=float(ev.window_hours))),
            "total_posts_ingested": int(len(p)), "total_relevant_posts": int(p.relevant.sum()),
            "total_need_units": len(nus), "total_silent_zones": len(flags), "unlocated_share": r2(unlocated),
            "data_source": "CrisisLens Evaluation Dataset v1.0 (synthetic, seed 2026)",
            "surge": r2(res.meta["surge"]), "theta": r2(res.meta["theta"], 0),
        },
        "units": units_json, "needUnits": nus, "expectedNeed": expected, "observedSignal": observed,
        "silentZones": flags, "screenedOut": screened, "timeline": timeline(win, impact),
        "perUnitTimeline": per_unit_tl, "finding": finding, "ablation": ablation, "nighttimeLights": lights,
        "criticalUnmetNeeds": critical, "reliabilityDiagram": bins,
        "evaluation": {"true_silent_zones": truth, **m_full},
        "unlocatedPostCount": int(win.unit_id.isna().sum()),
    }
    (DEST / f"{eid}.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(eid, "flags:", [f["admin_unit_name"] for f in flags], "| screened:", [s["admin_unit_name"] for s in screened],
          "| critical:", [c["admin_unit_name"] for c in critical], "| need units:", len(nus),
          "| ntl r:", round(corr, 2), "|", m_full)


for e in EVENT_IDS:
    export(e)


# ---------------------------------------------------------------- insights
def export_insights():
    """One small file for the interactive tabs: the lexicon (so the browser
    classifies exactly as Python does), the gazetteer, per-district decision
    inputs for the what-if simulator, and the cross-event evaluation."""
    from crisislens import classify
    from crisislens.geoparse import REGION_WORDS

    R = json.loads((HERE / "output" / "results.json").read_text())
    units, gaz = [], {}
    for e, eid in EVENT_IDS.items():
        u = run_cfg(e, FULL).join(GOLD[["true_comm_status"]])
        med = float(u.damage_ratio.median())
        raw = I.units[I.units.event_id == e]
        gaz[eid] = {"region_words": REGION_WORDS[e],
                    "units": [{"id": r.unit_id, "name": r.unit_name,
                               "places": [s.strip() for s in str(r.sub_localities).split("|")]}
                              for r in raw.itertuples()]}
        for uid, r in u.iterrows():
            units.append({
                "event_id": eid, "id": uid, "name": r.unit_name, "population": int(r.population),
                "damage_ratio": r2(r.damage_ratio, 3), "median_damage": r2(med, 3),
                "baseline": r2(r.baseline), "surge": r2(r.surge, 3), "theta": r2(r.theta, 0),
                "mu": r2(r.mu, 1), "observed": int(r.observed), "need_voices": int(r.need_voices),
                "voices_about": int(r.voices_about),
                "ntl_drop": r2(max(0.0, r.ntl_drop)) if not np.isnan(r.ntl_drop) else None,
                "cell_sites_down": r2(r.cell_sites_down), "evacuated_share": r2(r.evacuated_share_reported),
                "data_gap": bool(r.possible_collection_gap), "status": r.status, "flag": bool(r.flag),
                "truth_silent": bool(r.true_silent_zone == 1), "truth_reason": r.gt_reason,
            })
    lk = list(R["ladder"])
    C = R["classification"]
    out = {
        "thresholds": {"resid": P.RESID_T, "drop": P.DROP_T, "fusion": P.FUSION_T, "corr": P.CORR_T,
                       "min_mu_b": P.BASE_MIN, "min_mu_z": 3, "window_days": 3},
        "lexicon": {"needs": {n: classify.V2_LEXICON[n].pattern for n in classify.NEEDS},
                    "veto": classify.V2_VETO.pattern, "negation": classify.V2_NEGATION.pattern,
                    "urgent": classify.URGENT.pattern},
        "gazetteer": gaz, "units": units,
        "research": {
            "dataset": R["dataset"],
            "ladder": [{"step": k.split(" ", 1)[1], **R["ladder"][k]["pooled"]} for k in lk],
            "ranking": [{"name": k, "auc": v["auc_mean_over_events"]} for k, v in R["ranking_baselines"].items()],
            "ablation": [{"name": k, **{x: v[x] for x in ("precision", "recall", "f1", "tp", "fp")}}
                         for k, v in R["ablation"].items()],
            "loudness": [{"event": k, **v} for k, v in R["loudness_bias"].items()],
            "classifiers": [
                {"name": "Original keyword list", "relevance_f1": C["v1 lexicon (original TS)"]["relevance"]["f1"],
                 "need_f1": C["v1 lexicon (original TS)"]["need_micro_f1"], "note": "Written before this dataset: a clean estimate"},
                {"name": "Trained model, unseen event", "relevance_f1": C["TF-IDF + logistic regression (leave-one-event-out)"]["relevance_f1_mean"],
                 "need_f1": C["TF-IDF + logistic regression (leave-one-event-out)"]["need_micro_f1_mean"], "note": "Train on two disasters, test on the third"},
                {"name": "Revised keyword list", "relevance_f1": C["v2 lexicon (revised)"]["relevance"]["f1"],
                 "need_f1": C["v2 lexicon (revised)"]["need_micro_f1"], "note": "Revised on this dataset: optimistic"},
            ],
            "geolocation": R["geolocation"], "dedupe": R["dedupe"], "network": R["network"],
            "sensitivity": R["sensitivity"], "echo": R["echo_signal"],
            "cooccurrence": [{"pair": k, **v} for k, v in list(R["cooccurrence"].items())[:6]],
        },
    }
    (DEST / "insights.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print("insights.json:", len(units), "units")


export_insights()
