"""Network analysis of who amplifies whom, and of coordinated spam.

1. Amplification network: directed edge reposter -> original author for every
   native repost. Shows where attention concentrates (loudness bias at the
   level of the social graph, not just post counts).
2. Coordination network: authors are linked when they post the same text
   template (place names, numbers and links removed) within 60 minutes.
   Dense clusters of new, low-follower accounts are coordinated spam.
"""
from __future__ import annotations

import re

import networkx as nx
import numpy as np
import pandas as pd

from .dedupe import core_text


def gini(x) -> float:
    x = np.sort(np.asarray(x, dtype=float))
    if x.sum() == 0:
        return 0.0
    n = len(x)
    return float((2 * np.arange(1, n + 1) - n - 1).dot(x) / (n * x.sum()))


def amplification_network(p: pd.DataFrame) -> tuple[nx.DiGraph, pd.DataFrame]:
    by_id = p.set_index("post_id")
    r = p[p.repost_of_post_id.notna() & p.repost_of_post_id.isin(by_id.index)]
    G = nx.DiGraph()
    for row in r.itertuples():
        src = by_id.loc[row.repost_of_post_id]
        a, b = row.author_hash, src.author_hash
        if G.has_edge(a, b):
            G[a][b]["weight"] += 1
        else:
            G.add_edge(a, b, weight=1)
    # amplification received per incident unit of the ORIGINAL post
    rr = r.assign(orig_unit=r.repost_of_post_id.map(by_id.unit_id))
    per_unit = rr.groupby("orig_unit").size().rename("reposts_received")
    return G, per_unit


def template(text: str, place_rx: re.Pattern) -> str:
    t = core_text(text)
    t = re.sub(r"https?://\S+|bit\.ly/\S+", "<url>", t)
    t = place_rx.sub("<place>", t)
    t = re.sub(r"\d+", "<n>", t)
    t = re.sub(r"#\w+", "", t)
    return re.sub(r"\s+", " ", t).strip().lower()


def coordination_network(p: pd.DataFrame, place_rx: re.Pattern, window_min: int = 60) -> nx.Graph:
    q = p[~p.amplification].assign(tpl=lambda d: d.text.map(lambda t: template(t, place_rx)))
    q = q.sort_values("created_at_utc")
    G = nx.Graph()
    win = pd.Timedelta(minutes=window_min)
    for _, grp in q.groupby("tpl"):
        if grp.author_hash.nunique() < 2 or not grp.text.str.contains(r"bit\.ly|<url>|wallet|usdt|btc", case=False).any():
            continue
        ts = grp.created_at_utc.to_numpy()
        au = grp.author_hash.to_numpy()
        j = 0
        for i in range(len(grp)):
            while ts[i] - ts[j] > win:
                j += 1
            for k in range(j, i):
                if au[k] != au[i]:
                    if G.has_edge(au[k], au[i]):
                        G[au[k]][au[i]]["weight"] += 1
                    else:
                        G.add_edge(au[k], au[i], weight=1)
    return G
