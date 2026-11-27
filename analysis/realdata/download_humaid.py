"""Download the authorized HumAID mirror; never hydrate tweets or fetch authors."""
import hashlib
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests

ROOT = Path(__file__).resolve().parent
REVISION = "2e7ea23332006f075068b90d401b178d847b447a"
BASE = f"https://huggingface.co/datasets/QCRI/HumAID-events/resolve/{REVISION}"


def main():
    response = requests.get(f"https://huggingface.co/api/datasets/QCRI/HumAID-events/revision/{REVISION}", timeout=60)
    response.raise_for_status()
    names = sorted(x["rfilename"] for x in response.json()["siblings"] if x["rfilename"].endswith(".json"))

    def fetch(name):
        path = ROOT / "private" / "humaid" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            r = requests.get(f"{BASE}/{name}", timeout=120)
            r.raise_for_status()
            path.write_bytes(r.content)
        content = path.read_bytes()
        # The pinned mirror stores a JSON array in each split.
        rows = json.loads(content)
        assert isinstance(rows, list) and rows
        assert all("tweet_text" in row and "class_label" in row for row in rows)
        return {"path": name, "url": f"{BASE}/{name}", "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}

    with ThreadPoolExecutor(max_workers=4) as pool:
        files = list(pool.map(fetch, names))
    manifest = {"dataset": "QCRI/HumAID-events", "revision": REVISION, "files": files,
                "terms": "https://crisisnlp.qcri.org/terms-of-use.html",
                "paper": "https://doi.org/10.1609/icwsm.v15i1.18116"}
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Verified {len(files)} files; {sum(x['bytes'] for x in files):,} bytes", flush=True)


if __name__ == "__main__":
    main()
