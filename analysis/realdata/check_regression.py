"""Fail closed on ANY main-results change, not just rounded headline F1."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "output"


def differences(before, after, path=""):
    if isinstance(before, dict) and isinstance(after, dict):
        result = []
        for key in sorted(before.keys() | after.keys()):
            result.extend(differences(before.get(key), after.get(key), f"{path}.{key}".lstrip(".")))
        return result
    if before != after:
        return [{"path": path, "before": before, "after": after}]
    return []


if __name__ == "__main__":
    before = json.loads((OUT / "results_baseline.json").read_text(encoding="utf-8"))
    after = json.loads((OUT / "results.json").read_text(encoding="utf-8"))
    changes = differences(before, after)
    result = {"passed": not changes, "changes": changes,
              "headline": after["ladder"]["7 + fusion rule F = final method"]["pooled"]}
    print(json.dumps(result, indent=2))
    raise SystemExit(bool(changes))
