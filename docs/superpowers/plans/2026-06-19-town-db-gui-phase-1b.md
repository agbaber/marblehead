# Town database GUI Phase 1b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/browse/` with a left-nav shell and four working list views (Vendors, Budget, Meetings, Topics) over the Phase 1a SQLite, plus a data-layer fix that backfills vendor department from fund.

**Architecture:** New Jekyll layout `browse.html` provides the shell (left nav + breadcrumb + per-entity search bar). Single `assets/browse.js` IIFE handles sql.js loading, in-memory DB caching, table rendering, sort, filter chips, search. Each list view is a thin Jekyll page that defines its entity config (columns, filters, sort, search columns) and invokes the shared renderer.

**Tech Stack:** Jekyll 3.10, vanilla JS (IIFE pattern, matching `assets/explore.js`), CSS with palette tokens, sql.js v1.10 from CDN, pytest for the ingest fix, Playwright for smoke tests.

**Spec:** `docs/superpowers/specs/2026-06-19-town-db-gui-phase-1b-design.md`.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/build_sqlite_db.py` | Modify | Add Fund fallback to vendor_payments department |
| `scripts/test_build_sqlite_db.py` | Modify | Test for backfill behavior |
| `assets/data/marbleheaddata.sqlite` | Regenerate | Build artifact with the ingest fix |
| `_layouts/browse.html` | Create | Shell layout (left nav, breadcrumb, search) |
| `assets/browse.css` | Create | Shell + table chrome + filter-chip styles |
| `assets/browse.js` | Create | sql.js loader, table renderer, sort, search, chips |
| `browse/index.html` | Create | 4-card landing page |
| `browse/vendors.html` | Create | Vendors list view (calls renderer with config) |
| `browse/budget.html` | Create | Budget list view |
| `browse/meetings.html` | Create | Meetings list view |
| `browse/topics.html` | Create | Topics list view |
| `tests/smoke-test.mjs` | Modify | 5 new test functions (index + 4 list views) |
| `_data/browse_counts.yml` | Create at build time | Row counts for the index page cards |

---

## Task 1: Fix vendor_payments department backfill

**Files:**
- Modify: `scripts/build_sqlite_db.py`
- Modify: `scripts/test_build_sqlite_db.py`
- Regenerate: `assets/data/marbleheaddata.sqlite`

The Phase 1a ingest mapped `Division → department` naively. About $30M of FY26 spend ends up as `UNDEFINED` because Division is empty for enterprise funds, capital projects, and federal grants where the Fund IS the organizational unit. Fix: backfill from Fund.

- [ ] **Step 1.1: Update the existing vendor_payments test for the new behavior**

Open `scripts/test_build_sqlite_db.py`. Find `test_vendor_payments_ingest`. Add these assertions to the existing test (don't replace, augment):

```python
        # Backfill: rows where Division was empty/UNDEFINED in the CSV
        # should now have department derived from fund.
        undefined_rows = conn.execute(
            "SELECT COUNT(*) FROM vendor_payments WHERE department = 'UNDEFINED'"
        ).fetchone()[0]
        assert undefined_rows == 0, (
            f"Expected no UNDEFINED department after backfill, got {undefined_rows}"
        )

        # Electric Enterprise should be a visible department now
        # (it was UNDEFINED before the backfill).
        ee_total = conn.execute(
            "SELECT ROUND(SUM(amount), 0) FROM vendor_payments "
            "WHERE department = 'ELECTRIC ENTERPRISE' AND fiscal_year = 'FY26'"
        ).fetchone()[0]
        assert ee_total is not None and ee_total > 5_000_000, (
            f"Expected Electric Enterprise to surface as a department, got total {ee_total}"
        )

        # Genuinely tagless rows become 'Unattributed' (single label).
        unattributed = conn.execute(
            "SELECT COUNT(*) FROM vendor_payments WHERE department = 'Unattributed'"
        ).fetchone()[0]
        # We expect some Unattributed rows (the rows with both Division
        # and Fund empty), but not millions.
        assert unattributed >= 0 and unattributed < n // 4, (
            f"Unexpected Unattributed count {unattributed}"
        )
```

- [ ] **Step 1.2: Run the test, watch it fail**

```bash
pytest scripts/test_build_sqlite_db.py::test_vendor_payments_ingest -v
```

Expected: FAIL on `Expected no UNDEFINED department after backfill, got 6991` (or similar count).

- [ ] **Step 1.3: Update the ingest**

In `scripts/build_sqlite_db.py`, find `build_vendor_payments`. Inside the row loop, replace the line that builds the department value:

Old (current):
```python
            payload.append(
                (
                    payment_date or None,
                    fiscal_year or None,
                    (row.get("Vendor") or "").strip() or None,
                    (row.get("Division") or "").strip() or None,
                    (row.get("Description") or "").strip() or None,
                    amount,
                    (row.get("Fund") or "").strip() or None,
                    path.name,
                )
            )
```

New:
```python
            division = (row.get("Division") or "").strip()
            fund = (row.get("Fund") or "").strip()
            if division and division != "UNDEFINED":
                department = division
            elif fund:
                department = fund
            else:
                department = "Unattributed"
            payload.append(
                (
                    payment_date or None,
                    fiscal_year or None,
                    (row.get("Vendor") or "").strip() or None,
                    department,
                    (row.get("Description") or "").strip() or None,
                    amount,
                    fund or None,
                    path.name,
                )
            )
```

(The `fund` variable already exists from the previous line; we reuse it for the `fund` column too.)

- [ ] **Step 1.4: Run the test, watch it pass**

```bash
pytest scripts/test_build_sqlite_db.py -v
```

Expected: 5/5 passing (the existing 5 tests, with `test_vendor_payments_ingest` now exercising the new assertions).

- [ ] **Step 1.5: Rebuild the SQLite end-to-end and spot-check**

```bash
python3 scripts/build_sqlite_db.py
sqlite3 assets/data/marbleheaddata.sqlite "SELECT department, COUNT(*), ROUND(SUM(amount), 0) FROM vendor_payments WHERE fiscal_year='FY26' GROUP BY department ORDER BY SUM(amount) DESC LIMIT 12;"
```

Expected: no `UNDEFINED` in the output. `ELECTRIC ENTERPRISE`, `EXPENSES`, `GENERAL FUND - SCHOOL`, etc. now appear. `Unattributed` row count should be modest (or zero if every row has either Division or Fund).

- [ ] **Step 1.6: Commit**

```bash
git add scripts/build_sqlite_db.py scripts/test_build_sqlite_db.py assets/data/marbleheaddata.sqlite
git commit -m "$(cat <<'EOF'
Fix vendor_payments department: backfill from Fund when Division empty

