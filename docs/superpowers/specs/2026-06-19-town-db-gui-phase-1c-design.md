# Town database GUI Phase 1c: detail views and cross-references

Date: 2026-06-19
Status: ready for implementation planning

Parent spec: `docs/superpowers/specs/2026-06-18-town-database-gui-design.md`
Phase 1b spec: `docs/superpowers/specs/2026-06-19-town-db-gui-phase-1b-design.md`

## Overview

Phase 1c turns `/browse/` from a set of independent list views into a graph. Two new detail-view templates (vendor and department), cross-reference links from list rows into details, and the meeting-to-topic cross-tagging that populates `meetings.topic_tags` and `topics.meeting_count`.

The lift is smaller than expected because the meeting-to-topic mapping isn't an NLP project. Each transcript already carries a `topic_segments:` array in its front-matter with `topic:` + `topic_confidence:` per segment (used by the existing `_includes/topic-feed.html`). The Phase 1a meeting ingest just needs to harvest the distinct `topic` values per transcript into a comma-separated `topic_tags` string.

Where this stops being "alternative views of stuff you already have" and starts being "things you couldn't see before": clicking a vendor in `/browse/vendors/` opens a page that totals their payments across funds and departments. Clicking a department in either vendors or budget opens a page that aggregates every vendor paid + every budget line + every meeting tagged to that department's topical area. That's a query no other surface on the site answers.

## Goals

- New `/browse/vendors/<slug>/` detail page with per-vendor totals, all payments, and a fund/department breakdown.
- New `/browse/dept/<slug>/` detail page that joins vendors, budget_lines, and meetings around a department name.
- `vendor_payments` rows in the existing list view link the department column to the department detail.
- `budget_lines` rows link the department column to the department detail.
- `meetings.topic_tags` populated from transcript `topic_segments[].topic` (de-duplicated, comma-joined).
- `topics.meeting_count` populated from a `JOIN` against `meetings.topic_tags`.
- The existing `/browse/topics/` list view shows real `meeting_count` values per row (currently all 0).
- Meeting rows surface topic tags as small clickable chips that link to `/topics/<slug>/`.
- Smoke test coverage for both new detail pages and the new cross-reference behaviors.

## Non-goals

- **No Departments left-nav entry.** Departments are reached via cross-references only, not via `/browse/departments/`.
- **No budget-line detail pages.** Budget lines are leaves (single FY × dept × line_item rows). They link sideways to department detail.
- **No fund detail pages.** Same reason.
- **No global cross-entity search.**
- **No charts / sparklines** on detail pages. Tables and totals only.
- **No migration of `/checkbook/` to query SQLite.** Future phase.
- **No editorial cross-linking** (Phase 2 candidate): the existing /topics/ pages, /override/, etc. don't change in this phase.

## Architecture

```
                      +-----------------------------------+
   List views      →  |  /browse/vendors/, /budget/,      |
                      |  /meetings/, /topics/ (Phase 1b)  |
                      +-----------------+-----------------+
                                        |
                  row click             |  row click
   (department, slug)                   |  (meeting board, topic)
                                        v
                      +-----------------------------------+
   Detail views    →  |  /browse/vendors/<slug>/          |
                      |  /browse/dept/<slug>/              |
                      +-----------------+-----------------+
                                        |
                                        | sql.js queries
                                        v
                      +-----------------------------------+
   Data backend    →  |  marbleheaddata.sqlite             |
                      |  (12 tables; meetings.topic_tags   |
                      |   and topics.meeting_count are now |
                      |   populated)                       |
                      +-----------------+-----------------+
                                        ^
                                        | builds via Python
                      +-----------------------------------+
                      |  scripts/build_sqlite_db.py        |
                      |  (extended to harvest topic_segments)|
                      +-----------------------------------+
```

Detail pages reuse the `/browse/` shell layout from Phase 1b. The same `assets/browse.js` IIFE adds a new public function `Browse.renderDetailView(config)` so the per-page bootstrapping pattern stays consistent.

