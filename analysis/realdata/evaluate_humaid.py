"""Separate evaluation runner; imports frozen classifiers but never modifies them."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_fscore_support
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parent
ANALYSIS = ROOT.parent
OUT = ANALYSIS / "output" / "realdata"
sys.path.insert(0, str(ANALYSIS))
from crisislens.classify import classify_v1, classify_v2

SEED = 20261013
NEGATIVE = {"not_humanitarian", "sympathy_and_support"}
POSITIVE = {"requests_or_urgent_needs", "displaced_people_and_evacuations"}
AMBIGUOUS = {"caution_and_advice", "infrastructure_and_utility_damage",
             "injured_or_dead_people", "missing_or_found_people",
             "other_relevant_information", "rescue_volunteering_or_donation_effort"}
PROXIES = {"displaced_people_and_evacuations": "shelter",
           "injured_or_dead_people": "medical", "missing_or_found_people": "missing"}


def normalize(text):
    text = re.sub(r"https?://\S+", " URL ", text.lower())
    text = re.sub(r"@\w+", " USER ", text)
    return " ".join(text.split())


def metrics(y, pred):
    y, pred = np.asarray(y, dtype=int), np.asarray(pred, dtype=int)
    p, r, f, _ = precision_recall_fscore_support(y, pred, average="binary", zero_division=0)
    return {"precision": float(p), "recall": float(r), "f1": float(f), "n": len(y),
            "positives": int(y.sum()), "tp": int(((y == 1) & (pred == 1)).sum()),
            "fp": int(((y == 0) & (pred == 1)).sum()), "fn": int(((y == 1) & (pred == 0)).sum())}


def load_real():
    frames = []
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    for entry in manifest["files"]:
        path = ROOT / "private" / "humaid" / entry["path"]
        content = path.read_bytes()
        assert hashlib.sha256(content).hexdigest() == entry["sha256"], path
        frame = pd.DataFrame(json.loads(content))
        frame["event"] = entry["path"].split("/")[0]
        frame["split"] = path.stem
        frames.append(frame)
    raw = pd.concat(frames, ignore_index=True).rename(columns={"tweet_text": "text"})
    assert raw.text.map(lambda x: isinstance(x, str)).all()
    unexpected = set(raw.class_label) - NEGATIVE - POSITIVE - AMBIGUOUS - {"dont_know_cant_judge"}
    assert not unexpected, unexpected
    raw["normalized"] = raw.text.map(normalize)
    conflicts = raw.groupby(["event", "normalized"]).class_label.transform("nunique") > 1
    clean = raw[~conflicts].drop_duplicates(["event", "normalized"]).copy()
    clean["restricted"] = clean.class_label.map(lambda x: 1 if x in POSITIVE else 0 if x in NEGATIVE else np.nan)
    clean["broad"] = clean.class_label.map(lambda x: 0 if x in NEGATIVE else 1 if x in POSITIVE | AMBIGUOUS else np.nan)
    audit = {"raw_rows": len(raw), "retained_rows": len(clean), "conflicting_rows_removed": int(conflicts.sum()),
             "duplicates_removed": int((~conflicts).sum() - len(clean)),
             "class_counts": raw.class_label.value_counts().to_dict(),
             "per_event_raw": raw.event.value_counts().to_dict(), "revision": manifest["revision"]}
    return clean.reset_index(drop=True), audit


def evaluate(frame, targets, domain):
    frame = frame.copy()
    for name, fn in (("v1", classify_v1), ("v2", classify_v2)):
        parsed = frame.text.map(fn)
        frame[name] = parsed.map(lambda x: int(x[0]))
        frame[name + "_needs"] = parsed.map(lambda x: x[1])
    rows, examples, proxies = [], [], []
    for event in sorted(frame.event.unique()):
        held = frame[frame.event == event]
        # Exclude overlaps against ALL held-out texts, including unmapped rows.
        candidates = frame[frame.event != event]
        overlap = candidates.normalized.isin(set(held.normalized))
        training = candidates[~overlap]
        for target in targets:
            tr, te = training.dropna(subset=[target]), held.dropna(subset=[target])
            assert len(te) and tr[target].nunique() == 2
            vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2,
                                  sublinear_tf=True, max_features=60000)
            xtr = vec.fit_transform(tr.text)
            model = LogisticRegression(C=4, solver="liblinear", max_iter=2000, random_state=SEED)
            model.fit(xtr, tr[target].astype(int))
            assert model.n_iter_.max() < model.max_iter, "Model failed to converge"
            predictions = {"v1": te.v1.to_numpy(), "v2": te.v2.to_numpy(),
                           "tfidf_lr": model.predict(vec.transform(te.text))}
            for name, pred in predictions.items():
                row = {"domain": domain, "event": event, "target": target, "model": name,
                       "event_rows": len(held), "coverage": len(te) / len(held),
                       "training_rows": len(tr) if name == "tfidf_lr" else 0,
                       "training_overlap_rows_removed": int(overlap.sum()), **metrics(te[target], pred)}
                rows.append(row)
                for kind, mask in (("false_positive", (te[target].to_numpy() == 0) & (pred == 1)),
                                   ("false_negative", (te[target].to_numpy() == 1) & (pred == 0))):
                    for _, example in te.loc[mask].head(3).iterrows():
                        examples.append({"domain": domain, "event": event, "target": target, "model": name,
                                         "error": kind, "text": normalize(example.text),
                                         "source_label": str(example.get("class_label", example[target]))})
        if domain == "real":
            for label, need in PROXIES.items():
                subset = held[held.class_label == label]
                for name in ("v1", "v2"):
                    hits = int(subset[name + "_needs"].map(lambda x: need in x).sum())
                    proxies.append({"event": event, "model": name, "source_class": label, "need_proxy": need,
                                    "n": len(subset), "hits": hits,
                                    "positive_class_hit_rate": hits / len(subset) if len(subset) else None})
        print(f"Completed {domain}: {event}", flush=True)
    return rows, examples, proxies


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    private = OUT / "private"
    private.mkdir(exist_ok=True)
    real, audit = load_real()
    with threadpool_limits(limits=2):
        rows, examples, proxies = evaluate(real, ["restricted", "broad"], "real")
        # Gold labels are read only by this evaluation module, never by pipeline code.
        workbook = ANALYSIS.parent / "CrisisLens_dataset_v1.xlsx"
        sheets = pd.read_excel(workbook, sheet_name=["posts", "post_labels_gold"])
        sim = sheets["posts"].merge(sheets["post_labels_gold"], on=["post_id", "event_id"], validate="one_to_one")
        sim = sim.rename(columns={"event_id": "event", "gold_relevant": "gold_relevance"})
        sim["normalized"] = sim.text.map(normalize)
        sim_rows, sim_examples, _ = evaluate(sim, ["gold_relevance"], "simulated")
    results = {"phase": 1, "seed": SEED, "audit": audit, "metrics": rows + sim_rows,
               "need_proxy_hits": proxies, "historical_simulated_classification": json.loads(
                   (ANALYSIS / "output/results_baseline.json").read_text(encoding="utf-8"))["classification"],
               "transformer": {"status": "not_run", "reason": "No suitable cached multilingual encoder; no CUDA; model download needs approval."},
               "limitations": ["Restricted relevance is a partial class-derived proxy, not an unmet-need gold label.",
                               "Broad humanitarian relevance differs from CrisisLens need relevance.",
                               "No exhaustive ten-need or urgency gold; only three positive topic-proxy hit rates.",
                               "HumAID contains English posts only and is not a representative municipal stream.",
                               "Simulation v2 was tuned on the simulation being scored.",
                               "Training excludes normalized exact held-out overlaps, not every near-duplicate."]}
    (OUT / "phase1_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    pd.DataFrame(rows + sim_rows).to_csv(OUT / "phase1_metrics.csv", index=False)
    (private / "phase1_error_examples.json").write_text(json.dumps(examples + sim_examples, indent=2), encoding="utf-8")
    print("Saved aggregate metrics and private error examples", flush=True)


if __name__ == "__main__":
    main()
