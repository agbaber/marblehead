# Minutes corpus pipeline

Builds and maintains a local corpus of Marblehead meeting minutes PDFs and
extracted text files, starting from FY19 (July 2018).

The pipeline runs in four stages: discover, download, extract, verify.
Each stage is idempotent: re-running it skips already-completed rows.

## What the pipeline produces

### Manifest: `data/minutes_manifest.csv`

One row per meeting. Columns:

| Column | Description |
|---|---|
| `body` | `select_board`, `school_committee`, or `fincom` |
| `meeting_date` | ISO date of the meeting (`YYYY-MM-DD`) |
| `source_url` | Canonical URL of the PDF on the town or school website |
| `local_pdf` | Relative path to cached PDF (`data/minutes/{body}/{date}.pdf`) |
| `local_txt` | Relative path to extracted text file (`.txt`, same stem) |
| `extraction_method` | `pdftotext` or `ocr` |
| `text_quality` | `clean`, `degraded`, or `unreadable` |
| `status` | `downloaded`, `missing`, `restricted`, or `not_published` |
| `notes` | Free-text, used to explain `missing` or `not_published` rows |

The manifest CSV is committed. PDFs are gitignored (see below). Text files
are committed alongside the manifest.

### File layout: `data/minutes/{body}/`

```
data/minutes/
  select_board/
    2018-07-02.pdf      (gitignored)
    2018-07-02.txt      (committed)
    2018-07-18.pdf
    2018-07-18.txt
    ...
  school_committee/
    2018-08-01.pdf
    2018-08-01.txt
    ...
  fincom/
    (empty as of 2026-04-16 -- see Known coverage gaps)
```

## End-to-end run

Run from the repo root. All four commands are idempotent.

### 1. Discover

```bash
node scripts/minutes/discover_select_board.mjs
node scripts/minutes/discover_fincom.mjs
node scripts/minutes/discover_school_committee.mjs
```

Each scraper appends new rows to `data/minutes_manifest.csv` with
`status: pending`. Already-known rows are updated in place (not duplicated).

School Committee discovery uses Playwright (headless Chromium) to navigate
Finalsite archive pages. Select Board and FinCom discovery uses plain `fetch`
against the WordPress category pages on marbleheadma.gov.

### 2. Download

```bash
node scripts/minutes/download_minutes.mjs
```

Downloads all `pending` rows (concurrency 4, 60-second timeout). Skips rows
whose local PDF already exists on disk. Updates `status` to `downloaded` or
`missing` and writes `local_pdf` into the manifest.

### 3. Extract text

```bash
node scripts/minutes/extract_text.mjs
```

For each `downloaded` row without a `local_txt`, runs `pdftotext -layout`.
Falls back to `pdftoppm` + `tesseract` OCR for PDFs that yield fewer than
200 characters of direct text. Writes `.txt` next to the `.pdf` and records
`extraction_method` and `text_quality`.

### 4. Verify

```bash
node scripts/minutes/verify_corpus.mjs
```

Asserts six invariants (see Phase 1 exit gate below). Prints a coverage
summary and exits 0 if all pass.

## Adding new meetings

After a new Select Board or School Committee meeting is posted online,
re-run the discovery scraper for that body, then download and extract:

```bash
node scripts/minutes/discover_select_board.mjs
node scripts/minutes/download_minutes.mjs
node scripts/minutes/extract_text.mjs
node scripts/minutes/verify_corpus.mjs
```

The discovery scrapers are idempotent. Existing rows are not changed unless
the URL for a given date has been updated on the source site.

## Adding a new body

1. Copy one of the existing discovery scrapers (e.g. `discover_select_board.mjs`).
2. Set `MANIFEST_PATH` to `resolve('data/minutes_manifest.csv')`.
3. Set the correct base URL and update the PDF filename regex for the new body.
4. Set `body` to a short snake_case identifier (e.g. `planning_board`).
5. Add the new identifier to `VALID_BODIES` in `verify_corpus.mjs`.
6. Run discovery, then download and extract as above.

The manifest helper in `scripts/minutes/lib/manifest.mjs` handles all CSV
read/write and upsert logic. New scrapers should call `appendOrUpdate` from
that module rather than writing the CSV directly.

## Why PDFs are gitignored

PDF files can be 50 MB or more for a full corpus. Adding them to git would
bloat the repository and make cloning slow. The `.gitignore` rule is:

```
data/minutes/**/*.pdf
```

The `source_url` column in the manifest is the canonical citation for each
PDF. Anyone who needs a local copy can re-run the download script against
the live URLs. This follows the same convention as the `source-archive-v1`
release tag used elsewhere in this repo.

## Tests

```bash
npm run test:minutes
```

Runs the Node built-in test runner against `scripts/minutes/lib/*.test.mjs`.
Currently covers the manifest helper (5 assertions: read empty, write/read
round-trip, appendOrUpdate new row, appendOrUpdate update existing, column
order preservation).

## Tooling dependencies

Install via Homebrew and npm:

```bash
# PDF text extraction
brew install poppler     # provides pdftotext and pdftoppm
brew install tesseract   # OCR fallback

# Node packages (already in package.json)
npm install              # installs csv-parse, csv-stringify, p-limit, playwright
npx playwright install chromium   # browser for School Committee scraper
```

Node 20 or later is required.

## Phase 1 exit gate

`verify_corpus.mjs` asserts six invariants. All must pass before Phase 1
is considered complete:

1. **Required fields non-empty:** `body`, `meeting_date`, `source_url`,
   and `status` are present on every row.
2. **Downloaded rows have files on disk:** rows with `status: downloaded`
   must have both `local_pdf` and `local_txt` present at the recorded paths.
3. **Missing rows have notes:** rows with `status: missing` must have a
   non-empty `notes` field explaining the failure.
4. **No duplicate keys:** each `(body, meeting_date)` pair appears at most
   once.
5. **Dates in range:** all `meeting_date` values are on or after
   `2018-07-01` (start of FY19).
6. **Whitelist on body and status:** `body` must be one of
   `select_board`, `school_committee`, `fincom`; `status` must be one of
   `downloaded`, `missing`, `restricted`, `not_published`.

Current corpus totals (as of 2026-04-16):

| Body | Downloaded |
|---|---|
| select_board | 234 |
| school_committee | 203 |
| fincom | 0 (site gap; see below) |

## Known coverage gaps

### Finance Committee

FinCom does not publish meeting minutes on the town website as of
2026-04-16. The `marbleheadma.gov/category/finance-committee/` archive
contains only agendas and annual reports; no minutes PDFs are posted.

The `discover_fincom.mjs` scraper is retained in the pipeline so it will
automatically pick up any minutes that are published in the future.

A draft email requesting access to historical FinCom minutes is at:

```
docs/superpowers/notes/2026-04-16-town-clerk-fincom-minutes-email.md
```
