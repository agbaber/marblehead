# Historical Minutes Catalog: Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete corpus of Select Board, Finance Committee, and School Committee meeting minutes (FY19 to present), with a manifest that records every meeting's source URL, local file paths, extraction status, and any gaps.

**Architecture:** Three discovery scrapers (one per body, since each archive has a different structure) feed a unified manifest CSV. A download script reads the manifest and pulls PDFs to a gitignored local cache. A text-extraction script runs `pdftotext` first and falls back to `pdftoppm` + `tesseract` OCR for scanned PDFs. A verification script asserts manifest invariants and gates Phase 2.

**Tech Stack:** Node.js (matches existing repo pattern; Playwright already used in PR #543), Playwright for sites that require JS, plain `fetch` for static WordPress category pages, system tools `pdftotext` / `pdftoppm` / `tesseract` (already installed via Homebrew). Tests use Node's built-in `node --test` runner (no new test framework dependency).

**Spec reference:** `docs/superpowers/specs/2026-04-16-historical-minutes-catalog-design.md` (sections 3-5, 8, 10).

**Scope boundary:** This plan covers Phase 1 only (corpus build). Phase 2 (sample extraction & vet) and Phase 3 (full sweep + reader-facing page) get their own plans after Phase 1's exit gate.

**Storage convention.** PDF files are gitignored under `data/minutes/{body}/*.pdf` (the `data/` source-archive precedent: large primary docs live on GitHub release tags, not in the repo). Extracted text files (`*.txt`) and the manifest CSV are committed. The manifest's `source_url` is the canonical citation; `local_pdf` is a local cache path that any future session can re-populate by re-running the download script.

---

## File structure

| Path | Responsibility | Created in task |
|---|---|---|
| `scripts/minutes/lib/manifest.mjs` | Pure functions: read/write CSV, append/update row | Task 2 |
| `scripts/minutes/lib/manifest.test.mjs` | Unit tests for manifest helpers | Task 2 |
| `scripts/minutes/discover_select_board.mjs` | Scrape SB archive, emit manifest rows | Task 3 |
| `scripts/minutes/discover_fincom.mjs` | Scrape FinCom archive | Task 4 |
| `scripts/minutes/discover_school_committee.mjs` | Scrape SC archive (different host: marbleheadschools.org) | Task 5 |
| `scripts/minutes/download_minutes.mjs` | Read manifest, download PDFs, update status | Task 6 |
| `scripts/minutes/extract_text.mjs` | pdftotext primary, OCR fallback, update method/quality | Task 7 |
| `scripts/minutes/verify_corpus.mjs` | Assert manifest invariants, exit non-zero on failure | Task 8 |
| `scripts/minutes/README.md` | How to run the pipeline end-to-end | Task 9 |
| `data/minutes_manifest.csv` | The manifest itself (committed) | Tasks 3-7 |
| `data/minutes/{body}/{date}.pdf` | Local PDF cache (gitignored) | Task 6 |
| `data/minutes/{body}/{date}.txt` | Extracted text (committed) | Task 7 |
| `.gitignore` | Add `data/minutes/**/*.pdf` | Task 1 |
| `package.json` | Add Node deps (Playwright, csv-parse, csv-stringify, p-limit) | Task 1 |

---

### Task 1: Project setup

**Goal:** Stand up the `scripts/minutes/` directory, install Node dependencies, verify system tools, gitignore PDF cache.

**Files:**
- Create: `scripts/minutes/` (directory)
- Modify: `package.json` (root) to add deps
- Modify: `.gitignore` (root) to ignore PDF cache

- [ ] **Step 1: Confirm system tools are installed**

```bash
which pdftotext && which pdftoppm && which tesseract
```

Expected: three absolute paths (e.g. `/opt/homebrew/bin/pdftotext`). If any missing: `brew install poppler tesseract`.

- [ ] **Step 2: Check whether root package.json exists**

```bash
test -f package.json && cat package.json | head -30 || echo "no package.json"
```

Expected: either an existing package.json or "no package.json".

- [ ] **Step 3: Create or update package.json**

If no `package.json` exists at the repo root, create one:

```json
{
  "name": "marblehead-scripts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test:minutes": "node --test scripts/minutes/lib/*.test.mjs"
  },
  "dependencies": {
    "playwright": "^1.49.0",
    "csv-parse": "^5.6.0",
    "csv-stringify": "^6.5.2",
    "p-limit": "^6.2.0"
  }
}
```

If `package.json` exists, run:

```bash
npm install --save playwright csv-parse csv-stringify p-limit
```

And add the test script if not present.

- [ ] **Step 4: Install dependencies and Playwright browsers**

```bash
npm install
npx playwright install chromium
```

Expected: `node_modules/` populated, chromium downloaded.

- [ ] **Step 5: Add gitignore entries**

Append to `.gitignore`:

```
# Local PDF cache for minutes corpus (committed text files only)
data/minutes/**/*.pdf
```

- [ ] **Step 6: Create scripts directory and placeholder README**

```bash
mkdir -p scripts/minutes/lib
mkdir -p data/minutes/select_board data/minutes/fincom data/minutes/school_committee
```

- [ ] **Step 7: Verify gitignore works**

```bash
touch data/minutes/select_board/test.pdf
git check-ignore data/minutes/select_board/test.pdf
rm data/minutes/select_board/test.pdf
```

Expected: `git check-ignore` prints the file path (means it IS ignored, exit 0).

- [ ] **Step 8: Commit setup**

```bash
git add package.json package-lock.json .gitignore scripts/
git commit -m "Set up minutes corpus pipeline directory and deps"
```

---

### Task 2: Manifest helper module (TDD)

**Goal:** Pure functions for reading/writing the manifest CSV with append-or-update semantics. All other scripts use this module rather than re-parsing CSV.

**Files:**
- Create: `scripts/minutes/lib/manifest.mjs`
- Create: `scripts/minutes/lib/manifest.test.mjs`

The manifest schema (per spec section 8):

```
body,meeting_date,source_url,local_pdf,local_txt,extraction_method,text_quality,status,notes
```

- [ ] **Step 1: Write failing test for readManifest of empty file**

Create `scripts/minutes/lib/manifest.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readManifest, writeManifest, appendOrUpdate, MANIFEST_COLUMNS } from './manifest.mjs';

function tempPath() {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-test-'));
  return { path: join(dir, 'manifest.csv'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('readManifest returns empty array when file is missing', () => {
  const { path, cleanup } = tempPath();
  try {
    assert.deepEqual(readManifest(path), []);
  } finally {
    cleanup();
  }
});

test('writeManifest then readManifest round-trips a row', () => {
  const { path, cleanup } = tempPath();
  try {
    const row = {
      body: 'fincom',
      meeting_date: '2024-02-13',
      source_url: 'https://example.com/file.pdf',
      local_pdf: '',
      local_txt: '',
      extraction_method: 'none',
      text_quality: '',
      status: 'pending',
      notes: ''
    };
    writeManifest(path, [row]);
    assert.deepEqual(readManifest(path), [row]);
  } finally {
    cleanup();
  }
});

test('appendOrUpdate inserts a new row when no match', () => {
  const { path, cleanup } = tempPath();
  try {
    const row = { body: 'fincom', meeting_date: '2024-02-13', source_url: 'u', local_pdf: '', local_txt: '', extraction_method: 'none', text_quality: '', status: 'pending', notes: '' };
    appendOrUpdate(path, row);
    assert.equal(readManifest(path).length, 1);
  } finally {
    cleanup();
  }
});

test('appendOrUpdate updates existing row matched by (body, meeting_date)', () => {
  const { path, cleanup } = tempPath();
  try {
    const initial = { body: 'fincom', meeting_date: '2024-02-13', source_url: 'u', local_pdf: '', local_txt: '', extraction_method: 'none', text_quality: '', status: 'pending', notes: '' };
    appendOrUpdate(path, initial);
    appendOrUpdate(path, { ...initial, status: 'downloaded', local_pdf: 'data/minutes/fincom/2024-02-13.pdf' });
    const rows = readManifest(path);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'downloaded');
    assert.equal(rows[0].local_pdf, 'data/minutes/fincom/2024-02-13.pdf');
  } finally {
    cleanup();
  }
});

test('MANIFEST_COLUMNS matches spec', () => {
  assert.deepEqual(MANIFEST_COLUMNS, [
    'body', 'meeting_date', 'source_url', 'local_pdf', 'local_txt',
    'extraction_method', 'text_quality', 'status', 'notes'
  ]);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test scripts/minutes/lib/manifest.test.mjs
```

Expected: FAIL with "Cannot find module './manifest.mjs'" or similar.

- [ ] **Step 3: Implement manifest.mjs**

Create `scripts/minutes/lib/manifest.mjs`:

```js
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export const MANIFEST_COLUMNS = [
  'body', 'meeting_date', 'source_url', 'local_pdf', 'local_txt',
  'extraction_method', 'text_quality', 'status', 'notes'
];

export function readManifest(path) {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  if (!text.trim()) return [];
  return parse(text, { columns: true, skip_empty_lines: true });
}

export function writeManifest(path, rows) {
  const normalized = rows.map(row => {
    const out = {};
    for (const col of MANIFEST_COLUMNS) out[col] = row[col] ?? '';
    return out;
  });
  const csv = stringify(normalized, { header: true, columns: MANIFEST_COLUMNS });
  writeFileSync(path, csv);
}

export function appendOrUpdate(path, row) {
  const rows = readManifest(path);
  const idx = rows.findIndex(r => r.body === row.body && r.meeting_date === row.meeting_date);
  if (idx === -1) {
    rows.push(row);
  } else {
    rows[idx] = { ...rows[idx], ...row };
  }
  writeManifest(path, rows);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node --test scripts/minutes/lib/manifest.test.mjs
```

Expected: 5 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add scripts/minutes/lib/manifest.mjs scripts/minutes/lib/manifest.test.mjs
git commit -m "Add manifest CSV helpers with append-or-update semantics"
```

---

### Task 3: Discovery scraper for Select Board

**Goal:** Walk `https://marbleheadma.gov/category/select-board/`, extract every link to a Select Board *Minutes* PDF (filtering out Agendas), and emit one manifest row per discovered minutes file.

**Source archive structure (verified 2026-04-16):**
- URL: `https://marbleheadma.gov/category/select-board/`
- WordPress category page; year sections 2019-2026 visible (covers FY19+)
- File URL pattern: `https://marbleheadma.gov/wp-content/uploads/YYYY/MM/YYYY-MM-DD-Select-Board-Minutes.pdf`
- Filter: only links matching `/-Select-Board(-AMENDED)?-Minutes\.pdf$/i`
- AMENDED variants exist; treat AMENDED-Minutes as the canonical minutes file (overwrites un-amended for same date)

**Files:**
- Create: `scripts/minutes/discover_select_board.mjs`

- [ ] **Step 1: Manually fetch the page and inspect HTML structure**

```bash
curl -s 'https://marbleheadma.gov/category/select-board/' -o /tmp/sb.html
wc -l /tmp/sb.html
grep -oE 'href="[^"]*Select-Board[^"]*Minutes\.pdf"' /tmp/sb.html | head -10
```

Expected: ≥10 `href` matches for minutes PDFs. Note any pagination links (`/page/2/` etc.) in the page.

- [ ] **Step 2: Write the discovery script**

Create `scripts/minutes/discover_select_board.mjs`:

```js
#!/usr/bin/env node
// Discover Select Board minutes from marbleheadma.gov category archive.
// Walks paginated category pages, extracts minutes PDF URLs, appends to manifest.

import { appendOrUpdate } from './lib/manifest.mjs';
import { resolve } from 'node:path';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const BASE = 'https://marbleheadma.gov/category/select-board/';
const MINUTES_RE = /href="(https:\/\/marbleheadma\.gov\/wp-content\/uploads\/\d{4}\/\d{2}\/(\d{4}-\d{2}-\d{2})-Select-Board(?:-AMENDED)?-Minutes\.pdf)"/gi;
const PAGINATION_RE = /href="(https:\/\/marbleheadma\.gov\/category\/select-board\/page\/(\d+)\/)"/gi;
const FY19_START = '2018-07-01';

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'marblehead-data-research/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.text();
}

async function discoverPage(url, seen) {
  const html = await fetchPage(url);
  const found = [];
  for (const match of html.matchAll(MINUTES_RE)) {
    const sourceUrl = match[1];
    const date = match[2];
    if (date < FY19_START) continue;
    const key = `select_board:${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ source_url: sourceUrl, meeting_date: date });
  }
  const pagination = new Set();
  for (const match of html.matchAll(PAGINATION_RE)) {
    pagination.add(match[1]);
  }
  return { found, pagination };
}

