#!/usr/bin/env python3
"""Fetch ACS B01001 (Sex by Age) school-age population for Marblehead.

Pulls 5-year ACS estimates for end-years 2010-2023, sums the male and
female counts for ages 5-9, 10-14, and 15-17, and propagates the margins
of error.

Geography: state 25 (MA), county 009 (Essex), county subdivision 38400
(Marblehead town).

Output: data/acs_school_age_marblehead.csv
Source: https://api.census.gov/data/<year>/acs/acs5

ACS 5-year estimates are released in December for end-year YYYY (covering
YYYY-4 to YYYY). Re-run this script when a new vintage is published.

Variables (B01001):
  Male:   B01001_004E (5-9), B01001_005E (10-14), B01001_006E (15-17)
  Female: B01001_028E (5-9), B01001_029E (10-14), B01001_030E (15-17)
  Margins of error use the same numbers with 'M' instead of 'E'.
"""
import csv
import json
import math
import os
import sys
import urllib.parse
import urllib.request

OUT_PATH = "data/acs_school_age_marblehead.csv"
# End-years 2014..2023 inclusive — aligns with the chart's 2014-2026 axis.
# Earlier ACS vintages (2010-2013) exist but are not plotted; if you want them
# for future use, extend this range. Each year is one Census API call.
END_YEARS = list(range(2014, 2024))
STATE = "25"
COUNTY = "009"
COUSUB = "38400"

VARS_E = [
    "B01001_004E", "B01001_005E", "B01001_006E",  # male 5-9, 10-14, 15-17
    "B01001_028E", "B01001_029E", "B01001_030E",  # female 5-9, 10-14, 15-17
]
VARS_M = [v.replace("E", "M") for v in VARS_E]
ALL_VARS = VARS_E + VARS_M

HEADERS = [
    "acs_end_year",
    "ages_5_to_9",
    "ages_10_to_14",
    "ages_15_to_17",
    "total_5_to_17",
    "moe_total",
]


def fetch_year(year: int) -> dict:
    """Return a dict with the six count vars and six MOE vars for Marblehead."""
    base = f"https://api.census.gov/data/{year}/acs/acs5"
    params = {
        "get": ",".join(["NAME"] + ALL_VARS),
        "for": f"county subdivision:{COUSUB}",
        "in": f"state:{STATE} county:{COUNTY}",
    }
    key = os.environ.get("CENSUS_API_KEY")
    if key:
        params["key"] = key
    url = f"{base}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    # data is [headers, row]
    headers, row = data[0], data[1]
    return dict(zip(headers, row))


def compute_row(year: int, raw: dict) -> list:
    """Reduce six male+female counts into 5-9, 10-14, 15-17, total + MOE."""
    a59 = int(raw["B01001_004E"]) + int(raw["B01001_028E"])
    a10 = int(raw["B01001_005E"]) + int(raw["B01001_029E"])
    a15 = int(raw["B01001_006E"]) + int(raw["B01001_030E"])
    total = a59 + a10 + a15

    # MOE for a sum: sqrt(sum of squared component MOEs).
    # ACS-suppressed values may be negative (-555555555 etc.); coerce to 0.
    def safe_moe(v):
        try:
            x = int(v)
            return x if x >= 0 else 0
        except (TypeError, ValueError):
            return 0

    moes = [safe_moe(raw[v]) for v in VARS_M]
    moe_total = round(math.sqrt(sum(m * m for m in moes)))
    return [year, a59, a10, a15, total, moe_total]


def main():
    rows = []
    for year in END_YEARS:
        try:
            raw = fetch_year(year)
            row = compute_row(year, raw)
            print(f"  {year}: 5-17 = {row[4]} (MOE +/- {row[5]})", flush=True)
            rows.append(row)
        except Exception as e:
            print(f"  {year}: FAILED ({e})", file=sys.stderr)

    if not rows:
        print("No rows fetched, refusing to write empty CSV.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        for r in rows:
            w.writerow(r)
    print(f"\nWrote {OUT_PATH} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
