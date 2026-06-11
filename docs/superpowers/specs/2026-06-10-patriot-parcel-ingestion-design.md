# Patriot Properties parcel ingestion — design

**Date:** 2026-06-10
**Status:** Implemented, but with a source change (see below).

> **Source pivot (2026-06-10).** The WebPro scraping approach described below
> got the IP rate-limited (403) after ~7,000 requests, covering only ~2% of
> parcels, and is hard on the town's small server. The shipped implementation
> instead pulls the same data from **MassGIS Standardized Assessors' Parcels**
> (the "Massachusetts Property Tax Parcels" ArcGIS feature service, `TOWN_ID=168`)
> in ~5 paged requests: `scripts/fetch_massgis_parcels.py` +
> `scripts/massgis_parcels.py` -> `data/parcels.csv` (de-identified) and the
> gitignored full CSV. The two-stage / de-identification design and the
> committed-vs-gitignored split below all still hold; only the fetch mechanism
> and the FY vintage (FY2025 from MassGIS vs live FY2026 on WebPro) changed.
> The WebPro mechanics are retained below as the original research record.

## Goal

Ingest the full Marblehead parcel-level assessment dataset from the town's
official online assessor database (Patriot Properties WebPro) into a
committed, de-identified CSV in `data/`, so the site has a real distribution
of FY2026 assessed values and parcel characteristics to power home-value
calculators and assessment charts. Every value traces to the primary source
(the assessor database itself).

## Source

`https://marblehead.patriotproperties.com` — Patriot Properties **WebPro 4.4**,
a classic-ASP frameset application. It is the Marblehead Assessor's Office
official online property database (the same data the public can search one
parcel at a time).

### How a single parcel is read

The application stores the "currently viewed parcel" in **server-side session
state**, not in the URL of the page that renders the data. Reading one parcel
therefore requires a cookie jar and three steps:

1. Prime the session with any search:
   `POST SearchResults.asp` with body
   `SearchSubmitted=yes&SearchTotalValue=<lo>&SearchTotalValueThru=<hi>`.
2. Select the parcel (writes `AccountNumber` into the session):
   `GET Summary.asp?AccountNumber=<N>` (send a `Referer` of `SearchResults.asp`).
3. Read the detail HTML:
   `GET summary-bottom.asp` (no parameters; reads the parcel from session).

Consequence: **fetching must be sequential per cookie jar.** Parallel requests
sharing one jar would clobber each other's current-parcel session state. A
descriptive `User-Agent` and an inter-request delay are required — this is the
town's public server.

### Parcel enumeration

Parcels are keyed by `AccountNumber`, an integer running from 1 to roughly
8,500 (auto-detected at runtime, not hard-coded). Some account numbers are
gaps (exempt/retired records); these are logged and skipped, not treated as
errors. Sequential enumeration is the primary strategy because it is naturally
complete and trivially resumable. Walking the 665-entry street-name dropdown
(`SearchStreetName`) remains available as an independent gap-audit cross-check
but is not the primary path.

### Fields available per parcel (`summary-bottom.asp`)

- Location / street address
- Parcel ID (map-block-lot, e.g. `112 14 0`) and Old Parcel ID
- Owner name(s) and current mailing address (city/state/zip) — **PII, see below**
- Zoning
- Most recent sale: date, legal reference (book-page), price, grantor
- Assessment (Card 1): assessment year (FY), building value, extra-features
  value, land area (acres), land value, total value
- Narrative-derived characteristics: land-use class (e.g. `ONE FAM`), building
  style, year built, exterior, roof cover, units, total rooms, bedrooms,
  bathrooms, half baths, three-quarter baths
- `Card N of M` — multi-card parcels (condos / multi-building)

## Architecture

Two-stage pipeline, mirroring the checkbook `fetch -> build` split in which
the raw PII-bearing data never enters git.

### Stage 1 — `scripts/fetch_patriot_parcels.py` (fetch + cache raw)

- Opens one `requests.Session` cookie jar; primes it with a throwaway search.
- Auto-detects the upper `AccountNumber` bound (probe upward until a run of
  consecutive misses).