Phase 1a's vendor_payments ingest mapped Division to department
naively. For enterprise funds, capital projects, and federal grants,
Division is legitimately empty because the Fund IS the organizational
unit. Result: ~$30M of FY26 spend showed up as 'UNDEFINED'.

Backfill: if Division is empty or 'UNDEFINED', use Fund as the
department. Truly tagless rows (both empty) become 'Unattributed'.

Existing test extended with three assertions: no UNDEFINED remains,
Electric Enterprise surfaces with >$5M, Unattributed count is modest.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 2: Build _data/browse_counts.yml from build script

The `/browse/` index page shows row counts on each entity card. Generate them at build time so the cards render correctly on first paint, no JS round-trip.

**Files:**
- Modify: `scripts/build_sqlite_db.py`
- Create: `_data/browse_counts.yml` (build artifact)

- [ ] **Step 2.1: Update the build script to emit the counts file**

In `scripts/build_sqlite_db.py`, add a constant near the top:

```python
COUNTS_PATH = ROOT / "_data" / "browse_counts.yml"
```

At the end of `main()`, before `conn.close()`, add:

```python
        # Emit row counts for the /browse/ index page cards.
        counts = {}
        for entity in ("vendor_payments", "budget_lines", "meetings", "topics"):
            n = conn.execute(f'SELECT COUNT(*) FROM "{entity}"').fetchone()[0]
            counts[entity] = n
        COUNTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with COUNTS_PATH.open("w", encoding="utf-8") as f:
            f.write("# Auto-generated by scripts/build_sqlite_db.py. Do not edit.\n")
            for k, v in counts.items():
                f.write(f"{k}: {v}\n")
        print(f"\nWrote {COUNTS_PATH.relative_to(ROOT)}")
```

- [ ] **Step 2.2: Rebuild and verify the file appears**

```bash
python3 scripts/build_sqlite_db.py
cat _data/browse_counts.yml
```

Expected output:
```
# Auto-generated by scripts/build_sqlite_db.py. Do not edit.
vendor_payments: 15732
budget_lines: 39
meetings: 233
topics: 13
```

- [ ] **Step 2.3: Commit**

```bash
git add scripts/build_sqlite_db.py _data/browse_counts.yml
git commit -m "$(cat <<'EOF'
Emit _data/browse_counts.yml from the SQLite build

Row counts for the /browse/ index page entity cards. Build-time so
the counts render on first paint with no JS round-trip.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 3: Create the /browse/ shell layout and CSS skeleton

**Files:**
- Create: `_layouts/browse.html`
- Create: `assets/browse.css`
- Create: `browse/index.html` (uses the layout)

- [ ] **Step 3.1: Create `_layouts/browse.html`**

```html
---
layout: default
---
<link rel="stylesheet" href="/assets/browse.css">

<div class="browse-shell">
  <nav class="browse-nav" aria-label="Browse entities">
    <p class="browse-nav-eye">BROWSE</p>
    <ul class="browse-nav-list">
      <li><a href="/browse/vendors/" class="browse-nav-item{% if page.entity == 'vendors' %} is-active{% endif %}">Vendors</a></li>
      <li><a href="/browse/budget/" class="browse-nav-item{% if page.entity == 'budget' %} is-active{% endif %}">Budget</a></li>
      <li><a href="/browse/meetings/" class="browse-nav-item{% if page.entity == 'meetings' %} is-active{% endif %}">Meetings</a></li>
      <li><a href="/browse/topics/" class="browse-nav-item{% if page.entity == 'topics' %} is-active{% endif %}">Topics</a></li>
    </ul>
    <hr class="browse-nav-divider">
    <a class="browse-nav-download" href="/assets/data/marbleheaddata.sqlite" download>
      Download the database (4.6 MB)
    </a>
  </nav>

  <main class="browse-main">
    {% if page.entity %}
      <p class="browse-breadcrumb">
        <a href="/browse/">Browse</a>
        <span class="browse-breadcrumb-sep">›</span>
        <strong>{{ page.entity_label | default: page.entity }}</strong>
      </p>
    {% endif %}
    {{ content }}
  </main>
</div>
```

- [ ] **Step 3.2: Create `assets/browse.css`**

```css
/* /browse/ shell + table chrome.
   Inherits site palette tokens from assets/site.css. */

:root {
  --browse-row-height: 36px;
  --browse-table-font-size: 14px;
  --browse-numeric-font: ui-monospace, "Cascadia Mono", Menlo, monospace;
  --browse-row-divider: color-mix(in srgb, var(--c-navy) 8%, transparent);
  --browse-row-hover: color-mix(in srgb, var(--c-navy) 4%, transparent);
  --browse-chip-active-bg: var(--c-teal);
  --browse-chip-active-color: #fff;
}

/* Override default .page max-width for browse pages. */
.browse-shell {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 32px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 24px 64px;
  box-sizing: border-box;
}

@media (max-width: 800px) {
  .browse-shell {
    grid-template-columns: 1fr;
    gap: 0;
    padding: 16px;
  }
}

/* Left nav (desktop) / sticky entity switcher (mobile). */
.browse-nav {
  position: sticky;
  top: 24px;
  align-self: start;
  font-size: 14px;
}
.browse-nav-eye {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.6px;
  color: var(--text-subtle);
  margin: 0 0 12px;
}
.browse-nav-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.browse-nav-item {
  display: block;
  padding: 8px 10px;
  text-decoration: none;
  color: var(--text);
  border-radius: 6px;
  font-weight: 600;
}
.browse-nav-item:hover { background: var(--browse-row-hover); }
.browse-nav-item.is-active {
  background: color-mix(in srgb, var(--c-teal) 15%, transparent);
  color: var(--c-teal);
}
.browse-nav-divider {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 16px 0;
}
.browse-nav-download {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  text-decoration: none;
  padding: 6px 10px;
}
.browse-nav-download:hover { color: var(--c-teal); }

