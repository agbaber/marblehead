#!/usr/bin/env python3
"""
Build data/monthly_burn_FY26.json — the JSON the /monthly-pacing/ page
reads to render the per-fund monthly cumulative-spend chart.

Aggregates the latest published checkbook CSV by Fund x month and
emits the top 6 funds by total. The page itself decides which to
display (e.g. drops GENERAL FUND - SCHOOL because the checkbook only
captures ~22% of actual school spend with payroll excluded).

Inputs:
  - data/checkbook_FY26_<as-of>.csv  (the freshly built checkbook)
  - data/checkbook_redaction_disclosure.json (for the as-of date)

Output:
  - data/monthly_burn_FY26.json

Usage:
  scripts/build_monthly_burn.py

Run after scripts/build_checkbook_csv.py / build_checkbook_view.py
in the same workflow.
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
DISCLOSURE = DATA_DIR / "checkbook_redaction_disclosure.json"
OUTPUT = DATA_DIR / "monthly_burn_FY26.json"

FY26_MONTHS = [
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
]
TOP_N = 6


def find_checkbook_csv(as_of: str) -> Path:
    direct = DATA_DIR / f"checkbook_FY26_{as_of}.csv"
    if direct.exists():
        return direct
    candidates = sorted(DATA_DIR.glob("checkbook_FY26_*.csv"))
    if not candidates:
        sys.exit(f"no checkbook_FY26_*.csv files in {DATA_DIR}")
    return candidates[-1]


def main() -> int:
    if not DISCLOSURE.exists():
        sys.exit(f"missing {DISCLOSURE} — run build_checkbook_csv.py first")
    disclosure = json.loads(DISCLOSURE.read_text())
    as_of = disclosure["as_of"]
    csv_path = find_checkbook_csv(as_of)

    fund_monthly: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    with csv_path.open(newline="") as f:
        for row in csv.DictReader(f):
            amount = float(row["Amount"])
            ym = row["Date"][:7]
            fund_monthly[row["Fund"]][ym] += amount

    totals = {fund: sum(months.values()) for fund, months in fund_monthly.items()}
    top = sorted(totals.items(), key=lambda kv: -kv[1])[:TOP_N]

    funds_out = []
    for fund_name, total in top:
        cum = 0.0
        series = []
        for ym in FY26_MONTHS:
            cum += fund_monthly[fund_name].get(ym, 0.0)
            series.append({
                "month": ym,
                "cumulative": round(cum, 2),
                "monthly": round(fund_monthly[fund_name].get(ym, 0.0), 2),
            })
        funds_out.append({
            "fund": fund_name,
            "total_through_as_of": round(total, 2),
            "series": series,
        })

    payload = {
        "as_of": as_of,
        "fiscal_year": "FY26",
        "fy_months": FY26_MONTHS,
        "funds": funds_out,
        "source": f"data/{csv_path.name} (vendor payments only; excludes payroll)",
        "generated_by": "scripts/build_monthly_burn.py",
    }

    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {OUTPUT} (as_of={as_of}, {len(funds_out)} funds, top: {funds_out[0]['fund']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
