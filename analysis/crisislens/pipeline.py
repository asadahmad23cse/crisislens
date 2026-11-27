"""CrisisLens pipeline over the v1 evaluation dataset.

Reads ONLY the pipeline-input sheets (posts, admin_units, events,
unit_daily_evidence). Two detector calibrations are available:

* ``calibration="v1"`` - the constants of the TypeScript prototype
  (src/lib/crisislens/pipeline/silentZone.ts): theta = 10, a fixed exposure
  elasticity, Detector B gate "baseline >= 5 authors/day", and an exposure
  gate on total expected need. This is the pre-specified design.
* ``calibration="v2"`` - the same detectors, with the constants replaced by
  quantities estimated from each event's own UNLABELLED data:
    - theta fitted from the 7 pre-event days (method of moments),
    - a regional "crisis surge" factor = median observed/baseline ratio
      across the event's districts (peers), replacing the fixed elasticity,
    - a severity gate (damage ratio >= regional median) replacing the
      population-weighted exposure gate,
    - Detector B gate on expected voices in the window (>= 5).
  v2 was designed after v1 was seen to fail on this dataset; see report.

After detection, two screens use the independent-evidence sheet:
an evacuation / data-gap confounder screen and a night-light / cell-site
corroboration check.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace

import numpy as np
import pandas as pd

from . import classify, dedupe
from .geoparse import Gazetteer

THETA_V1 = 10         # NegBin over-dispersion of the TS prototype
RESID_T = 2.0         # Detector A threshold
DROP_T = 0.5          # Detector B drop threshold
BASE_MIN = 5.0        # Detector B gate (v1: authors/day, v2: expected voices in window)
EXPO_PCT_T = 0.5      # Detector B exposure percentile gate (v1)
SPAM_T = 0.6          # spam account score threshold
GAP_MIN_H = 8         # minimum zero-run that may be a collection gap
CORR_T = 0.5          # night-light drop or cell-sites-down share counted as corroboration
FUSION_T = 1.0        # Detector F: weaker social shortfall accepted when evidence shows an outage


# ------------------------------------------------------------- damage curves
def mmi_to_damage(m):
    for lim, r in ((4, .001), (5, .005), (6, .02), (7, .08), (8, .20), (9, .45), (10, .75)):
        if m < lim:
            return r
    return .95


def wind_to_damage(v):
    return min(0.9, (max(0.0, v) / 50) ** 3)


def depth_to_damage(d):
    return min(0.8, d / (d + 1.5))


DAMAGE = {"earthquake": mmi_to_damage, "cyclone": wind_to_damage, "flood": depth_to_damage}


@dataclass
class Config:
    """Switches used by the ablation study. Defaults = full v2 method."""
    label: str = "full"
    calibration: str = "v2"          # v1 | v2
    count: str = "authors"           # authors | posts
    voices: str = "from"             # from (in-unit or unspecified authors) | about (anyone)
    observed_scope: str = "all"      # all posts | need (relevant posts only, as in the TS prototype)
    drop_amplification: bool = True
    drop_spam: bool = True
    baseline: str = "empirical"      # empirical | supplied | none
    surge: bool = True               # v2: peer surge factor
    fit_theta: bool = True           # v2: theta from pre-event data
    gate: str = "severity"           # severity | size
    detectors: str = "ABZF"          # any combination of A, B, Z, F
    confounder_screen: bool = True
    corroboration: bool = True

    def but(self, **kw) -> "Config":
        return replace(self, **kw)


PROTOTYPE_V1 = Config(label="prototype_v1", calibration="v1", voices="about", observed_scope="need",
                      baseline="supplied", surge=False, fit_theta=False, gate="size",
                      detectors="AB", confounder_screen=False, corroboration=False)


@dataclass
class EventResult:
    event_id: str
    posts: pd.DataFrame
    units: pd.DataFrame
    need_units: pd.DataFrame
    hourly: pd.DataFrame
    meta: dict = field(default_factory=dict)


# ------------------------------------------------------------ post stage
def process_posts(posts: pd.DataFrame, units: pd.DataFrame, event: pd.Series) -> pd.DataFrame:
    gz = Gazetteer(units, event.name)
    p = posts[posts.event_id == event.name].copy()
    p["hours"] = (p.created_at_utc - event.impact_utc).dt.total_seconds() / 3600
    p["phase"] = np.where(p.hours < 0, "pre", "post")

    cls = p.text.map(classify.classify_v2)
    p["relevant"], p["needs"], p["urgency"], p["negated"] = cls.str[0], cls.str[1], cls.str[2], cls.str[3]
    v1 = p.text.map(classify.classify_v1)
    p["relevant_v1"], p["needs_v1"], p["urgency_v1"] = v1.str[0], v1.str[1], v1.str[2]

    loc = [gz.incident_unit(t, la, lo) for t, la, lo in zip(p.text, p.latitude, p.longitude)]
    p["unit_id"] = [x[0] for x in loc]
    p["loc_method"] = [x[1] for x in loc]
    ap = p.author_declared_location.map(gz.author_place)
    p["author_kind"], p["author_unit"] = ap.str[0], ap.str[1]

    p["amplification"] = [dedupe.is_amplification(t, r) for t, r in zip(p.text, p.is_repost)]
    p["copy"] = p.text.map(dedupe.is_copy)
    p["spam_score"] = p.author_hash.map(dedupe.spam_account_scores(p))
    p["spam"] = p.spam_score >= SPAM_T
    p["independent"] = p.relevant & ~p.amplification & ~p["copy"] & ~p.spam
    return p


def voice_mask(p: pd.DataFrame, cfg: Config) -> pd.Series:
    m = p.unit_id.notna()
    if cfg.drop_amplification:
        m &= ~p.amplification & ~p["copy"]
    if cfg.drop_spam:
        m &= ~p.spam
    if cfg.voices == "from":
        # A voice FROM the unit: the author declares this unit, or only the region,
        # or nothing. Authors declaring another district or another country are
        # talking ABOUT the unit, not from it.
        m &= (p.author_kind.isin(["region", "unknown"])
              | ((p.author_kind == "unit") & (p.author_unit == p.unit_id)))
    return m


def build_need_units(p: pd.DataFrame) -> pd.DataFrame:
    r = p[p.relevant & ~p.amplification & ~p.spam & p.unit_id.notna() & (p.phase == "post")].copy()
    r = r.explode("needs")
    r["core"] = r.text.map(dedupe.core_text)
    r["sig"] = r.core.map(dedupe.minhash)
    r["block"] = list(zip(r.unit_id, r.needs, (r.hours // 6).astype(int)))
    r = r.reset_index(drop=True)
    r["cluster"] = dedupe.cluster_need_units(r)
    return r.groupby("cluster").agg(
        unit_id=("unit_id", "first"), need=("needs", "first"),
        bucket=("block", lambda s: s.iat[0][2]), n_posts=("post_id", "size"),
        n_authors=("author_hash", "nunique"), urgency=("urgency", "max"),
        example=("core", "first")).reset_index()


def fit_theta(daily: pd.DataFrame) -> float:
    """Method-of-moments NegBin dispersion from pre-event daily counts.
    var = m + m^2/theta  ->  1/theta = (var - m) / m^2, pooled by median."""
    m, v = daily.mean(axis=1), daily.var(axis=1)
    inv = ((v - m) / m.pow(2))[m >= 2].clip(lower=0)
    inv_med = float(inv.median()) if len(inv) else 0.0
    return float(np.clip(1 / inv_med if inv_med > 0 else 1000.0, 5, 1000))


# ------------------------------------------------------------ unit stage
def run_event(inputs, event_id: str, cfg: Config | None = None,
              processed: pd.DataFrame | None = None) -> EventResult:
    cfg = cfg or Config()
    ev = inputs.events.set_index("event_id").loc[event_id]
    units = inputs.units[inputs.units.event_id == event_id].copy().reset_index(drop=True)
    p = processed if processed is not None else process_posts(inputs.posts, inputs.units, ev)
    W, days = float(ev.window_hours), int(ev.baseline_days)
    win_days = W / 24

    # ---- Expected need surface (unchanged from the prototype)
    units["damage_ratio"] = units.hazard_intensity.map(DAMAGE[ev.hazard_type])
    units["pop_exposed"] = (units.population * units.damage_ratio).round()
    units["expected_need"] = (units.pop_exposed * units.vulnerability * units.infrastructure_factor).round()
    units["exposure_pct"] = units.expected_need.rank(method="first").sub(1) / (len(units) - 1)
    med_E = units.expected_need.median()
    if cfg.gate == "size":
        gate = units.expected_need > med_E
    else:
        gate = units.damage_ratio >= units.damage_ratio.median()
    units["gate"] = gate

    # ---- Observed + baseline surfaces (same counting rule on both sides)
    v = p[voice_mask(p, cfg)]
    key = "author_hash" if cfg.count == "authors" else "post_id"
    pre = v[(v.hours >= -24 * days) & (v.hours < 0)].assign(day=lambda d: np.floor(d.hours / 24).astype(int))
    post = v[(v.hours >= 0) & (v.hours < W)]
    if cfg.observed_scope == "need":
        post = post[post.relevant]
    daily = (pre.groupby(["unit_id", "day"])[key].nunique().unstack(fill_value=0)
             .reindex(index=units.unit_id, columns=range(-days, 0), fill_value=0))
    units["baseline_empirical"] = daily.mean(axis=1).values
    if cfg.baseline == "empirical":
        units["baseline"] = units.baseline_empirical
    elif cfg.baseline == "supplied":
        units["baseline"] = units.supplied_baseline_daily_authors
    else:  # one regional average for every unit: ignores local connectivity
        units["baseline"] = units.baseline_empirical.mean()
    units["observed"] = units.unit_id.map(post.groupby("unit_id")[key].nunique()).fillna(0)
    units["need_voices"] = units.unit_id.map(
        post[post.relevant].groupby("unit_id").author_hash.nunique()).fillna(0)
    units["need_posts_all"] = units.unit_id.map(
        p[(p.hours >= 0) & (p.hours < W) & p.relevant].groupby("unit_id").size()).fillna(0)
    about = p[(p.hours >= 0) & (p.hours < W) & p.relevant & ~p.spam & ~voice_mask(p, cfg.but(voices="from"))]
    units["voices_about"] = units.unit_id.map(about.groupby("unit_id").author_hash.nunique()).fillna(0)

    base_w = units.baseline * win_days
    units["ratio"] = units.observed / base_w.where(base_w > 0)

    _evidence(units, inputs.evidence[inputs.evidence.event_id == event_id])

    # ---- Detectors
    if cfg.calibration == "v1":
        theta = THETA_V1
        el = 1 + 0.5 * np.log2(np.maximum(1, units.expected_need) / max(1, med_E))
        units["surge"] = el.clip(0.5, 3.0)
        units["mu"] = base_w * units.surge
        units["dropoff"] = (1 - units.observed / base_w.where(base_w > 0)).clip(0, 1).fillna(0)
        b_gate = (units.baseline >= BASE_MIN) & (units.exposure_pct > EXPO_PCT_T)
    else:
        theta = fit_theta(daily) if cfg.fit_theta else THETA_V1
        s = float(units.loc[base_w >= 1, "ratio"].median()) if cfg.surge else 1.0
        units["surge"] = s
        units["mu"] = base_w * s
        units["dropoff"] = (1 - units.observed / units.mu.where(units.mu > 0)).clip(0, 1).fillna(0)
        b_gate = (units.mu >= BASE_MIN) & gate
    var = units.mu + units.mu ** 2 / theta
    units["residual"] = (units.mu - units.observed) / np.sqrt(np.maximum(0.5, var))
    units["det_A"] = ("A" in cfg.detectors) & (units.residual > RESID_T) & gate
    units["det_B"] = ("B" in cfg.detectors) & (units.dropoff > DROP_T) & b_gate
    units["det_Z"] = (("Z" in cfg.detectors) & (units.need_voices == 0) & gate
                      & (units.mu >= 3))
    # Fusion: independent evidence of an outage + a modest social shortfall
    units["det_F"] = (("F" in cfg.detectors) & gate & units.corroborated
                      & (units.residual > FUSION_T))

    sA = np.minimum(60, (units.residual - 2) * 15 + 30).clip(lower=0)
    sB = np.where(units.det_B, np.minimum(50, units.dropoff * units.exposure_pct * 60), 0)
    units["score"] = np.clip(sA + sB + np.where(units.det_A & units.det_B, 10, 0), 0, 100).round()
    # Continuous ranking score for AUC: one-sided residual, gated
    units["rank_score"] = units.residual.where(gate, units.residual - 10)
    # E (ablation only): independent evidence alone, no social signal at all
    units["det_E"] = ("E" in cfg.detectors) & gate & units.corroborated
    units["flag_social"] = units.det_A | units.det_B | units.det_Z | units.det_F | units.det_E

    units["theta"] = theta
    hourly = _hourly(v, units, days, W, key)
    # Posts ABOUT the unit by everyone else (other districts, abroad), used to
    # tell a crawler gap (everyone vanishes) from a local cut-off (only locals do)
    others = p[p.unit_id.notna() & ~p.spam & ~voice_mask(p, cfg.but(voices="from"))]
    hourly_about = _hourly(others, units, days, W, "post_id")
    _screens(units, hourly, hourly_about, inputs.evidence[inputs.evidence.event_id == event_id], W, cfg)

    return EventResult(event_id, p, units, pd.DataFrame(), hourly,
                       meta={"theta": theta, "surge": float(units.surge.median()),
                             "median_expected_need": med_E, "hazard": ev.hazard_type,
                             "event_name": ev.event_name, "impact_utc": str(ev.impact_utc)})


def _longest_zero_run(row: np.ndarray) -> tuple[int, int]:
    best, start, cur, cs = 0, -1, 0, 0
    for i, x in enumerate(row):
        if x == 0:
            cs = i if cur == 0 else cs
            cur += 1
            if cur > best:
                best, start = cur, cs
        else:
            cur = 0
    return best, start


def _hourly(df, units, days, W, key):
    return (df[(df.hours >= -24 * days) & (df.hours < W)]
            .assign(h=lambda d: np.floor(d.hours).astype(int))
            .groupby(["unit_id", "h"])[key].nunique().unstack(fill_value=0)
            .reindex(index=units.unit_id, columns=range(-24 * days, int(W)), fill_value=0))


def _still_silent(r, mu, cfg):
    """Re-apply the detectors that fired, with an adjusted expectation mu."""
    var = mu + mu ** 2 / r.theta
    resid = (mu - r.observed) / np.sqrt(np.maximum(0.5, var))
    drop = (1 - r.observed / mu) if mu > 0 else 0.0
    a = "A" in cfg.detectors and resid > RESID_T
    b = "B" in cfg.detectors and mu >= BASE_MIN and drop > DROP_T
    z = "Z" in cfg.detectors and r.det_Z and mu >= 3
    f = "F" in cfg.detectors and r.corroborated and resid > FUSION_T
    e = "E" in cfg.detectors and r.det_E     # evidence-only rule ignores the social count
    return bool(r.gate and (a or b or z or f or e))


def _evidence(units, ev_rows):
    """Independent evidence per unit: night-light drop and cell sites down."""
    ntl, cells = [], []
    for r in units.itertuples():
        e = ev_rows[ev_rows.unit_id == r.unit_id]
        clear = e[e.ntl_cloud_masked == 0]   # cloud-masked days are skipped
        pre = clear[clear.day_offset < 0].ntl_radiance_nw_cm2_sr.mean()
        pst = clear[clear.day_offset >= 0].ntl_radiance_nw_cm2_sr.mean()
        ntl.append(1 - pst / pre if pre > 0 and not np.isnan(pst) else np.nan)
        cells.append(e[e.day_offset >= 0].cell_sites_down_pct_reported.mean() / 100)
    units["ntl_drop"] = ntl
    units["cell_sites_down"] = cells
    units["corroborated"] = ((units.ntl_drop >= CORR_T) | (units.cell_sites_down >= CORR_T)).fillna(False)


def _screens(units, hourly, hourly_about, ev_rows, W, cfg):
    post_cols = [c for c in hourly.columns if 0 <= c < W]
    pre_cols = [c for c in hourly.columns if c < 0]
    out = {k: [] for k in ("evac", "run", "run_start", "about_in_run",
                           "about_exp_in_run", "gap", "evac_explains")}
    for r in units.itertuples():
        e = ev_rows[ev_rows.unit_id == r.unit_id]
        # Evacuation: if the reported evacuated share of the population is removed
        # from the expectation, is the unit still too quiet?
        evac = e.evacuees_reported.max() / r.population if len(e) else 0.0
        out["evac"].append(evac)
        out["evac_explains"].append(evac > 0.01 and not _still_silent(r, r.mu * (1 - evac), cfg))

        # Collection gap: the longest hour-run with zero local voices. If posts
        # ABOUT the unit from everyone else vanish in the same hours, the data
        # feed is missing; if outsiders keep posting, locals are really silent.
        row = hourly.loc[r.unit_id, post_cols].to_numpy()
        run, start = _longest_zero_run(row)
        arow = hourly_about.loc[r.unit_id, post_cols].to_numpy()
        a_in = arow[start:start + run].sum() if run else 0
        a_rate = (arow.sum() - a_in) / max(1, len(arow) - run)
        out["run"].append(run)
        out["run_start"].append(start)
        out["about_in_run"].append(int(a_in))
        out["about_exp_in_run"].append(a_rate * run)
        gap = bool(run >= GAP_MIN_H and a_in == 0 and a_rate * run >= 2)
        # ...and the gap must explain the shortfall: remove the gap hours from mu
        if gap:
            gap = not _still_silent(r, r.mu * (1 - run / W), cfg)
        out["gap"].append(gap)
    units["evacuated_share_reported"] = out["evac"]
    units["longest_zero_run_h"] = out["run"]
    units["zero_run_start_h"] = out["run_start"]
    units["about_posts_in_run"] = out["about_in_run"]
    units["about_posts_expected_in_run"] = out["about_exp_in_run"]
    units["possible_collection_gap"] = out["gap"]
    units["evacuation_explains"] = out["evac_explains"]

    flag = units.flag_social.copy()
    status = np.where(flag, "silent_zone", "not_flagged").astype(object)
    if cfg.confounder_screen:
        evac = flag & units.evacuation_explains
        gap = flag & ~evac & units.possible_collection_gap
        status = np.where(evac, "explained_evacuation", status)
        status = np.where(gap, "explained_data_gap", status)
        flag &= ~(evac | gap)
    if cfg.corroboration:
        status = np.where(flag & ~units.corroborated, "uncorroborated", status)
        flag &= units.corroborated
    units["status"] = status
    units["flag"] = flag