/* Mobile sticky entity switcher. */
@media (max-width: 800px) {
  .browse-nav {
    position: sticky;
    top: 0;
    background: var(--surface);
    z-index: 5;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
    margin: 0 -16px 16px;
    padding-left: 16px;
    padding-right: 16px;
  }
  .browse-nav-eye { display: none; }
  .browse-nav-list {
    flex-direction: row;
    gap: 6px;
    overflow-x: auto;
  }
  .browse-nav-item {
    padding: 6px 12px;
    border-radius: 999px;
    white-space: nowrap;
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .browse-nav-divider { display: none; }
  .browse-nav-download {
    font-size: 11px;
    text-align: center;
    margin-top: 8px;
  }
}

/* Breadcrumb. */
.browse-breadcrumb {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 16px;
}
.browse-breadcrumb a {
  color: var(--text-muted);
  text-decoration: none;
}
.browse-breadcrumb a:hover { color: var(--c-teal); }
.browse-breadcrumb-sep { margin: 0 6px; color: var(--text-subtle); }
.browse-breadcrumb strong { color: var(--text); font-weight: 700; }

/* Search bar. */
.browse-search {
  display: block;
  width: 100%;
  max-width: 360px;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  margin: 0 0 16px;
  background: var(--surface);
  color: var(--text);
}
.browse-search:focus {
  outline: 2px solid var(--c-teal);
  outline-offset: 0;
  border-color: var(--c-teal);
}

/* Filter chips. */
.browse-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
  align-items: center;
}
.browse-filter-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.browse-filter-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin-right: 4px;
}
.browse-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  user-select: none;
}
.browse-chip:hover { border-color: var(--c-teal); }
.browse-chip.is-active {
  background: var(--browse-chip-active-bg);
  color: var(--browse-chip-active-color);
  border-color: var(--browse-chip-active-bg);
}

/* Table. */
.browse-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.browse-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--browse-table-font-size);
  font-variant-numeric: tabular-nums;
}
.browse-table thead th {
  position: sticky;
  top: 0;
  background: var(--surface);
  text-align: left;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--text-subtle);
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  white-space: nowrap;
}
.browse-table thead th.is-sorted::after {
  content: " ▾";
  color: var(--c-teal);
}
.browse-table thead th.is-sorted-desc::after { content: " ▾"; }
.browse-table thead th.is-sorted-asc::after { content: " ▴"; }
.browse-table tbody tr {
  border-bottom: 1px solid var(--browse-row-divider);
  height: var(--browse-row-height);
}
.browse-table tbody tr:hover { background: var(--browse-row-hover); }
.browse-table td {
  padding: 8px 12px;
  vertical-align: middle;
}
.browse-table td.is-numeric,
.browse-table td.is-date {
  font-family: var(--browse-numeric-font);
}
.browse-table td.is-numeric { text-align: right; }
.browse-table td a { color: var(--text); text-decoration: none; }
.browse-table td a:hover { color: var(--c-teal); text-decoration: underline; }

/* Status pane (loading / error). */
.browse-status {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

/* Load-more button. */
.browse-load-more {
  display: block;
  width: 100%;
  padding: 12px;
  margin-top: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text);
}
.browse-load-more:hover { border-color: var(--c-teal); color: var(--c-teal); }

/* Footnote under table. */
.browse-footnote {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 12px;
  line-height: 1.5;
}

/* Mobile row height. */
@media (max-width: 800px) {
  .browse-table tbody tr { height: 44px; }
}

/* Index page entity cards. */
.browse-index-intro {
  font-size: 16px;
  line-height: 1.5;
  color: var(--text);
  margin: 0 0 24px;
  max-width: 720px;
}
.browse-index-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 600px) {
  .browse-index-cards { grid-template-columns: 1fr 1fr; }
}
@media (min-width: 1000px) {
  .browse-index-cards { grid-template-columns: repeat(4, 1fr); }
}
.browse-card {
  display: flex;
  flex-direction: column;
  padding: 22px 24px 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 8px);
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.15s, transform 0.15s;
}
.browse-card:hover {
  border-color: var(--c-teal);
  transform: translateY(-1px);
}
.browse-card-eye {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: var(--c-teal);
  margin: 0 0 8px;
}
.browse-card-count {
  font-size: 22px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  margin: 0 0 8px;
}
.browse-card-summary {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}
```

- [ ] **Step 3.3: Create `browse/index.html`**

```html
---
title: "Browse the data"
permalink: /browse/
layout: browse
og_title: "Browse: Marblehead data"
og_description: "Tables of vendors, budget lines, meetings, and topics. The town as a database."
---

<h1>Browse the data</h1>

<p class="browse-index-intro">
  Marblehead's vendor payments, budget lines, meetings, and topic feeds, organized as browseable tables.
  Backed by a downloadable
  <a href="/assets/data/marbleheaddata.sqlite">SQLite database</a>
  with primary-source citations on every table.
</p>

<div class="browse-index-cards">
  <a class="browse-card" href="/browse/vendors/">
    <p class="browse-card-eye">VENDORS</p>
    <p class="browse-card-count">{{ site.data.browse_counts.vendor_payments }}</p>
    <p class="browse-card-summary">Every vendor check the town has paid this fiscal year.</p>
  </a>
  <a class="browse-card" href="/browse/budget/">
    <p class="browse-card-eye">BUDGET</p>
    <p class="browse-card-count">{{ site.data.browse_counts.budget_lines }}</p>
    <p class="browse-card-summary">General fund appropriations by department and line item.</p>
  </a>
  <a class="browse-card" href="/browse/meetings/">
    <p class="browse-card-eye">MEETINGS</p>
    <p class="browse-card-count">{{ site.data.browse_counts.meetings }}</p>
    <p class="browse-card-summary">Every Select Board, School Committee, FinCom, and other-board meeting with an ingested transcript.</p>
  </a>
  <a class="browse-card" href="/browse/topics/">
    <p class="browse-card-eye">TOPICS</p>
    <p class="browse-card-count">{{ site.data.browse_counts.topics }}</p>
    <p class="browse-card-summary">The site's topic-feed pages and what links into each.</p>
  </a>
