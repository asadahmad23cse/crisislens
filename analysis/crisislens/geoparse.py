"""Stage 3: resolve the place of the incident, not the place of the author.

"Need help in Gorkha" posted from London belongs to Gorkha.
"Evacuated from Kuttanad. Now at the relief camp in Kollam" belongs to Kollam,
because that is where the people and the need currently are.
"""
from __future__ import annotations

import math
import re

import pandas as pd

# Declared locations that name the region, not a specific district.
REGION_WORDS = {
    "nepal_eq_2015": ["nepal"],
    "maria_2017": ["puerto rico", "pr", "boricua"],
    "kerala_flood_2018": ["kerala", "india"],
}
UNKNOWN_WORDS = {"earth", "world", "somewhere", "home"}


class Gazetteer:
    def __init__(self, units: pd.DataFrame, event_id: str):
        u = units[units.event_id == event_id]
        self.event_id = event_id
        self.centroids = {r.unit_id: (r.centroid_lat, r.centroid_lon) for r in u.itertuples()}
        self.name_of = dict(zip(u.unit_id, u.unit_name))
        lookup: dict[str, str] = {}
        for r in u.itertuples():
            lookup[r.unit_name.lower()] = r.unit_id
            for s in str(r.sub_localities).split("|"):
                lookup.setdefault(s.strip().lower(), r.unit_id)
        self.lookup = lookup
        names = sorted(lookup, key=len, reverse=True)  # longest match first
        self.rx = re.compile(r"(?<![\w])(" + "|".join(re.escape(n) for n in names) + r")(?![\w])",
                             re.IGNORECASE)
        self.now_at = re.compile(r"now at|camp (in|at)", re.IGNORECASE)

    def mentions(self, text: str) -> list[tuple[int, str]]:
        return [(m.start(), self.lookup[m.group(1).lower()]) for m in self.rx.finditer(text)]

    def incident_unit(self, text: str, lat=None, lon=None) -> tuple[str | None, str]:
        """Return (unit_id, method). method in {text, text_now_at, coords, none}."""
        body = re.sub(r"^RT @\w+:\s*", "", text)
        ms = self.mentions(body)
        if ms:
            m = self.now_at.search(body)
            if m and "evacuated from" in body.lower():
                after = [u for pos, u in ms if pos > m.start()]
                if after:
                    return after[0], "text_now_at"
            return ms[0][1], "text"
        if lat is not None and not (isinstance(lat, float) and math.isnan(lat)):
            best = min(self.centroids, key=lambda k: (self.centroids[k][0] - lat) ** 2
                       + (self.centroids[k][1] - lon) ** 2)
            return best, "coords"
        return None, "none"

    def author_place(self, declared) -> tuple[str, str | None]:
        """Classify a self-declared author location.

        Returns (kind, unit_id) with kind in {unit, region, outside, unknown}.
        """
        if declared is None or (isinstance(declared, float) and math.isnan(declared)):
            return "unknown", None
        d = str(declared).strip().lower()
        ms = self.mentions(d)
        if ms:
            return "unit", ms[-1][1]  # "Thamel, Kathmandu" -> Kathmandu
        tokens = re.split(r"[,\s]+", d)
        if any(w in d for w in REGION_WORDS[self.event_id] if len(w) > 2) or \
                any(t in REGION_WORDS[self.event_id] for t in tokens):
            return "region", None
        if d in UNKNOWN_WORDS:
            return "unknown", None
        return "outside", None
