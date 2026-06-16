#!/usr/bin/env python3
"""Snapshot Town of Marblehead Open Finance / Open Expenditures portal totals.

The portal at townofmarblehead-ma-oe.spending.socrata.com is the
public face of a Socrata/OpenGov instance fed nightly from MUNIS. The
underlying SODA datasets (ledger 8vi6-4vj7, vendor w3vm-9mxr on
townofmarblehead-ma-edp.data.socrata.com) require auth, but the
portal's `chart_data.json` aggregation endpoint is public.

That endpoint only exposes year-to-date rollups for the current
fiscal year (FY26 as of 2026), by a single dimension at a time. Date
filters, granularity, and parent/child drilldown parameters are
silently ignored. So the most we can do is take two cumulative
snapshots per day:

  - by department (9 rows, ~700 bytes)
  - by vendor (~2,000 rows, ~150 KB)

Daily diffs of those two CSVs show what departments/vendors received
new payments since yesterday, which is the realistic provenance from
a portal that updates end-of-business-day.

Outputs:
  data/town_spending/department_totals.csv
  data/town_spending/vendor_totals.csv
  data/town_spending/snapshot_meta.json

Source: https://townofmarblehead-ma-oe.spending.socrata.com/
"""
import csv
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

PORTAL = "https://townofmarblehead-ma-oe.spending.socrata.com"
OUT_DIR = Path("data/town_spending")
USER_AGENT = "marbleheaddata.org daily-refresh (https://marbleheaddata.org)"


def current_fiscal_year(today: dt.date) -> int:
    """Marblehead FY runs July 1 – June 30. FY26 = Jul 2025 – Jun 2026."""
    return today.year + 1 if today.month >= 7 else today.year


def fetch(child_entity: str, year: int, limit: int) -> dict:
    qs = urllib.parse.urlencode({
        "child_entity": child_entity,
        "year": year,
        "limit": limit,
    })
    url = f"{PORTAL}/api/chart_data.json?{qs}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def write_csv(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["key", "label", "total"])
        for r in sorted(records, key=lambda r: r["label"]):
            w.writerow([r["key"], r["label"], f"{float(r['total']):.2f}"])


def main() -> int:
    today = dt.date.today()
    fy = current_fiscal_year(today)

    dept = fetch("department", fy, limit=200)
    vendor = fetch("vendor", fy, limit=5000)

    dept_records = dept.get("records", [])
    vendor_records = vendor.get("records", [])

    if not dept_records or not vendor_records:
        print(
            f"Empty response from portal (dept={len(dept_records)} "
            f"vendor={len(vendor_records)}). Aborting without overwriting.",
            file=sys.stderr,
        )
        return 1

    if len(vendor_records) < vendor.get("count", 0):
        print(
            f"Vendor response truncated: got {len(vendor_records)} of "
            f"{vendor['count']}. Raise --limit.",
            file=sys.stderr,
        )
        return 1

    write_csv(OUT_DIR / "department_totals.csv", dept_records)
    write_csv(OUT_DIR / "vendor_totals.csv", vendor_records)

    dept_sum = sum(float(r["total"]) for r in dept_records)
    vendor_sum = sum(float(r["total"]) for r in vendor_records)

    meta = {
        "snapshot_date": today.isoformat(),
        "fiscal_year": fy,
        "department_row_count": len(dept_records),
        "vendor_row_count": len(vendor_records),
        "department_total_usd": round(dept_sum, 2),
        "vendor_total_usd": round(vendor_sum, 2),
        "source_url": f"{PORTAL}/",
    }
    (OUT_DIR / "snapshot_meta.json").write_text(
        json.dumps(meta, indent=2) + "\n"
    )

    print(
        f"FY{fy} snapshot {today.isoformat()}: "
        f"{len(dept_records)} depts (${dept_sum:,.0f}), "
        f"{len(vendor_records)} vendors (${vendor_sum:,.0f})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