</div>
```

- [ ] **Step 3.4: Build and verify the shell renders**

```bash
bundle exec jekyll build 2>&1 | tail -3
ls _site/browse/index.html
```

Expected: `_site/browse/index.html` exists. Open it (or serve and curl) to confirm the shell renders with 4 cards and the row counts populated.

- [ ] **Step 3.5: Commit**

```bash
git add _layouts/browse.html assets/browse.css browse/index.html
git commit -m "$(cat <<'EOF'
Add /browse/ shell layout, CSS, and index page

_layouts/browse.html provides the left nav + breadcrumb. CSS lives
in assets/browse.css with the hybrid visual register (existing
palette + denser table tokens). browse/index.html is the 4-card
landing pulling row counts from _data/browse_counts.yml.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 4: Create assets/browse.js with sql.js loader and table renderer

**Files:**
- Create: `assets/browse.js`

The single JS file that powers all four list views. Loads sql.js, fetches the SQLite, caches it module-globally, then exposes a `Browse.renderListView(config)` function each list-view page calls with its entity config.

- [ ] **Step 4.1: Create `assets/browse.js`**

```javascript
/* /browse/ list-view runtime.
 *
 * Loads sql.js + the SQLite once per session, then renders
 * filterable / sortable / searchable tables for each list-view page.
 *
 * Each /browse/<entity>/ page calls Browse.renderListView(config) with
 * its entity config (columns, filters, sort, search columns).
 *
 * IIFE pattern matches the rest of the site's vanilla-JS conventions
 * (see assets/explore.js, assets/ballot.js).
 */
(function () {
  var SQLJS_URL = "https://sql.js.org/dist/sql-wasm.js";
  var SQLJS_WASM = "https://sql.js.org/dist/sql-wasm.wasm";
  var DB_URL = "/assets/data/marbleheaddata.sqlite";

  var dbPromise = null;  // cached across in-tab navigation

  function ensureSqlJs() {
    if (window.initSqlJs) return Promise.resolve(window.initSqlJs);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = SQLJS_URL;
      s.onload = function () { resolve(window.initSqlJs); };
      s.onerror = function () { reject(new Error("sql.js script failed to load")); };
      document.head.appendChild(s);
    });
  }

  function loadDb() {
    if (dbPromise) return dbPromise;
    dbPromise = ensureSqlJs().then(function (initSqlJs) {
      return Promise.all([
        initSqlJs({ locateFile: function () { return SQLJS_WASM; } }),
        fetch(DB_URL).then(function (r) {
          if (!r.ok) throw new Error("DB fetch failed: " + r.status);
          return r.arrayBuffer();
        }),
      ]);
    }).then(function (pair) {
      var SQL = pair[0];
      var buf = pair[1];
      return new SQL.Database(new Uint8Array(buf));
    });
    return dbPromise;
  }

  /* Format helpers. */
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return "";
    return "$" + Number(n).toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }
  function fmtMoneyRound(n) {
    if (n == null || isNaN(n)) return "";
    return "$" + Math.round(Number(n)).toLocaleString();
  }
  function fmtText(s) { return s == null ? "" : String(s); }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* Build a WHERE clause + binding list from active filters and the
     current search term. Returns { sql: "...", params: [...] }. */
  function buildWhere(config, state) {
    var clauses = [];
    var params = [];
    // Filter chips.
    config.filters.forEach(function (filter) {
      var selected = (state.filters[filter.column] || []).slice();
      if (selected.length === 0) return;
      // Multi-select: column IN (?, ?, ...). Single-select: column = ?.
      var qmarks = selected.map(function () { return "?"; }).join(", ");
      clauses.push('"' + filter.column + '" IN (' + qmarks + ')');
      params.push.apply(params, selected);
    });
    // Search term.
    var term = (state.search || "").trim();
    if (term && config.searchColumns && config.searchColumns.length) {
      var likes = config.searchColumns.map(function (c) {
        return '"' + c + '" LIKE ?';
      });
      clauses.push("(" + likes.join(" OR ") + ")");
      var pat = "%" + term + "%";
      config.searchColumns.forEach(function () { params.push(pat); });
    }
    return {
      sql: clauses.length ? " WHERE " + clauses.join(" AND ") : "",
      params: params,
    };
  }

  /* Render the table body from query results. */
  function renderRows(config, rows) {
    var tbody = document.querySelector(".browse-table tbody");
    if (!tbody) return;
    if (rows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="' + config.columns.length +
        '" class="browse-status">No rows match.</td></tr>';
      return;
    }
    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      html += "<tr>";
      for (var j = 0; j < config.columns.length; j++) {
        var col = config.columns[j];
        var value = row[col.column];
        var formatted;
        if (col.format === "money") formatted = fmtMoney(value);
        else if (col.format === "moneyRound") formatted = fmtMoneyRound(value);
        else formatted = escapeHtml(fmtText(value));
        var classes = [];
        if (col.format === "money" || col.format === "moneyRound") classes.push("is-numeric");
        if (col.format === "date") classes.push("is-date");
        var cell;
        if (col.linkColumn && row[col.linkColumn]) {
          cell = '<a href="' + escapeHtml(row[col.linkColumn]) + '">' + formatted + "</a>";
        } else {
          cell = formatted;
        }
        html += '<td class="' + classes.join(" ") + '">' + cell + "</td>";
      }
      html += "</tr>";
    }
    tbody.innerHTML = html;
  }

  /* Render filter chips. Returns an array of {column, value, el} pairs
     so the event handler can wire up active-state toggling. */
  function renderFilters(config, state, onChange) {
    var wrap = document.querySelector(".browse-filters");
    if (!wrap) return;
    wrap.innerHTML = "";
    config.filters.forEach(function (filter) {
      var group = document.createElement("div");
      group.className = "browse-filter-group";
      var label = document.createElement("span");
      label.className = "browse-filter-label";
      label.textContent = filter.label + ":";
      group.appendChild(label);
      filter.values.forEach(function (value) {
        var chip = document.createElement("button");
        chip.className = "browse-chip";
        chip.type = "button";
        chip.dataset.column = filter.column;
        chip.dataset.value = value;
        chip.textContent = value;
        if ((state.filters[filter.column] || []).indexOf(value) >= 0) {
          chip.classList.add("is-active");
        }
        chip.addEventListener("click", function () {
          var arr = state.filters[filter.column] || [];
          if (filter.multi === false) {
            // Single-select: toggle, replacing.
            state.filters[filter.column] = arr.indexOf(value) >= 0 ? [] : [value];
          } else {
            // Multi-select: toggle this value within the array.
            var idx = arr.indexOf(value);
            if (idx >= 0) arr.splice(idx, 1); else arr.push(value);
            state.filters[filter.column] = arr;
          }
          onChange();
        });
        group.appendChild(chip);
      });
      wrap.appendChild(group);
    });
  }

  /* Wire up sort on column headers. */
  function renderSortHeaders(config, state, onChange) {
    var thead = document.querySelector(".browse-table thead tr");
    if (!thead) return;
    thead.innerHTML = "";
    config.columns.forEach(function (col) {
      var th = document.createElement("th");
      th.textContent = col.label;
      if (state.sortColumn === col.column) {
        th.classList.add(state.sortDesc ? "is-sorted-desc" : "is-sorted-asc");
      }
      th.addEventListener("click", function () {
        if (state.sortColumn === col.column) {
          state.sortDesc = !state.sortDesc;
        } else {
          state.sortColumn = col.column;
          state.sortDesc = (col.defaultSort === "desc") || false;
        }
        onChange();
      });
      thead.appendChild(th);
    });
  }

  /* Debounce. */
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* Run the query and re-render. */
  function runQuery(db, config, state) {
    var where = buildWhere(config, state);
    var orderBy = "";
    if (state.sortColumn) {
      orderBy = ' ORDER BY "' + state.sortColumn + '" ' +
        (state.sortDesc ? "DESC" : "ASC");
    }
    var limit = state.pageSize ? " LIMIT " + (state.pageSize * state.pages) : "";
    var sql =
      "SELECT * FROM \"" + config.table + "\"" + where.sql + orderBy + limit;
    var stmt = db.prepare(sql);
    stmt.bind(where.params);
    var rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    renderRows(config, rows);
    // Update the row count label.
    var countEl = document.querySelector(".browse-row-count");
    if (countEl) {
      // Total available (no limit) for the count display.
      var countSql =
        'SELECT COUNT(*) AS n FROM "' + config.table + '"' + where.sql;
      var cstmt = db.prepare(countSql);
      cstmt.bind(where.params);
      cstmt.step();
      var total = cstmt.getAsObject().n;
      cstmt.free();
      countEl.textContent = rows.length + " of " + total + " rows";
    }
  }

  function showStatus(msg) {
    var wrap = document.querySelector(".browse-table-wrap");
    if (!wrap) return;
    wrap.innerHTML = '<div class="browse-status">' + escapeHtml(msg) + "</div>";
  }

  /* Public API: render a list view based on config. */
  function renderListView(config) {
    showStatus("Loading data...");
    loadDb().then(function (db) {
      // Restore the table skeleton if we replaced it with a status div.
      var wrap = document.querySelector(".browse-table-wrap");
      if (wrap && !wrap.querySelector("table")) {
        wrap.innerHTML =
          '<table class="browse-table"><thead><tr></tr></thead>' +
          '<tbody></tbody></table>';
      }
      var state = {
        filters: {},
        search: "",
        sortColumn: config.defaultSortColumn || null,
        sortDesc: config.defaultSortDesc !== false,
        pageSize: config.pageSize || 0,
        pages: 1,
      };

      // Fill in dynamic filter values from the DB.
      config.filters.forEach(function (filter) {
        if (filter.valuesFrom === "distinct") {
          var stmt = db.prepare(
            'SELECT DISTINCT "' + filter.column + '" AS v FROM "' +
            config.table + '" WHERE "' + filter.column +
            '" IS NOT NULL ORDER BY "' + filter.column + '"'
          );
          var vals = [];
          while (stmt.step()) vals.push(stmt.getAsObject().v);
          stmt.free();
          filter.values = filter.topN ? vals.slice(0, filter.topN) : vals;
        }
      });

      function refresh() {
        renderSortHeaders(config, state, refresh);
        renderFilters(config, state, refresh);
        runQuery(db, config, state);
      }
      refresh();

      // Wire up the search input.
      var searchInput = document.querySelector(".browse-search");
      if (searchInput) {
        var onInput = debounce(function () {
          state.search = searchInput.value;
          refresh();
        }, 200);
        searchInput.addEventListener("input", onInput);
      }

      // Wire up the "Load more" button.
      var loadMoreBtn = document.querySelector(".browse-load-more");
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", function () {
          state.pages += 1;
          runQuery(db, config, state);
        });
      }
    }).catch(function (err) {
      showStatus("Couldn't load the database. Reload to try again. (" + err.message + ")");
    });
  }

  window.Browse = { renderListView: renderListView };
})();
```