## Data layer changes

### 1. `meetings.topic_tags` populated from `topic_segments[].topic`

Phase 1a's meeting ingest reads transcript front-matter but only picks scalar fields. The `topic_segments` array is parsed as YAML in Jekyll's Liquid include but never made it into the SQLite.

Extension to `build_meetings(conn)` in `scripts/build_sqlite_db.py`:

```python
# Pseudocode for the topic_tags harvest (real code in plan)
def _harvest_topic_tags(path: Path) -> str:
    """Return comma-joined distinct topic slugs from transcript topic_segments."""
    seen = set()
    in_segments = False
    with path.open(encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped == "topic_segments:":
                in_segments = True
                continue
            if in_segments:
                if stripped.startswith("- topic:"):
                    slug = stripped.split(":", 1)[1].strip()
                    seen.add(slug)
                elif line.startswith(("---", "summary_card", "votes", "decisions", "narrative_arc")):
                    break
    return ",".join(sorted(seen))
```

Then `meetings.topic_tags` gets the harvested string. Empty string for transcripts without `topic_segments` (older imports).

### 2. `topics.meeting_count` populated from a JOIN

After both `meetings` and `topics` are built, run an UPDATE to set each topic's `meeting_count`:

```sql
UPDATE topics SET meeting_count = (
  SELECT COUNT(*) FROM meetings
  WHERE meetings.topic_tags LIKE ('%' || topics.slug || '%')
);
```

(LIKE with the slug surrounded by commas would be safer; the build script uses `',' || topic_tags || ','` to avoid prefix-match collisions. Real code in plan.)

## New surfaces

### `/browse/vendors/<slug>/`: vendor detail

URL: `/browse/vendors/<slug>/` where `<slug>` is the vendor name slugified (lowercase, non-alphanumerics → hyphens, collapsed). Slug collisions get a numeric suffix in the data file at build time, not at query time. The page reads its slug from the URL via JS and queries the SQLite for matching rows.

Layout:

```
Browse > Vendors > Hilltop Securities Inc.

HILLTOP SECURITIES INC.
─────────────────────
Total paid this fiscal year:  $66,529.80      Payments:  1
Departments served:           DEBT SERVICE     Funds:    GENERAL FUND - TOWN
First payment: 2026-06-17    Last payment: 2026-06-17

All payments:
date         dept             fund                       category               amount
2026-06-17   DEBT SERVICE     GENERAL FUND - TOWN        Debt service payment   $66,529.80

By department:
DEBT SERVICE                                                                    $66,529.80
```

