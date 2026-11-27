"""Data loading for the CrisisLens evaluation dataset.

The workbook has two kinds of sheets:
  * pipeline inputs  -> posts, admin_units, events, unit_daily_evidence
  * evaluation only  -> post_labels_gold, unit_ground_truth

The pipeline may only call `load_inputs`. The gold sheets are loaded by the
evaluation code through `load_gold`, so the detector can never see the answer.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATASET = ROOT / "CrisisLens_dataset_v1.xlsx"

INPUT_SHEETS = ("posts", "admin_units", "events", "unit_daily_evidence")
GOLD_SHEETS = ("post_labels_gold", "unit_ground_truth")


@dataclass
class Inputs:
    posts: pd.DataFrame
    units: pd.DataFrame
    events: pd.DataFrame
    evidence: pd.DataFrame


def load_inputs(path: Path = DATASET) -> Inputs:
    x = pd.read_excel(path, sheet_name=list(INPUT_SHEETS))
    posts = x["posts"].copy()
    posts["created_at_utc"] = pd.to_datetime(posts["created_at_utc"], utc=True)
    posts["text"] = posts["text"].astype(str)
    events = x["events"].copy()
    for c in ("impact_utc", "observation_start_utc", "observation_end_utc"):
        events[c] = pd.to_datetime(events[c], utc=True)
    return Inputs(posts, x["admin_units"].copy(), events, x["unit_daily_evidence"].copy())


def load_gold(path: Path = DATASET) -> dict[str, pd.DataFrame]:
    """EVALUATION ONLY. Never call this from the pipeline package."""
    return pd.read_excel(path, sheet_name=list(GOLD_SHEETS))
