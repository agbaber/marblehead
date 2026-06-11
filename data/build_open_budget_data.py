#!/usr/bin/env python3
"""Ingest the Town of Marblehead Open Budget portal into tidy CSVs.

Source: https://townofmarblehead-ma-ob.budget.socrata.com/#!/year/2026
The portal is a Socrata OpenBudget front end. Its data is served per-branch
from the portal's own JSON API:

  /api/all_years.json?type=operating
  /api/<branch>/entity_counts.json?year=YYYY&child_entity=orgN
  /api/<branch>/chart_data.json?year=YYYY&child_entity=orgN&<ancestor filters>

where <branch> is "opex" (adopted operating budget) or "revenue" (revenue
budget). The budget is a strict org hierarchy org1 > org2 > ... > org6.
Passing every ancestor level as a query param (org1=.., org2=.., ...) filters
the child breakdown to that node, so we can crawl the tree to its leaves.

Only FY2026 carries dollar values; FY2027 exists in the portal as an empty
placeholder year (every org1 total is $0), so we ingest FY2026 only and record
that fact. This script is provenance-only: it does not assert these figures are
authoritative. The primary source remains the Town budget book / FinCom report;
the portal is a secondary presentation that this CSV mirrors for convenience.

Run: python3 build_open_budget_data.py
Writes: open_budget_FY2026_opex.csv, open_budget_FY2026_revenue.csv
"""

import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://townofmarblehead-ma-ob.budget.socrata.com/api"
LEVELS = ["org1", "org2", "org3", "org4", "org5", "org6"]
SNAPSHOT_DATE = "2026-06-10"
SOURCE_URL = "https://townofmarblehead-ma-ob.budget.socrata.com/#!/year/2026"


def fetch(branch, year, child_entity, filters):
    """Return the list of child entities at `child_entity`, filtered to the
    ancestor path in `filters` ({'org1': value, 'org2': value, ...})."""
    params = {
        "page": "0",
        "limit": "5000",
        "sort_field": "total",
        "sort": "desc",
        "year": str(year),
        "child_entity": child_entity,
    }
    params.update(filters)
    url = f"{BASE}/{branch}/chart_data.json?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = json.loads(r.read())
            return data.get("entities", []) if isinstance(data, dict) else []
        except Exception as e:  # transient network / 5xx: back off and retry
            if attempt == 3:
                print(f"  ! giving up on {url}: {e}", file=sys.stderr)
                return []
            time.sleep(0.5 * (attempt + 1))
    return []


def crawl(branch, year):
    """Walk org1->org6, returning one dict per leaf node with its full path,
    budget total, and the two trailing prior-period columns the API returns.

    The org levels are not uniform depth: under the school fund a leaf sits at
    org6 (fund > school > UNDEFINED > expense-category > account); a single-line
    capital article bottoms out at org2. A node is therefore a leaf when the
    next level returns no nonzero children, OR when it is itself an org6 node
    (there is no level below org6 to query). Recording only leaves means leaf
    totals sum to the grand total with no double counting of internal rollups.
    """
    leaves = []

    # Seed at org1, then fan out one worker per org1 subtree.
    top = fetch(branch, year, LEVELS[0], {})
    top = [c for c in top if round(c.get("total") or 0, 2) != 0]
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = [
            ex.submit(_branch_under, branch, year, c.get("key"), c, leaves)
            for c in top
        ]
        for f in futures:
            f.result()
    return leaves


def _branch_under(branch, year, org1_key, org1_entity, leaves):
    """Crawl everything under a single org1 node (runs in a worker thread)."""
    local = []

    def recurse(depth, filters, path):
        if depth >= len(LEVELS):
            # Past org6: the deepest node we fixed (path[-1]) is the leaf.
            local.append(_leaf_record(branch, year, path, path[-1]["_entity"]))
            return
        level = LEVELS[depth]
        children = fetch(branch, year, level, filters)
        # Drop zero-dollar children (FY2027 placeholders, empty buckets).
        children = [c for c in children if round(c.get("total") or 0, 2) != 0]
        if not children:
            # No further breakdown: path[-1] is a leaf shallower than org6.
            local.append(_leaf_record(branch, year, path, path[-1]["_entity"]))
            return
        for c in children:
            key = c.get("key")
            child_filters = dict(filters)
            child_filters[level] = key
            recurse(depth + 1, child_filters,
                    path + [{"level": level, "key": key, "_entity": c}])

    recurse(1, {"org1": org1_key},
            [{"level": "org1", "key": org1_key, "_entity": org1_entity}])
    leaves.extend(local)


def _leaf_record(branch, year, path, entity):
    rec = {lvl: "" for lvl in LEVELS}
    for node in path:
        rec[node["level"]] = node["key"]
    rec.update({
        "branch": "operating" if branch == "opex" else "revenue",
        "fiscal_year": f"FY{year}",
        "amount_usd": round(entity.get("total") or 0, 2),
        "prior_secondary_usd": round(entity.get("secondary_total") or 0, 2),
        "prior_tertiary_usd": round(entity.get("tertiary_total") or 0, 2),
        "depth": sum(1 for lvl in LEVELS if rec[lvl] != ""),
        "snapshot_date": SNAPSHOT_DATE,
        "source_url": SOURCE_URL,
    })
    return rec


def write_csv(rows, fname):
    cols = (LEVELS + ["branch", "fiscal_year", "depth", "amount_usd",
            "prior_secondary_usd", "prior_tertiary_usd",
            "snapshot_date", "source_url"])
    rows = sorted(rows, key=lambda r: (-r["amount_usd"], r["org1"]))
    with open(fname, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in cols})
    total = round(sum(r["amount_usd"] for r in rows), 2)
    print(f"  wrote {fname}: {len(rows)} leaf rows, total ${total:,.2f}")
    return total


def main():
    year = 2026
    targets = {
        "opex": ("open_budget_FY2026_opex.csv", 206063591.63),
        "revenue": ("open_budget_FY2026_revenue.csv", 119436756.56),
    }
    for branch, (fname, expected) in targets.items():
        print(f"crawling {branch} FY{year} ...")
        rows = crawl(branch, year)
        total = write_csv(rows, fname)
        delta = round(total - expected, 2)
        flag = "OK" if abs(delta) < 1.0 else f"MISMATCH delta={delta:,.2f}"
        print(f"  reconcile vs portal grand total ${expected:,.2f}: {flag}")


if __name__ == "__main__":
    main()