Sections:
- **Header** with vendor name (uppercased to match the source CSV's voice), total, payment count, date range, departments served, funds used.
- **All payments** table (the same `.browse-table` styling, paginated 50 at a time with Load more).
- **By department** aggregate table (dept name, total, payment count). Each department links to `/browse/dept/<dept-slug>/`.
- **Footnote** with source cite.

If the vendor has only one payment, the "By department" section collapses or is omitted.

Multi-year handling: for FY26 there's only one fiscal year. The header skips the year-over-year section. If/when a prior-year CSV gets added, the same template auto-renders a year-over-year table.

### `/browse/dept/<slug>/`: department detail

URL: `/browse/dept/<slug>/` where `<slug>` is the department name slugified.

Layout:

```
Browse > Departments > Electric Enterprise

ELECTRIC ENTERPRISE
───────────────────
Total vendor spend this FY:   $8,808,736       Vendor rows:  278
Budget lines this FY:         (none in budget_lines for this fund)
Topics frequently discussed:  (none of the high-level topic slugs match)

Top vendors:
vendor                                          payments      total
BERKSHIRE WIND POWER COOPERATIVE CORP           12            $1,234,567
MYERS CONTROLLED POWER LLC                      27            $987,654
NORTHEAST PUBLIC POWER ASSOC                    18            $654,321
...

Budget lines (FY26):
(none: Electric Enterprise is an enterprise fund, not in the general fund key items)

Related meetings:
(empty: no topic in topic_seeds.json maps cleanly to "Electric Enterprise")
```

Sections:
- **Header** with department name (uppercased), total vendor spend, total budget appropriated, top vendor, top line item.
- **Top vendors** table (10 rows by total). Each vendor links to `/browse/vendors/<slug>/`. Load more to expand.
- **Budget lines** table (filtered to this department). May be empty if the department is a fund without budget_lines rows.
- **Related meetings** table. Meetings whose `topic_tags` overlap with this department's topical area. Phase 1c uses a loose heuristic in the page config (e.g. "Public Safety" department → topics `public-safety`); if no mapping is defined, this section shows "no related meetings tagged." Phase 2 can add a real mapping.

### Cross-reference links from list views

- `/browse/vendors/` department column: each cell becomes `<a href="/browse/dept/<slug>/">DEPT NAME</a>`. The link is generated client-side in `browse.js` from the cell value (slugify on render). Vendor column also linkifies to vendor detail.
- `/browse/budget/` department column: same as above.
- `/browse/meetings/` adds a small "topics" column rendered as little chips. Each chip is a link to `/topics/<slug>/` (the existing topic page).
- `/browse/topics/` row's title already linked. The `meeting_count` column now has non-zero values for any topic the transcripts touch.

`browse.js` config additions:

```javascript
{
  column: "department",
  label: "Department",
  linkTemplate: "/browse/dept/{slugify(value)}/"
}
```

A new `linkTemplate` field handles client-side URL templating (slugify is exposed as a tiny JS helper). When both `linkColumn` (existing) and `linkTemplate` (new) are unset, the cell stays plain.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/build_sqlite_db.py` | Modify | `_harvest_topic_tags` helper; populate `meetings.topic_tags` and `topics.meeting_count` |
| `scripts/test_build_sqlite_db.py` | Modify | Tests for the topic_tags harvest and meeting_count populate |
| `assets/data/marbleheaddata.sqlite` | Regenerate | Build artifact with topic_tags and meeting_count |
| `assets/browse.js` | Modify | Add `renderDetailView`, slugify helper, linkTemplate column support |
| `assets/browse.css` | Modify | Detail-page header card, aggregate-table chrome |
| `browse/vendors/index.html` | Modify (or rename from current) | Existing vendors list view stays; detail page lives below |
| `browse/vendors/_detail.html` | Create | Vendor detail page (one slug-driven template) |
| `browse/dept/_detail.html` | Create | Department detail page |
| `_layouts/browse.html` | Modify | Extend breadcrumb to handle 3 segments (Browse > Entity > Title) |
| `tests/smoke-test.mjs` | Modify | testBrowseVendorDetail, testBrowseDeptDetail, testTopicMeetingCounts |

Detail-page slugs work like this: a single Jekyll-generated page at `/browse/vendors/__detail/` (or similar) reads `?slug=` from query string OR pathname. Jekyll doesn't natively render one-page-per-row for thousands of vendors. Implementation chooses between:

- **A. Query string** (`/browse/vendors/?vendor=hilltop-securities-inc`): list view and detail share the same URL, JS toggles a "detail panel" view. Simple, ugly URLs.
- **B. Path with shared template** (`/browse/vendors/<slug>/`): a single `browse/vendors.html` page is configured with a permalink that captures the slug. Jekyll doesn't directly support param-style permalinks, so this requires a build-time hack (generate one page per slug, or use `.html` + JS rewrites). Pretty URLs, harder to ship.
- **C. Hash-based** (`/browse/vendors/#hilltop-securities-inc`): one page, hash drives the detail render. Pretty URLs, no Jekyll work, works as a clean SPA-style overlay.

**Plan recommendation: C.** Browser handles back/forward via hashchange, no build-time fan-out, no query-string ugliness. The detail page is a section within `/browse/vendors/` that shows/hides based on `location.hash`. Same approach for `/browse/dept/<slug>/`.

## URL structure (Phase 1c)

```
/browse/                              (unchanged from 1b)
/browse/vendors/                      list view (1b)
/browse/vendors/#<slug>                 vendor detail (hash-driven)
/browse/budget/                       list view (1b)
/browse/meetings/                     list view (1b)
/browse/topics/                       list view (1b)
/browse/dept/                         new: list view of departments (just for the route to exist)
/browse/dept/#<slug>                    department detail (hash-driven)
```

`/browse/dept/` (no hash) renders an empty-state page with a one-liner like *"Pick a department from the Vendors or Budget tables."* This avoids a 404 if someone navigates to the bare URL.

## Smoke test additions

```js
async function testVendorDetail(page) {
  // Hash-driven, so set the hash then wait.
  await page.goto(`${SITE}/browse/vendors/#hilltop-securities-inc`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.detail-header', { timeout: 5000 });
  const header = await page.textContent('.detail-header');
  header.includes('HILLTOP SECURITIES') ? ok('vendor detail header rendered') : fail('vendor detail', header);
  const rows = await page.$$('.detail-payments tbody tr');
  rows.length > 0 ? ok(`${rows.length} payment rows`) : fail('vendor detail payments', 'none');
}

