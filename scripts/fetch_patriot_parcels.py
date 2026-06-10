#!/usr/bin/env python3
"""Stage 1: fetch every Marblehead parcel's raw detail HTML from Patriot
Properties WebPro and cache it under data/patriot_raw/ (gitignored).

The app stores the "current parcel" in server-side session, not the URL, so we
reuse one curl cookie jar sequentially: POST SearchResults.asp to prime the
session, GET Summary.asp?AccountNumber=N to select the parcel, then GET
summary-bottom.asp (no params) to read it.

Usage:
  python3 scripts/fetch_patriot_parcels.py            # full sweep, resumable
  python3 scripts/fetch_patriot_parcels.py --max 25   # dry run over 1..25
Outputs:
  data/patriot_raw/<N>.html        raw summary-bottom.asp per real parcel
  data/patriot_raw/_manifest.json  {account: "ok"|"gap"|"error"}
Source: https://marblehead.patriotproperties.com  (WebPro 4.4)
"""
import argparse
import json
import os
import pathlib
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from patriot_parse import parse_summary  # noqa: E402

BASE = "https://marblehead.patriotproperties.com"
RAW_DIR = "data/patriot_raw"
MANIFEST = os.path.join(RAW_DIR, "_manifest.json")
JAR = "/tmp/patriot_jar.txt"
UA = "marbleheaddata.org civic-data parcel ingest (contact agbaber@gmail.com)"
DELAY = 0.4          # seconds between parcels; be polite to the town's server
GAP_STOP = 60        # consecutive non-parcels past the real max -> stop probing
PRIME_BODY = "SearchSubmitted=yes&SearchTotalValue=2000000&SearchTotalValueThru=2010000"


def curl(args, data=None):
    cmd = ["curl", "-s", "-A", UA, "-c", JAR, "-b", JAR]
    if data is not None:
        cmd += ["-X", "POST", "--data", data]
    cmd += args
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def prime():
    curl([f"{BASE}/SearchResults.asp"], data=PRIME_BODY)


def fetch_one(n):
    curl(["-e", f"{BASE}/SearchResults.asp", f"{BASE}/Summary.asp?AccountNumber={n}"])
    html = curl(["-e", f"{BASE}/Summary.asp?AccountNumber={n}", f"{BASE}/summary-bottom.asp"])
    if "Either no search has been executed" in html:
        prime()
        curl(["-e", f"{BASE}/SearchResults.asp", f"{BASE}/Summary.asp?AccountNumber={n}"])
        html = curl(["-e", f"{BASE}/Summary.asp?AccountNumber={n}", f"{BASE}/summary-bottom.asp"])
    return html


def classify(html):
    # The page always contains the literal label "Parcel ID"; a non-existent
    # account renders a BLANK template (empty parcel id). Treat a parcel as real
    # only when the parsed parcel_id is non-empty.
    if "Either no search has been executed" in html:
        return "error"   # session problem, not a clean gap
    try:
        rec = parse_summary(html)
    except Exception:  # noqa: BLE001
        return "error"
    if rec.get("parcel_id") and rec.get("parcel_id") != "Old Parcel ID":
        return "ok"
    return "gap"


def load_manifest():
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as fh:
            return json.load(fh)
    return {}


def save_manifest(m):
    with open(MANIFEST, "w") as fh:
        json.dump(m, fh, indent=0, sort_keys=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=0, help="upper account bound (0 = auto)")
    ap.add_argument("--start", type=int, default=1)
    args = ap.parse_args()

    os.makedirs(RAW_DIR, exist_ok=True)
    manifest = load_manifest()
    prime()

    n = args.start
    ceiling = args.max
    consecutive_gaps = 0
    while True:
        if ceiling and n > ceiling:
            break
        path = os.path.join(RAW_DIR, f"{n}.html")

        # Resume: skip already-processed accounts.
        if str(n) in manifest and (manifest[str(n)] == "ok" and os.path.exists(path)):
            consecutive_gaps = 0
            n += 1
            continue
        if str(n) in manifest and manifest[str(n)] == "gap":
            consecutive_gaps += 1
            if not ceiling and consecutive_gaps >= GAP_STOP:
                break
            n += 1
            continue

        html = fetch_one(n)
        status = classify(html)
        if status == "ok":
            with open(path, "w", encoding="latin-1", errors="replace") as fh:
                fh.write(html)
            consecutive_gaps = 0
        else:
            consecutive_gaps += 1
        manifest[str(n)] = status

        if n % 50 == 0:
            save_manifest(manifest)
            print(f"... account {n}: {status} (gap run {consecutive_gaps})", file=sys.stderr)

        if not ceiling and consecutive_gaps >= GAP_STOP:
            print(f"Stopping: {GAP_STOP} consecutive non-parcels after {n}", file=sys.stderr)
            break
        n += 1
        time.sleep(DELAY)

    save_manifest(manifest)
    ok = sum(1 for v in manifest.values() if v == "ok")
    print(f"Done. {ok} parcels cached; manifest has {len(manifest)} accounts.", file=sys.stderr)


if __name__ == "__main__":
    main()
