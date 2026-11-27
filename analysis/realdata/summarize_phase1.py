"""Render readable aggregate tables from the saved results, without tweet text."""
import json
from pathlib import Path
import pandas as pd

OUT = Path(__file__).resolve().parents[1] / "output" / "realdata"


def table(rows):
    lines = ["| Data | Event | Target | Classifier | N | Coverage | Precision | Recall | F1 |",
             "|---|---|---|---|---:|---:|---:|---:|---:|"]
    for r in rows:
        lines.append(f"| {r['domain']} | {r['event']} | {r['target']} | {r['model']} | {r['n']} | "
                     f"{r['coverage']:.1%} | {r['precision']:.3f} | {r['recall']:.3f} | {r['f1']:.3f} |")
    return "\n".join(lines)


def main():
    results = json.loads((OUT / "phase1_results.json").read_text(encoding="utf-8"))
    rows = results["metrics"]
    selected = [r for r in rows if r["domain"] == "simulated" or r["event"] in
                ("hurricane_maria_2017", "kerala_floods_2018")]
    text = "# Phase 1: real-post classifier evaluation\n\n"
    text += ("Restricted relevance is a partial class-derived proxy; broad relevance is a different "
             "humanitarian topic target. Neither supplies complete ten-need gold labels. "
             "Simulation v2 was tuned on the simulation being scored.\n\n")
    text += f"Source audit: {results['audit']['raw_rows']:,} public-dataset tweets in 19 events.\n\n"
    text += table(selected)
    text += "\n\nTF-IDF LR uses the capped, frozen configuration documented in MAPPING.md. "
    text += "Real models train on other HumAID events; simulated models train on other simulated events. "
    text += "These are different training domains and label definitions, not a direct transfer benchmark.\n\n"
    text += "## All event results\n\n" + table([r for r in rows if r["domain"] == "real"])
    text += "\n\n## Limitations\n\n" + "\n".join("- " + x for x in results["limitations"])
    text += "\n- Transformer: " + results["transformer"]["reason"]
    text += ("\n- Error examples are in the ignored private JSON, with handles and URLs masked; "
             "do not redistribute its contents.\n")
    (OUT / "PHASE1_SUMMARY.md").write_text(text, encoding="utf-8")
    frame = pd.DataFrame(selected)
    print(frame[["domain", "event", "target", "model", "precision", "recall", "f1"]].to_string(index=False))


if __name__ == "__main__":
    main()
