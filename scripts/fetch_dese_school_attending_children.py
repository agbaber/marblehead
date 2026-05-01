#!/usr/bin/env python3
"""Fetch DESE "School Attending Children" for Marblehead.

This dataset breaks down where students residing in a given Massachusetts
town actually attend school: local public, regional academic, vocational,
collaborative, charter, out-of-district public, homeschool, in-state
private, and out-of-state private. Coverage runs SY 1985 through SY 2025
(SY 2020 is missing, plausibly a COVID reporting gap).

Output: data/dese_school_attending_marblehead.csv
Source: https://educationtocareer.data.mass.gov/resource/rdxw-mfv3.json

The `sy` field is the academic-year-ending year (sy=2024 means SY 2023-24,
which Marblehead reports as FY24).
"""
import csv
import json
import os
import sys
import urllib.parse
import urllib.request

OUT_PATH = "data/dese_school_attending_marblehead.csv"
RESOURCE = "rdxw-mfv3"
TOWN = "Marblehead"
BASE = "https://educationtocareer.data.mass.gov/resource"

HEADERS = [
    "school_year_end",
    "town",
    "loc_pub",
    "acad_reg",
    "voc_reg",
    "collabs",
    "charter",
    "ood_pub",
    "homeschool",
    "in_state_priv",
    "oos_priv",
    "total",
    "total_pub",
    "public_pct",
]

NUMERIC_FIELDS = HEADERS[2:-1]  # everything except keys + the percent string


def fetch_all():
    params = {"town": TOWN, "$limit": "100", "$order": "sy"}
    url = f"{BASE}/{RESOURCE}.json?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode())


def to_int(v):
    if v in (None, "", "-"):
        return 0
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def main():
    rows = fetch_all()
    if not rows:
        print("No rows returned, aborting.", file=sys.stderr)
        sys.exit(1)

    out = []
    for r in rows:
        out.append([
            int(r["sy"]),
            r["town"],
            to_int(r.get("loc_pub_cnt")),
            to_int(r.get("acad_reg_cnt")),
            to_int(r.get("voc_reg_cnt")),
            to_int(r.get("collabs_cnt")),
            to_int(r.get("chart_cnt")),
            to_int(r.get("ood_pub_cnt")),
            to_int(r.get("home_schld_cnt")),
            to_int(r.get("in_state_priv_cnt")),
            to_int(r.get("oos_priv_cnt")),
            to_int(r.get("total_cnt")),
            to_int(r.get("total_pub_cnt")),
            r.get("public_pct", ""),
        ])
        sy = r["sy"]
        print(
            f"  SY {sy}: total={out[-1][11]} mps={out[-1][2]} "
            f"priv={out[-1][9]} pub_pct={out[-1][13]}",
            flush=True,
        )

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        for r in out:
            w.writerow(r)
    print(f"\nWrote {OUT_PATH} ({len(out)} rows)")


if __name__ == "__main__":
    main()
