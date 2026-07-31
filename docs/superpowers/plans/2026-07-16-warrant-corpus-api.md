# Warrant Corpus + Public Read API (Plan 1 of Standing Warrant Votes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the 2019-2025 Town Meeting corpus (article series and instances) into the community-pulse D1 database and serve it through a public, versioned, CORS-open `/api/v1` read layer on the existing worker.

**Architecture:** Pure corpus logic (title normalization, series grouping, kind assignment) lives in a repo-root script library with unit tests; a builder CLI emits curated series CSVs to `data/`; a sync CLI loads them into D1 following the `sync_parcel_owners.mjs` pattern. The worker gains one new module, `api_v1.js`, mounted as an if-chain branch in `handleRequest`, serving JSON with `Access-Control-Allow-Origin: *`, `Cache-Control`, and ETag/304 handling.

**Tech Stack:** Cloudflare Worker (plain JS modules, no framework), D1 (SQLite), vitest with `@cloudflare/vitest-pool-workers`, Node .mjs CLI scripts, wrangler v4 via `npx -y wrangler@4`.

**Spec:** `docs/superpowers/specs/2026-07-10-standing-warrant-votes-design.md`. This plan covers the spec's rollout items 1-2 for the worker side only. Voting endpoints (questions, question_votes, snapshots), the SvelteKit app, and street-list verification are Plans 2-4. Budget_line series (omnibus decomposition by department, with amounts from FinCom reports) are a later corpus pass; this plan ships series of kinds `money_article`, `other_article`, and `consent` only.

## Global Constraints

