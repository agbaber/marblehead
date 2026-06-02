#!/usr/bin/env python3
"""Add `obase` (compounded operating-override base, $) to charts/town_explorer.html.

For each town, sums the current-day dollar value of every winning operating
override (and subtracts winning underrides) since 1980. Each override's
contribution compounds at 2.5%/yr from its fiscal year because Prop 2.5
permanently raises the levy ceiling and the limit grows 2.5%/yr.

Formula: obase = sum(sign * amount * 1.025^(2026 - fiscal_year)) over
rows where win_loss == "WIN" and vote_type in ("Override", "Underride").
sign = +1 for Override, -1 for Underride. Debt exclusions are excluded
because they don't permanently raise the levy limit.

Source: data/dor_override_history_all.csv (MA DOR Prop 2.5 Override and
Underride Votes database, all wins and losses 1980-present).

Usage: python3 scripts/add_override_base_to_explorer.py
"""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = REPO_ROOT / "data" / "dor_override_history_all.csv"
HTML_PATH = REPO_ROOT / "charts" / "town_explorer.html"

TARGET_FY = 2026
RATE = 1.025


def parse_amount(raw: str) -> float:
    s = (raw or "").replace(",", "").replace('"', "").strip()
    if not s or s == "-":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def load_override_base() -> dict[str, int]:
    """Return {municipality: compounded operating-override base, rounded $}."""
    base: dict[str, float] = defaultdict(float)
    with CSV_PATH.open() as f:
        for row in csv.DictReader(f):
            if row["win_loss"] != "WIN":
                continue
            vt = row["vote_type"]
            if vt not in ("Override", "Underride"):
                continue
            try:
                fy = int(row["fiscal_year"])
            except (ValueError, KeyError):
                continue
            amt = parse_amount(row["amount"])
            sign = 1 if vt == "Override" else -1
            years = max(0, TARGET_FY - fy)
            base[row["municipality"]] += sign * amt * (RATE ** years)
    return {muni: round(v) for muni, v in base.items()}


def main() -> int:
    base = load_override_base()
    html = HTML_PATH.read_text()

    match = re.search(r"(  var DATA = )(\[.*?\])(;)", html)
    if not match:
        print("ERROR: could not locate `var DATA = [...]` in HTML", file=sys.stderr)
        return 1

    data = json.loads(match.group(2))

    for row in data:
        name = row["n"]
        if "obase" in row:
            print(f"WARN: {name} already has obase={row['obase']}, overwriting")
        row["obase"] = base.get(name, 0)

    new_literal = json.dumps(data, separators=(",", ":"))
    new_html = html[: match.start(2)] + new_literal + html[match.end(2) :]

    HTML_PATH.write_text(new_html)
    print(f"OK: augmented {len(data)} towns with obase field")
    mh = next(r for r in data if r["n"] == "Marblehead")
    print(f"    Marblehead obase = ${mh['obase']:,}")
    top = sorted(data, key=lambda r: -r["obase"])[:5]
    print(f"    Top 5: " + ", ".join(f"{r['n']} ${r['obase']/1e6:.1f}M" for r in top))
    return 0


if __name__ == "__main__":
    sys.exit(main())
