# Patriot Properties Parcel Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest every Marblehead parcel into a committed, de-identified `data/parcels.csv` (plus a gitignored full CSV that retains owner/mailing for local verification).

> **Source pivot (2026-06-10):** Tasks 1-4 below targeted the Patriot Properties WebPro scrape. That got the IP rate-limited (403) after ~7,000 requests (~2% coverage), so the shipped pipeline uses **MassGIS Standardized Assessors' Parcels** instead (`scripts/fetch_massgis_parcels.py`, `scripts/massgis_parcels.py`, `data/test_massgis_parcels.py`). Same de-identification design, FY2025 vintage, ~5 paged API requests for all 8,805 parcels. The WebPro tasks are kept below as the original record.

**Architecture:** Two-stage pipeline. Stage 1 (`fetch_patriot_parcels.py`) drives the session-stateful ASP app via curl + a cookie jar, caching each parcel's raw `summary-bottom.asp` HTML to a gitignored dir. Stage 2 (`build_patriot_parcels.py`) parses the cache into two CSVs. A pure parser function is unit-tested against a committed scrubbed fixture (TDD); the network fetcher is validated by a small dry run.

**Tech Stack:** Python 3 stdlib (`csv`, `re`, `json`, `subprocess`, `html.parser`), `curl` for session cookies (mirrors `scripts/fetch_dor_overrides.py`), `pytest` for the parser test.

---

## File Structure

- Create `scripts/patriot_parse.py` — pure parsing module: `parse_summary(html) -> dict`. No I/O, no network. The unit-tested core.
- Create `scripts/fetch_patriot_parcels.py` — Stage 1 network fetcher + raw cache + manifest. Imports nothing from parse.
- Create `scripts/build_patriot_parcels.py` — Stage 2: walks the raw cache, calls `parse_summary`, writes both CSVs.
- Create `data/fixtures/patriot_summary_sample.html` — committed, owner/mailing scrubbed, for the parser test.
- Create `data/test_patriot_parse.py` — pytest for `parse_summary`.
- Modify `.gitignore` — ignore `data/patriot_raw/`.
- Modify `data/DATA_CATALOG.md` — entry for `data/parcels.csv`.
- Modify `data/SOURCE_LOOKUP.md` — entry for the scripted fetch/build flow.

---

## Task 1: Gitignore the raw cache

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add the ignore rule**