async function testDeptDetail(page) {
  await page.goto(`${SITE}/browse/dept/#electric-enterprise`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.detail-header', { timeout: 5000 });
  const vendors = await page.$$('.detail-top-vendors tbody tr');
  vendors.length > 0 ? ok(`${vendors.length} top vendors`) : fail('dept detail vendors', 'none');
}

async function testTopicMeetingCounts(page) {
  await page.goto(`${SITE}/browse/topics/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.browse-table tbody tr', { timeout: 10000 });
  // Read all the meeting_count cells; at least one should be > 0 now.
  const counts = await page.$$eval('.browse-table tbody tr td:nth-child(3)', els => els.map(e => parseInt(e.textContent, 10)));
  counts.some(c => c > 0) ? ok(`${counts.filter(c => c > 0).length} topics have non-zero meeting_count`) : fail('topics counts', 'all zero');
}
```

## Out of scope (reminders)

- No standalone `/browse/departments/` list view in the left nav.
- No budget-line detail pages.
- No fund detail pages.
- No charts.
- No keyboard navigation between detail pages.
- No editorial integration (existing /topics/, /override/ pages unchanged).

## Open questions for implementation

1. **Slug collision handling for vendors.** Two vendors named "ABC Inc" and "ABC, Inc." would collide on the same slug. The build script either appends a numeric suffix per collision (`abc-inc`, `abc-inc-2`) or includes the vendor's first-seen row id in the slug. Plan picks one.

2. **Department-to-topic mapping for "Related meetings" section.** No declarative mapping exists today. Phase 1c either ships an inline lookup table in `browse.js` (a few obvious ones like `POLICE → public-safety`) or leaves the section empty by default with a "future phase" footnote. Plan picks one; defaults to mostly-empty with the few obvious mappings.

3. **`topic_tags` storage shape.** Comma-joined string (current proposal) is simple but loses sortability of multi-tag rows. Alternative: a separate `meetings_topics` join table. Plan picks; default is comma string for Phase 1c with a noted upgrade path.

4. **Detail-page caching.** Since the SQLite is already in memory after the first list-view visit, detail pages share the connection. If someone arrives directly at `/browse/vendors/#hilltop-securities-inc` (deep link), the page has to load sql.js + DB cold. Plan documents the cold-load latency expectation (likely ~1-2 s, similar to a list view cold load).

5. **Test data for the smoke tests.** The "HILLTOP SECURITIES" assertion in the vendor detail test will fail if next month's checkbook export uses a different first-row vendor. Either pin the test to a slug that's almost certainly going to exist (some known historical vendor), or assert "some detail header rendered" generically. Plan picks.
