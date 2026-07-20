#!/usr/bin/env python3
"""
Build data/monthly_burn_FY<N>.json — the JSON the /monthly-pacing/ page
reads to render the per-fund monthly cumulative-spend chart.

Aggregates data/operating_budget_FY<N>.csv (fetched daily from the
Open Budget portal) by Fund x fiscalmonth and emits the top funds by
total actual spending. Unlike the checkbook (vendor payments only),
this dataset INCLUDES payroll, so General Fund - School can be charted
honestly instead of dropped.

Rows are restricted to the fiscal year's twelve months (the portal's
year=<N> export can carry rows from other fiscal years, whose
fiscalmonth buckets fall outside this FY's Jul-Jun window).

Inputs:
  - data/operating_budget_FY<N>.csv  (built by fetch_operating_budget.py)

Output:
  - data/monthly_burn_FY<N>.json

Usage:
  scripts/build_monthly_burn.py              # current fiscal year
  scripts/build_monthly_burn.py --year 2026  # rebuild a prior FY
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from datetime import UTC, date, datetime
from pathlib import Path

import fylib

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"

TOP_N = 6


def safe_float(s: str | None) -> float:
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def latest_fiscal_month(rows: list[dict]) -> str | None:
    """Latest fiscalmonth bucket containing actual activity (YYYY-MM-01)."""
    latest: date | None = None
    for r in rows:
        if safe_float(r.get("actual")) == 0:
            continue
        fm = (r.get("fiscalmonth") or "")[:10]
        if not fm:
            continue
        try:
            d = date.fromisoformat(fm)
        except ValueError:
            continue
        if latest is None or d > latest:
            latest = d
    return latest.isoformat() if latest else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("--year", type=int, default=fylib.current_fiscal_year(),
                    help="fiscal year to build (default: current fiscal year)")
    args = ap.parse_args()
    year = args.year
    label = fylib.fy_label(year)
    fy_months = fylib.fy_months(year)

    src = DATA_DIR / f"operating_budget_{label}.csv"
    out = DATA_DIR / f"monthly_burn_{label}.json"

    if not src.exists():
        sys.exit(f"missing {src}; run scripts/fetch_operating_budget.py first")

    with src.open(newline="") as f:
        rows = list(csv.DictReader(f))

    # Aggregate actual by fund x fiscal month
    fund_month: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for r in rows:
        actual = safe_float(r.get("actual"))
        if actual == 0:
            continue
        fund = r.get("fund") or ""
        if not fund:
            continue
        ym = (r.get("fiscalmonth") or "")[:7]
        if ym not in fy_months:
            continue
        fund_month[fund][ym] += actual

    totals = {fund: sum(months.values()) for fund, months in fund_month.items()}
    top = sorted(totals.items(), key=lambda kv: -kv[1])[:TOP_N]

    funds_out = []
    for fund_name, total in top:
        cum = 0.0
        series = []
        for ym in fy_months:
            cum += fund_month[fund_name].get(ym, 0.0)
            series.append({
                "month": ym,
                "cumulative": round(cum, 2),
                "monthly": round(fund_month[fund_name].get(ym, 0.0), 2),
            })
        funds_out.append({
            "fund": fund_name,
            "total_through_as_of": round(total, 2),
            "series": series,
        })

    payload = {
        "as_of": datetime.now(UTC).date().isoformat(),
        "latest_fiscal_month": latest_fiscal_month(rows),
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "fiscal_year": label,
        "fy_months": fy_months,
        "funds": funds_out,
        "source": f"data/operating_budget_{label}.csv (Open Budget portal, payroll included)",
        "generated_by": "scripts/build_monthly_burn.py",
    }

    out.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {out.relative_to(REPO_ROOT)} "
          f"(as_of={payload['as_of']}, {len(funds_out)} funds)")
    for f in funds_out:
        print(f"  {f['fund']:<32} ${f['total_through_as_of']:>13,.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