- For each account 1..ceiling: performs the 3-step read and writes the raw
  `summary-bottom.asp` HTML to `data/patriot_raw/<N>.html`.
- **Resumable:** skips any account whose raw file already exists, so re-runs
  do not re-hit the town's server.
- **Polite:** sequential, fixed inter-request delay, retry-with-backoff on
  transient failures, descriptive `User-Agent` identifying the project.
- Gaps / "no data" responses are recorded to a manifest
  (`data/patriot_raw/_manifest.json`: account -> status) and skipped.
- `data/patriot_raw/` is **gitignored**. Raw HTML contains owner names and
  mailing addresses and must never be committed.

### Stage 2 — `scripts/build_patriot_parcels.py` (parse -> two CSVs)

Parses each cached HTML file into a structured record and writes two outputs:

**`data/parcels.csv` — committed, de-identified.** Columns:

```
account_number, parcel_id, address, zoning, land_use, style, year_built,
land_area_acres, units, rooms, bedrooms, bathrooms, half_baths,
building_value, extra_features_value, land_value, total_value,
assessment_fy, card_count, sale_date, sale_price, book_page
```

No `owner`, no `mailing_address`. This is the published dataset the site reads.

**`data/patriot_raw/parcels_full.csv` — gitignored.** The same rows **plus**
`owner` and `mailing_address`, for local verification only. This is the
"stored but not exportable" copy: present on the operator's disk, absent from
the public repo. Because marbleheaddata.org is a public static site with no
backend, committing PII *is* publishing it; keeping the full file gitignored
is the only honest implementation of "not easily exportable."

### Data modeling notes

- **One row per parcel.** `card_count` records how many cards a parcel has;
  `total_value`, `land_value`, and `building_value` are parcel-level figures
  read from Card 1.
- **Assessment year is captured, not assumed** (`assessment_fy`); the current
  source serves FY2026 values.
- Numeric fields are parsed to plain integers/floats (commas stripped); empty
  or "--" source values become blank, not zero.

## Provenance

Per the every-number-traces-to-a-source rule:

- Add a `data/DATA_CATALOG.md` entry for `data/parcels.csv`: what it is, source
  (`marblehead.patriotproperties.com`), scrape date, assessment FY, row count,
  and the de-identification note (owner/mailing deliberately excluded).
- Add a `data/SOURCE_LOOKUP.md` entry describing the scripted fetch/build flow
  and the gitignored raw cache, so a future operator can refresh it.

## Error handling

- Network/transient HTTP errors: retry with backoff (bounded), then record the
  account as `error` in the manifest and continue — one bad parcel never aborts
  the sweep.
- Session expiry mid-sweep ("Either no search has been executed..."): detect
  the sentinel string and re-prime the session, then retry the parcel.
- Parse failures in Stage 2: record the account and a reason to a build log;
  emit the partial row with blanks rather than dropping the parcel silently
  (no silent failures).
- Gap accounts: expected and normal; logged at debug level, counted in the
  run summary.

## Testing

- **Parser unit test** against a committed fixture HTML file under
  `tests/fixtures/` derived from a real `summary-bottom.asp` response but with
  the owner/mailing fields scrubbed to placeholder text, so the fixture itself
  carries no real PII. Asserts every column extracts the expected value,
  including a multi-card fixture and a gap/"no data" fixture.
- **Stage-1 dry run** over a small account range (e.g. 1..25) to confirm the
  session-prime / fetch / cache loop and the resumability skip before the full
  ~8,500 sweep.
- Existing repo smoke tests remain green (the new CSV is data only; no page
  changes in this work).

## Scope boundaries (YAGNI)

- **In scope:** the two scripts, the committed de-identified CSV, the gitignored
  full CSV + raw cache, `.gitignore` entry, catalog/source-lookup entries, and
  parser tests.
- **Out of scope (separate future work):** any site page, chart, or calculator
  that *consumes* `data/parcels.csv`; cross-year history; geometry/GIS joins.
  This spec delivers the dataset only.