- [ ] **Step 4.2: Verify the browse.js parses and doesn't break the build**

```bash
bundle exec jekyll build 2>&1 | tail -3
node --check assets/browse.js && echo "JS parses OK"
```

Expected: build succeeds, JS parses.

- [ ] **Step 4.3: Commit**

```bash
git add assets/browse.js
git commit -m "$(cat <<'EOF'
Add assets/browse.js: sql.js loader + list-view renderer

Single IIFE that handles sql.js loading (CDN), database fetch +
caching, table rendering, sort, search (debounced 200ms), and
multi-select filter chips. Each /browse/<entity>/ page calls
Browse.renderListView(config) with its entity-specific config.

Pattern matches the existing assets/explore.js conventions
(vanilla JS, IIFE, no module system).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 5: Build /browse/topics/

Smallest list view (13 rows), proves the pattern works end-to-end.

**Files:**
- Create: `browse/topics.html`

- [ ] **Step 5.1: Create `browse/topics.html`**

```html
---
title: "Browse: Topics"
permalink: /browse/topics/
layout: browse
entity: topics
entity_label: Topics
---

<input type="search" class="browse-search" placeholder="search topics...">

<div class="browse-filters"></div>
<p class="browse-row-count"></p>

<div class="browse-table-wrap">
  <table class="browse-table">
    <thead><tr></tr></thead>
    <tbody></tbody>
  </table>
</div>

<p class="browse-footnote">
  Source: <code>marbleheaddata.sqlite</code> → <code>topics</code>.
  The Meetings tagged column populates in Phase 1c once
  meetings.topic_tags is wired. For now, click a topic title to see
  its existing feed.
</p>