- No em-dashes or en-dashes in any committed text, code comments, JSON copy, or docs; hyphens only (repo rule, CI does not catch en-dashes).
- Neutral copy everywhere; no editorial language in API payloads or docs (repo editorial stance).
- Next migration number is `0008` (both `0007_engagement.sql` and `0007_vouch_requests.sql` exist; do not reuse 0007).
- New vitest test files are silently skipped unless added to the matching `include` list in `community-pulse/vitest.config.js` (widget project for node-env unit tests, worker project for `cloudflare:test` tests).
- Worker-pool tests do not run migrations; they `CREATE TABLE IF NOT EXISTS` the tables they need in `beforeEach` (existing pattern in `tests/engagement.test.js`).
- All work happens in the worktree `/Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes` on branch `spec/standing-warrant-votes` (PR #1001). Never commit in the main working directory.
- Pushes use the PAT from `/Users/agbaber/marblehead/.env` (`GITHUB_TOKEN`) in the inline HTTPS URL form on first push of any new branch; this branch already tracks that URL, so plain `git push` works.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Source CSVs are already committed: `data/town_meeting_results.csv` (398 rows, authoritative for 2019-2025) and `data/town_meeting_warrant_articles.csv` (first-pass titles, 2016 + 2026 coverage). This plan's sync loads only from `town_meeting_results.csv`; 2016/2026 instances arrive when their dispositions are backfilled.
- Public API responses always carry `Access-Control-Allow-Origin: *` (distinct from the widget endpoints, which use `env.ALLOWED_ORIGIN`).

---

### Task 1: Warrant corpus schema (migration 0008)

**Files:**
- Create: `community-pulse/worker/schema/0008_warrant_corpus.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `article_series(slug, title, kind, first_year, last_year, notes)` and `article_instances(series_slug, meeting_year, meeting_type, meeting_date, article_number, title, amount, fincom_recommendation, tm_result, tm_vote_yes, tm_vote_no, in_effect, notes, source_doc, source_url)` with PK `(meeting_year, meeting_type, article_number)`. Tasks 4-7 rely on these exact column names.

- [ ] **Step 1: Write the migration**

```sql
-- 0008_warrant_corpus.sql
-- Town Meeting warrant corpus: recurring article series and their
-- per-year instances. Facts layer only; no voting tables here.
-- Sources: data/town_meeting_results.csv (see data/DATA_CATALOG.md).

CREATE TABLE IF NOT EXISTS article_series (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('budget_line','money_article','other_article','consent')),
  first_year INTEGER,
  last_year  INTEGER,
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS article_instances (
  series_slug           TEXT NOT NULL,
  meeting_year          INTEGER NOT NULL,
  meeting_type          TEXT NOT NULL DEFAULT 'annual' CHECK (meeting_type IN ('annual','special')),
  meeting_date          TEXT,
  article_number        INTEGER NOT NULL,
  title                 TEXT NOT NULL,
  amount                REAL,
  fincom_recommendation TEXT,
  tm_result             TEXT CHECK (tm_result IN ('adopted','defeated','indefinitely_postponed','withdrawn','not_taken_up')),
  tm_vote_yes           INTEGER,
  tm_vote_no            INTEGER,
  in_effect             INTEGER,
  notes                 TEXT,
  source_doc            TEXT,
  source_url            TEXT,
  PRIMARY KEY (meeting_year, meeting_type, article_number)
);

CREATE INDEX IF NOT EXISTS idx_article_instances_series
  ON article_instances (series_slug, meeting_year);
```

`in_effect` semantics: NULL means "same as adoption"; 0 means adopted but not in effect (the 2025 3A article, overturned by the July 2025 referendum). `amount` and `fincom_recommendation` stay NULL in this plan; they backfill from FinCom reports later.

- [ ] **Step 2: Apply locally and verify**

Run:
```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse/worker
npx -y wrangler@4 d1 migrations apply community-pulse --local
npx -y wrangler@4 d1 execute community-pulse --local --command "SELECT name FROM sqlite_master WHERE name IN ('article_series','article_instances');"
```
Expected: migrations output lists `0008_warrant_corpus.sql` as applied; the SELECT returns both table names.

- [ ] **Step 3: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
git add community-pulse/worker/schema/0008_warrant_corpus.sql
git commit -m "worker: add warrant corpus schema (migration 0008)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Corpus logic library (normalization, series, kinds)

**Files:**
- Create: `scripts/warrant_lib.mjs`
- Create: `community-pulse/tests/warrant-lib.test.js`
- Modify: `community-pulse/vitest.config.js` (add `'tests/warrant-lib.test.js'` to the **widget** project's `include` array)

**Interfaces:**
- Consumes: nothing.
- Produces (exact exports Tasks 3-4 import):
  - `parseCsv(text) -> Array<object>` (RFC-4180 quoted fields, keys from header row)
  - `normalizeTitle(rawTitle) -> string` (lowercased, punctuation-stripped, alias-canonicalized)
  - `slugify(normalizedTitle) -> string`
  - `deriveKind(slug) -> 'money_article' | 'other_article' | 'consent'`
  - `buildSeries(resultRows) -> { series: Array<{slug,title,kind,first_year,last_year,notes}>, map: Array<{normalized_title, slug}> }`

- [ ] **Step 1: Write the failing test**

```js
// community-pulse/tests/warrant-lib.test.js
import { describe, it, expect } from 'vitest';
import {
  parseCsv, normalizeTitle, slugify, deriveKind, buildSeries
} from '../../scripts/warrant_lib.mjs';

describe('parseCsv', () => {
  it('handles quoted fields containing commas and escaped quotes', () => {
    const rows = parseCsv('a,b\n"x, y","he said ""hi"""\nplain,2\n');
    expect(rows).toEqual([
      { a: 'x, y', b: 'he said "hi"' },
      { a: 'plain', b: '2' },
    ]);
  });
});

describe('normalizeTitle', () => {
  it('lowercases, strips stray punctuation, collapses spaces', () => {
    expect(normalizeTitle('  Walls  and Fences ')).toBe('walls and fences');
  });
  it('canonicalizes known year-to-year renames', () => {
    expect(normalizeTitle('Expense of Several Departments'))
      .toBe('expenses of several departments');
    expect(normalizeTitle('Stormwater Construction'))
      .toBe('storm drainage construction');
    expect(normalizeTitle('Storm Drain Construction'))
      .toBe('storm drainage construction');
    expect(normalizeTitle('Revolving Fund'))
      .toBe('departmental revolving funds');
    expect(normalizeTitle('Reclassification and Pay Schedule (Administrative)'))
      .toBe('proposed reclassification and pay schedule (administrative)');
    expect(normalizeTitle('Financial Assistance Conservation'))
      .toBe('financial assistance for conservation');
    expect(normalizeTitle('Supplemental Appropriation and Expenses for the Schools'))
      .toBe('supplemental appropriation for the schools');
  });
  it('keeps genuinely different proposals separate', () => {
    expect(normalizeTitle('Ban use of gas-powered Leaf Blowers'))
      .not.toBe(normalizeTitle('Summer Break from Gas-Powered Leaf Blowers'));
  });
});

describe('slugify', () => {
  it('drops parens and apostrophes, hyphenates spaces', () => {
    expect(slugify('proposed reclassification and pay schedule (administrative)'))
      .toBe('proposed-reclassification-and-pay-schedule-administrative');
  });
});

describe('deriveKind', () => {
  it('classifies known slugs', () => {
    expect(deriveKind('expenses-of-several-departments')).toBe('money_article');
    expect(deriveKind('consent-articles')).toBe('consent');
    expect(deriveKind('assume-liability')).toBe('consent');
    expect(deriveKind('land-acknowledgement')).toBe('other_article');
  });
});

describe('buildSeries', () => {
  it('groups renamed instances into one series with year range', () => {
    const rows = [
      { meeting_year: '2022', title: 'Expense of Several Departments' },
      { meeting_year: '2024', title: 'Expenses of Several Departments' },
    ];
    const { series, map } = buildSeries(rows);
    expect(series).toHaveLength(1);
    expect(series[0].slug).toBe('expenses-of-several-departments');
    expect(series[0].kind).toBe('money_article');
    expect(series[0].first_year).toBe(2022);
    expect(series[0].last_year).toBe(2024);
    expect(series[0].title).toBe('Expenses of Several Departments');
    expect(map).toContainEqual({
      normalized_title: 'expense of several departments',
      slug: 'expenses-of-several-departments',
    });
  });
});
```

- [ ] **Step 2: Add the test to the widget include list, run, verify it fails**

In `community-pulse/vitest.config.js`, widget project, append `'tests/warrant-lib.test.js'` to `include`.

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run tests/warrant-lib.test.js`
Expected: FAIL with "Failed to load ../../scripts/warrant_lib.mjs" (module does not exist).

- [ ] **Step 3: Write the library**

```js
// scripts/warrant_lib.mjs
// Pure logic for the Town Meeting warrant corpus: CSV parsing, title
// normalization across year-to-year renames, series grouping, and kind
// assignment. No I/O; CLIs in build_warrant_series.mjs and
// sync_warrant_corpus.mjs wrap this. Tested from
// community-pulse/tests/warrant-lib.test.js.

// Variant normalized title -> canonical normalized title. Every entry
// was observed in data/town_meeting_results.csv or the FinCom extraction
// (data/town_meeting_warrant_articles.csv); do not invent merges.
export const ALIASES = {
  'expense of several departments': 'expenses of several departments',
  'storm drain construction': 'storm drainage construction',
  'stormwater construction': 'storm drainage construction',
  'revolving fund': 'departmental revolving funds',
  'capital improvements public buildings': 'capital improvements for public buildings',
  'available funds appropriated to reduce the tax rate': 'available funds appropriate to reduce tax rate',
  'financial assistance conservation': 'financial assistance for conservation',
  'contracts for more than three years': 'contracts in excess of three years',
  'transfer of funds to special education stabilization account': 'transfer funds to special education stabilization account',
  'reclassification and pay schedule (administrative)': 'proposed reclassification and pay schedule (administrative)',
  'pay schedule and reclassification (administrative)': 'proposed reclassification and pay schedule (administrative)',
  'reclassification and pay schedule (traffic supervisors)': 'proposed reclassification and pay schedule (traffic supervisors)',
  'proposed pay schedule and reclassification (traffic supervisors)': 'proposed reclassification and pay schedule (traffic supervisors)',
  'reclassification and pay schedule (seasonal and temporary)': 'proposed reclassification and pay schedule (seasonal and temporary personnel)',
  'proposed reclassification and pay schedule (seasonal and temporary)': 'proposed reclassification and pay schedule (seasonal and temporary personnel)',
  'supplemental appropriation and expenses for the schools': 'supplemental appropriation for the schools',
  'supplemental appropriation for several departments': 'supplemental expenses of several departments',
  'supplemental appropriation and expenses of several departments': 'supplemental expenses of several departments',
  'collective bargaining, police': 'collective bargaining (police)',
  'mwra local water system assistance program (interest-free loan)': 'mwra local water system assistance program',
};

// Slug -> kind. Anything not listed is 'other_article'. budget_line
// series (omnibus decomposition by department) are a later corpus pass.
export const KIND_BY_SLUG = {
  // The town's own consent bundles plus the pre-2025 housekeeping that
  // moved into them.
  'consent-articles': 'consent',
  'consent-articles-water-and-sewer': 'consent',
  'articles-in-numerical-order': 'consent',
  'reports-of-town-officers-and-committees': 'consent',
  'assume-liability': 'consent',
  'accept-trust-property': 'consent',
  'lease-town-property': 'consent',
  'contracts-in-excess-of-three-years': 'consent',
  'water-and-sewer-commission-claims': 'consent',
  // Recurring money articles.
  'expenses-of-several-departments': 'money_article',
  'purchase-of-equipment-of-several-departments': 'money_article',
  'capital-improvements-for-public-buildings': 'money_article',
  'walls-and-fences': 'money_article',
  'storm-drainage-construction': 'money_article',
  'water-department-construction': 'money_article',
  'sewer-department-construction': 'money_article',
  'unpaid-accounts': 'money_article',
  'available-funds-appropriate-to-reduce-tax-rate': 'money_article',
  'essex-north-shore-agricultural-and-technical-school-district': 'money_article',
  'mwra-local-water-system-assistance-program': 'money_article',
  'lease-purchase': 'money_article',
  'departmental-revolving-funds': 'money_article',
  'collective-bargaining-fire': 'money_article',
  'collective-bargaining-police': 'money_article',
  'collective-bargaining-iuecwa-local-1776': 'money_article',
  'proposed-reclassification-and-pay-schedule-administrative': 'money_article',
  'proposed-reclassification-and-pay-schedule-traffic-supervisors': 'money_article',
  'proposed-reclassification-and-pay-schedule-seasonal-and-temporary-personnel': 'money_article',
  'compensation-town-officers': 'money_article',
  'ratification-of-salary-bylaw': 'money_article',
  'financial-assistance-for-conservation': 'money_article',
  'transfer-funds-to-special-education-stabilization-account': 'money_article',
  'supplemental-appropriation-for-the-schools': 'money_article',
  'supplemental-expenses-of-several-departments': 'money_article',
  'school-capital-needs': 'money_article',
  'medicaid-reimbursement-money': 'money_article',
  'capital-transfers': 'money_article',
  'debt-exclusion-premium': 'money_article',
  'release-funds-from-transportation-network': 'money_article',
  'affordable-housing-tax-title-foreclosures': 'money_article',
};

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map(cells =>
    Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));
}

export function normalizeTitle(rawTitle) {
  let t = String(rawTitle).toLowerCase().trim();
  t = t.replace(/[^a-z0-9() ]+/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return ALIASES[t] || t;
}

export function slugify(normalizedTitle) {
  return normalizedTitle.replace(/[()]/g, '').replace(/\s+/g, ' ').trim().replace(/ /g, '-');
}

export function deriveKind(slug) {
  return KIND_BY_SLUG[slug] || 'other_article';
}

/**
 * Group result rows (objects with meeting_year and title) into series.
 * Display title per series: the title of the most recent instance.
 */
export function buildSeries(resultRows) {
  const bySlug = new Map();
  const mapEntries = new Map();

  for (const row of resultRows) {
    const year = Number(row.meeting_year);
    const normalized = normalizeTitle(row.title);
    const slug = slugify(normalized);
    mapEntries.set(normalizeTitle(row.title), slug);

    const existing = bySlug.get(slug);
    if (!existing) {
      bySlug.set(slug, {
        slug,
        title: row.title,
        kind: deriveKind(slug),
        first_year: year,
        last_year: year,
        notes: '',
        _titleYear: year,
      });
      continue;
    }

    existing.first_year = Math.min(existing.first_year, year);
    existing.last_year = Math.max(existing.last_year, year);
    if (year >= existing._titleYear) {
      existing.title = row.title;
      existing._titleYear = year;
    }
  }

  const series = [...bySlug.values()]
    .map(({ _titleYear, ...s }) => s)
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const map = [...mapEntries.entries()]
    .map(([normalized_title, slug]) => ({ normalized_title, slug }))
    .sort((a, b) => a.normalized_title.localeCompare(b.normalized_title));
  return { series, map };
}
```

Note on `normalizeTitle` and the test: `Ban use of gas-powered Leaf Blowers` normalizes to `ban use of gas powered leaf blowers` (hyphen becomes space) and `Summer Break from Gas-Powered Leaf Blowers` to `summer break from gas powered leaf blowers`; distinct, as the test requires. Apostrophes strip to spaces before collapse, so `Indigenous Peoples' Day` becomes `indigenous peoples day`.

- [ ] **Step 4: Run tests, verify pass**

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run tests/warrant-lib.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Run the full suite to catch include-list regressions**

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run`
Expected: all pre-existing tests still pass, plus the new file.

- [ ] **Step 6: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
git add scripts/warrant_lib.mjs community-pulse/tests/warrant-lib.test.js community-pulse/vitest.config.js
git commit -m "corpus: warrant series logic library with tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Series builder CLI and generated series CSVs

**Files:**
- Create: `scripts/build_warrant_series.mjs`
- Create: `data/article_series.csv` (generated, then committed)
- Create: `data/article_series_map.csv` (generated, then committed)
- Modify: `data/DATA_CATALOG.md` (entry for both files, inserted before the `## What We Don't Have` section)

**Interfaces:**
- Consumes: `parseCsv`, `buildSeries` from `scripts/warrant_lib.mjs`; `data/town_meeting_results.csv`.
- Produces: `data/article_series.csv` with header `slug,title,kind,first_year,last_year,notes` and `data/article_series_map.csv` with header `normalized_title,slug`. Task 4 reads both.

- [ ] **Step 1: Write the CLI**

```js
#!/usr/bin/env node
// Regenerate data/article_series.csv and data/article_series_map.csv
// from data/town_meeting_results.csv. Deterministic; run after any
// results-CSV change and commit the diff.
//
// Usage: node scripts/build_warrant_series.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, buildSeries } from './warrant_lib.mjs';

function csvField(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => csvField(r[h])).join(','));
  return lines.join('\n') + '\n';
}

const rows = parseCsv(readFileSync('data/town_meeting_results.csv', 'utf-8'));
const { series, map } = buildSeries(rows);

writeFileSync('data/article_series.csv',
  toCsv(['slug', 'title', 'kind', 'first_year', 'last_year', 'notes'], series));
writeFileSync('data/article_series_map.csv',
  toCsv(['normalized_title', 'slug'], map));

const kinds = {};
for (const s of series) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
console.log(`Input rows: ${rows.length}`);
console.log(`Series: ${series.length}`, kinds);
console.log(`Map entries: ${map.length}`);

const recurring = series.filter(s => s.last_year > s.first_year).length;
console.log(`Recurring series (seen in more than one year): ${recurring}`);
```

- [ ] **Step 2: Run it and sanity-check the output**

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes && node scripts/build_warrant_series.mjs`
Expected: `Input rows: 398`; series count in the 120-200 range with all three kinds present; recurring series at least 25. Then eyeball the top of the file:

Run: `head -30 data/article_series.csv`
Expected: alphabetical slugs; `expenses-of-several-departments` has `first_year` 2019 (it appears in 2019-2025 under two title variants); `consent-articles` has kind `consent`.

Spot-check that no known rename produced two series:

Run: `grep -c '\-construction' data/article_series.csv` and `grep 'storm' data/article_series_map.csv`
Expected: exactly one storm construction slug (`storm-drainage-construction`) among the construction series, and the map shows all three title variants (`storm drain construction`, `storm drainage construction`, `stormwater construction`) pointing at that one slug. Other legitimate storm series exist (`stormwater-enterprise-fund`, two stormwater bylaw amendments), so a bare count of "storm" matches is not the invariant. (Plan errata: an earlier revision expected `grep -c "storm"` to return 1, which is unsatisfiable; Task 3's review corrected it.) If a construction variant maps to its own slug, the rename is missing from `ALIASES` in `scripts/warrant_lib.mjs`; add it there (with a test) rather than editing the generated CSV.

- [ ] **Step 3: Add the DATA_CATALOG entry**

Insert before `## What We Don't Have (identified gaps)` in `data/DATA_CATALOG.md`:

```markdown
### Warrant Article Series (generated)
- **What it is:** The recurring-article identity layer over `town_meeting_results.csv`: one row per article series (e.g. the omnibus operating budget, whatever its title that year), plus a normalized-title-to-slug map covering every observed title variant.
- **Files:** `article_series.csv`, `article_series_map.csv`
- **Generated by:** `node scripts/build_warrant_series.mjs` (deterministic; regenerate and commit after any change to `town_meeting_results.csv` or to the alias/kind maps in `scripts/warrant_lib.mjs`).
- **Caveats:** Rename merges (aliases) and kind assignments are curated code in `scripts/warrant_lib.mjs`, observed from the corpus, not invented. `budget_line` series (omnibus decomposed by department) are not yet generated.
- **Confidence:** Derived data; as good as the results CSV plus the alias map.
```

- [ ] **Step 4: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
git add scripts/build_warrant_series.mjs data/article_series.csv data/article_series_map.csv data/DATA_CATALOG.md
git commit -m "corpus: generate article series and title map CSVs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Corpus sync CLI (CSVs into D1)

**Files:**
- Create: `scripts/sync_warrant_corpus.mjs`
- Create: `community-pulse/tests/warrant-sync.test.js`
- Modify: `community-pulse/vitest.config.js` (add `'tests/warrant-sync.test.js'` to the **widget** project's `include` array)

**Interfaces:**
- Consumes: `parseCsv`, `normalizeTitle` from `scripts/warrant_lib.mjs`; `data/article_series.csv`, `data/article_series_map.csv`, `data/town_meeting_results.csv`; the Task 1 tables.
- Produces: populated `article_series` and `article_instances` tables in a target D1 (local, staging, or prod). Exports `buildInstanceRow(resultRow, slugByNormalizedTitle) -> object` and `buildSeriesRow(seriesRow) -> object` for tests.

- [ ] **Step 1: Write the failing test**

```js
// community-pulse/tests/warrant-sync.test.js
import { describe, it, expect } from 'vitest';
import { buildSeriesRow, buildInstanceRow } from '../../scripts/sync_warrant_corpus.mjs';

const MAP = new Map([
  ['expenses of several departments', 'expenses-of-several-departments'],
  ['expense of several departments', 'expenses-of-several-departments'],
  ['amend zoning bylaw 3a multi family overlay district', 'amend-zoning-bylaw-3a-multi-family-overlay-district'],
]);

describe('buildSeriesRow', () => {
  it('coerces years to numbers and passes fields through', () => {
    const row = buildSeriesRow({
      slug: 'walls-and-fences', title: 'Walls and Fences',
      kind: 'money_article', first_year: '2019', last_year: '2025', notes: '',
    });
    expect(row).toEqual({
      slug: 'walls-and-fences', title: 'Walls and Fences',
      kind: 'money_article', first_year: 2019, last_year: 2025, notes: null,
    });
  });
});

describe('buildInstanceRow', () => {
  it('maps a normal adopted row', () => {
    const row = buildInstanceRow({
      meeting_year: '2022', meeting_date: '2022-05-02', meeting_type: 'annual',
      article_number: '30', title: 'Expense of Several Departments',
      disposition: 'adopted', vote_yes: '', vote_no: '',
      notes: 'omnibus FY23 operating budget',
      source_doc: 'Annual-Report-2022.pdf', source_url: 'https://example.com/ar2022.pdf',
    }, MAP);
    expect(row).toEqual({
      series_slug: 'expenses-of-several-departments',
      meeting_year: 2022, meeting_type: 'annual', meeting_date: '2022-05-02',
      article_number: 30, title: 'Expense of Several Departments',
      amount: null, fincom_recommendation: null,
      tm_result: 'adopted', tm_vote_yes: null, tm_vote_no: null,
      in_effect: null, notes: 'omnibus FY23 operating budget',
      source_doc: 'Annual-Report-2022.pdf', source_url: 'https://example.com/ar2022.pdf',
    });
  });

  it('parses tallies and flags the overturned 3A row as not in effect', () => {
    const row = buildInstanceRow({
      meeting_year: '2025', meeting_date: '2025-05-06', meeting_type: 'annual',
      article_number: '23', title: 'Amend Zoning Bylaw - 3A Multi-Family Overlay District',
      disposition: 'adopted', vote_yes: '951', vote_no: '759',
      notes: 'overturned by town-wide special referendum 2025-07-08',
      source_doc: 'x.pdf', source_url: 'https://example.com/x.pdf',
    }, MAP);
    expect(row.tm_vote_yes).toBe(951);
    expect(row.tm_vote_no).toBe(759);
    expect(row.in_effect).toBe(0);
  });

  it('throws on a title missing from the series map', () => {
    expect(() => buildInstanceRow({
      meeting_year: '2024', meeting_date: '2024-05-06', meeting_type: 'annual',
      article_number: '1', title: 'Completely Unknown Article',
      disposition: 'adopted', vote_yes: '', vote_no: '', notes: '',
      source_doc: 'x.pdf', source_url: 'https://example.com/x.pdf',
    }, MAP)).toThrow(/no series mapping/i);
  });
});
```

- [ ] **Step 2: Add to widget include list, run, verify failure**

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run tests/warrant-sync.test.js`
Expected: FAIL, module `../../scripts/sync_warrant_corpus.mjs` not found.

- [ ] **Step 3: Write the sync CLI**

```js
#!/usr/bin/env node
// Sync the warrant corpus CSVs into D1 (article_series, article_instances).
// Mirrors scripts/sync_parcel_owners.mjs: truncate then chunked inserts
// through wrangler d1 execute.
//
// Usage:
//   node scripts/sync_warrant_corpus.mjs [--db community-pulse-staging] [--env staging] [--prod] [--remote]
//
// Defaults to the staging DB, local mode. --prod targets the production
// DB with no wrangler env. Exports buildSeriesRow and buildInstanceRow
// for tests (community-pulse/tests/warrant-sync.test.js).

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseCsv, normalizeTitle } from './warrant_lib.mjs';

export function buildSeriesRow(r) {
  return {
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    first_year: Number(r.first_year),
    last_year: Number(r.last_year),
    notes: r.notes ? r.notes : null,
  };
}

export function buildInstanceRow(r, slugByNormalizedTitle) {
  const slug = slugByNormalizedTitle.get(normalizeTitle(r.title));
  if (!slug) {
    throw new Error(`no series mapping for title: ${r.title} (${r.meeting_year})`);
  }
  const notes = r.notes ? r.notes : null;
  return {
    series_slug: slug,
    meeting_year: Number(r.meeting_year),
    meeting_type: r.meeting_type,
    meeting_date: r.meeting_date,
    article_number: Number(r.article_number),
    title: r.title,
    amount: null,
    fincom_recommendation: null,
    tm_result: r.disposition,
    tm_vote_yes: r.vote_yes ? Number(r.vote_yes) : null,
    tm_vote_no: r.vote_no ? Number(r.vote_no) : null,
    in_effect: notes && notes.includes('overturned') ? 0 : null,
    notes,
    source_doc: r.source_doc,
    source_url: r.source_url,
  };
}

function parseArgs(argv) {
  const args = { db: 'community-pulse-staging', env: 'staging', remote: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') args.db = argv[++i];
    else if (a === '--env') args.env = argv[++i];
    else if (a === '--prod') { args.db = 'community-pulse'; args.env = ''; }
    else if (a === '--remote') args.remote = true;
  }
  return args;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sqlEscape(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function main() {
  const args = parseArgs(process.argv);

  const seriesRows = parseCsv(readFileSync('data/article_series.csv', 'utf-8'))
    .map(buildSeriesRow);
  const mapRows = parseCsv(readFileSync('data/article_series_map.csv', 'utf-8'));
  const slugByNormalizedTitle = new Map(mapRows.map(m => [m.normalized_title, m.slug]));
  const knownSlugs = new Set(seriesRows.map(s => s.slug));

  for (const m of mapRows) {
    if (!knownSlugs.has(m.slug)) {
      throw new Error(`map references unknown series slug: ${m.slug}`);
    }
  }

  const instanceRows = parseCsv(readFileSync('data/town_meeting_results.csv', 'utf-8'))
    .map(r => buildInstanceRow(r, slugByNormalizedTitle));

  console.log(`Series: ${seriesRows.length}, instances: ${instanceRows.length}`);

  const wranglerArgs = ['-y', 'wrangler@4', 'd1', 'execute', args.db];
  if (args.env) wranglerArgs.push('--env', args.env);
  if (args.remote) wranglerArgs.push('--remote');
  else wranglerArgs.push('--local');
  wranglerArgs.push('--command');

  const run = sql => execFileSync('npx', [...wranglerArgs, sql],
    { stdio: 'inherit', cwd: 'community-pulse/worker' });

  run('DELETE FROM article_instances;');
  run('DELETE FROM article_series;');

  const SERIES_COLS = ['slug', 'title', 'kind', 'first_year', 'last_year', 'notes'];
  for (const batch of chunk(seriesRows, 200)) {
    const values = batch.map(r => `(${SERIES_COLS.map(c => sqlEscape(r[c])).join(',')})`).join(',');
    run(`INSERT INTO article_series (${SERIES_COLS.join(',')}) VALUES ${values};`);
  }

  const INSTANCE_COLS = ['series_slug', 'meeting_year', 'meeting_type', 'meeting_date',
    'article_number', 'title', 'amount', 'fincom_recommendation', 'tm_result',
    'tm_vote_yes', 'tm_vote_no', 'in_effect', 'notes', 'source_doc', 'source_url'];
  for (const batch of chunk(instanceRows, 100)) {
    const values = batch.map(r => `(${INSTANCE_COLS.map(c => sqlEscape(r[c])).join(',')})`).join(',');
    run(`INSERT INTO article_instances (${INSTANCE_COLS.join(',')}) VALUES ${values};`);
  }

  console.log(`Inserted ${seriesRows.length} series and ${instanceRows.length} instances.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Run unit tests, verify pass**

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run tests/warrant-sync.test.js`
Expected: PASS.

- [ ] **Step 5: Sync the local D1 and verify counts**

Run:
```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
node scripts/sync_warrant_corpus.mjs --db community-pulse --env ''
cd community-pulse/worker
npx -y wrangler@4 d1 execute community-pulse --local --command "SELECT (SELECT COUNT(*) FROM article_series) AS series, (SELECT COUNT(*) FROM article_instances) AS instances;"
```
Expected: `instances` = 398; `series` matches the Task 3 build output. If `buildInstanceRow` throws a `no series mapping` error, a title variant is missing from `ALIASES`; fix it in `scripts/warrant_lib.mjs`, add a test case, regenerate the Task 3 CSVs, and rerun.

- [ ] **Step 6: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
git add scripts/sync_warrant_corpus.mjs community-pulse/tests/warrant-sync.test.js community-pulse/vitest.config.js
git commit -m "corpus: D1 sync script for warrant series and instances

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: API v1 scaffold (module, mount, CORS, ETag)

**Files:**
- Create: `community-pulse/worker/src/api_v1.js`
- Create: `community-pulse/tests/api-v1.test.js`
- Modify: `community-pulse/worker/src/index.js` (mount in `handleRequest`, right after the OPTIONS preflight block)
- Modify: `community-pulse/vitest.config.js` (add `'tests/api-v1.test.js'` to the **worker** project's `include` array)

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: `handleApiV1(request, env, url) -> Promise<Response|null>` (null when the path is not under `/api/v1/`); helper `jsonResponse(request, data, { maxAge }) -> Promise<Response>` used by Tasks 6-7. Route added here: `GET /api/v1/` index. All responses carry `Access-Control-Allow-Origin: *`.

- [ ] **Step 1: Write the failing test**

```js
// community-pulse/tests/api-v1.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { handleRequest } from '../worker/src/index.js';

async function get(path, headers = {}) {
  const req = new Request(`https://pulse.example.com${path}`, { headers });
  return handleRequest(req, env);
}

beforeEach(async () => {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS article_series (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      first_year INTEGER,
      last_year INTEGER,
      notes TEXT
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS article_instances (
      series_slug TEXT NOT NULL,
      meeting_year INTEGER NOT NULL,
      meeting_type TEXT NOT NULL DEFAULT 'annual',
      meeting_date TEXT,
      article_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      amount REAL,
      fincom_recommendation TEXT,
      tm_result TEXT,
      tm_vote_yes INTEGER,
      tm_vote_no INTEGER,
      in_effect INTEGER,
      notes TEXT,
      source_doc TEXT,
      source_url TEXT,
      PRIMARY KEY (meeting_year, meeting_type, article_number)
    )
  `).run();
  await env.DB.prepare('DELETE FROM article_instances').run();
  await env.DB.prepare('DELETE FROM article_series').run();

  await env.DB.prepare(
    "INSERT INTO article_series (slug, title, kind, first_year, last_year, notes) VALUES " +
    "('walls-and-fences','Walls and Fences','money_article',2019,2025,NULL)," +
    "('consent-articles','Consent Articles','consent',2024,2025,NULL)"
  ).run();
  await env.DB.prepare(
    "INSERT INTO article_instances (series_slug, meeting_year, meeting_type, meeting_date, article_number, title, tm_result, tm_vote_yes, tm_vote_no, in_effect, notes, source_doc, source_url) VALUES " +
    "('walls-and-fences',2024,'annual','2024-05-06',9,'Walls and Fences','adopted',674,107,NULL,NULL,'atr2024.pdf','https://example.com/atr2024.pdf')," +
    "('walls-and-fences',2025,'annual','2025-05-06',9,'Walls and Fences','adopted',392,36,NULL,NULL,'atr2025.pdf','https://example.com/atr2025.pdf')," +
    "('consent-articles',2025,'annual','2025-05-06',3,'Consent Articles','adopted',402,22,NULL,NULL,'atr2025.pdf','https://example.com/atr2025.pdf')"
  ).run();
});

describe('GET /api/v1/', () => {
  it('returns the endpoint index with open CORS', async () => {
    const res = await get('/api/v1/');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const body = await res.json();
    expect(body.name).toBe('marblehead warrant corpus api');
    expect(body.version).toBe(1);
    expect(body.endpoints).toContain('/api/v1/series');
  });
});

describe('unknown v1 path', () => {
  it('returns JSON 404 with open CORS', async () => {
    const res = await get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.json()).toEqual({ error: 'not found' });
  });
});

describe('ETag handling', () => {
  it('returns 304 on matching If-None-Match', async () => {
    const first = await get('/api/v1/');
    const etag = first.headers.get('ETag');
    expect(etag).toBeTruthy();
    const second = await get('/api/v1/', { 'If-None-Match': etag });
    expect(second.status).toBe(304);
  });
});
```

- [ ] **Step 2: Add to the worker include list, run, verify failure**

In `community-pulse/vitest.config.js`, worker project, append `'tests/api-v1.test.js'` to `include`.

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run tests/api-v1.test.js`
Expected: FAIL; `/api/v1/` currently falls through to the worker's 404 plain-text response, so status and body assertions fail.

- [ ] **Step 3: Write the module and mount it**

```js
// community-pulse/worker/src/api_v1.js
// Public, versioned, read-only API over the warrant corpus.
// Open CORS by design: this is public-record data. Write endpoints do
// not belong in this module; they stay session-authed elsewhere.

const V1_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
  'Content-Type': 'application/json',
};

const ENDPOINTS = [
  '/api/v1/',
  '/api/v1/series',
  '/api/v1/series/:slug',
  '/api/v1/meetings/:year',
  '/api/v1/openapi.json',
];

async function computeEtag(body) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `"${hex.slice(0, 32)}"`;
}

export async function jsonResponse(request, data, { maxAge = 300, status = 200 } = {}) {
  const body = JSON.stringify(data);
  const headers = {
    ...V1_HEADERS,
    'Cache-Control': `public, max-age=${maxAge}`,
  };

  if (status === 200) {
    const etag = await computeEtag(body);
    headers.ETag = etag;

    if (request.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers });
    }
  }

  return new Response(body, { status, headers });
}

export async function handleApiV1(request, env, url) {
  if (!url.pathname.startsWith('/api/v1/') && url.pathname !== '/api/v1') return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: V1_HEADERS });
  }
  if (request.method !== 'GET') {
    return jsonResponse(request, { error: 'method not allowed' }, { status: 405, maxAge: 0 });
  }

  const path = url.pathname.replace(/\/$/, '') || '/api/v1';

  if (path === '/api/v1') {
    return jsonResponse(request, {
      name: 'marblehead warrant corpus api',
      version: 1,
      endpoints: ENDPOINTS,
    });
  }

  return jsonResponse(request, { error: 'not found' }, { status: 404, maxAge: 0 });
}
```

In `community-pulse/worker/src/index.js`, add the import at the top with the other imports:

```js
import { handleApiV1 } from './api_v1.js';
```

and mount immediately after the OPTIONS preflight block (before the `/api/reactions` branch), so v1 handles its own OPTIONS in future but existing behavior is unchanged. Replace:

```js
  // CORS preflight.
  if (request.method === 'OPTIONS') {
    return corsResponse(request, env);
  }
```

with:

```js
  // Public versioned API (open CORS, handles its own preflight).
  if (url.pathname === '/api/v1' || url.pathname.startsWith('/api/v1/')) {
    const v1Response = await handleApiV1(request, env, url);
    if (v1Response) return v1Response;
  }

  // CORS preflight.
  if (request.method === 'OPTIONS') {
    return corsResponse(request, env);
  }
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run tests/api-v1.test.js`
Expected: PASS (the series/instances describe blocks arrive in Task 6; only index, 404, and ETag tests exist so far).

- [ ] **Step 5: Full suite**

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run`
Expected: everything passes; the OPTIONS-preflight reorder must not break `worker.test.js` or `engagement.test.js`.

- [ ] **Step 6: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
git add community-pulse/worker/src/api_v1.js community-pulse/worker/src/index.js community-pulse/tests/api-v1.test.js community-pulse/vitest.config.js
git commit -m "worker: mount /api/v1 with open CORS, ETag, index route

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Series endpoints (list and detail)

**Files:**
- Modify: `community-pulse/worker/src/api_v1.js`
- Modify: `community-pulse/tests/api-v1.test.js`

**Interfaces:**
- Consumes: `jsonResponse`, Task 1 tables, Task 5 routing.
- Produces:
  - `GET /api/v1/series[?kind=]` -> `{ series: [{ slug, title, kind, first_year, last_year, instance_count }] }`
  - `GET /api/v1/series/:slug` -> `{ slug, title, kind, first_year, last_year, notes, instances: [{ meeting_year, meeting_type, meeting_date, article_number, title, tm_result, tm_vote_yes, tm_vote_no, in_effect, notes, source_doc, source_url }] }` ordered by `meeting_year` ascending. Plan 3's app consumes these shapes verbatim.

- [ ] **Step 1: Add failing tests**

Append to `community-pulse/tests/api-v1.test.js`:

```js
describe('GET /api/v1/series', () => {
  it('lists series with instance counts', async () => {
    const res = await get('/api/v1/series');
    expect(res.status).toBe(200);
    const body = await res.json();
    const walls = body.series.find(s => s.slug === 'walls-and-fences');
    expect(walls).toEqual({
      slug: 'walls-and-fences', title: 'Walls and Fences', kind: 'money_article',
      first_year: 2019, last_year: 2025, instance_count: 2,
    });
  });

  it('filters by kind', async () => {
    const res = await get('/api/v1/series?kind=consent');
    const body = await res.json();
    expect(body.series.map(s => s.slug)).toEqual(['consent-articles']);
  });

  it('rejects an unknown kind', async () => {
    const res = await get('/api/v1/series?kind=bogus');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid kind' });
  });
});

describe('GET /api/v1/series/:slug', () => {
  it('returns the series with its instances oldest first', async () => {
    const res = await get('/api/v1/series/walls-and-fences');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe('walls-and-fences');
    expect(body.instances).toHaveLength(2);
    expect(body.instances[0].meeting_year).toBe(2024);
    expect(body.instances[1].meeting_year).toBe(2025);
    expect(body.instances[1].tm_vote_yes).toBe(392);
    expect(body.instances[1].source_url).toBe('https://example.com/atr2025.pdf');
  });

  it('404s an unknown slug', async () => {
    const res = await get('/api/v1/series/not-a-series');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });
});
```

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run tests/api-v1.test.js`
Expected: the new describe blocks FAIL with 404s; earlier tests still pass.

- [ ] **Step 2: Implement the routes**

In `community-pulse/worker/src/api_v1.js`, add before the final 404 return in `handleApiV1`:

```js
  if (path === '/api/v1/series') {
    return handleSeriesList(request, env, url);
  }

  const seriesMatch = path.match(/^\/api\/v1\/series\/([a-z0-9-]+)$/);
  if (seriesMatch) {
    return handleSeriesDetail(request, env, seriesMatch[1]);
  }
```

and add the handlers at module level:

```js
const VALID_KINDS = ['budget_line', 'money_article', 'other_article', 'consent'];

async function handleSeriesList(request, env, url) {
  const kind = url.searchParams.get('kind');
  if (kind && !VALID_KINDS.includes(kind)) {
    return jsonResponse(request, { error: 'invalid kind' }, { status: 400, maxAge: 0 });
  }

  const base =
    'SELECT s.slug, s.title, s.kind, s.first_year, s.last_year, ' +
    'COUNT(i.article_number) AS instance_count ' +
    'FROM article_series s ' +
    'LEFT JOIN article_instances i ON i.series_slug = s.slug ';
  const tail = 'GROUP BY s.slug ORDER BY s.slug';

  const stmt = kind
    ? env.DB.prepare(`${base} WHERE s.kind = ? ${tail}`).bind(kind)
    : env.DB.prepare(`${base} ${tail}`);
  const { results } = await stmt.all();

  return jsonResponse(request, { series: results });
}

async function handleSeriesDetail(request, env, slug) {
  const series = await env.DB.prepare(
    'SELECT slug, title, kind, first_year, last_year, notes FROM article_series WHERE slug = ?'
  ).bind(slug).first();

  if (!series) {
    return jsonResponse(request, { error: 'not found' }, { status: 404, maxAge: 0 });
  }

  const { results: instances } = await env.DB.prepare(
    'SELECT meeting_year, meeting_type, meeting_date, article_number, title, ' +
    'tm_result, tm_vote_yes, tm_vote_no, in_effect, notes, source_doc, source_url ' +
    'FROM article_instances WHERE series_slug = ? ' +
    'ORDER BY meeting_year ASC, meeting_type ASC, article_number ASC'
  ).bind(slug).all();

  return jsonResponse(request, { ...series, instances });
}
```

- [ ] **Step 3: Run tests, verify pass**

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run tests/api-v1.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
git add community-pulse/worker/src/api_v1.js community-pulse/tests/api-v1.test.js
git commit -m "worker: /api/v1/series list and detail endpoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Meetings endpoint, OpenAPI document, README docs

**Files:**
- Create: `community-pulse/worker/src/openapi.js`
- Modify: `community-pulse/worker/src/api_v1.js`
- Modify: `community-pulse/tests/api-v1.test.js`
- Modify: `community-pulse/README.md` (new section)

**Interfaces:**
- Consumes: Tasks 5-6.
- Produces:
  - `GET /api/v1/meetings/:year` -> `{ year, articles: [instance shape from Task 6 plus series_slug] }` ordered by meeting_type then article_number
  - `GET /api/v1/openapi.json` -> OpenAPI 3.1 document
  - `OPENAPI` export from `openapi.js`

- [ ] **Step 1: Add failing tests**

Append to `community-pulse/tests/api-v1.test.js`:

```js
describe('GET /api/v1/meetings/:year', () => {
  it('returns all articles for a year', async () => {
    const res = await get('/api/v1/meetings/2025');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2025);
    expect(body.articles).toHaveLength(2);
    expect(body.articles.map(a => a.series_slug).sort())
      .toEqual(['consent-articles', 'walls-and-fences']);
  });

  it('404s a year with no data', async () => {
    const res = await get('/api/v1/meetings/1999');
    expect(res.status).toBe(404);
  });

  it('falls through to 404 for a non-numeric year', async () => {
    const res = await get('/api/v1/meetings/abc');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/openapi.json', () => {
  it('serves an OpenAPI 3.1 document listing the endpoints', async () => {
    const res = await get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe('3.1.0');
    expect(Object.keys(body.paths)).toContain('/api/v1/series/{slug}');
  });
});
```

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run tests/api-v1.test.js`
Expected: new blocks FAIL with 404 bodies.

- [ ] **Step 2: Write openapi.js and the routes**

```js
// community-pulse/worker/src/openapi.js
// OpenAPI 3.1 description of the public read API. Served at
// /api/v1/openapi.json. Extend alongside api_v1.js when routes change.

const instanceSchema = {
  type: 'object',
  properties: {
    meeting_year: { type: 'integer' },
    meeting_type: { type: 'string', enum: ['annual', 'special'] },
    meeting_date: { type: 'string' },
    article_number: { type: 'integer' },
    title: { type: 'string' },
    tm_result: {
      type: ['string', 'null'],
      enum: ['adopted', 'defeated', 'indefinitely_postponed', 'withdrawn', 'not_taken_up', null],
    },
    tm_vote_yes: { type: ['integer', 'null'] },
    tm_vote_no: { type: ['integer', 'null'] },
    in_effect: { type: ['integer', 'null'], description: 'null means same as adoption; 0 means adopted but later overturned' },
    notes: { type: ['string', 'null'] },
    source_doc: { type: ['string', 'null'] },
    source_url: { type: ['string', 'null'] },
  },
};

export const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'Marblehead warrant corpus API',
    version: '1.0.0',
    description: 'Read-only public data: Town Meeting warrant article series and per-year instances with dispositions. Every row traces to a primary source document.',
  },
  paths: {
    '/api/v1/': { get: { summary: 'Endpoint index' } },
    '/api/v1/series': {
      get: {
        summary: 'List article series',
        parameters: [{
          name: 'kind', in: 'query', required: false,
          schema: { type: 'string', enum: ['budget_line', 'money_article', 'other_article', 'consent'] },
        }],
      },
    },
    '/api/v1/series/{slug}': {
      get: {
        summary: 'One series with all its instances, oldest first',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Series detail',
            content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                slug: { type: 'string' },
                title: { type: 'string' },
                kind: { type: 'string' },
                first_year: { type: 'integer' },
                last_year: { type: 'integer' },
                notes: { type: ['string', 'null'] },
                instances: { type: 'array', items: instanceSchema },
              },
            } } },
          },
        },
      },
    },
    '/api/v1/meetings/{year}': {
      get: {
        summary: 'Every article acted on (or passed over) in a meeting year',
        parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer' } }],
      },
    },
    '/api/v1/openapi.json': { get: { summary: 'This document' } },
  },
};
```

In `api_v1.js`, import and route (before the final 404):

```js
import { OPENAPI } from './openapi.js';
```

```js
  if (path === '/api/v1/openapi.json') {
    return jsonResponse(request, OPENAPI, { maxAge: 3600 });
  }

  const meetingsMatch = path.match(/^\/api\/v1\/meetings\/(\d{4})$/);
  if (meetingsMatch) {
    return handleMeetingYear(request, env, Number(meetingsMatch[1]));
  }
```

and the handler:

```js
async function handleMeetingYear(request, env, year) {
  const { results } = await env.DB.prepare(
    'SELECT series_slug, meeting_year, meeting_type, meeting_date, article_number, ' +
    'title, tm_result, tm_vote_yes, tm_vote_no, in_effect, notes, source_doc, source_url ' +
    'FROM article_instances WHERE meeting_year = ? ' +
    'ORDER BY meeting_type ASC, article_number ASC'
  ).bind(year).all();

  if (results.length === 0) {
    return jsonResponse(request, { error: 'not found' }, { status: 404, maxAge: 0 });
  }
  return jsonResponse(request, { year, articles: results });
}
```

(A non-numeric year fails the `\d{4}` route match and falls through to the 404, which the test asserts.)

- [ ] **Step 3: Run tests, verify pass, run full suite**

Run: `cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse && npx vitest run`
Expected: all tests pass.

- [ ] **Step 4: Document in the README**

Append to `community-pulse/README.md`:

```markdown
## Public read API (/api/v1)

Read-only warrant corpus endpoints, open CORS, no auth:

- `GET /api/v1/` endpoint index
- `GET /api/v1/series?kind=money_article` series list with instance counts
- `GET /api/v1/series/<slug>` one series plus all instances, oldest first
- `GET /api/v1/meetings/<year>` every article in that year's meetings
- `GET /api/v1/openapi.json` machine-readable description

Data pipeline: `data/town_meeting_results.csv` (hand-verified, per-row
provenance) plus generated `data/article_series.csv` and
`data/article_series_map.csv` (regenerate with
`node scripts/build_warrant_series.mjs`), loaded into D1 with
`node scripts/sync_warrant_corpus.mjs [--prod] [--remote]` from the
repo root. Rerun the sync after any corpus CSV change.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
git add community-pulse/worker/src/api_v1.js community-pulse/worker/src/openapi.js community-pulse/tests/api-v1.test.js community-pulse/README.md
git commit -m "worker: meetings endpoint, OpenAPI doc, API README section

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Staging rollout, then production

**Files:** none (operational task; run from the worktree).

**Interfaces:**
- Consumes: everything above.
- Produces: live staging and production APIs.

- [ ] **Step 1: Apply migration and sync staging (remote)**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse/worker
npx -y wrangler@4 d1 migrations apply community-pulse-staging --env staging --remote
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
node scripts/sync_warrant_corpus.mjs --remote
```
Expected: migration 0008 applied; sync prints 398 instances inserted.

- [ ] **Step 2: Deploy staging and smoke it**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse/worker
npx -y wrangler@4 deploy --env staging
curl -s https://marblehead-community-pulse-staging.agbaber.workers.dev/api/v1/series?kind=consent | head -c 400
curl -s https://marblehead-community-pulse-staging.agbaber.workers.dev/api/v1/series/expenses-of-several-departments | head -c 600
```
Expected: JSON with consent series; omnibus series detail listing instances for 2019-2025 with tm_result values. If the workers.dev subdomain differs, take the URL from the deploy output.

- [ ] **Step 3: Apply migration, sync, deploy production**

Production deploy is additive (new routes only; existing widget endpoints untouched), but do it deliberately:

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes/community-pulse/worker
npx -y wrangler@4 d1 migrations apply community-pulse --remote
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
node scripts/sync_warrant_corpus.mjs --prod --remote
cd community-pulse/worker
npx -y wrangler@4 deploy
curl -s https://marblehead-community-pulse.agbaber.workers.dev/api/v1/ | head -c 300
curl -s https://marblehead-community-pulse.agbaber.workers.dev/api/v1/meetings/2025 | head -c 400
```
Expected: index JSON; 2025 meeting JSON with 52 articles.

- [ ] **Step 4: Verify the widget still works in production**

```bash
curl -s "https://marblehead-community-pulse.agbaber.workers.dev/api/reactions?section_ids=index.html%23m-override" | head -c 200
```
Expected: JSON reaction counts (not an error); confirms the mount reorder changed nothing for existing consumers.

- [ ] **Step 5: Push the branch**

```bash
cd /Users/agbaber/marblehead/.worktrees/spec-standing-warrant-votes
git push
```
Expected: branch updates PR #1001.

---

## Self-Review Notes

- Spec coverage for Plan 1 scope: schema (Task 1), corpus CSVs plus provenance and DATA_CATALOG (Tasks 3-4 plus already-committed sources), public read API with open CORS, caching, ETags (Tasks 5-7), OpenAPI (Task 7), staging-then-prod rollout (Task 8). Out of scope by design and named as later plans: questions/votes/snapshots, quorum gating, SvelteKit app, street list and voter flags, budget_line series, API keys and rate tiers.
- Type consistency: `jsonResponse(request, data, opts)` used identically in Tasks 5-7; instance payload shape in Task 6 matches the OpenAPI `instanceSchema` in Task 7 and the seeded columns in Task 5's test; `buildInstanceRow` output columns match `INSTANCE_COLS` and the Task 1 schema.
- The Task 4 local-sync step must use `--db community-pulse --env ''` so it targets the same local D1 the Task 1 migration touched (wrangler's local state is per-database-name).
