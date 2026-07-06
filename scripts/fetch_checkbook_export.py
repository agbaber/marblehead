#!/usr/bin/env python3
"""
Fetch the spending portal's full payment ledger as a CSV and pipe it
into build_checkbook_csv.py for surgical redaction. Replaces the
manual "Download CSV" button click in the spending portal UI.

Source:
  https://townofmarblehead-ma-oe.spending.socrata.com/api/checkbook_data.csv?year=<FY>&limit=<n>

The endpoint is the same one the portal's UI Export button hits. As of
2026-06-10 it is open: no cookie/session/auth header is required, and
it returns the full FY-to-date ledger in a single response (~1.6 MB
for a full FY, served in a few seconds). Columns ship in exactly the shape
build_checkbook_csv.py expects: " Vendor, Fund, Division, Description,
Date, Amount" (with a leading space on Vendor that the build script
already tolerates via c.strip().title()).

The raw export carries employee surnames on injury/comp medical claims
and student initials on out-of-district SpEd placements. Never commit
it. By default this script writes the raw CSV under /tmp/ (outside the
repo) and then immediately invokes scripts/build_checkbook_csv.py,
which produces the publishable data/checkbook_FY<yy>_<as-of>.csv,
regenerates data/checkbook_redaction_disclosure.json, and writes
/tmp/checkbook_redaction_review.tsv as the privacy gate. REVIEW THE
REVIEW FILE BEFORE COMMITTING.

Usage:
  python3 scripts/fetch_checkbook_export.py             # current FY, fetch + build
  python3 scripts/fetch_checkbook_export.py --year 2026 # a specific FY
  python3 scripts/fetch_checkbook_export.py --raw-only  # fetch only

After committing the regenerated CSV, update in charts/checkbook.html:
  - CHECKBOOK_URL (file name carries the as-of date)
  - the Source files list in the Notes section
"""

from __future__ import annotations

import argparse
import csv
import json
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import fylib

# Mirror crawl_budget_drill.py: prefer certifi when the system trust
# store can't validate Socrata's chain (mostly macOS dev machines).
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

REPO_ROOT = Path(__file__).resolve().parent.parent
BASE = "https://townofmarblehead-ma-oe.spending.socrata.com/api"
DEFAULT_RAW_PATH = Path("/tmp/checkbook_raw_export.csv")

# Total backoff window 5 + 15 + 45 = 65s across 4 attempts. The portal's
# observed transient failures are HTTP 503 and TLS read timeouts that
# clear within seconds, so a short backoff is enough; longer would
# make a real outage slower to fail without buying additional success
# rate.
RETRY_BACKOFFS = (5, 15, 45)


def urlopen_with_retry(url: str, *, timeout: int):
    """urlopen() that retries transient errors with exponential backoff.

    Retries on HTTP 5xx, HTTP 429, and any URLError / TimeoutError /
    OSError (covers DNS, connect, reset, and socket-level timeouts).
    Other HTTPErrors (4xx other than 429) are raised immediately —
    those are caller bugs, not upstream blips.
    """
    last_err: BaseException | None = None
    attempts = len(RETRY_BACKOFFS) + 1
    for i in range(attempts):
        try:
            return urllib.request.urlopen(url, timeout=timeout, context=SSL_CTX)
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code != 429:
                raise
            last_err = e
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
        if i < attempts - 1:
            wait = RETRY_BACKOFFS[i]
            print(f"  portal fetch failed ({last_err}); retrying in {wait}s "
                  f"(attempt {i + 2}/{attempts})", file=sys.stderr, flush=True)
            time.sleep(wait)
    assert last_err is not None
    raise last_err


def fetch_meta(year: int) -> dict:
    """Return {'count': N, 'total_amount': X} for the year."""
    url = f"{BASE}/checkbook_data.json?" + urllib.parse.urlencode({
        "year": year, "limit": 1,
    })
    with urlopen_with_retry(url, timeout=30) as r:
        body = json.loads(r.read())
    return {"count": body["count"], "total_amount": body["total_amount"]}


def fetch_csv(year: int, limit: int, out_path: Path) -> None:
    url = f"{BASE}/checkbook_data.csv?" + urllib.parse.urlencode({
        "year": year, "limit": limit,
    })
    with urlopen_with_retry(url, timeout=120) as r:
        out_path.write_bytes(r.read())


def verify(raw_path: Path, expected: dict) -> tuple[int, float]:
    with raw_path.open(newline="") as f:
        reader = csv.DictReader(f)
        cols = {c.strip().title(): c for c in reader.fieldnames or []}
        if "Amount" not in cols:
            sys.exit(f"raw export missing Amount column (found {reader.fieldnames})")
        rows = list(reader)
    total = round(sum(float(r[cols["Amount"]]) for r in rows), 2)
    n = len(rows)
    if n != expected["count"]:
        sys.exit(f"row-count mismatch: CSV has {n:,}, API said {expected['count']:,}")
    if abs(total - expected["total_amount"]) > 0.01:
        sys.exit(f"total mismatch: CSV sums to ${total:,.2f}, API said "
                 f"${expected['total_amount']:,.2f}")
    return n, total


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--year", type=int, default=None,
                    help="Fiscal year, e.g. 2027 for FY27 (default: current FY)")
    ap.add_argument("--raw-path", type=Path, default=DEFAULT_RAW_PATH,
                    help=f"Where to write the raw export (default {DEFAULT_RAW_PATH})")
    ap.add_argument("--raw-only", action="store_true",
                    help="Fetch the raw CSV and stop; skip the redaction step")
    args = ap.parse_args()
    year = args.year or fylib.current_fiscal_year()

    if args.raw_path.resolve().is_relative_to(REPO_ROOT):
        sys.exit(f"--raw-path must be outside the repo (got {args.raw_path}); "
                 "the raw export contains PII and must never be committed")

    print(f"fetching {fylib.fy_label(year)} ledger metadata...")
    meta = fetch_meta(year)
    print(f"  rows expected: {meta['count']:,}")
    print(f"  total expected: ${meta['total_amount']:,.2f}")

    limit = meta["count"] + 100  # buffer in case of late writes mid-fetch
    print(f"downloading full ledger to {args.raw_path} (limit={limit:,})...")
    fetch_csv(year, limit, args.raw_path)
    print(f"  wrote {args.raw_path.stat().st_size:,} bytes")

    n, total = verify(args.raw_path, meta)
    print(f"verified: {n:,} rows summing to ${total:,.2f}")

    if args.raw_only:
        print("\n--raw-only set; stopping before redaction step.")
        return

    print("\nhanding off to scripts/build_checkbook_csv.py...")
    build_script = REPO_ROOT / "scripts" / "build_checkbook_csv.py"
    subprocess.run(
        [sys.executable, str(build_script), str(args.raw_path), "--year", str(year)],
        check=True,
    )


if __name__ == "__main__":
    main()
