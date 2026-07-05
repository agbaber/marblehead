#!/usr/bin/env python3
"""
Fetch the Town of Marblehead's full operating budget CSV from the
Open Budget portal.

Source:
  https://townofmarblehead-ma-ob.budget.socrata.com/api/operating_budget.csv?year=<FY>

The Open Budget portal sits alongside the Open Expenditures (vendor
checkbook) and Open Finance (dashboard) portals at sibling subdomains
(-oe, -of, -ob). Its operating_budget endpoint exposes the same
underlying dataset Andrew was previously hand-downloading as five
"Fund_Group" CSVs — but in a single export, plus encumbrance and
fiscalmonth columns the manual flow didn't pull.

The endpoint is public: a Referer header on the budget portal is the
only requirement. ~6.4 MB / 14.6k rows for FY26 as of 2026-06-22.

Columns include:
  - fiscalyear, fiscalmonth (monthly granularity)
  - fund, fundcode, fundgroup
  - segment2 (function category), segment3 (department), department
  - originalbudget, revisedbudget
  - actual (PAYROLL INCLUDED — distinct from spending-portal ledger
    which is payroll-stripped vendor-only)
  - encumbrance, obligatedamount, unencumberedbalance

No PII columns. Safe to commit raw.

Output:
  data/operating_budget_FY26.csv

Usage:
  python3 scripts/fetch_operating_budget.py
  python3 scripts/fetch_operating_budget.py --year 2026
"""
from __future__ import annotations

import argparse
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import fylib

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"

PORTAL = "https://townofmarblehead-ma-ob.budget.socrata.com"
USER_AGENT = "marbleheaddata.org daily-refresh (https://marbleheaddata.org)"
RETRY_BACKOFFS = (5, 15, 45)


def fetch_csv(year: int) -> bytes:
    url = f"{PORTAL}/api/operating_budget.csv?year={year}"
    req = urllib.request.Request(
        url,
        headers={
            # The portal's /api/* endpoints redirect to /404 unless a
            # Referer to the portal root is set. The spending portal
            # doesn't require this, but the budget portal does.
            "Referer": f"{PORTAL}/",
            "User-Agent": USER_AGENT,
            "Accept": "text/csv,*/*;q=0.9",
        },
    )
    last_err: Exception | None = None
    for attempt, wait in enumerate((0,) + RETRY_BACKOFFS):
        if wait:
            print(f"  portal fetch failed ({last_err}); retrying in {wait}s "
                  f"(attempt {attempt + 1}/{len(RETRY_BACKOFFS) + 1})")
            time.sleep(wait)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"portal returned HTTP {resp.status}")
                return resp.read()
        except (urllib.error.URLError, RuntimeError) as e:
            last_err = e
    raise SystemExit(f"all retries failed for {url}: {last_err}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("--year", type=int, default=None,
                    help="fiscal year (default: current FY)")
    args = ap.parse_args()

    year = args.year or fylib.current_fiscal_year()
    print(f"Fetching operating_budget.csv for FY{year}...")
    body = fetch_csv(year)

    out = DATA_DIR / f"operating_budget_FY{year - 2000}.csv"
    out.write_bytes(body)
    print(f"  wrote {out} ({len(body):,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
