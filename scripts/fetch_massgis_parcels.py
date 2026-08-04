#!/usr/bin/env python3
"""Fetch all Marblehead parcels from the MassGIS Standardized Assessors'
Parcels feature service and write two CSVs.

  data/parcels.csv                  committed, de-identified (no owner/mailing)
  data/parcels_raw/parcels_full.csv gitignored, adds owner + mailing

Raw JSON pages are cached under data/parcels_raw/ (gitignored) for provenance.

The service caps a query at 2000 rows, so we page with resultOffset, ordered by
OBJECTID for stable paging. One run is ~5 requests (8,805 parcels).

Usage: python3 scripts/fetch_massgis_parcels.py
Source: MassGIS "Massachusetts Property Tax Parcels" FeatureServer/0,
        https://www.mass.gov/info-details/massgis-data-property-tax-parcels
"""
import csv
import json
import os
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from massgis_parcels import FULL_COLS, OUT_FIELDS, PUBLIC_COLS, map_feature  # noqa: E402

QUERY = (
    "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/"
    "Massachusetts_Property_Tax_Parcels/FeatureServer/0/query"
)
TOWN_ID = 168           # MassGIS code for Marblehead
PAGE = 2000
RAW_DIR = "data/parcels_raw"
PUBLIC_OUT = "data/parcels.csv"
FULL_OUT = os.path.join(RAW_DIR, "parcels_full.csv")
UA = "marbleheaddata.org civic-data parcel ingest (contact agbaber@gmail.com)"


def fetch_page(offset):
    args = [
        "curl", "-s", "-A", UA, "--get", QUERY,
        "--data-urlencode", f"where=TOWN_ID={TOWN_ID}",
        "--data-urlencode", f"outFields={OUT_FIELDS}",
        "--data-urlencode", "returnGeometry=false",
        "--data-urlencode", "orderByFields=OBJECTID",
        "--data-urlencode", f"resultOffset={offset}",
        "--data-urlencode", f"resultRecordCount={PAGE}",
        "--data-urlencode", "f=json",
    ]
    out = subprocess.run(args, capture_output=True, text=True).stdout
    return json.loads(out)


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    rows = []
    offset = 0
    while True:
        data = fetch_page(offset)
        if "error" in data:
            print(f"API error at offset {offset}: {data['error']}", file=sys.stderr)
            sys.exit(1)
        feats = data.get("features", [])
        if not feats:
            break
        with open(os.path.join(RAW_DIR, f"page_{offset}.json"), "w") as fh:
            json.dump(data, fh)
        rows.extend(map_feature(f["attributes"]) for f in feats)
        print(f"... offset {offset}: {len(feats)} parcels (total {len(rows)})", file=sys.stderr)
        if len(feats) < PAGE:
            break
        offset += PAGE

    rows.sort(key=lambda r: (str(r["map_par_id"]), str(r["loc_id"])))

    with open(PUBLIC_OUT, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=PUBLIC_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    with open(FULL_OUT, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FULL_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    fy = {r["fy"] for r in rows if r["fy"] != ""}
    total = sum(r["total_val"] for r in rows if isinstance(r["total_val"], int))
    print(f"Wrote {len(rows)} parcels -> {PUBLIC_OUT} and {FULL_OUT}", file=sys.stderr)
    print(f"FY vintage(s): {sorted(fy)}; town-wide total assessed value ${total:,}", file=sys.stderr)


if __name__ == "__main__":
    main()