Append to `.gitignore` (under a comment, matching the file's existing style):

```
# Local raw cache for Patriot Properties parcel scrape (committed CSV only).
# Raw HTML and the full CSV contain owner names + mailing addresses (PII).
data/patriot_raw/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "Gitignore Patriot Properties raw parcel cache (PII stays local)"
```

---

## Task 2: Parser module + failing test (TDD)

The parser is a pure function over one `summary-bottom.asp` HTML string. Field
extraction is the only logic worth testing; build it test-first against a
committed fixture whose owner/mailing values are placeholders.

**Files:**
- Create: `data/fixtures/patriot_summary_sample.html`
- Create: `data/test_patriot_parse.py`
- Create: `scripts/patriot_parse.py`

- [ ] **Step 1: Create the scrubbed fixture**

Save a real `summary-bottom.asp` response to
`data/fixtures/patriot_summary_sample.html`, then replace the two owner-name
lines and the mailing-address line with placeholders `OWNER REDACTED` and
`MAILING REDACTED` so the committed fixture carries no real PII. Keep every
other cell (Parcel ID `112 14 0`, location `5  HARBOR VIEW`, zoning `SR`, sale
date `11/30/2023`, sale price `3,010,000`, book-page `41882-279`, FY `2026`,
building `811,300`, xtra `1,500`, land area `0.290`, land value `1,190,400`,
total `2,003,200`, land use `ONE FAM`, style `OLD STYLE`, year built `1900`,
units `1`, rooms `8`, beds `4`, baths `2`, half baths `1`, `Card 1 of 1`).

- [ ] **Step 2: Write the failing test**

```python
# data/test_patriot_parse.py
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
from patriot_parse import parse_summary  # noqa: E402

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "patriot_summary_sample.html"


def _rec():
    return parse_summary(FIXTURE.read_text(encoding="latin-1"))


def test_identifiers_and_location():
    r = _rec()
    assert r["parcel_id"] == "112 14 0"
    assert r["address"] == "5 HARBOR VIEW"
    assert r["zoning"] == "SR"
    assert r["card_count"] == 1


def test_assessment_values_are_numeric():
    r = _rec()
    assert r["assessment_fy"] == 2026
    assert r["building_value"] == 811300
    assert r["extra_features_value"] == 1500
    assert r["land_value"] == 1190400
    assert r["total_value"] == 2003200
    assert r["land_area_acres"] == 0.290


def test_characteristics_and_sale():
    r = _rec()
    assert r["land_use"] == "ONE FAM"
    assert r["style"] == "OLD STYLE"
    assert r["year_built"] == 1900
    assert r["units"] == 1
    assert r["rooms"] == 8
    assert r["bedrooms"] == 4
    assert r["bathrooms"] == 2
    assert r["half_baths"] == 1
    assert r["sale_date"] == "11/30/2023"
    assert r["sale_price"] == 3010000
    assert r["book_page"] == "41882-279"


def test_owner_present_in_full_record_only():
    # parse_summary returns owner/mailing; the BUILD step is what drops them
    # from the committed CSV. Here we just assert they are captured.
    r = _rec()
    assert "owner" in r
    assert "mailing_address" in r
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `cd /Users/agbaber/marblehead/.worktrees/patriot-parcels && python3 -m pytest data/test_patriot_parse.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'patriot_parse'`.

- [ ] **Step 4: Implement `parse_summary`**

Create `scripts/patriot_parse.py`. Strategy: strip `<script>`/`<style>`, split
on tags into a flat list of non-empty text cells, then read values by their
labels (the labels and values are adjacent cells, confirmed against the live
page). Provide small helpers `_to_int` (strip commas, handle `--`/empty) and
`_to_float`. Pull characteristics from the narrative sentence by anchoring on
its fixed label words. Return a dict with EVERY field including `owner` and
`mailing_address`. Field names must match the test exactly.

```python
#!/usr/bin/env python3
"""Parse one Patriot Properties summary-bottom.asp response into a record.

Pure function, no I/O. Field names are the canonical column names used by
build_patriot_parcels.py.
"""
import re


def _cells(html):
    html = re.sub(r"(?is)<script.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?</style>", " ", html)
    text = re.sub(r"<[^>]+>", "\t", html)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    text = re.sub(r"[ \t\r\n]+", " ", text.replace("\t", "\x00"))
    return [c.strip() for c in text.split("\x00") if c.strip()]


def _after(cells, label, default=""):
    """First cell following the cell whose (whitespace-collapsed) text == label."""
    norm = lambda s: re.sub(r"\s+", " ", s).strip()
    for i, c in enumerate(cells[:-1]):
        if norm(c) == label:
            return cells[i + 1]
    return default


def _to_int(s):
    s = re.sub(r"[^0-9-]", "", s or "")
    return int(s) if s not in ("", "-") else None


def _to_float(s):
    m = re.search(r"-?\d+(?:\.\d+)?", (s or "").replace(",", ""))
    return float(m.group()) if m else None


def parse_summary(html):
    cells = _cells(html)
    joined = " ".join(cells)

    m = re.search(r"Card\s+(\d+)\s+of\s+(\d+)", joined)
    card_count = int(m.group(2)) if m else 1

    # Narrative: "...contains X acres of land mainly classified as LUC with a(n)
    # STYLE style building, built about YEAR, having EXT exterior and ROOF roof
    # cover, with U unit(s), R total room(s), B total bedroom(s), T total
    # bath(s), H total half bath(s), Q total 3/4 bath(s)."
    nar = lambda pat: (re.search(pat, joined) or [None, ""])[1] if re.search(pat, joined) else ""

    def ng(pat):
        m = re.search(pat, joined)
        return m.group(1).strip() if m else ""

    return {
        "parcel_id": _after(cells, "Parcel ID"),
        "old_parcel_id": _after(cells, "Old Parcel ID"),
        "address": re.sub(r"\s+", " ", _after(cells, "Location")).strip(),
        "owner": _after(cells, "Owner"),
        "mailing_address": _after(cells, "Address"),
        "zoning": _after(cells, "Zoning"),
        "sale_date": _after(cells, "Sale Date"),
        "book_page": _after(cells, "Legal Reference"),
        "sale_price": _to_int(ng(r"Sale\s*Price\s*[:|]?\s*([\d,]+)")) ,
        "assessment_fy": _to_int(_after(cells, "Year")),
        "building_value": _to_int(ng(r"Building\s*Value\s*([\d,]+)")),
        "extra_features_value": _to_int(ng(r"Xtra Features\s*Value\s*([\d,]+)")),
        "land_area_acres": _to_float(ng(r"Land\s*Area\s*([\d.]+)\s*acres")),
        "land_value": _to_int(ng(r"Land\s*Value\s*([\d,]+)")),
        "total_value": _to_int(ng(r"Total\s*Value\s*([\d,]+)")),
        "land_use": ng(r"classified as\s*([A-Z0-9 ]+?)\s*with a"),
        "style": ng(r"with a\(n\)\s*([A-Z0-9 ]+?)\s*style building"),
        "year_built": _to_int(ng(r"built about\s*(\d{4})")),
        "units": _to_int(ng(r"with\s*(\d+)\s*unit")),
        "rooms": _to_int(ng(r"(\d+)\s*total room")),
        "bedrooms": _to_int(ng(r"(\d+)\s*total bedroom")),
        "bathrooms": _to_int(ng(r"(\d+)\s*total bath")),
        "half_baths": _to_int(ng(r"(\d+)\s*total half bath")),
        "card_count": card_count,
    }
```

Note for implementer: the `sale_price`, `building_value`, etc. regexes target
the value that follows the label text in the flattened narrative/label stream.
Run the test (next step); if any field misses, print `_cells(html)` for the
fixture and adjust that field's anchor. Do not loosen a regex so far it matches
the wrong number — verify against the known fixture values.

- [ ] **Step 5: Run the test, verify it passes**

Run: `cd /Users/agbaber/marblehead/.worktrees/patriot-parcels && python3 -m pytest data/test_patriot_parse.py -q`
Expected: PASS (4 tests). Iterate on `parse_summary` anchors until green.

- [ ] **Step 6: Commit**

```bash
git add scripts/patriot_parse.py data/test_patriot_parse.py data/fixtures/patriot_summary_sample.html
git commit -m "Add Patriot Properties summary parser with unit test (scrubbed fixture)"
```

---

## Task 3: Stage 1 — session-stateful fetcher with raw cache

**Files:**
- Create: `scripts/fetch_patriot_parcels.py`

- [ ] **Step 1: Implement the fetcher**

Key mechanics (verified live):
- Base `https://marblehead.patriotproperties.com`.
- Prime session: `POST /SearchResults.asp` body
  `SearchSubmitted=yes&SearchTotalValue=2000000&SearchTotalValueThru=2010000`.
- Per account N: `GET /Summary.asp?AccountNumber=N` (Referer `/SearchResults.asp`),
  then `GET /summary-bottom.asp` (Referer `/Summary.asp?AccountNumber=N`).
- Cache jar in `/tmp`; use one `curl` jar reused with `-c -b`.
- A "no data" parcel returns short HTML containing
  `Either no search has been executed` (session) — re-prime + retry once; if it
  still says that AND we just primed, the account is genuinely empty/gap.
- A real parcel's HTML contains `Parcel ID`.

```python
#!/usr/bin/env python3
"""Stage 1: fetch every Marblehead parcel's raw detail HTML from Patriot
Properties WebPro and cache it under data/patriot_raw/ (gitignored).

Usage:
  python3 scripts/fetch_patriot_parcels.py            # full sweep, resumable
  python3 scripts/fetch_patriot_parcels.py --max 25   # dry run over 1..25
Outputs:
  data/patriot_raw/<N>.html      raw summary-bottom.asp per real parcel
  data/patriot_raw/_manifest.json  {account: "ok"|"gap"|"error"}
Source: https://marblehead.patriotproperties.com  (WebPro 4.4)
"""
import argparse
import json
import os
import subprocess
import sys
import time

BASE = "https://marblehead.patriotproperties.com"
RAW_DIR = "data/patriot_raw"
MANIFEST = os.path.join(RAW_DIR, "_manifest.json")
JAR = "/tmp/patriot_jar.txt"
UA = "marbleheaddata.org civic-data parcel ingest (contact agbaber@gmail.com)"
DELAY = 0.4          # seconds between parcels; be polite
GAP_STOP = 60        # consecutive gaps above known max -> stop ceiling probe


def curl(args, data=None):
    cmd = ["curl", "-s", "-A", UA, "-c", JAR, "-b", JAR]
    if data is not None:
        cmd += ["-X", "POST", "--data", data]
    cmd += args
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def prime():
    curl([f"{BASE}/SearchResults.asp"],
         data="SearchSubmitted=yes&SearchTotalValue=2000000&SearchTotalValueThru=2010000")


def fetch_one(n):
    curl(["-e", f"{BASE}/SearchResults.asp", f"{BASE}/Summary.asp?AccountNumber={n}"])
    html = curl(["-e", f"{BASE}/Summary.asp?AccountNumber={n}", f"{BASE}/summary-bottom.asp"])
    if "Either no search has been executed" in html:
        prime()
        curl(["-e", f"{BASE}/SearchResults.asp", f"{BASE}/Summary.asp?AccountNumber={n}"])
        html = curl(["-e", f"{BASE}/Summary.asp?AccountNumber={n}", f"{BASE}/summary-bottom.asp"])
    return html


def classify(html):
    if "Parcel ID" in html:
        return "ok"
    if "Either no search has been executed" in html:
        return "error"   # session problem, not a clean gap
    return "gap"


def load_manifest():
    if os.path.exists(MANIFEST):
        return json.load(open(MANIFEST))
    return {}


def save_manifest(m):
    json.dump(m, open(MANIFEST, "w"), indent=0, sort_keys=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=0, help="upper account bound (0 = auto)")
    ap.add_argument("--start", type=int, default=1)
    args = ap.parse_args()

    os.makedirs(RAW_DIR, exist_ok=True)
    manifest = load_manifest()
    prime()

    n = args.start
    ceiling = args.max
    consecutive_gaps = 0
    while True:
        if ceiling and n > ceiling:
            break
        path = os.path.join(RAW_DIR, f"{n}.html")
        if str(n) in manifest and (manifest[str(n)] != "ok" or os.path.exists(path)):
            # already processed; resume
            if manifest[str(n)] == "ok":
                consecutive_gaps = 0
            else:
                consecutive_gaps += 1
            n += 1
            if not ceiling and consecutive_gaps >= GAP_STOP:
                break
            continue

        html = fetch_one(n)
        status = classify(html)
        if status == "ok":
            open(path, "w", encoding="latin-1", errors="replace").write(html)
            consecutive_gaps = 0
        else:
            consecutive_gaps += 1
        manifest[str(n)] = status

        if n % 50 == 0:
            save_manifest(manifest)
            print(f"... account {n}: {status} (gaps run {consecutive_gaps})", file=sys.stderr)

        if not ceiling and consecutive_gaps >= GAP_STOP:
            print(f"Stopping: {GAP_STOP} consecutive non-parcels after {n}", file=sys.stderr)
            break
        n += 1
        time.sleep(DELAY)

    save_manifest(manifest)
    ok = sum(1 for v in manifest.values() if v == "ok")
    print(f"Done. {ok} parcels cached, manifest has {len(manifest)} accounts.", file=sys.stderr)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Dry run over a small range, verify cache + manifest**

Run: `cd /Users/agbaber/marblehead/.worktrees/patriot-parcels && python3 scripts/fetch_patriot_parcels.py --max 25`
Expected: stderr summary "N parcels cached"; `data/patriot_raw/` has several
`<N>.html` files and `_manifest.json`. Spot check: `grep -l "Parcel ID" data/patriot_raw/*.html | head`.

- [ ] **Step 3: Commit the script (cache stays ignored)**

```bash
git add scripts/fetch_patriot_parcels.py
git commit -m "Add Stage 1 Patriot Properties fetcher (session-stateful, resumable, polite)"
```

---

## Task 4: Stage 2 — build the two CSVs

**Files:**
- Create: `scripts/build_patriot_parcels.py`

- [ ] **Step 1: Implement the build**

```python
#!/usr/bin/env python3
"""Stage 2: parse data/patriot_raw/*.html into two CSVs.

  data/parcels.csv            committed, de-identified (no owner/mailing)
  data/patriot_raw/parcels_full.csv   gitignored, includes owner + mailing

Usage: python3 scripts/build_patriot_parcels.py
"""
import csv
import glob
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from patriot_parse import parse_summary

RAW_DIR = "data/patriot_raw"
PUBLIC_OUT = "data/parcels.csv"
FULL_OUT = os.path.join(RAW_DIR, "parcels_full.csv")

PUBLIC_COLS = [
    "account_number", "parcel_id", "address", "zoning", "land_use", "style",
    "year_built", "land_area_acres", "units", "rooms", "bedrooms", "bathrooms",
    "half_baths", "building_value", "extra_features_value", "land_value",
    "total_value", "assessment_fy", "card_count", "sale_date", "sale_price",
    "book_page",
]
FULL_COLS = PUBLIC_COLS + ["owner", "mailing_address"]


def main():
    files = sorted(glob.glob(os.path.join(RAW_DIR, "*.html")),
                   key=lambda p: int(pathlib.Path(p).stem))
    rows = []
    errors = []
    for f in files:
        acct = int(pathlib.Path(f).stem)
        try:
            rec = parse_summary(open(f, encoding="latin-1").read())
            rec["account_number"] = acct
            rows.append(rec)
        except Exception as e:  # noqa: BLE001 - record, never silently drop
            errors.append((acct, repr(e)))

    rows.sort(key=lambda r: r["account_number"])

    with open(PUBLIC_OUT, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=PUBLIC_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    with open(FULL_OUT, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FULL_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} parcels -> {PUBLIC_OUT} and {FULL_OUT}", file=sys.stderr)
    if errors:
        print(f"{len(errors)} parse errors:", file=sys.stderr)
        for acct, err in errors[:20]:
            print(f"  account {acct}: {err}", file=sys.stderr)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run against the dry-run cache, sanity check the CSV**

Run: `cd /Users/agbaber/marblehead/.worktrees/patriot-parcels && python3 scripts/build_patriot_parcels.py && head -3 data/parcels.csv`
Expected: header + rows; `total_value` numeric; `owner` column ABSENT from
`data/parcels.csv` but PRESENT in `data/patriot_raw/parcels_full.csv`
(`head -1 data/patriot_raw/parcels_full.csv | grep owner`).

- [ ] **Step 3: Commit the script**

```bash
git add scripts/build_patriot_parcels.py
git commit -m "Add Stage 2 build: parse parcel cache into de-identified + full CSVs"
```

---

## Task 5: Full sweep + publish dataset

This is the long-running step (~8,500 parcels x 2 requests x 0.4s delay ≈ 1–2h).

- [ ] **Step 1: Run the full fetch (background)**

Run: `cd /Users/agbaber/marblehead/.worktrees/patriot-parcels && python3 scripts/fetch_patriot_parcels.py` (run in background; it is resumable, so an interrupt is safe to re-run).
Expected final stderr: "Done. ~8000+ parcels cached".

- [ ] **Step 2: Build the published CSV**

Run: `python3 scripts/build_patriot_parcels.py`
Expected: "Wrote N parcels"; N within a few % of the cached "ok" count.

- [ ] **Step 3: Validate totals against a known anchor**

Confirm the FY2026 town-wide total assessed value is in a sane range and that
median residential `total_value` is plausible for Marblehead (roughly $1M+).
Spot-check 2–3 known addresses against the live site.

- [ ] **Step 4: Commit the dataset**

```bash
git add data/parcels.csv
git commit -m "Ingest FY2026 Marblehead parcel assessments from Patriot Properties (de-identified)"
```

---

## Task 6: Provenance docs

**Files:**
- Modify: `data/DATA_CATALOG.md`
- Modify: `data/SOURCE_LOOKUP.md`

- [ ] **Step 1: Add the DATA_CATALOG entry**

Add a section near the other property/tax entries:

```markdown
### Parcel Assessments (data/parcels.csv, ~8,xxx parcels, FY2026)
- **What it is:** Parcel-level FY2026 assessed values and property
  characteristics for every Marblehead parcel.
- **Source:** Town of Marblehead Assessor online database (Patriot Properties
  WebPro 4.4), https://marblehead.patriotproperties.com. Scraped <DATE>.
- **Columns:** account_number, parcel_id, address, zoning, land_use, style,
  year_built, land_area_acres, units, rooms, bedrooms, bathrooms, half_baths,
  building_value, extra_features_value, land_value, total_value, assessment_fy,
  card_count, sale_date, sale_price, book_page.
- **De-identification:** owner names and mailing addresses are deliberately
  excluded from the committed CSV (they live only in the gitignored
  data/patriot_raw/parcels_full.csv). The data is public record but the bulk
  file is kept out of the public repo.
- **Refresh:** python3 scripts/fetch_patriot_parcels.py && python3 scripts/build_patriot_parcels.py
```

- [ ] **Step 2: Add the SOURCE_LOOKUP entry**

```markdown
## Parcel Assessments (Patriot Properties WebPro)
- Source: https://marblehead.patriotproperties.com (WebPro 4.4), the Assessor's
  official online database.
- Scripted flow: scripts/fetch_patriot_parcels.py caches each parcel's raw
  summary-bottom.asp HTML to data/patriot_raw/ (gitignored); the app keys
  parcels by AccountNumber and stores the current parcel in server-side session,
  so the fetcher reuses one cookie jar sequentially (POST SearchResults.asp to
  prime, GET Summary.asp?AccountNumber=N, GET summary-bottom.asp).
- scripts/build_patriot_parcels.py parses the cache into data/parcels.csv
  (committed, de-identified) and data/patriot_raw/parcels_full.csv (gitignored,
  with owner + mailing).
```

- [ ] **Step 3: Commit**

```bash
git add data/DATA_CATALOG.md data/SOURCE_LOOKUP.md
git commit -m "Document Patriot Properties parcel dataset (catalog + source lookup)"
```

---

## Self-review checklist (completed by plan author)

- **Spec coverage:** source mechanics (Task 3), enumeration + ceiling (Task 3),
  field schema (Task 2), de-identified vs full split (Task 4), gitignore
  (Task 1), provenance (Task 6), parser test (Task 2), dry run (Task 3 Step 2),
  full sweep (Task 5). All spec sections map to a task.
- **Placeholders:** `<DATE>` in Task 6 is filled at run time from the scrape
  date; `~8,xxx` is the real count after Task 5. No code placeholders.
- **Type consistency:** `parse_summary` returns the exact keys consumed by
  `PUBLIC_COLS`/`FULL_COLS` in Task 4 and asserted in Task 2.
