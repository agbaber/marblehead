#!/usr/bin/env python3
"""Add `esh` (education share of general fund) to charts/town_explorer.html.

Reads education_pct_of_gf from data/dor_all_351_FY26.csv and merges it as
a new `esh` field onto each town row in the inlined DATA JSON array in
charts/town_explorer.html.

Usage: python3 scripts/add_school_share_to_explorer.py
"""
import csv
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = REPO_ROOT / "data" / "dor_all_351_FY26.csv"
HTML_PATH = REPO_ROOT / "charts" / "town_explorer.html"


def load_school_share() -> dict[str, float]:
    """Return {municipality: education_pct_of_gf} as floats."""
    out = {}
    with CSV_PATH.open() as f:
        for row in csv.DictReader(f):
            out[row["municipality"]] = float(row["education_pct_of_gf"])
    return out


def main() -> int:
    shares = load_school_share()
    html = HTML_PATH.read_text()

    match = re.search(r"(  var DATA = )(\[.*?\])(;)", html)
    if not match:
        print("ERROR: could not locate `var DATA = [...]` in HTML", file=sys.stderr)
        return 1

    data = json.loads(match.group(2))

    missing = []
    for row in data:
        name = row["n"]
        if name not in shares:
            missing.append(name)
            continue
        if "esh" in row:
            print(f"WARN: {name} already has esh={row['esh']}, overwriting")
        row["esh"] = shares[name]

    if missing:
        print(f"ERROR: {len(missing)} towns in DATA not found in CSV: {missing[:5]}...", file=sys.stderr)
        return 1

    new_literal = json.dumps(data, separators=(",", ":"))
    new_html = html[: match.start(2)] + new_literal + html[match.end(2) :]

    HTML_PATH.write_text(new_html)
    print(f"OK: augmented {len(data)} towns with esh field")
    print(f"    Marblehead esh = {next(r['esh'] for r in data if r['n'] == 'Marblehead')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
