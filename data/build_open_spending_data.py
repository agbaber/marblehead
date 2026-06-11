#!/usr/bin/env python3
"""Snapshot the Town of Marblehead Open Expenditures (checkbook) portal.

Source: https://townofmarblehead-ma-oe.spending.socrata.com (the "Open
Finance / checkbook" sibling of the Open Budget portal). This is ACTUAL cash
paid out, year to date, NOT the adopted budget. It refreshes every time the
Town uploads, so this is a dated snapshot: "complete as of SNAPSHOT_DATE",
not a fixed final figure. FY2026 is the only year the portal carries.

API shape mirrors the budget portal but with two differences: the response
key is "records" (not "entities") and there are no prior-period comparison
columns. Two orthogonal cuts of the same total are captured:

  by_account  - crawl org1..org6 cumulatively to fully-constrained leaves.
                Parallels open_budget_FY2026_opex.csv so actuals can be set
                against the adopted budget by department.
  by_vendor   - the vendor dimension crossed with org1 (department), so each
                row is (department, vendor, amount). Grouping by vendor gives
                the flat "where the money went" list; the department column
                gives attribution. This is the cut the old April snapshot had
                only a thin top-N slice of.

Both cuts independently reconcile to the portal grand total, which is the
proof that the crawl captured everything with no double counting.

Run: python3 build_open_spending_data.py
"""

import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://townofmarblehead-ma-oe.spending.socrata.com/api"
LEVELS = ["org1", "org2", "org3", "org4", "org5", "org6"]
YEAR = 2026
SNAPSHOT_DATE = "2026-06-11"
SOURCE_URL = "https://townofmarblehead-ma-oe.spending.socrata.com/#!/year/2026"
GRAND_TOTAL = 100370353.89  # portal app_data total_amount at snapshot time


def fetch(child_entity, filters):
    params = {
        "year": str(YEAR),
        "page": "0",
        "limit": "20000",
        "sort_field": "total",
        "sort": "desc",
        "child_entity": child_entity,
    }
    params.update(filters)
    url = f"{BASE}/chart_data.json?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=40) as r:
                data = json.loads(r.read())
            return data.get("records", []) if isinstance(data, dict) else []
        except Exception as e:
            if attempt == 3:
                print(f"  ! giving up on {url}: {e}", file=sys.stderr)
                return []
            time.sleep(0.5 * (attempt + 1))
    return []


# ---- by_account: cumulative crawl org1..org6 to leaves -----------------

def crawl_accounts():
    leaves = []
    top = [c for c in fetch(LEVELS[0], {}) if round(c.get("total") or 0, 2) != 0]
    with ThreadPoolExecutor(max_workers=8) as ex:
        for f in [ex.submit(_acct_branch, c.get("key"), leaves) for c in top]:
            f.result()
    return leaves


def _acct_branch(org1_key, leaves):
    local = []

    def recurse(depth, filters, path):
        if depth >= len(LEVELS):
            local.append(_acct_record(path))
            return
        level = LEVELS[depth]
        children = [c for c in fetch(level, filters)
                    if round(c.get("total") or 0, 2) != 0]
        if not children:
            local.append(_acct_record(path))
            return
        for c in children:
            recurse(depth + 1,
                    {**filters, level: c["key"]},
                    path + [(level, c["key"], c["total"])])

    recurse(1, {"org1": org1_key}, [("org1", org1_key, None)])
    leaves.extend(local)


def _acct_record(path):
    rec = {lvl: "" for lvl in LEVELS}
    for lvl, key, _ in path:
        rec[lvl] = key
    rec.update({
        "amount_usd": round(path[-1][2] or 0, 2),
        "depth": sum(1 for lvl in LEVELS if rec[lvl] != ""),
        "fiscal_year": f"FY{YEAR}",
        "snapshot_date": SNAPSHOT_DATE,
        "source_url": SOURCE_URL,
    })
    return rec


# ---- by_vendor: vendor crossed with org1 department --------------------

def crawl_vendors():
    rows = []
    depts = [c for c in fetch("org1", {}) if round(c.get("total") or 0, 2) != 0]

    def one(dept):
        out = []
        for v in fetch("vendor", {"org1": dept["key"]}):
            if round(v.get("total") or 0, 2) == 0:
                continue
            out.append({
                "department": dept["key"],
                "vendor": v["key"],
                "amount_usd": round(v["total"], 2),
                "fiscal_year": f"FY{YEAR}",
                "snapshot_date": SNAPSHOT_DATE,
                "source_url": SOURCE_URL,
            })
        return out

    with ThreadPoolExecutor(max_workers=8) as ex:
        for r in ex.map(one, depts):
            rows.extend(r)
    return rows


def write_csv(rows, fname, cols, sort_key):
    rows = sorted(rows, key=sort_key)
    with open(fname, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in cols})
    total = round(sum(r["amount_usd"] for r in rows), 2)
    print(f"  wrote {fname}: {len(rows)} rows, total ${total:,.2f}")
    return total


def reconcile(total, label):
    delta = round(total - GRAND_TOTAL, 2)
    print(f"  reconcile {label} vs portal ${GRAND_TOTAL:,.2f}: "
          + ("OK" if abs(delta) < 1.0 else f"MISMATCH delta={delta:,.2f}"))


def main():
    print("crawling by_account ...")
    acct = crawl_accounts()
    t = write_csv(
        acct, f"open_spending_FY2026_by_account_snapshot_{SNAPSHOT_DATE}.csv",
        LEVELS + ["fiscal_year", "depth", "amount_usd", "snapshot_date", "source_url"],
        lambda r: (-r["amount_usd"], r["org1"]))
    reconcile(t, "by_account")

    print("crawling by_vendor (vendor x department) ...")
    vend = crawl_vendors()
    t = write_csv(
        vend, f"open_spending_FY2026_by_vendor_snapshot_{SNAPSHOT_DATE}.csv",
        ["department", "vendor", "amount_usd", "fiscal_year", "snapshot_date", "source_url"],
        lambda r: (-r["amount_usd"], r["department"]))
    reconcile(t, "by_vendor")


if __name__ == "__main__":
    main()