async function main() {
  const seen = new Set();
  const queue = [BASE];
  const visited = new Set();
  const allFound = [];

  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    console.log(`Fetching ${url}`);
    const { found, pagination } = await discoverPage(url, seen);
    allFound.push(...found);
    for (const p of pagination) {
      if (!visited.has(p)) queue.push(p);
    }
  }

  console.log(`Discovered ${allFound.length} Select Board minutes (FY19+)`);

  for (const f of allFound) {
    appendOrUpdate(MANIFEST_PATH, {
      body: 'select_board',
      meeting_date: f.meeting_date,
      source_url: f.source_url,
      local_pdf: '',
      local_txt: '',
      extraction_method: 'none',
      text_quality: '',
      status: 'pending',
      notes: ''
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the discovery script**

```bash
node scripts/minutes/discover_select_board.mjs
```

Expected: console output `Discovered N Select Board minutes (FY19+)` where N ≥ 50 (Select Board meets twice monthly; FY19-FY26 = ~7 years × 24 ≈ 168 meetings, minus gaps).

- [ ] **Step 4: Sanity-check the manifest**

```bash
head -5 data/minutes_manifest.csv
wc -l data/minutes_manifest.csv
```

Expected: header + N rows. Every row has `body=select_board`, `status=pending`, non-empty `source_url` and `meeting_date`.

- [ ] **Step 5: Commit**

```bash
git add scripts/minutes/discover_select_board.mjs data/minutes_manifest.csv
git commit -m "Discover Select Board minutes FY19 to present"
```

---

### Task 4: Discovery scraper for Finance Committee

**Goal:** Same as Task 3, against `https://marbleheadma.gov/category/finance-committee/`.

**Source archive structure (verified 2026-04-16):**
- URL: `https://marbleheadma.gov/category/finance-committee/`
- WordPress category page; FY24, FY25, FY26 visible plus older years
- File URL pattern: `https://marbleheadma.gov/wp-content/uploads/YYYY/MM/YYYY-MM-DD-Finance-Committee-...pdf`
- Filter: links matching `/-Finance-Committee(-AMENDED)?-Minutes\.pdf$/i`
- Note: FinCom also publishes "Warrant Article Hearing" docs and annual reports; keep only minutes for the manifest. Annual reports are already in `data/*FinCom_Report.pdf` and out of scope here.

**Files:**
- Create: `scripts/minutes/discover_fincom.mjs`

- [ ] **Step 1: Manually inspect the FinCom page**

```bash
curl -s 'https://marbleheadma.gov/category/finance-committee/' -o /tmp/fc.html
grep -oE 'href="[^"]*Finance-Committee[^"]*Minutes\.pdf"' /tmp/fc.html | head -10
```

Expected: ≥5 matches. Note pagination if present.

- [ ] **Step 2: Implement discover_fincom.mjs**

Create `scripts/minutes/discover_fincom.mjs` with the same structure as Task 3, with these substitutions:

```js
const BASE = 'https://marbleheadma.gov/category/finance-committee/';
const MINUTES_RE = /href="(https:\/\/marbleheadma\.gov\/wp-content\/uploads\/\d{4}\/\d{2}\/(\d{4}-\d{2}-\d{2})-Finance-Committee(?:-[A-Za-z]+)*?(?:-AMENDED)?-Minutes\.pdf)"/gi;
const PAGINATION_RE = /href="(https:\/\/marbleheadma\.gov\/category\/finance-committee\/page\/(\d+)\/)"/gi;
```

And in the manifest write:

```js
appendOrUpdate(MANIFEST_PATH, {
  body: 'fincom',
  meeting_date: f.meeting_date,
  // ...rest identical to Task 3
});
```

Full script body: copy `discover_select_board.mjs`, replace `select_board` with `fincom`, `Select-Board` with `Finance-Committee`, and use the regex constants above.

- [ ] **Step 3: Run discovery**

```bash
node scripts/minutes/discover_fincom.mjs
```

Expected: `Discovered N FinCom minutes (FY19+)` where N ≥ 30 (FinCom typically meets ~15-20x/year; older years may be sparser).

- [ ] **Step 4: Sanity-check**

```bash
grep -c '^fincom,' data/minutes_manifest.csv
grep '^fincom,' data/minutes_manifest.csv | head -3
```

Expected: row count matches script output. All rows have `body=fincom`, valid date, valid URL.

- [ ] **Step 5: Commit**

```bash
git add scripts/minutes/discover_fincom.mjs data/minutes_manifest.csv
git commit -m "Discover Finance Committee minutes FY19 to present"
```

---

### Task 5: Discovery scraper for School Committee

**Goal:** Walk `https://www.marbleheadschools.org/fs/pages/1547` (the FY26 page) plus archive links to prior fiscal years, extract every minutes PDF URL.

**Source archive structure (verified 2026-04-16):**
- Host: `marbleheadschools.org` (separate from town site)
- FY-organized landing page: `/fs/pages/1547`. Newest-first.
- Each FY has subsections: Agendas, Minutes, Subcommittees
- Older fiscal years live behind "Archive" links to other `/fs/pages/<id>` pages
- Files hosted on `resources.finalsite.net/images/v<timestamp>/marbleheadschoolsorg/<hash>/<filename>.pdf`
- Filename pattern: variable; minutes files contain "Minutes" substring (case-insensitive) and a date prefix like `1-15-26` or `01152026`
- Page renders via JavaScript (finalsite); needs Playwright, not plain fetch

**Files:**
- Create: `scripts/minutes/discover_school_committee.mjs`

- [ ] **Step 1: Manually browse to confirm structure**

Run interactively:

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.marbleheadschools.org/fs/pages/1547', { waitUntil: 'networkidle', timeout: 60000 });
  const links = await page.\$\$eval('a[href*=\".pdf\"]', as => as.map(a => ({ text: a.textContent.trim(), href: a.href })));
  console.log(JSON.stringify(links.slice(0, 20), null, 2));
  await browser.close();
})();
"
```

Expected: array of `{text, href}` pairs. Note: text contains the human-readable label (e.g. "1.15.2026 Minutes"), href is the finalsite CDN URL. Record all archive page IDs you see linked under "Archive" (e.g. `/fs/pages/2451` for 2024-2025).

- [ ] **Step 2: Implement the SC discovery script**

Create `scripts/minutes/discover_school_committee.mjs`:

```js
#!/usr/bin/env node
// Discover School Committee minutes via marbleheadschools.org (finalsite).
// Walks FY26 landing page + archive pages, extracts minutes PDF URLs.

import { appendOrUpdate } from './lib/manifest.mjs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const ENTRY_PAGE = 'https://www.marbleheadschools.org/fs/pages/1547';
const FY19_START = '2018-07-01';

// Match dates in link text. Examples seen in archive:
//   "1.15.2026 Minutes", "01-15-2026 Minutes", "January 15, 2026 Minutes",
//   "SchoolCommitteeMinutes1-15-26.pdf"
const DATE_PATTERNS = [
  /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
];

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

function normalizeDate(text, href) {
  for (const re of DATE_PATTERNS) {
    const m = text.match(re) || href.match(re);
    if (!m) continue;
    if (re === DATE_PATTERNS[0]) {
      let [_, mo, d, y] = m;
      if (y.length === 2) y = '20' + y;
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const mo = MONTHS[m[1].toLowerCase()];
    return `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  }
  return null;
}

async function harvestPage(page, url) {
  console.log(`Visiting ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  const links = await page.$$eval('a[href*=".pdf"]', as =>
    as.map(a => ({ text: a.textContent.trim(), href: a.href }))
  );
  const archiveLinks = await page.$$eval('a[href*="/fs/pages/"]', as =>
    as.map(a => a.href).filter(h => h !== window.location.href)
  );
  return { links, archiveLinks };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'marblehead-data-research/1.0' });
  const page = await context.newPage();

  const visited = new Set();
  const queue = [ENTRY_PAGE];
  const allMinutes = [];
  const seen = new Set();

  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    let result;
    try {
      result = await harvestPage(page, url);
    } catch (err) {
      console.error(`  WARN: failed to load ${url}: ${err.message}`);
      continue;
    }

    for (const link of result.links) {
      const looksLikeMinutes = /minutes/i.test(link.text) || /minutes/i.test(link.href);
      if (!looksLikeMinutes) continue;
      const date = normalizeDate(link.text, link.href);
      if (!date) {
        console.log(`  SKIP (no date): ${link.text} -> ${link.href}`);
        continue;
      }
      if (date < FY19_START) continue;
      const key = `school_committee:${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allMinutes.push({ source_url: link.href, meeting_date: date });
    }

    // Follow archive links that look like FY-archive pages (avoid going off-domain)
    for (const a of result.archiveLinks) {
      if (!a.includes('marbleheadschools.org/fs/pages/')) continue;
      if (!visited.has(a)) queue.push(a);
    }
  }

  await browser.close();

  console.log(`Discovered ${allMinutes.length} School Committee minutes (FY19+)`);

  for (const m of allMinutes) {
    appendOrUpdate(MANIFEST_PATH, {
      body: 'school_committee',
      meeting_date: m.meeting_date,
      source_url: m.source_url,
      local_pdf: '',
      local_txt: '',
      extraction_method: 'none',
      text_quality: '',
      status: 'pending',
      notes: ''
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run discovery**

```bash
node scripts/minutes/discover_school_committee.mjs
```

Expected: `Discovered N School Committee minutes (FY19+)` where N ≥ 50 (SC meets twice monthly; ~7 FYs × 20 ≈ 140 meetings).

If N < 30, the archive pagination/archive-link traversal probably missed older years. Inspect the SKIP log lines for entries with no parseable date, then extend `DATE_PATTERNS` if a common format is missing.

- [ ] **Step 4: Sanity-check**

```bash
grep -c '^school_committee,' data/minutes_manifest.csv
grep '^school_committee,' data/minutes_manifest.csv | head -3
```

Expected: row count matches script output.

- [ ] **Step 5: Commit**

```bash
git add scripts/minutes/discover_school_committee.mjs data/minutes_manifest.csv
git commit -m "Discover School Committee minutes FY19 to present"
```

---

### Task 6: Download script

**Goal:** Read manifest; for every row with `status=pending`, download `source_url` to `data/minutes/{body}/{meeting_date}.pdf`. Update `local_pdf` and set `status=downloaded`. On HTTP error, set `status=missing` with the error in `notes`.

**Files:**
- Create: `scripts/minutes/download_minutes.mjs`

- [ ] **Step 1: Implement the download script**

Create `scripts/minutes/download_minutes.mjs`:

```js
#!/usr/bin/env node
import { readManifest, appendOrUpdate } from './lib/manifest.mjs';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import pLimit from 'p-limit';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const CONCURRENCY = 4;
const TIMEOUT_MS = 60_000;

async function downloadOne(row) {
  const localPdf = `data/minutes/${row.body}/${row.meeting_date}.pdf`;
  const absPath = resolve(localPdf);
  if (existsSync(absPath)) {
    return { ...row, local_pdf: localPdf, status: 'downloaded' };
  }
  mkdirSync(dirname(absPath), { recursive: true });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(row.source_url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'marblehead-data-research/1.0' }
    });
    if (!res.ok) {
      return { ...row, status: 'missing', notes: `HTTP ${res.status} (${row.source_url})` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(absPath, buf);
    return { ...row, local_pdf: localPdf, status: 'downloaded', notes: '' };
  } catch (err) {
    return { ...row, status: 'missing', notes: `Fetch error: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const rows = readManifest(MANIFEST_PATH);
  const pending = rows.filter(r => r.status === 'pending' || (r.status === 'downloaded' && !existsSync(resolve(r.local_pdf))));
  console.log(`Downloading ${pending.length} of ${rows.length} manifest rows`);

  const limit = pLimit(CONCURRENCY);
  let done = 0;
  await Promise.all(pending.map(row => limit(async () => {
    const updated = await downloadOne(row);
    appendOrUpdate(MANIFEST_PATH, updated);
    done++;
    if (done % 10 === 0 || done === pending.length) {
      console.log(`  ${done}/${pending.length}`);
    }
  })));

  const after = readManifest(MANIFEST_PATH);
  const downloaded = after.filter(r => r.status === 'downloaded').length;
  const missing = after.filter(r => r.status === 'missing').length;
  console.log(`Final: ${downloaded} downloaded, ${missing} missing`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Dry-run on a small subset first**

Create a temporary subset to test on (don't run against the full manifest yet):

```bash
head -6 data/minutes_manifest.csv > /tmp/test_manifest.csv
MANIFEST_OVERRIDE=/tmp/test_manifest.csv node -e "
import('./scripts/minutes/lib/manifest.mjs').then(m => {
  console.log(m.readManifest('/tmp/test_manifest.csv'));
});
"
```

Verify the read works on a subset. Skip this if you trust the implementation.

- [ ] **Step 3: Run full download**

```bash
node scripts/minutes/download_minutes.mjs
```

Expected: ~5-10 minutes for ~300+ files at 4 concurrency. Console output shows progress every 10 files. Final summary lists `downloaded` and `missing` counts.

- [ ] **Step 4: Spot-check downloaded PDFs**

```bash
ls data/minutes/select_board/ | head -5
file data/minutes/select_board/$(ls data/minutes/select_board/ | head -1)
```

Expected: PDFs listed; `file` reports "PDF document".

- [ ] **Step 5: Inspect missing entries**

```bash
grep ',missing,' data/minutes_manifest.csv | head -10
```

Note the failure modes (404, timeout, redirect). If a single body has a high miss rate, the URL pattern in discovery may need fixing; re-run discovery and download.

- [ ] **Step 6: Commit (manifest only; PDFs are gitignored)**

```bash
git add scripts/minutes/download_minutes.mjs data/minutes_manifest.csv
git status  # verify no .pdf files staged
git commit -m "Download minutes PDFs to local cache; mark missing entries"
```

---

### Task 7: Text extraction

**Goal:** For every `status=downloaded` row missing `local_txt`, run `pdftotext`. If output is empty or under 200 chars, fall back to `pdftoppm` + `tesseract` OCR. Write text alongside PDF, update `extraction_method` and `text_quality`.

**Files:**
- Create: `scripts/minutes/extract_text.mjs`

- [ ] **Step 1: Implement the extraction script**

Create `scripts/minutes/extract_text.mjs`:

```js
#!/usr/bin/env node
import { readManifest, appendOrUpdate } from './lib/manifest.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const MIN_PDFTOTEXT_CHARS = 200;

function runPdfToText(pdfPath) {
  try {
    const out = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
    return out;
  } catch (err) {
    return '';
  }
}

function runOcr(pdfPath) {
  const dir = mkdtempSync(join(tmpdir(), 'ocr-'));
  try {
    execFileSync('pdftoppm', ['-r', '300', '-png', pdfPath, join(dir, 'page')], { stdio: 'inherit' });
    const pages = readdirSync(dir).filter(f => f.endsWith('.png')).sort();
    const chunks = [];
    for (const p of pages) {
      const out = execFileSync('tesseract', [join(dir, p), 'stdout', '-l', 'eng'], {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024
      });
      chunks.push(out);
    }
    return chunks.join('\n\n--- page break ---\n\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function classifyQuality(text) {
  if (!text || text.trim().length < 100) return 'unreadable';
  // Heuristic: lots of single-character or two-character "words" suggests OCR garbage
  const tokens = text.split(/\s+/).filter(Boolean);
  const shortRatio = tokens.filter(t => t.length <= 2).length / Math.max(tokens.length, 1);
  if (shortRatio > 0.4) return 'degraded';
  return 'clean';
}

function extractOne(row) {
  const localPdf = resolve(row.local_pdf);
  if (!existsSync(localPdf)) {
    return { ...row, status: 'missing', notes: `${row.notes || ''} PDF disappeared from cache`.trim() };
  }
  const localTxt = row.local_pdf.replace(/\.pdf$/, '.txt');
  const absTxt = resolve(localTxt);

  let text = runPdfToText(localPdf);
  let method = 'pdftotext';
  if (text.trim().length < MIN_PDFTOTEXT_CHARS) {
    console.log(`  OCR fallback: ${row.local_pdf}`);
    text = runOcr(localPdf);
    method = 'ocr';
  }
  const quality = classifyQuality(text);
  writeFileSync(absTxt, text);
  return { ...row, local_txt: localTxt, extraction_method: method, text_quality: quality };
}

async function main() {
  const rows = readManifest(MANIFEST_PATH);
  const todo = rows.filter(r => r.status === 'downloaded' && !r.local_txt);
  console.log(`Extracting text for ${todo.length} of ${rows.length} manifest rows`);

  let i = 0;
  for (const row of todo) {
    i++;
    console.log(`[${i}/${todo.length}] ${row.body} ${row.meeting_date}`);
    const updated = extractOne(row);
    appendOrUpdate(MANIFEST_PATH, updated);
  }

  const after = readManifest(MANIFEST_PATH);
  const counts = { clean: 0, degraded: 0, unreadable: 0 };
  for (const r of after) {
    if (counts[r.text_quality] !== undefined) counts[r.text_quality]++;
  }
  console.log(`Final quality: clean=${counts.clean}, degraded=${counts.degraded}, unreadable=${counts.unreadable}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run extraction on the full corpus**

```bash
node scripts/minutes/extract_text.mjs
```

Expected: progresses through every downloaded row. OCR fallback is slow (~30s per scanned PDF); plain pdftotext is sub-second. If most files are native-text PDFs, total runtime is ~5-15 minutes.

- [ ] **Step 3: Spot-check a `clean` row**

```bash
grep ',clean,' data/minutes_manifest.csv | head -1
# Pick the local_txt path from that row and read it:
LOCAL_TXT=$(grep ',clean,' data/minutes_manifest.csv | head -1 | awk -F',' '{print $5}')
head -30 "$LOCAL_TXT"
```

Expected: human-readable meeting minutes prose. If garbled, re-classify by lowering MIN_PDFTOTEXT_CHARS or adjusting `classifyQuality`.

- [ ] **Step 4: Spot-check a `degraded` or OCR'd row**

```bash
grep ',ocr,' data/minutes_manifest.csv | head -1
LOCAL_TXT=$(grep ',ocr,' data/minutes_manifest.csv | head -1 | awk -F',' '{print $5}')
head -30 "$LOCAL_TXT"
```

Expected: text with OCR artifacts (occasional misrecognized characters) but still mostly readable.

- [ ] **Step 5: Commit text files + manifest**

```bash
git add scripts/minutes/extract_text.mjs data/minutes/*/*.txt data/minutes_manifest.csv
git status | head -20  # confirm no .pdf staged
git commit -m "Extract text from minutes PDFs (pdftotext primary, OCR fallback)"
```

---

### Task 8: Verification script

**Goal:** Assert manifest invariants for the Phase 1 exit gate. Exits non-zero if any invariant is violated, listing each violation.

**Invariants (per spec section 5):**
1. Every row has a non-empty `body`, `meeting_date`, `source_url`, `status`.
2. Every `status=downloaded` row has both `local_pdf` and `local_txt` populated and the files exist on disk (PDF in cache, text in repo).
3. Every `status=missing` row has a non-empty `notes` field.
4. No duplicate `(body, meeting_date)` pairs.
5. `meeting_date >= 2018-07-01` for every row (FY19 cutoff).
6. Every row's `body` is in `{select_board, fincom, school_committee}`.

**Files:**
- Create: `scripts/minutes/verify_corpus.mjs`

- [ ] **Step 1: Implement the verification script**

Create `scripts/minutes/verify_corpus.mjs`:

```js
#!/usr/bin/env node
import { readManifest } from './lib/manifest.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const VALID_BODIES = new Set(['select_board', 'fincom', 'school_committee']);
const VALID_STATUSES = new Set(['downloaded', 'missing', 'restricted', 'not_published']);
const FY19_START = '2018-07-01';

function main() {
  const rows = readManifest(MANIFEST_PATH);
  const violations = [];

  // Invariant 6: body whitelist
  for (const r of rows) {
    if (!VALID_BODIES.has(r.body)) {
      violations.push(`Invalid body "${r.body}" on row ${r.meeting_date}`);
    }
    if (!VALID_STATUSES.has(r.status)) {
      violations.push(`Invalid status "${r.status}" on ${r.body} ${r.meeting_date}`);
    }
  }

  // Invariant 1: required fields
  for (const r of rows) {
    for (const f of ['body', 'meeting_date', 'source_url', 'status']) {
      if (!r[f]) violations.push(`Missing ${f} on row ${JSON.stringify(r)}`);
    }
  }

  // Invariant 2: downloaded rows have files
  for (const r of rows) {
    if (r.status !== 'downloaded') continue;
    if (!r.local_pdf || !existsSync(resolve(r.local_pdf))) {
      violations.push(`downloaded but PDF missing: ${r.body} ${r.meeting_date}`);
    }
    if (!r.local_txt || !existsSync(resolve(r.local_txt))) {
      violations.push(`downloaded but text missing: ${r.body} ${r.meeting_date}`);
    }
  }

  // Invariant 3: missing rows have notes
  for (const r of rows) {
    if (r.status === 'missing' && !r.notes) {
      violations.push(`missing but no explanation: ${r.body} ${r.meeting_date}`);
    }
  }

  // Invariant 4: no duplicate keys
  const keys = new Map();
  for (const r of rows) {
    const k = `${r.body}:${r.meeting_date}`;
    if (keys.has(k)) {
      violations.push(`Duplicate key ${k}`);
    }
    keys.set(k, true);
  }

  // Invariant 5: dates within FY19+
  for (const r of rows) {
    if (r.meeting_date && r.meeting_date < FY19_START) {
      violations.push(`Date out of range (${r.meeting_date}) for ${r.body}`);
    }
  }

  // Coverage summary
  const byBody = {};
  for (const r of rows) {
    byBody[r.body] ??= { downloaded: 0, missing: 0, restricted: 0, not_published: 0 };
    byBody[r.body][r.status]++;
  }

  console.log('Coverage by body:');
  for (const [body, counts] of Object.entries(byBody)) {
    console.log(`  ${body}: ${JSON.stringify(counts)}`);
  }

  if (violations.length) {
    console.error(`\n${violations.length} invariant violations:`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log('\nAll Phase 1 invariants pass.');
}

main();
```

- [ ] **Step 2: Run verification**

```bash
node scripts/minutes/verify_corpus.mjs
```

Expected output if Phase 1 is complete:

```
Coverage by body:
  select_board: {"downloaded":N1,"missing":M1,...}
  fincom: {"downloaded":N2,"missing":M2,...}
  school_committee: {"downloaded":N3,"missing":M3,...}

All Phase 1 invariants pass.
```

If violations are reported: read each, fix the underlying script (discovery/download/extract), re-run that script, then re-run verification.

- [ ] **Step 3: Commit**

```bash
git add scripts/minutes/verify_corpus.mjs
git commit -m "Add verify_corpus.mjs as Phase 1 exit gate"
```

---

### Task 9: Document the pipeline + open PR

**Goal:** Write `scripts/minutes/README.md` so a future session can re-run or extend the pipeline. Push the branch and open a PR.

**Files:**
- Create: `scripts/minutes/README.md`

- [ ] **Step 1: Write the README**

Create `scripts/minutes/README.md`:

```markdown
# Minutes corpus pipeline

Discovers, downloads, and text-extracts meeting minutes for the Marblehead
Select Board, Finance Committee, and School Committee, FY19 to present.

## Outputs

- `data/minutes_manifest.csv`: one row per meeting (downloaded, missing,
  restricted, or not_published). Schema in
  `docs/superpowers/specs/2026-04-16-historical-minutes-catalog-design.md`
  section 8.
- `data/minutes/{body}/{YYYY-MM-DD}.txt`: extracted text (committed).
- `data/minutes/{body}/{YYYY-MM-DD}.pdf`: local PDF cache (gitignored).
  Re-populate by running the download script.

## End-to-end run

```bash
# 1. Discover (one per body; idempotent, appends new meetings)
node scripts/minutes/discover_select_board.mjs
node scripts/minutes/discover_fincom.mjs
node scripts/minutes/discover_school_committee.mjs

# 2. Download (idempotent; skips PDFs already in cache)
node scripts/minutes/download_minutes.mjs

# 3. Extract text (idempotent; skips rows with local_txt set)
node scripts/minutes/extract_text.mjs

# 4. Verify (Phase 1 exit gate; non-zero exit on invariant violation)
node scripts/minutes/verify_corpus.mjs
```

Total wall time: 10 to 30 minutes depending on how many rows are new and
how many require OCR.

## Adding new meetings (recurring use)

After every Select Board, FinCom, or School Committee meeting, re-run
the discovery script for that body. New meetings will be appended to the
manifest. Then run download + extract to fetch and process them.

```bash
node scripts/minutes/discover_select_board.mjs
node scripts/minutes/download_minutes.mjs
node scripts/minutes/extract_text.mjs
git add data/minutes/select_board/*.txt data/minutes_manifest.csv
git commit -m "Add Select Board minutes through YYYY-MM-DD"
```

## Adding a new body

1. Create `scripts/minutes/discover_<body>.mjs` modeled on
   `discover_fincom.mjs` (for WordPress category pages) or
   `discover_school_committee.mjs` (for finalsite-hosted FY pages).
2. Add `<body>` to `VALID_BODIES` in `verify_corpus.mjs`.
3. Run discovery + download + extract + verify.

## Why PDFs are gitignored

The corpus is ~300+ PDFs at ~1MB each. Storing them in git would bloat
the repo. The `source_url` field in the manifest is the canonical citation;
the local PDF is a cache. Anyone can re-populate the cache from the
manifest by running `download_minutes.mjs`.

This matches the existing pattern: bulk source documents live on the
GitHub release tag `source-archive-v1`; only a few critical PDFs live in
`data/`.

## Tests

```bash
npm run test:minutes
```

Tests live in `scripts/minutes/lib/*.test.mjs` and use Node's built-in
`node --test` runner.

## Tooling dependencies

System (install via Homebrew):
- `pdftotext`, `pdftoppm` (poppler)
- `tesseract`

Node (in `package.json`):
- `playwright` (for marbleheadschools.org which renders via JS)
- `csv-parse`, `csv-stringify` (manifest I/O)
- `p-limit` (concurrency on downloads)

## Phase 1 exit gate

`verify_corpus.mjs` exits zero only when:
- Every row has `body`, `meeting_date`, `source_url`, `status`.
- Every `downloaded` row has both PDF and TXT files present.
- Every `missing` row explains why in `notes`.
- No duplicate `(body, meeting_date)` pairs.
- All dates are >= 2018-07-01.
- All bodies are in `{select_board, fincom, school_committee}`.

When this passes, Phase 1 is complete. Phase 2 (sample extraction & vet)
proceeds against this manifest. See the spec for the phase boundary.
```

- [ ] **Step 2: Final verify run**

```bash
node scripts/minutes/verify_corpus.mjs
```

Expected: "All Phase 1 invariants pass."

- [ ] **Step 3: Commit README**

```bash
git add scripts/minutes/README.md
git commit -m "Document minutes corpus pipeline for future sessions"
```

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin claude/historical-minutes-catalog-spec
gh pr create --title "Phase 1: historical minutes corpus pipeline" --body "$(cat <<'EOF'
## Summary

Implements Phase 1 of the historical minutes catalog (per
`docs/superpowers/specs/2026-04-16-historical-minutes-catalog-design.md`):

- **Discovery scrapers** for Select Board, Finance Committee, and School
  Committee minutes archives.
- **Download script** that pulls every discovered minutes PDF to a local
  cache (gitignored).
- **Text extraction** with `pdftotext` primary and `pdftoppm + tesseract`
  OCR fallback for scanned PDFs.
- **Verification script** that asserts manifest invariants (Phase 1 exit
  gate).
- **Pipeline README** for future sessions.

## What this enables

Phase 2 (sample extraction & vet) and Phase 3 (full sweep + reader-facing
page) get separate plans. This PR sets up the corpus they need.

## Test plan

- [ ] `npm run test:minutes` passes
- [ ] `node scripts/minutes/verify_corpus.mjs` exits 0
- [ ] Manifest covers FY19 to present for all three bodies; gaps are
  explicit with explanations
- [ ] Spot-check sample of `clean` text files reads as human prose
- [ ] Spot-check sample of `ocr` text files is mostly readable

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Report it back to the user.

---

## Phase 1 exit criteria

Phase 1 is complete when all of:

- `node scripts/minutes/verify_corpus.mjs` exits 0
- Manifest covers FY19 (2018-07-01) through present for all three bodies, with gaps explicit
- Coverage summary printed by verify shows `downloaded` counts in expected ballpark:
  - `select_board`: 100-200 rows
  - `fincom`: 50-150 rows
  - `school_committee`: 100-200 rows
- PR opened against `main`

When this passes, hand off to a fresh session with the next plan:
`docs/superpowers/plans/YYYY-MM-DD-historical-minutes-catalog-phase-2.md`
(written separately, after this phase ships).