<script src="/assets/browse.js" defer></script>
<script>
window.addEventListener("DOMContentLoaded", function () {
  window.Browse.renderListView({
    table: "topics",
    columns: [
      { column: "title", label: "Topic", linkColumn: "page_url" },
      { column: "slug", label: "Slug" },
      { column: "meeting_count", label: "Meetings tagged" },
    ],
    filters: [],
    searchColumns: ["title", "slug"],
    defaultSortColumn: "title",
    defaultSortDesc: false,
    pageSize: 0,
  });
});
</script>
```

(The `meeting_count` is currently 0 for every row; the footnote explains this populates in Phase 1c.)

- [ ] **Step 5.2: Build and visit the page**

```bash
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4000 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6
curl -sf http://127.0.0.1:4000/browse/topics/ -o /dev/null && echo "topics OK" || echo "topics DOWN"
```

Expected: 200 response. To visually verify, take a screenshot:

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4000/browse/topics/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.browse-table tbody tr', { timeout: 5000 });
  await page.screenshot({ path: 'proof/town-db-gui-1b-topics.png' });
  await browser.close();
})();
"
```

Expected: screenshot shows 13 topic rows with titles linking to /topics/<slug>/.

- [ ] **Step 5.3: Commit**

```bash
git add browse/topics.html proof/town-db-gui-1b-topics.png
git commit -m "$(cat <<'EOF'
Add /browse/topics/ list view

Simplest of the four list views (13 rows, no filter chips). Proves
the browse.js + browse.css + browse.html shell pattern works end
to end. Each topic title links to its existing /topics/<slug>/
feed page.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 6: Build /browse/meetings/

**Files:**
- Create: `browse/meetings.html`

- [ ] **Step 6.1: Create `browse/meetings.html`**

```html
---
title: "Browse: Meetings"
permalink: /browse/meetings/
layout: browse
entity: meetings
entity_label: Meetings
---

<input type="search" class="browse-search" placeholder="search meetings...">

<div class="browse-filters"></div>
<p class="browse-row-count"></p>

<div class="browse-table-wrap">
  <table class="browse-table">
    <thead><tr></tr></thead>
    <tbody></tbody>
  </table>
</div>

<button class="browse-load-more">Load more</button>

