# Town database GUI Phase 1b: /browse/ shell and four list views

Date: 2026-06-19
Status: ready for implementation planning

Parent spec: `docs/superpowers/specs/2026-06-18-town-database-gui-design.md`

## Overview

Phase 1b ships the `/browse/` section of marbleheaddata.org: a consistent shell (left nav + breadcrumb + per-entity search bar) plus four list views over the SQLite data layer shipped in Phase 1a (PR #906). Vendors, Budget lines, Meetings, Topics. Detail views are deferred to Phase 1c.

The visual register is hybrid: the site's existing palette, fonts, and section chrome are preserved, but tables and table chrome follow tighter rules (compact rows, tabular nums on numbers, sticky table headers, monospace dates). Reads as part of the same site but unmistakably "an operator surface" once you're in it.

Phase 1b also corrects a real data quality issue in Phase 1a's `vendor_payments` ingest: rows where the source CSV's `Division` column is empty or `'UNDEFINED'` get their `department` derived from the `Fund` column instead. About $30M of FY26 spend that currently shows up as `UNDEFINED` resolves into Electric Enterprise, capital projects, and federal grants once that fix lands.

## Goals

- A reachable `/browse/` section with a working left nav, breadcrumb, and per-entity search for all four Phase 1 entities.
- Hybrid visual register: existing palette + Libre Franklin headings + Inter body; tables denser than the rest of the site with tabular nums and sticky headers.
- Mobile responsive: left nav collapses to a sticky entity switcher above 800 px breakpoint.
- Per-entity filter chips and sortable columns per the entity sections below.
- Data correctness: vendor_payments ingest backfills department from fund when Division is empty.
- Smoke test coverage: each list view's structural contract (selectors, row counts, search behavior).

## Non-goals (deferred to Phase 1c or later)

- **No detail views.** Clicking a vendor name or a budget department does not yet open a drilldown. List views are read-only.
- **Meetings and Topics rows do link out** to their existing `/transcripts/<slug>/` or `/topics/<slug>/` pages (those pages already exist). Vendors and Budget rows are inert in this phase.
- **No global cross-entity search.** Per-entity search only.
- **No migration of `/checkbook/` to query the SQLite.** `/checkbook/` keeps its current implementation. `/browse/vendors/` is the new table-shaped sibling. Both exist, both link to each other.
- **No detail-pane / sidebar inspection.** Rows are flat.
- **No charts or sparklines** in list views.
- **No keyboard cmd+K navigation.**
- **No saved filters, no user state.**

## Scope locked in brainstorm (recap)

- All four list views in a single Phase 1b PR.
- Visual register: hybrid (existing palette, denser table chrome).
- UNDEFINED departments: fix the ingest, not the UX.

## Architecture

```
                    +----------------------------------+
   GUI surface  →   |  /browse/* Jekyll pages          |
                    |  layout: browse.html              |
                    |  list-view template + entity JSON |
                    +----------------+-----------------+
                                     |
                                     | reads via sql.js
                                     v
                    +----------------------------------+
   Data backend →   |  assets/data/marbleheaddata.sqlite|
                    |  (12 tables + _meta)              |
                    +----------------+-----------------+
                                     ^
                                     | builds via Python
                    +----------------------------------+
                    |  scripts/build_sqlite_db.py       |
                    |  (Phase 1a, extended in 1b)       |
                    +----------------------------------+
```

The data backend ships in Phase 1a. Phase 1b adds:
- `_layouts/browse.html` (shell layout)
- `assets/browse.js` (sql.js loader, list-view renderer, search, filter chips, sort)
- `assets/browse.css` (table chrome + shell styles)
- One Jekyll page per list view (`browse/index.html`, `browse/vendors.html`, `browse/budget.html`, `browse/meetings.html`, `browse/topics.html`)
- One small extension to `scripts/build_sqlite_db.py` (department backfill from fund)

## Data layer fix: backfill department from fund

The Open Finance vendor CSV has two columns we collapsed into one in Phase 1a:
- `Division`: which division spent (e.g. `POLICE`, `FIRE`, `EXPENSES`)
- `Fund`: which money pool (e.g. `GENERAL FUND - TOWN`, `ELECTRIC ENTERPRISE`, `A11 2022 CAPITAL IMPROVEMENT`)

Phase 1a's ingest mapped `Division → department`. For enterprise funds, capital projects, and federal grants, Division is legitimately empty because the Fund IS the organizational unit. This accounts for ~$30M of the $37M currently labeled `UNDEFINED` in `vendor_payments.department`.

Phase 1b extends the ingest:

```python
# Pseudocode for the ingest backfill (real code lives in plan)
division = (row.get("Division") or "").strip()
fund = (row.get("Fund") or "").strip()
if division and division != "UNDEFINED":
    department = division
elif fund:
    department = fund     # backfill
else:
    department = "Unattributed"
```

Result: the big UNDEFINED pile resolves into specific funds (Electric Enterprise $8.8M, Capital projects $4.9M + $1.3M + $0.7M, federal grants $1.2M + $0.7M, etc.). The remaining ~$7M of genuinely-tagless General Fund spending becomes `Unattributed` (single label, surface-honest).

The SQLite gets rebuilt as part of Phase 1b's first commit. The `vendor_payments` table's row count stays the same; only the `department` distribution changes.

## The /browse/ shell

Common chrome on every `/browse/*` page, via the `browse.html` Jekyll layout. Mockup at desktop width:

```
┌──────────────────────────────────────────────────────────┐
│  Site header (existing site nav)                         │
├────────────────┬─────────────────────────────────────────┤
│                │  Browse > Vendor payments               │
│  BROWSE        ├─────────────────────────────────────────┤
│                │                                         │
│  ◆ Vendors     │  [🔍 search this list]                  │
│  ◆ Budget      │                                         │
│  ◆ Meetings    │  Fiscal year: [all] [FY26]              │
│  ◆ Topics      │  Department: [all] [Police] [...]       │
│                │                                         │
│  ─────────     │  date        vendor          dept       │
│  Download .db  │  2025-07-01  ALL AMERICAN... ART 7...   │
│                │  ...                                    │
└────────────────┴─────────────────────────────────────────┘
```

### Left nav

- Static list of the four Phase 1 entities. Each is an `<a>` to its list view page.
- Below a divider, a "Download the database" link to `/assets/data/marbleheaddata.sqlite` (~4.6 MB). This is the Phase 1a download affordance, preserved.
- Active entity highlighted (matches Jekyll-determined current page).
- Mobile (<800 px): collapses to a sticky entity switcher at the top of the main pane. Switcher is a horizontal row of pill tabs (Vendors | Budget | Meetings | Topics), with the active one highlighted. Download link moves to a footer link on each list view page.

### Breadcrumb

- `Browse > <entity name>` on each list view page.
- Rendered at the top of the main pane.
- Plain text on the first item ("Browse"), bold on the entity name.

### Per-entity search bar

- Top of each list view, full-width on mobile, half-width on desktop.
- Placeholder: `search this list` (or entity-specific text, see entity sections).
- Debounced at 200 ms.
- Implementation: a `LIKE %term%` query on the entity's searchable columns. Per the parent spec's open question #1, if vendor search at 15k rows feels slow, fall back to FTS5 in implementation (decision deferred to plan).

### Visual register

Inherits site palette tokens (`var(--c-navy)`, `var(--c-teal)`, `var(--surface)`, `var(--text)`, `var(--text-muted)`, `var(--border)`). Adds a small set of table-specific tokens in `assets/browse.css`:

```css
:root {
  --browse-row-height: 36px;
  --browse-table-font-size: 14px;
  --browse-numeric-font: ui-monospace, 'Cascadia Mono', Menlo, monospace;
  --browse-row-divider: color-mix(in srgb, var(--c-navy) 8%, transparent);
}
```

Tables use:
- `font-variant-numeric: tabular-nums` on all numeric and date columns.
- Sticky `thead` (`position: sticky; top: 0`) so column headers stay visible during scroll.
- Row height fixed at `--browse-row-height` (36 px desktop, 44 px mobile for touch targets).
- No row background stripes; subtle `border-bottom` per row using `--browse-row-divider`.
- Hover state lifts the row slightly (`background: color-mix(in srgb, var(--c-navy) 4%, transparent)`).

Headings on browse pages stay Libre Franklin; body and table cells use the existing system stack.

## sql.js loading strategy

- On first load of any `/browse/*` page, JS lazy-loads the sql.js WASM (CDN: `https://sql.js.org/dist/sql-wasm.js`) and fetches `/assets/data/marbleheaddata.sqlite`.
- The fetched database is held in `window.__browseDb__` (or equivalent module-scope variable) so subsequent navigations within `/browse/*` reuse the same in-memory database without re-fetching. (Browser cache handles cold-starts on later visits.)
- Loading state: while the DB is loading, the table area shows a small "Loading data..." placeholder; filter chips and search are disabled (visibly grayed-out).
- Error state: if the SQLite fetch fails (404, network error, parse error), the table area shows "Couldn't load the database. Reload to try again." plus the error in a `<details>` for debugging.
- The sql.js script tag is loaded with `defer` so it doesn't block initial render.

## Per-entity list views

### `/browse/vendors/`: Vendor payments

Columns shown (left to right):

| Column | Style | Source |
|---|---|---|
| Date | monospace, tabular | `payment_date` |
| Vendor | text, bold | `vendor` |
| Department | text | `department` (after Phase 1b ingest fix) |
| Fund | text, small | `fund` |
| Amount | monospace, tabular, right-aligned | `amount` formatted as `$XX,XXX.XX` |

**Filter chips (top of table):**
- Fiscal year (multi-select): `FY26`, plus any earlier years present in the data.
- Department (multi-select): top 12 departments by row count, plus "..." that expands to the full list. "Unattributed" surfaces as a chip alongside the named departments.
- Fund (single-select): "All funds" default, plus individual fund chips.

**Sort:**
- Click any column header to sort. Default: `date DESC`.
- Single-column sort only in Phase 1b. Multi-column is a future phase.

**Search:** matches against `vendor`, `department`, `category` (`Description`), `fund`.

**Pagination:** show first 100 rows. "Load more" button at the bottom extends by 100. No traditional pagination UI.

**Footnote below the table:** `Source: assets/data/marbleheaddata.sqlite → vendor_payments. See _meta for citation.`

### `/browse/budget/`: Budget lines

Columns:

| Column | Style | Source |
|---|---|---|
| Fiscal year | monospace, tabular | `fiscal_year` |
| Department | text, bold | `department` |
| Line item | text | `line_item` |
| Fund | text, small | `fund` |
| Amount | monospace, tabular, right-aligned | `amount` formatted as `$X,XXX,XXX` |
| Phase | text, small | `budget_phase` |

**Filter chips:**
- Fiscal year (single-select): FY26 default.
- Department (single-select): Town / Schools / All.

**Sort:** default `fiscal_year DESC, amount DESC`.

**Search:** matches against `line_item`, `department`.

**Pagination:** all rows on one page (current data has 39 rows).

**Important UX note:** the budget_lines table is NOT a clean partition of grand totals (per Phase 1a's noted overlap in `School_Key_Items`). The page footnote says: *"This view is the flattened published key-items breakdown. Department totals here can differ from grand totals because some sub-items overlap. Cite: FY26_budget_summary.json."*

### `/browse/meetings/`: Meetings

Columns:

| Column | Style | Source |
|---|---|---|
| Date | monospace, tabular | `meeting_date` |
| Board | text | `board` (displayed via lookup to a friendlier label, see below) |
| Title | text, links to `url` | `title` linking to `/transcripts/<slug>/` |

Board labels for display:
- `board-of-health` → "Board of Health"
- `select-board` → "Select Board"
- `school-committee` → "School Committee"
- `finance-committee` → "Finance Committee"
- `town-meeting` → "Town Meeting"

(This lookup is a small dict in `browse.js`; no SQLite change.)

**Filter chips:**
- Board (multi-select).
- Year (single-select): current year default, plus all prior years.

**Sort:** default `meeting_date DESC`.

**Search:** matches against `title`.

**Pagination:** 50 rows per page, "Load more" button.

**Detail behavior:** each row's title is a link to its existing transcript page (`url` column). Phase 1c will add a "▸ expand" affordance to preview the digest in-line, but Phase 1b is just a link.

### `/browse/topics/`: Topics

Columns:

| Column | Style | Source |
|---|---|---|
| Topic | text, bold, links to `page_url` | `title` linking to `/topics/<slug>/` |
| Slug | monospace, small | `slug` |
| Meetings tagged | tabular, right-aligned | `meeting_count` (currently 0 in Phase 1a; populate in 1c) |

**Filter chips:** none (13 rows fits on screen).

**Sort:** default `title ASC`.

**Search:** matches against `title`, `slug`.

**Pagination:** none.

**Footnote:** *"The Meetings tagged column populates in Phase 1c once meetings.topic_tags is wired. For now, click a topic to see its existing feed."*

## /browse/ index page

A landing card surface at `/browse/`. Four cards, one per entity:

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  VENDORS       │  │  BUDGET        │  │  MEETINGS      │  │  TOPICS        │
│                │  │                │  │                │  │                │
│  15,732 rows   │  │  39 rows       │  │  233 rows      │  │  13 rows       │
│  Every vendor  │  │  Department    │  │  Every meeting │  │  The topic     │
│  check this    │  │  by line item, │  │  with an       │  │  pages and     │
│  fiscal year.  │  │  General Fund. │  │  ingested      │  │  what's tagged │
│                │  │                │  │  transcript.   │  │  to each.      │
│  → Browse      │  │  → Browse      │  │  → Browse      │  │  → Browse      │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘
```

Row counts pulled from `_meta` at render time (or build time). Cards use the existing tile chrome (`.home-tile` class) for consistency.

Above the cards: a single intro paragraph explaining what `/browse/` is. Two sentences max. Cite the SQLite as the underlying source and link to the download.

## URL structure (Phase 1b)

```
/browse/             index page; intro + 4 entity cards
/browse/vendors/     list view
/browse/budget/      list view
/browse/meetings/    list view
/browse/topics/      list view
```

No detail-view URLs in Phase 1b. Meetings and Topics rows link to existing `/transcripts/<slug>/` and `/topics/<slug>/`. Vendors and Budget rows are inert (no click target inside the row).

## Mobile behavior (<800 px)

- Left nav collapses into a sticky pill-tab switcher at the top of each list view.
- Filter chips wrap to multiple lines.
- Tables become horizontally scrollable (`overflow-x: auto`) within their container.
- Row height bumps to 44 px for touch targets.
- "Load more" buttons are full-width.

## Smoke test additions

Extend `tests/smoke-test.mjs` with assertions for the four new list views:

```js
async function testBrowseEntity(page, entitySlug, expectedSelectors) {
  console.log(`\n── /browse/${entitySlug}/ ──`);
  const res = await page.goto(`${SITE}/browse/${entitySlug}/`, { waitUntil: 'networkidle' });
  res.status() === 200 ? ok('200') : fail('status', res.status());
  for (const sel of expectedSelectors) {
    const el = await page.$(sel);
    el ? ok(`${sel} present`) : fail(`${sel} missing`, '');
  }
  // Wait for table to populate (sql.js async).
  await page.waitForSelector('.browse-table tbody tr', { timeout: 5000 });
  const rows = await page.$$('.browse-table tbody tr');
  rows.length > 0 ? ok(`${rows.length} rows rendered`) : fail('rows', 'none');
}
```

Plus an index-page assertion: `/browse/` returns 200 and has 4 `.home-tile` cards.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `_layouts/browse.html` | Create | Shell with left nav, breadcrumb, search bar |
| `assets/browse.js` | Create | sql.js loader, list-view renderer, filter/sort/search |
| `assets/browse.css` | Create | Shell styles + table chrome tokens |
| `browse/index.html` | Create | 4-card index page |
| `browse/vendors.html` | Create | Vendors list view, calls into browse.js with config |
| `browse/budget.html` | Create | Budget list view |
| `browse/meetings.html` | Create | Meetings list view |
| `browse/topics.html` | Create | Topics list view |
| `scripts/build_sqlite_db.py` | Modify | Add Fund fallback to vendor_payments department |
| `scripts/test_build_sqlite_db.py` | Modify | Add test for backfill behavior |
| `assets/data/marbleheaddata.sqlite` | Regenerate | Build artifact, rebuilt with the ingest fix |
| `tests/smoke-test.mjs` | Modify | 4 new test functions for the list views |

## Out of scope

- Detail views (Phase 1c).
- Migration of `/checkbook/` to query SQLite (future phase).
- Global cmd+K search (Phase 2).
- New entities (Officials, Documents, Charts, Peer towns).
- Cross-references between entities (Phase 1c).
- Authentication, saved filters, user state.
- Charts or sparklines.

## Open questions for implementation

1. **Vendor search performance.** 15,732 rows on a `LIKE %term%` query against three columns via sql.js. The plan should include a quick benchmark in an early task; if p95 > 500 ms on a typical viewer device, switch to FTS5 (build-time virtual table).

2. **`browse.js` size budget.** A single bundle for shell + 4 list views could grow. If it crosses ~600 lines, the plan should split into `browse-shell.js` + `browse-table.js`. Implementation choice.

3. **Module pattern.** ES modules vs IIFE vs script-tag globals. The existing site uses plain script tags with globals (per `assets/explore.js`, `assets/ballot.js`). Stay with that pattern unless it produces real friction.

4. **Where the entity config lives.** Each list view's columns/filters/sort defaults could live in a YAML data file (`_data/browse_entities.yml`) or inline in each `browse/<entity>.html`. Plan picks one. Inline is simpler for 4 entities; YAML is cleaner if Phase 2 adds more.

5. **Mobile sticky-switcher implementation.** CSS `position: sticky` with `display: flex` row of pills is the simple approach. If that fights with the site header's existing sticky behavior, the plan picks a fallback (e.g. absolute positioning within the page container).

6. **Index page row counts: build-time or run-time.** The 4 entity cards show row counts (15,732 vendors etc.). Cleanest is build-time: a Jekyll generator or a small `_data/browse_counts.yml` produced by the build script. Run-time means JS reads `_meta` after sql.js loads, which delays the count's appearance. Plan picks build-time.