<p class="browse-footnote">
  Source: <code>marbleheaddata.sqlite</code> → <code>meetings</code>.
  Rows are scanned from <code>_transcripts/*.md</code> front-matter
  at build time. Click a row's title to open the existing transcript page.
</p>

<script src="/assets/browse.js" defer></script>
<script>
window.addEventListener("DOMContentLoaded", function () {
  window.Browse.renderListView({
    table: "meetings",
    columns: [
      { column: "meeting_date", label: "Date", format: "date" },
      { column: "board", label: "Board" },
      { column: "title", label: "Title", linkColumn: "url" },
    ],
    filters: [
      {
        column: "board",
        label: "Board",
        multi: true,
        valuesFrom: "distinct",
      },
    ],
    searchColumns: ["title"],
    defaultSortColumn: "meeting_date",
    defaultSortDesc: true,
    pageSize: 50,
  });
});
</script>
```

- [ ] **Step 6.2: Build and screenshot**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4000 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6
curl -sf http://127.0.0.1:4000/browse/meetings/ -o /dev/null && echo "meetings OK"

node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4000/browse/meetings/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.browse-table tbody tr', { timeout: 5000 });
  await page.screenshot({ path: 'proof/town-db-gui-1b-meetings.png' });
  await browser.close();
})();
"
```

Expected: screenshot shows date-sorted meetings with board filter chips at the top.

- [ ] **Step 6.3: Commit**

```bash
git add browse/meetings.html proof/town-db-gui-1b-meetings.png
git commit -m "$(cat <<'EOF'
Add /browse/meetings/ list view

Date-sorted descending by default. Multi-select board filter chips
auto-populate from distinct values. 50 rows per page with a "Load
more" button. Title cell links to the existing transcript page via
the url column.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 7: Build /browse/budget/

**Files:**
- Create: `browse/budget.html`

- [ ] **Step 7.1: Create `browse/budget.html`**

```html
---
title: "Browse: Budget lines"
permalink: /browse/budget/
layout: browse
entity: budget
entity_label: Budget lines
---

<input type="search" class="browse-search" placeholder="search budget lines...">

<div class="browse-filters"></div>
<p class="browse-row-count"></p>

<div class="browse-table-wrap">
  <table class="browse-table">
    <thead><tr></tr></thead>
    <tbody></tbody>
  </table>
</div>

<p class="browse-footnote">
  Source: <code>marbleheaddata.sqlite</code> → <code>budget_lines</code>,
  flattened from <code>data/FY*_budget_summary.json</code>.
  Department totals here can differ from grand totals because some
  sub-items overlap in the source. See <code>_meta</code> for the cite.
</p>

<script src="/assets/browse.js" defer></script>
<script>
window.addEventListener("DOMContentLoaded", function () {
  window.Browse.renderListView({
    table: "budget_lines",
    columns: [
      { column: "fiscal_year", label: "FY", format: "date" },
      { column: "department", label: "Department" },
      { column: "line_item", label: "Line item" },
      { column: "fund", label: "Fund" },
      { column: "amount", label: "Amount", format: "moneyRound" },
      { column: "budget_phase", label: "Phase" },
    ],
    filters: [
      {
        column: "fiscal_year",
        label: "FY",
        multi: false,
        valuesFrom: "distinct",
      },
      {
        column: "department",
        label: "Dept",
        multi: false,
        valuesFrom: "distinct",
      },
    ],
    searchColumns: ["line_item", "department"],
    defaultSortColumn: "amount",
    defaultSortDesc: true,
    pageSize: 0,
  });
});
</script>
```

- [ ] **Step 7.2: Build and screenshot**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4000 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6

node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4000/browse/budget/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.browse-table tbody tr', { timeout: 5000 });
  await page.screenshot({ path: 'proof/town-db-gui-1b-budget.png' });
  await browser.close();
})();
"
```

Expected: 39 rows sorted by amount descending. Top row should be a large town line item like Health Insurance Transfer ($11.8M).

- [ ] **Step 7.3: Commit**

```bash
git add browse/budget.html proof/town-db-gui-1b-budget.png
git commit -m "$(cat <<'EOF'
Add /browse/budget/ list view

39 rows, all on one page. Single-select FY and department chips,
sorted by amount descending. Footnote flags the overlap caveat
(Town and School key items don't partition cleanly into grand totals).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 8: Build /browse/vendors/

The hardest entity (15,732 rows). Watch search performance.

**Files:**
- Create: `browse/vendors.html`

- [ ] **Step 8.1: Create `browse/vendors.html`**

```html
---
title: "Browse: Vendor payments"
permalink: /browse/vendors/
layout: browse
entity: vendors
entity_label: Vendor payments
---

<input type="search" class="browse-search" placeholder="search vendors, departments, descriptions...">

<div class="browse-filters"></div>
<p class="browse-row-count"></p>

<div class="browse-table-wrap">
  <table class="browse-table">
    <thead><tr></tr></thead>
    <tbody></tbody>
  </table>
</div>

<button class="browse-load-more">Load more</button>

<p class="browse-footnote">
  Source: <code>marbleheaddata.sqlite</code> → <code>vendor_payments</code>,
  ingested from the Marblehead Open Finance vendor checks export.
  Department is the source CSV's Division when present, otherwise
  falls back to Fund. The label "Unattributed" marks rows with neither.
</p>

<script src="/assets/browse.js" defer></script>
<script>
window.addEventListener("DOMContentLoaded", function () {
  window.Browse.renderListView({
    table: "vendor_payments",
    columns: [
      { column: "payment_date", label: "Date", format: "date" },
      { column: "vendor", label: "Vendor" },
      { column: "department", label: "Department" },
      { column: "fund", label: "Fund" },
      { column: "amount", label: "Amount", format: "money" },
    ],
    filters: [
      {
        column: "fiscal_year",
        label: "FY",
        multi: true,
        valuesFrom: "distinct",
      },
      {
        column: "department",
        label: "Dept",
        multi: true,
        valuesFrom: "distinct",
        topN: 12,
      },
    ],
    searchColumns: ["vendor", "department", "category", "fund"],
    defaultSortColumn: "payment_date",
    defaultSortDesc: true,
    pageSize: 100,
  });
});
</script>
```

- [ ] **Step 8.2: Build and benchmark**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4000 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6

# Open in Playwright and measure first-paint + first search.
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:4000/browse/vendors/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.browse-table tbody tr', { timeout: 15000 });
  const tFirstPaint = Date.now() - t0;
  console.log('First-row paint:', tFirstPaint, 'ms');

  // Time a search input.
  const t1 = Date.now();
  await page.fill('.browse-search', 'CONSTRUCTION');
  await page.waitForFunction(
    () => document.querySelectorAll('.browse-table tbody tr').length < 100,
    { timeout: 5000 }
  );
  const tSearch = Date.now() - t1;
  console.log('First search (CONSTRUCTION):', tSearch, 'ms');

  await page.screenshot({ path: 'proof/town-db-gui-1b-vendors.png' });
  await browser.close();
})();
"
```

Expected: first-row paint within ~3 seconds (sql.js + DB fetch). First search within ~500 ms.

**If search takes longer than 500 ms p95**, switch to an FTS5 virtual table in the SQLite build. Add to `scripts/build_sqlite_db.py` at the end of `build_vendor_payments`:

```python
# FTS5 search index over vendor_payments.
conn.execute("CREATE VIRTUAL TABLE vendor_payments_fts USING fts5(vendor, department, category, fund, content='vendor_payments', content_rowid='id')")
conn.execute("INSERT INTO vendor_payments_fts(rowid, vendor, department, category, fund) SELECT id, vendor, department, category, fund FROM vendor_payments")
```

And change `searchColumns` in the page to use FTS via a different code path. **Only do this if the benchmark requires it.** Otherwise skip.

- [ ] **Step 8.3: Commit**

```bash
git add browse/vendors.html proof/town-db-gui-1b-vendors.png
git commit -m "$(cat <<'EOF'
Add /browse/vendors/ list view

15,732 rows, paginated 100 at a time with a "Load more" button.
Multi-select FY and Department filter chips (top 12 departments
by row count, plus an expand-all). LIKE search against vendor,
department, category, and fund. Footnote explains the Division-
to-Fund backfill so readers know "Electric Enterprise" appears
under Department rather than as a separate column.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 9: Add smoke tests for /browse/

**Files:**
- Modify: `tests/smoke-test.mjs`

- [ ] **Step 9.1: Add a generic browse-page test function and a per-entity test**

Add to `tests/smoke-test.mjs`, before the main `(async () => { ... })` block:

```javascript
async function testBrowseIndex(page) {
  console.log('\n── /browse/ ──');
  const res = await page.goto(`${SITE}/browse/`, { waitUntil: 'domcontentloaded' });
  res && res.status() === 200 ? ok('/browse/ → 200') : fail('/browse/', `status ${res ? res.status() : 'no response'}`);
  const cards = await page.$$('.browse-card');
  cards.length === 4 ? ok('4 entity cards') : fail('Browse cards', `expected 4, got ${cards.length}`);
}

async function testBrowseEntity(page, slug, minRows) {
  console.log(`\n── /browse/${slug}/ ──`);
  const res = await page.goto(`${SITE}/browse/${slug}/`, { waitUntil: 'networkidle' });
  res && res.status() === 200 ? ok(`/browse/${slug}/ → 200`) : fail(`/browse/${slug}/`, `status ${res ? res.status() : 'no response'}`);

  // Shell.
  const breadcrumb = await page.$('.browse-breadcrumb');
  breadcrumb ? ok('Breadcrumb present') : fail('Breadcrumb', 'missing');
  const search = await page.$('.browse-search');
  search ? ok('Search input present') : fail('Search input', 'missing');
  const navItems = await page.$$('.browse-nav-item');
  navItems.length === 4 ? ok('Left nav has 4 entities') : fail('Left nav', `got ${navItems.length}`);

  // Wait for sql.js to load and render rows.
  try {
    await page.waitForSelector('.browse-table tbody tr', { timeout: 15000 });
  } catch (_) {
    fail(`${slug} table`, 'no rows rendered within 15s');
    return;
  }
  const rows = await page.$$('.browse-table tbody tr');
  rows.length >= minRows
    ? ok(`${rows.length} rows rendered (>= ${minRows})`)
    : fail(`${slug} rows`, `expected at least ${minRows}, got ${rows.length}`);
}
```

In the main `(async () => { ... })` block, after the existing test calls, add:

```javascript
  await testBrowseIndex(page);
  await testBrowseEntity(page, 'topics', 10);
  await testBrowseEntity(page, 'meetings', 30);
  await testBrowseEntity(page, 'budget', 30);
  await testBrowseEntity(page, 'vendors', 50);
```

- [ ] **Step 9.2: Run the full smoke suite**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4000 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6
SITE=http://127.0.0.1:4000 node tests/smoke-test.mjs 2>&1 | tail -20
```

Expected: pre-existing tests still pass, all 5 new browse assertions pass.

- [ ] **Step 9.3: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "$(cat <<'EOF'
Add smoke tests for /browse/ index and 4 list views

testBrowseIndex asserts 200 + 4 entity cards.
testBrowseEntity asserts shell selectors (breadcrumb, search, 4
nav items) and that the table renders at least N rows after
sql.js loads. Calls for topics (>=10), meetings (>=30),
budget (>=30), vendors (>=50).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 10: Final verification, full-page proof, push, open PR

**Files:**
- Create: `proof/town-db-gui-1b.png`
- Create: `proof/town-db-gui-1b-full.png`

- [ ] **Step 10.1: Run the full local test target**

```bash
pkill -f "jekyll serve" 2>/dev/null
npm run test:local 2>&1 | tail -20
```

Expected: 0 failures (or only the pre-existing flake known from Phase 1a).

- [ ] **Step 10.2: Capture a full-page screenshot of /browse/vendors/ for the PR**

```bash
nohup bundle exec jekyll serve --port 4000 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6

node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const v of [
    { name: 'town-db-gui-1b.png', viewport: { width: 1440, height: 900 }, fullPage: false },
    { name: 'town-db-gui-1b-full.png', viewport: { width: 1440, height: 900 }, fullPage: true },
  ]) {
    const ctx = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:4000/browse/vendors/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.browse-table tbody tr', { timeout: 10000 });
    await page.screenshot({ path: 'proof/' + v.name, fullPage: v.fullPage });
    await ctx.close();
  }
  await browser.close();
})();
"
ls -lh proof/town-db-gui-1b*.png
```

- [ ] **Step 10.3: Stop Jekyll**

```bash
pkill -f "jekyll serve" 2>/dev/null
```

- [ ] **Step 10.4: Push and open PR**

```bash
git add proof/town-db-gui-1b.png proof/town-db-gui-1b-full.png
git commit -m "$(cat <<'EOF'
Phase 1b proof: above-fold and full-page screenshots of /browse/vendors/

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"

git push

gh pr create --title "Town database GUI Phase 1b: /browse/ shell and four list views" --body-file - <<'EOF'
## Summary

Ships the `/browse/` section: shell (left nav + breadcrumb + per-entity search) and four list views over the Phase 1a SQLite.

- `/browse/` index (4 entity cards with row counts)
- `/browse/vendors/` (15,732 rows, FY + Dept filter chips, multi-page)
- `/browse/budget/` (39 rows, FY + Dept filter chips, sortable)
- `/browse/meetings/` (233 rows, Board filter chips, links to existing transcript pages)
- `/browse/topics/` (13 rows, links to existing topic feeds)

Also corrects Phase 1a's `vendor_payments` ingest: the ~$30M "UNDEFINED" pile resolves into Electric Enterprise, capital projects, federal grants, etc. by backfilling from Fund when Division is empty.

Spec: `docs/superpowers/specs/2026-06-19-town-db-gui-phase-1b-design.md`.

## Preview & How to Test

- **Preview URL**: edit this body with the Cloudflare Pages URL when the preview deploy is green.
- **Specific paths/screens to check**:
  1. `/browse/`: confirm 4 entity cards with row counts (15732 / 39 / 233 / 13).
  2. `/browse/vendors/`: wait ~3s for sql.js + DB. Confirm 100 rows render, sort by date descending. Click "Dept" chip "ELECTRIC ENTERPRISE" and verify the count drops.
  3. `/browse/meetings/`: confirm date-sorted list. Click a row's title to open the existing transcript page.
  4. `/browse/budget/`: confirm 39 rows. The top row should be a big town item like Health Insurance Transfer ($11.8M).
  5. `/browse/topics/`: confirm 13 rows linking to /topics/<slug>/.
  6. Search box in any list view: confirm it filters rows.
  7. Mobile (resize to <800 px): left nav should collapse into a sticky pill switcher at the top.
- **Expected behavior**: each list view loads, sql.js fetches and parses the SQLite once per tab, subsequent navigations within /browse/ reuse the in-memory DB.
- **Edge cases**:
  - Reload the page mid-load: the DB cache lives in JS module scope, so reload re-fetches.
  - Click a filter chip while sql.js is still loading: chips are inert until the DB is ready (no error).
  - Search for nothing (empty string): shows all rows.

## Proof of Work

![/browse/vendors/ above the fold](proof/town-db-gui-1b.png)

Full page: `proof/town-db-gui-1b-full.png`. Per-entity screenshots in `proof/town-db-gui-1b-{topics,meetings,budget,vendors}.png`.

Smoke test: 0 failures (or note the pre-existing town-budget flake).

## Risk

- **sql.js fetch is 4.6 MB.** Cached aggressively by the browser; cold load on a slow connection is the main concern. Acceptable for Phase 1b; Phase 2 can paginate by fiscal year if needed.
- **Search perf at 15k rows.** Plan included a benchmark step. If p95 > 500 ms, FTS5 path is documented.
- **No detail views.** Vendors and Budget rows are inert. Phase 1c adds detail.
EOF
```

---

## Definition of done

- All 10 tasks committed on the `town-db-gui-1b` branch.
- PR open with full-page proof.
- `npm run test:local` is green (or only the pre-existing flake).
- `/browse/` and the four list views render with data.
- `vendor_payments.department` no longer contains `UNDEFINED`; Electric Enterprise and other funds surface as real departments.

## Out of scope reminders

- No detail views (Phase 1c).
- No migration of `/checkbook/` to query SQLite.
- No global cmd+K search.
- No new entities.
- No authentication / saved filters / user state.
- No charts / sparklines in list views.
- No cross-references between entities (Phase 1c).
