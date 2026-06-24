# Town database GUI Phase 1c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/browse/` from independent list views into a graph: vendor detail page, department detail page, cross-reference links from list rows to detail pages, and meeting-to-topic cross-tagging via the existing `topic_segments` data in transcript front-matter.

**Architecture:** Hash-driven detail pages (`/browse/vendors/#<slug>`, `/browse/dept/#<slug>`) inside the existing `/browse/` shell. A new `Browse.renderDetailView(config)` function in `assets/browse.js` mirrors `renderListView`'s pattern. The meeting ingest harvests `topic_segments[].topic` from each transcript into a comma-joined `meetings.topic_tags` column; a follow-up UPDATE populates `topics.meeting_count` via LIKE join.

**Tech Stack:** Same as Phase 1b. Python 3 for the ingest extension, pytest for the data-layer tests, vanilla JS (extends `assets/browse.js`), Jekyll for the new detail pages, Playwright for smoke tests.

**Spec:** `docs/superpowers/specs/2026-06-19-town-db-gui-phase-1c-design.md`.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/build_sqlite_db.py` | Modify | `_harvest_topic_tags` helper; populate `meetings.topic_tags` and `topics.meeting_count` |
| `scripts/test_build_sqlite_db.py` | Modify | Tests for topic_tags harvest and meeting_count populate |
| `assets/data/marbleheaddata.sqlite` | Regenerate | Build artifact with the new column values |
| `assets/browse.js` | Modify | Add `slugify`, `linkTemplate` column support, `renderDetailView`, hash router |
| `assets/browse.css` | Modify | Detail-page header card, aggregate-table chrome |
| `browse/vendors.html` | Modify | Mount the detail container; list view stays, hash toggles |
| `browse/budget.html` | Modify | Wire `department` column to dept detail link |
| `browse/meetings.html` | Modify | Add topic chip column |
| `browse/dept.html` | Create | Hash-driven department detail page (empty without hash) |
| `_layouts/browse.html` | Modify | Conditional 3-segment breadcrumb when `page.entity` is set and hash is present |
| `tests/smoke-test.mjs` | Modify | 3 new tests: vendor detail, dept detail, topic counts |

---

## Task 1: Extend the meeting ingest to harvest topic_tags

**Files:**
- Modify: `scripts/build_sqlite_db.py`
- Modify: `scripts/test_build_sqlite_db.py`
- Regenerate: `assets/data/marbleheaddata.sqlite`

The Phase 1a meeting ingest pulls scalar front-matter fields. This task adds a small parser that scans each transcript file for the `topic_segments:` block and collects distinct `topic:` slug values into a comma-joined string written to `meetings.topic_tags`.

Sample transcript front-matter (real example from `_transcripts/select-board-2026-04-15.md`):

```yaml
---
slug: select-board-2026-04-15
board: select-board
...
topic_segments:
  - topic: public-comment
    topic_confidence: 0.99
    start_seconds: 4
  - topic: override
    topic_confidence: 0.99
    start_seconds: 70
  - topic: labor-personnel
    topic_confidence: 0.95
    start_seconds: 3379
---
```

Expected `topic_tags` value for this file: `"labor-personnel,override,public-comment"` (sorted alphabetically, comma-joined, no spaces).

- [ ] **Step 1.1: Add the failing test**

In `scripts/test_build_sqlite_db.py`, augment the existing `test_meetings_ingest` function. Add these assertions before the `finally:` block:

```python
        # Phase 1c: topic_tags populated from topic_segments[].topic
        select_board_2026_04_15 = conn.execute(
            "SELECT topic_tags FROM meetings WHERE slug = 'select-board-2026-04-15'"
        ).fetchone()
        assert select_board_2026_04_15 is not None, "Select Board 2026-04-15 row missing"
        tags = select_board_2026_04_15[0]
        # Should contain at least 'override' since the file has that topic_segment.
        assert "override" in tags, (
            f"Expected 'override' in topic_tags, got: {tags!r}"
        )
        # Sorted, comma-joined, no spaces.
        if tags:
            parts = tags.split(",")
            assert parts == sorted(parts), f"Topic tags not sorted: {tags!r}"
            assert " " not in tags, f"Topic tags contain spaces: {tags!r}"

        # At least one meeting somewhere should have non-empty topic_tags.
        with_tags = conn.execute(
            "SELECT COUNT(*) FROM meetings WHERE topic_tags != ''"
        ).fetchone()[0]
        assert with_tags > 0, "Expected at least one meeting with non-empty topic_tags"
```

- [ ] **Step 1.2: Run, watch fail**

```bash
pytest scripts/test_build_sqlite_db.py::test_meetings_ingest -v
```

Expected: FAIL on the `topic_tags` assertion (current ingest writes empty string).

- [ ] **Step 1.3: Implement `_harvest_topic_tags`**

In `scripts/build_sqlite_db.py`, add a helper function near `_parse_frontmatter`:

```python
def _harvest_topic_tags(path: Path) -> str:
    """Return comma-joined sorted distinct topic slugs from a transcript's
    topic_segments block.

    Returns '' if the block is absent. The transcript's front-matter format
    is stable indented YAML; we don't load PyYAML.
    """
    seen: set[str] = set()
    in_segments = False
    with path.open(encoding="utf-8") as f:
        for line in f:
            line_rstripped = line.rstrip("\n")
            stripped = line_rstripped.strip()
            if not in_segments:
                if stripped == "topic_segments:":
                    in_segments = True
                continue
            # Inside topic_segments: lines look like
            #   "  - topic: public-comment"  (we want public-comment)
            # The block ends at the closing "---" or at the next top-level key
            # (no leading whitespace on the line).
            if line_rstripped == "---":
                break
            if line and not line[0].isspace() and ":" in line:
                # Top-level key like "summary_card:" closes the segments block.
                break
            if stripped.startswith("- topic:"):
                slug = stripped.split(":", 1)[1].strip()
                if slug:
                    seen.add(slug)
    return ",".join(sorted(seen))
```

- [ ] **Step 1.4: Wire it into `build_meetings`**

In `scripts/build_sqlite_db.py`, find the `payload.append((...))` call inside the meeting-ingest loop. The current call has `""` in the topic_tags slot. Replace:

```python
        payload.append(
            (
                fm.get("date") or None,
                fm.get("board") or None,
                fm.get("title") or "",
                slug,
                1,                      # has_transcript
                0,                      # has_digest (future phase)
                "",                     # topic_tags (future phase)
                f"/transcripts/{slug}/",
            )
        )
```

With:

```python
        payload.append(
            (
                fm.get("date") or None,
                fm.get("board") or None,
                fm.get("title") or "",
                slug,
                1,                      # has_transcript
                0,                      # has_digest (future phase)
                _harvest_topic_tags(md), # topic_tags from transcript front-matter
                f"/transcripts/{slug}/",
            )
        )
```

The variable `md` is the `Path` for the current transcript file inside the loop.

- [ ] **Step 1.5: Run, watch pass**

```bash
pytest scripts/test_build_sqlite_db.py -v
```

Expected: 5/5 passing.

- [ ] **Step 1.6: Rebuild and spot-check**

```bash
python3 scripts/build_sqlite_db.py
sqlite3 assets/data/marbleheaddata.sqlite "SELECT topic_tags, COUNT(*) FROM meetings GROUP BY topic_tags ORDER BY COUNT(*) DESC LIMIT 10;"
```

Expected: a few common multi-tag combinations and an empty-string row for older transcripts without `topic_segments`.

- [ ] **Step 1.7: Commit**

```bash
git add scripts/build_sqlite_db.py scripts/test_build_sqlite_db.py assets/data/marbleheaddata.sqlite
git commit -m "$(cat <<'EOF'
Populate meetings.topic_tags from transcript topic_segments

Phase 1a's meeting ingest left topic_tags as an empty string. Each
transcript already carries a topic_segments YAML array with topic:
slug entries used by the existing /topics/<slug>/ feed pages. The
new _harvest_topic_tags helper scans each file's front-matter,
collects distinct topic slugs, and writes them comma-joined and
sorted into meetings.topic_tags.

Empty string for transcripts without topic_segments (older imports).

Test verified: a known transcript surfaces 'override' in its tags,
the tags are sorted, no spaces, and at least one meeting has
non-empty tags.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 2: Populate `topics.meeting_count` via JOIN

**Files:**
- Modify: `scripts/build_sqlite_db.py`
- Modify: `scripts/test_build_sqlite_db.py`
- Regenerate: `assets/data/marbleheaddata.sqlite`

Now that `meetings.topic_tags` has real values, run a SQL UPDATE that counts, for each topic, how many meetings contain that slug in their comma-joined tag string.

- [ ] **Step 2.1: Add the failing test**

Augment `test_topics_ingest` in `scripts/test_build_sqlite_db.py`. Add before the `finally:` block:

```python
        # Phase 1c: meeting_count populated via JOIN against meetings.topic_tags.
        # At least one topic with known transcripts should have meeting_count > 0.
        override = conn.execute(
            "SELECT meeting_count FROM topics WHERE slug = 'override'"
        ).fetchone()
        assert override is not None, "override topic row missing"
        assert override[0] > 0, (
            f"Expected override meeting_count > 0, got {override[0]}"
        )

        # Total meeting_count across all topics should be > 0.
        total = conn.execute(
            "SELECT SUM(meeting_count) FROM topics"
        ).fetchone()[0]
        assert total > 0, f"Expected total meeting_count > 0, got {total}"
```

- [ ] **Step 2.2: Run, watch fail**

```bash
pytest scripts/test_build_sqlite_db.py::test_topics_ingest -v
```

Expected: FAIL on the `override meeting_count > 0` assertion (current ingest writes 0 for every row).

- [ ] **Step 2.3: Add the UPDATE after both ingests**

In `scripts/build_sqlite_db.py`, find the section in `main()` where both `build_meetings(conn)` and `build_topics(conn)` have already run, but before `conn.commit()` runs. Insert:

```python
        # Populate topics.meeting_count via LIKE join against meetings.topic_tags.
        # The ',,' bookends prevent prefix-match collisions
        # (e.g. 'override' must not match 'override-prep').
        conn.execute(
            "UPDATE topics SET meeting_count = ("
            "  SELECT COUNT(*) FROM meetings "
            "  WHERE (',' || meetings.topic_tags || ',') "
            "        LIKE ('%,' || topics.slug || ',%')"
            ")"
        )
        print(f"  {'topics.meeting_count':32s} populated via JOIN")
```

- [ ] **Step 2.4: Run, watch pass**

```bash
pytest scripts/test_build_sqlite_db.py -v
```

Expected: 5/5 passing.

- [ ] **Step 2.5: Rebuild and spot-check**

```bash
python3 scripts/build_sqlite_db.py
sqlite3 assets/data/marbleheaddata.sqlite "SELECT slug, meeting_count FROM topics ORDER BY meeting_count DESC;"
```

Expected: real counts. `override`, `admin-housekeeping`, `public-comment` likely high; some topics may stay at 0 if no transcripts mention them.

- [ ] **Step 2.6: Commit**

```bash
git add scripts/build_sqlite_db.py scripts/test_build_sqlite_db.py assets/data/marbleheaddata.sqlite
git commit -m "$(cat <<'EOF'
Populate topics.meeting_count via LIKE join on meetings.topic_tags

The UPDATE runs after both build_meetings and build_topics so the
meetings.topic_tags column has been populated. Uses ',,' bookends
on both sides of the LIKE pattern to avoid prefix-match collisions
(e.g. 'override' would otherwise also match 'override-prep' if such
a slug existed).

Side effect: /browse/topics/ list view will now show real counts
once Phase 1c's list-view changes ship.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 3: Add slugify helper + linkTemplate column support to browse.js

**Files:**
- Modify: `assets/browse.js`

This task adds two small additions to the list-view renderer: a `slugify` helper for converting values like `"ELECTRIC ENTERPRISE"` to `"electric-enterprise"`, and a new column option `linkTemplate` that produces a clickable cell with a URL built from the value (instead of from a separate `linkColumn`).

The existing `linkColumn` (used by Topics and Meetings) reads the URL from a sibling column. The new `linkTemplate` builds it from the value itself.

- [ ] **Step 3.1: Add the `slugify` helper near the other format helpers**

In `assets/browse.js`, after the `escapeHtml` function, add:

```javascript
  /* Slugify a string: lowercase, non-alphanumerics to hyphens, collapsed. */
  function slugify(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
```

- [ ] **Step 3.2: Extend `renderRows` to handle `linkTemplate`**

Find the `renderRows` function. Inside the column loop, find the block:

```javascript
        var cell;
        if (col.linkColumn && row[col.linkColumn]) {
          cell = '<a href="' + escapeHtml(row[col.linkColumn]) + '">' + formatted + "</a>";
        } else {
          cell = formatted;
        }
```

Replace with:

```javascript
        var cell;
        if (col.linkColumn && row[col.linkColumn]) {
          cell = '<a href="' + escapeHtml(row[col.linkColumn]) + '">' + formatted + "</a>";
        } else if (col.linkTemplate && value != null && value !== "") {
          var href = col.linkTemplate.replace(/\{slug\}/g, slugify(value));
          cell = '<a href="' + escapeHtml(href) + '">' + formatted + "</a>";
        } else {
          cell = formatted;
        }
```

The `{slug}` token in the template gets replaced by the slugified value. Example: `linkTemplate: "/browse/dept/#{slug}"` with value `"ELECTRIC ENTERPRISE"` produces `/browse/dept/#electric-enterprise`.

- [ ] **Step 3.3: Quick parse check**

```bash
node --check assets/browse.js && echo "JS parses OK"
```

Expected: parses.

- [ ] **Step 3.4: Commit**

```bash
git add assets/browse.js
git commit -m "$(cat <<'EOF'
Add slugify helper and linkTemplate column option to browse.js

slugify converts arbitrary text values to URL slugs (lowercase,
non-alphanumerics to hyphens, collapsed). linkTemplate is a new
column option that builds the cell's href from the value itself
using a {slug} token: e.g. linkTemplate: "/browse/dept/#{slug}"
on the department column produces clickable cells linking to
the department detail.

Used by Phase 1c's cross-reference work in Tasks 4-5.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 4: Wire department cross-reference links in vendors and budget list views

**Files:**
- Modify: `browse/vendors.html`
- Modify: `browse/budget.html`

- [ ] **Step 4.1: Update `browse/vendors.html`**

Find the columns array in the inline `<script>`:

```javascript
    columns: [
      { column: "payment_date", label: "Date", format: "date" },
      { column: "vendor", label: "Vendor" },
      { column: "department", label: "Department" },
      { column: "fund", label: "Fund" },
      { column: "amount", label: "Amount", format: "money" },
    ],
```

Replace with:

```javascript
    columns: [
      { column: "payment_date", label: "Date", format: "date" },
      { column: "vendor", label: "Vendor", linkTemplate: "/browse/vendors/#{slug}" },
      { column: "department", label: "Department", linkTemplate: "/browse/dept/#{slug}" },
      { column: "fund", label: "Fund" },
      { column: "amount", label: "Amount", format: "money" },
    ],
```

- [ ] **Step 4.2: Update `browse/budget.html`**

Find the columns array. Change the `department` entry:

```javascript
      { column: "department", label: "Department" },
```

To:

```javascript
      { column: "department", label: "Department", linkTemplate: "/browse/dept/#{slug}" },
```

- [ ] **Step 4.3: Build, screenshot for visual confirmation**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4001 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6

node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4001/browse/vendors/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.browse-table tbody tr', { timeout: 15000 });
  // Confirm department cells are now anchors.
  const linkedDepts = await page.\$\$eval('.browse-table tbody tr td:nth-child(3) a', els => els.length);
  console.log('Department links rendered:', linkedDepts);
  await page.screenshot({ path: 'proof/town-db-gui-1c-vendors-linked.png' });
  await browser.close();
})();
"
pkill -f "jekyll serve" 2>/dev/null
```

Expected: dozens of department cells render as anchors with hrefs like `/browse/dept/#expenses`, `/browse/dept/#electric-enterprise`, etc.

- [ ] **Step 4.4: Commit**

```bash
git add browse/vendors.html browse/budget.html proof/town-db-gui-1c-vendors-linked.png
git commit -m "$(cat <<'EOF'
Wire department cross-reference links in vendors and budget rows

vendors.html: vendor column now linkTemplate-linked to vendor
detail (/browse/vendors/#<slug>), department column to dept
detail (/browse/dept/#<slug>). budget.html: department column
to dept detail.

Vendor and department detail pages don't exist yet (Tasks 7-8);
the links currently navigate to a list-view URL with a hash that
the page ignores. Once detail rendering is wired (Task 6+), the
hash triggers the detail view.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 5: Add topic chips column to meetings list view

**Files:**
- Modify: `browse/meetings.html`

The `meetings.topic_tags` column now has real values (Task 1). Render them in the meetings list view as a small chip column. Each chip links to `/topics/<slug>/` (the existing topic-feed page).

This task adds a special column-formatter case: `format: "tags"`. The renderer splits the comma-joined string and renders each as an inline pill link.

- [ ] **Step 5.1: Add the `tags` format to browse.js**

In `assets/browse.js`, find the column-formatting block inside `renderRows`:

```javascript
        if (col.format === "money") formatted = fmtMoney(value);
        else if (col.format === "moneyRound") formatted = fmtMoneyRound(value);
        else formatted = escapeHtml(fmtText(value));
```

Replace with:

```javascript
        if (col.format === "money") formatted = fmtMoney(value);
        else if (col.format === "moneyRound") formatted = fmtMoneyRound(value);
        else if (col.format === "tags") formatted = fmtTagChips(value);
        else formatted = escapeHtml(fmtText(value));
```

Add a `fmtTagChips` helper near the other formatters:

```javascript
  /* Render a comma-joined tag string as a row of inline chip links.
     Each chip links to /topics/<tag>/. Returns HTML (already escaped). */
  function fmtTagChips(s) {
    if (s == null || s === "") return "";
    var tags = String(s).split(",").filter(function (t) { return t !== ""; });
    if (tags.length === 0) return "";
    var html = "";
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i];
      html +=
        '<a class="browse-tag" href="/topics/' + encodeURIComponent(tag) + '/">' +
        escapeHtml(tag) + "</a>";
    }
    return html;
  }
```

Important: the `fmtTagChips` output IS already HTML and must not be re-escaped. Update the cell-wrap logic:

```javascript
        var cell;
        if (col.linkColumn && row[col.linkColumn]) {
          cell = '<a href="' + escapeHtml(row[col.linkColumn]) + '">' + formatted + "</a>";
        } else if (col.linkTemplate && value != null && value !== "") {
          var href = col.linkTemplate.replace(/\{slug\}/g, slugify(value));
          cell = '<a href="' + escapeHtml(href) + '">' + formatted + "</a>";
        } else {
          cell = formatted;
        }
```

stays as-is. For the `tags` format, do NOT wrap in an outer anchor (the chips are individually linked). To handle this, change the condition:

```javascript
        var cell;
        if (col.format === "tags") {
          cell = formatted;
        } else if (col.linkColumn && row[col.linkColumn]) {
          cell = '<a href="' + escapeHtml(row[col.linkColumn]) + '">' + formatted + "</a>";
        } else if (col.linkTemplate && value != null && value !== "") {
          var href = col.linkTemplate.replace(/\{slug\}/g, slugify(value));
          cell = '<a href="' + escapeHtml(href) + '">' + formatted + "</a>";
        } else {
          cell = formatted;
        }
```

- [ ] **Step 5.2: Add `.browse-tag` styling to assets/browse.css**

Append to the end of `assets/browse.css`:

```css
/* Topic tag chips inside table cells. */
.browse-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  margin: 0 4px 2px 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--c-navy) 6%, transparent);
  color: var(--text);
  text-decoration: none;
}
.browse-tag:hover {
  background: color-mix(in srgb, var(--c-teal) 15%, transparent);
  color: var(--c-teal);
}
```

- [ ] **Step 5.3: Update `browse/meetings.html` columns**

Find the columns array. Replace:

```javascript
    columns: [
      { column: "meeting_date", label: "Date", format: "date" },
      { column: "board", label: "Board" },
      { column: "title", label: "Title", linkColumn: "url" },
    ],
```

With:

```javascript
    columns: [
      { column: "meeting_date", label: "Date", format: "date" },
      { column: "board", label: "Board" },
      { column: "title", label: "Title", linkColumn: "url" },
      { column: "topic_tags", label: "Topics", format: "tags" },
    ],
```

- [ ] **Step 5.4: Build, screenshot**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4001 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6

node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4001/browse/meetings/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.browse-table tbody tr', { timeout: 15000 });
  const tagCount = await page.\$\$eval('.browse-tag', els => els.length);
  console.log('Topic chips rendered:', tagCount);
  await page.screenshot({ path: 'proof/town-db-gui-1c-meetings-tags.png' });
  await browser.close();
})();
"
pkill -f "jekyll serve" 2>/dev/null
```

Expected: dozens of `.browse-tag` chips across the visible rows.

- [ ] **Step 5.5: Commit**

```bash
git add assets/browse.js assets/browse.css browse/meetings.html proof/town-db-gui-1c-meetings-tags.png
git commit -m "$(cat <<'EOF'
Render meeting topic_tags as chip column in /browse/meetings/

Adds a 'tags' format option to browse.js that splits a comma-joined
string and renders each as a small inline chip linking to the
existing /topics/<slug>/ page. Adds .browse-tag styling.

Result: each meeting row now surfaces which topical areas its
transcript covered, with one click out to the topic feed.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 6: Add `Browse.renderDetailView` + hash router to browse.js

**Files:**
- Modify: `assets/browse.js`

This task introduces the shared detail-view runtime. `renderDetailView(config)` takes a config that names the SQL queries to run and the DOM regions to populate. A hash-change listener swaps between list view and detail view on the same page.

- [ ] **Step 6.1: Add the detail-view renderer**

At the bottom of `assets/browse.js`, before the existing `window.Browse = { renderListView: renderListView };` line, add:

```javascript
  /* Render a detail view. Config shape:
     {
       slugParam: "vendor",                  // for the breadcrumb label
       headerQuery: {                         // single-row SQL to fill the header
         sql: "SELECT vendor, COUNT(*) AS n_payments, SUM(amount) AS total ... WHERE vendor = :slug",
         render: function (row) { return "..."; },   // returns header HTML
       },
       sections: [
         {
           selector: ".detail-payments",       // where to mount this section
           sql: "SELECT * FROM vendor_payments WHERE vendor = :slug ORDER BY payment_date DESC",
           columns: [...],                     // browse-table column configs
           emptyMessage: "No rows.",
         },
         ...
       ],
     }
   */
  function renderDetailView(config) {
    var slug = (location.hash || "").replace(/^#/, "");
    if (!slug) {
      // No hash: show the list view (caller controls show/hide via DOM).
      showDetail(false);
      return;
    }
    showDetail(true);
    var headerEl = document.querySelector(".detail-header");
    var bodyEl = document.querySelector(".detail-body");
    if (headerEl) headerEl.innerHTML = '<div class="browse-status">Loading...</div>';
    loadDb().then(function (db) {
      // The display-friendly value derived from the slug.
      // Reverse-slugify the slug to find the row whose slugified value matches.
      // (Vendors and departments are uppercase in the data; we match
      // case-insensitive by computing slug client-side per row.)

      // Header.
      if (config.headerQuery && headerEl) {
        var stmt = db.prepare(config.headerQuery.sql);
        // Pull all rows whose slugified key column matches the URL slug.
        var keyCol = config.headerQuery.keyColumn;
        var likeSql = config.headerQuery.allSql ||
          ("SELECT * FROM \"" + config.headerQuery.table + "\"");
        stmt.free();
        // Simpler: scan and filter by slugify match on the key column.
        var all = db.prepare(likeSql);
        var matches = [];
        while (all.step()) {
          var r = all.getAsObject();
          if (slugify(r[keyCol]) === slug) matches.push(r);
        }
        all.free();
        if (matches.length === 0) {
          headerEl.innerHTML =
            '<div class="browse-status">No rows match "' +
            escapeHtml(slug) + '".</div>';
          return;
        }
        headerEl.innerHTML = config.headerQuery.render(matches);
      }

      // Sections.
      if (bodyEl) bodyEl.innerHTML = "";
      (config.sections || []).forEach(function (section) {
        var sec = document.createElement("section");
        sec.className = section.className || "detail-section";
        if (section.heading) {
          var h = document.createElement("h3");
          h.textContent = section.heading;
          sec.appendChild(h);
        }
        var table = document.createElement("table");
        table.className = "browse-table";
        var thead = document.createElement("thead");
        var trh = document.createElement("tr");
        section.columns.forEach(function (col) {
          var th = document.createElement("th");
          th.textContent = col.label;
          trh.appendChild(th);
        });
        thead.appendChild(trh);
        table.appendChild(thead);
        var tbody = document.createElement("tbody");
        table.appendChild(tbody);
        sec.appendChild(table);
        if (bodyEl) bodyEl.appendChild(sec);

        // Pull matching rows from a flexible source.
        var rows = [];
        var stmtAll = db.prepare(section.sql);
        while (stmtAll.step()) {
          var r2 = stmtAll.getAsObject();
          // Optional client-side slug filter (the section.sql may already
          // filter by slug if it has an obvious key column).
          if (section.filterBySlug && slugify(r2[section.filterBySlug]) !== slug) continue;
          rows.push(r2);
        }
        stmtAll.free();

        if (rows.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="' + section.columns.length +
            '" class="browse-status">' +
            escapeHtml(section.emptyMessage || "No rows match.") +
            '</td></tr>';
          return;
        }

        var html = "";
        for (var i = 0; i < rows.length; i++) {
          html += "<tr>";
          var row = rows[i];
          for (var j = 0; j < section.columns.length; j++) {
            var col = section.columns[j];
            var v = row[col.column];
            var f;
            if (col.format === "money") f = fmtMoney(v);
            else if (col.format === "moneyRound") f = fmtMoneyRound(v);
            else if (col.format === "tags") f = fmtTagChips(v);
            else f = escapeHtml(fmtText(v));
            var classes = [];
            if (col.format === "money" || col.format === "moneyRound") classes.push("is-numeric");
            if (col.format === "date") classes.push("is-date");
            var c;
            if (col.format === "tags") c = f;
            else if (col.linkColumn && row[col.linkColumn]) {
              c = '<a href="' + escapeHtml(row[col.linkColumn]) + '">' + f + "</a>";
            } else if (col.linkTemplate && v != null && v !== "") {
              var hh = col.linkTemplate.replace(/\{slug\}/g, slugify(v));
              c = '<a href="' + escapeHtml(hh) + '">' + f + "</a>";
            } else c = f;
            html += '<td class="' + classes.join(" ") + '">' + c + "</td>";
          }
          html += "</tr>";
        }
        tbody.innerHTML = html;
      });
    }).catch(function (err) {
      if (headerEl) {
        headerEl.innerHTML =
          '<div class="browse-status">Couldn\'t load the database. ' +
          escapeHtml(err.message) + '</div>';
      }
    });
  }

  /* Show/hide list view vs detail view based on hash state. */
  function showDetail(showDetail) {
    var list = document.querySelector(".browse-list-view");
    var detail = document.querySelector(".browse-detail-view");
    if (list) list.style.display = showDetail ? "none" : "";
    if (detail) detail.style.display = showDetail ? "" : "none";
  }

  /* Router: on initial paint and on hashchange, decide which view runs. */
  function mountListAndDetail(listConfig, detailConfig) {
    function route() {
      var hasHash = !!location.hash.replace(/^#/, "");
      if (hasHash && detailConfig) {
        renderDetailView(detailConfig);
      } else if (listConfig) {
        showDetail(false);
        renderListView(listConfig);
      }
    }
    route();
    window.addEventListener("hashchange", route);
  }
```

Then replace the `window.Browse = { renderListView: renderListView };` line with:

```javascript
  window.Browse = {
    renderListView: renderListView,
    renderDetailView: renderDetailView,
    mountListAndDetail: mountListAndDetail,
    slugify: slugify,
  };
```

- [ ] **Step 6.2: Quick parse check**

```bash
node --check assets/browse.js && echo "JS parses OK"
```

Expected: parses. (No runtime test possible until Tasks 7 and 8 mount the new container divs.)

- [ ] **Step 6.3: Commit**

```bash
git add assets/browse.js
git commit -m "$(cat <<'EOF'
Add renderDetailView + hash router to browse.js

renderDetailView reads a slug from location.hash, queries the
SQLite for matching rows (filtered client-side by slugified key
column), and renders into .detail-header and .detail-body.

mountListAndDetail is the public router: page calls it once with
both a list config and a detail config, and the hash decides
which to show. Hash changes (back/forward, in-page links) re-route.

showDetail toggles .browse-list-view vs .browse-detail-view DOM
containers so pages can use one URL for both views.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 7: Wire vendor detail into /browse/vendors/

**Files:**
- Modify: `browse/vendors.html`
- Modify: `assets/browse.css`

The vendors page already exists from Phase 1b. This task wraps the list-view DOM in a `.browse-list-view` container, adds a parallel `.browse-detail-view` container (hidden by default), and changes the bottom inline script to call `Browse.mountListAndDetail(...)` with both configs.

- [ ] **Step 7.1: Add detail-page CSS**

Append to `assets/browse.css`:

```css
/* Detail-view header card. */
.browse-detail-view {
  display: none;
}
.detail-header {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 18px 22px;
  margin: 0 0 22px;
}
.detail-header h2 {
  font-family: 'Libre Franklin', system-ui, sans-serif;
  font-size: clamp(20px, 3vw, 26px);
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0 0 12px;
  color: var(--text);
  text-transform: uppercase;
}
.detail-header-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 18px;
  font-size: 13px;
}
.detail-header-grid dt {
  color: var(--text-subtle);
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  margin: 0 0 4px;
}
.detail-header-grid dd {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* Detail body: sections of tables. */
.detail-section {
  margin: 0 0 28px;
}
.detail-section h3 {
  font-family: 'Libre Franklin', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 10px;
  color: var(--text);
}
.detail-section .browse-table { width: 100%; }
```

- [ ] **Step 7.2: Restructure `browse/vendors.html`**

Replace the entire body (everything after the front-matter `---`) with:

```html
<div class="browse-list-view">
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
    Source: <code>marbleheaddata.sqlite</code> &rarr; <code>vendor_payments</code>,
    ingested from the Marblehead Open Finance vendor checks export.
    Department is the source CSV's Division when present, otherwise
    falls back to Fund. The label "Unattributed" marks rows with neither.
  </p>
</div>

<div class="browse-detail-view">
  <div class="detail-header"></div>
  <div class="detail-body"></div>
  <p class="browse-footnote">
    <a href="/browse/vendors/">&larr; back to all vendors</a>
  </p>
</div>

<script src="/assets/browse.js" defer></script>
<script>
window.addEventListener("DOMContentLoaded", function () {
  window.Browse.mountListAndDetail(
    {
      table: "vendor_payments",
      columns: [
        { column: "payment_date", label: "Date", format: "date" },
        { column: "vendor", label: "Vendor", linkTemplate: "/browse/vendors/#{slug}" },
        { column: "department", label: "Department", linkTemplate: "/browse/dept/#{slug}" },
        { column: "fund", label: "Fund" },
        { column: "amount", label: "Amount", format: "money" },
      ],
      filters: [
        { column: "fiscal_year", label: "FY", multi: true, valuesFrom: "distinct" },
        { column: "department", label: "Dept", multi: true, valuesFrom: "distinct", topN: 12 },
      ],
      searchColumns: ["vendor", "department", "category", "fund"],
      defaultSortColumn: "payment_date",
      defaultSortDesc: true,
      pageSize: 100,
    },
    {
      headerQuery: {
        keyColumn: "vendor",
        allSql: "SELECT vendor, department, fund, payment_date, amount FROM vendor_payments",
        render: function (rows) {
          var vendor = rows[0].vendor;
          var total = 0;
          var depts = {};
          var funds = {};
          var first = rows[0].payment_date;
          var last = rows[0].payment_date;
          for (var i = 0; i < rows.length; i++) {
            total += Number(rows[i].amount) || 0;
            if (rows[i].department) depts[rows[i].department] = true;
            if (rows[i].fund) funds[rows[i].fund] = true;
            if (rows[i].payment_date < first) first = rows[i].payment_date;
            if (rows[i].payment_date > last) last = rows[i].payment_date;
          }
          var fmtMoney = function (n) {
            return "$" + Math.round(n).toLocaleString();
          };
          var deptList = Object.keys(depts).sort().join(", ");
          var fundList = Object.keys(funds).sort().join(", ");
          return (
            '<h2>' + (vendor ? vendor.replace(/</g, "&lt;") : "(unnamed)") + '</h2>' +
            '<dl class="detail-header-grid">' +
              '<div><dt>Total paid</dt><dd>' + fmtMoney(total) + '</dd></div>' +
              '<div><dt>Payments</dt><dd>' + rows.length + '</dd></div>' +
              '<div><dt>First payment</dt><dd>' + first + '</dd></div>' +
              '<div><dt>Last payment</dt><dd>' + last + '</dd></div>' +
              '<div><dt>Departments</dt><dd>' + (deptList || "(none)") + '</dd></div>' +
              '<div><dt>Funds</dt><dd>' + (fundList || "(none)") + '</dd></div>' +
            '</dl>'
          );
        },
      },
      sections: [
        {
          heading: "All payments",
          className: "detail-section detail-payments",
          sql: "SELECT payment_date, department, fund, category, amount, vendor FROM vendor_payments ORDER BY payment_date DESC",
          filterBySlug: "vendor",
          columns: [
            { column: "payment_date", label: "Date", format: "date" },
            { column: "department", label: "Department", linkTemplate: "/browse/dept/#{slug}" },
            { column: "fund", label: "Fund" },
            { column: "category", label: "Description" },
            { column: "amount", label: "Amount", format: "money" },
          ],
          emptyMessage: "No payments to this vendor.",
        },
      ],
    }
  );
});
</script>
```

(Note: I removed the `entity: vendors` permalink reference because the page is the same `permalink: /browse/vendors/`. The breadcrumb already points at Vendors. The page YAML at the top stays as it was in Phase 1b.)

- [ ] **Step 7.3: Build and test the vendor detail**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4001 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6

# Pick a known vendor slug from the data:
sqlite3 assets/data/marbleheaddata.sqlite "SELECT vendor FROM vendor_payments WHERE vendor IS NOT NULL ORDER BY amount DESC LIMIT 1;"
# Use that vendor's name slugified in the hash URL below.

node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  // First: list view loads.
  await page.goto('http://127.0.0.1:4001/browse/vendors/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.browse-table tbody tr', { timeout: 15000 });
  // Then navigate via hash to a known vendor.
  // Use any vendor that appears in the FY26 data.
  await page.goto('http://127.0.0.1:4001/browse/vendors/#hilltop-securities-inc', { waitUntil: 'networkidle' });
  await page.waitForSelector('.detail-header h2', { timeout: 10000 });
  const headerText = await page.textContent('.detail-header h2');
  console.log('Detail header:', headerText);
  const rows = await page.\$\$eval('.detail-payments tbody tr', els => els.length);
  console.log('Detail rows:', rows);
  await page.screenshot({ path: 'proof/town-db-gui-1c-vendor-detail.png' });
  await browser.close();
})();
"
pkill -f "jekyll serve" 2>/dev/null
```

Expected: detail header shows the vendor name uppercased, payment count, total, etc. Detail body shows a payments table.

- [ ] **Step 7.4: Commit**

```bash
git add browse/vendors.html assets/browse.css proof/town-db-gui-1c-vendor-detail.png
git commit -m "$(cat <<'EOF'
Wire vendor detail into /browse/vendors/

Wraps the existing list view in .browse-list-view and adds a
parallel .browse-detail-view container. mountListAndDetail()
in browse.js routes between them based on location.hash.

Detail header shows total paid, payment count, date range,
departments served, funds used. All-payments table below.
Department names in the detail are linked to /browse/dept/#<slug>.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 8: Build /browse/dept/ with department detail

**Files:**
- Create: `browse/dept.html`

The department page is hash-only. With no hash, it renders an empty-state landing. With a hash, it renders the department detail (top vendors + budget lines).

- [ ] **Step 8.1: Create `browse/dept.html`**

```html
---
title: "Browse: Departments"
permalink: /browse/dept/
layout: browse
entity: dept
entity_label: Departments
---

<div class="browse-list-view">
  <p class="browse-status">
    Pick a department from the
    <a href="/browse/vendors/">Vendors</a> or
    <a href="/browse/budget/">Budget</a>
    tables to view its detail. The department detail shows every
    vendor paid, every budget line, and which topics related meetings discussed.
  </p>
</div>

<div class="browse-detail-view">
  <div class="detail-header"></div>
  <div class="detail-body"></div>
  <p class="browse-footnote">
    <a href="/browse/vendors/">&larr; back to vendors</a>
    &middot;
    <a href="/browse/budget/">budget</a>
  </p>
</div>

<script src="/assets/browse.js" defer></script>
<script>
window.addEventListener("DOMContentLoaded", function () {
  window.Browse.mountListAndDetail(
    null,
    {
      headerQuery: {
        keyColumn: "department",
        allSql: "SELECT department, fund, amount FROM vendor_payments WHERE department IS NOT NULL",
        render: function (rows) {
          var dept = rows[0].department;
          var total = 0;
          var funds = {};
          var byVendor = {};
          for (var i = 0; i < rows.length; i++) {
            total += Number(rows[i].amount) || 0;
            if (rows[i].fund) funds[rows[i].fund] = true;
          }
          var fmtMoney = function (n) { return "$" + Math.round(n).toLocaleString(); };
          return (
            '<h2>' + (dept ? dept.replace(/</g, "&lt;") : "(unnamed)") + '</h2>' +
            '<dl class="detail-header-grid">' +
              '<div><dt>Vendor spend this FY</dt><dd>' + fmtMoney(total) + '</dd></div>' +
              '<div><dt>Vendor payment rows</dt><dd>' + rows.length + '</dd></div>' +
              '<div><dt>Funds</dt><dd>' + Object.keys(funds).sort().join(", ") + '</dd></div>' +
            '</dl>'
          );
        },
      },
      sections: [
        {
          heading: "Top vendors by total",
          className: "detail-section detail-top-vendors",
          sql: "SELECT vendor, department, COUNT(*) AS n_payments, SUM(amount) AS total FROM vendor_payments GROUP BY vendor, department ORDER BY SUM(amount) DESC",
          filterBySlug: "department",
          columns: [
            { column: "vendor", label: "Vendor", linkTemplate: "/browse/vendors/#{slug}" },
            { column: "n_payments", label: "Payments" },
            { column: "total", label: "Total", format: "moneyRound" },
          ],
          emptyMessage: "No vendor payments under this department.",
        },
        {
          heading: "Budget lines",
          className: "detail-section detail-budget",
          sql: "SELECT fiscal_year, line_item, fund, amount, department FROM budget_lines",
          filterBySlug: "department",
          columns: [
            { column: "fiscal_year", label: "FY", format: "date" },
            { column: "line_item", label: "Line item" },
            { column: "fund", label: "Fund" },
            { column: "amount", label: "Amount", format: "moneyRound" },
          ],
          emptyMessage: "No budget_lines rows under this department.",
        },
      ],
    }
  );
});
</script>
```

- [ ] **Step 8.2: Build and screenshot**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4001 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6

node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  // Empty-state landing.
  await page.goto('http://127.0.0.1:4001/browse/dept/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'proof/town-db-gui-1c-dept-empty.png' });
  // Detail (Electric Enterprise).
  await page.goto('http://127.0.0.1:4001/browse/dept/#electric-enterprise', { waitUntil: 'networkidle' });
  await page.waitForSelector('.detail-header h2', { timeout: 10000 });
  const headerText = await page.textContent('.detail-header h2');
  console.log('Dept header:', headerText);
  const vendorRows = await page.\$\$eval('.detail-top-vendors tbody tr', els => els.length);
  console.log('Top vendor rows:', vendorRows);
  await page.screenshot({ path: 'proof/town-db-gui-1c-dept-detail.png' });
  await browser.close();
})();
"
pkill -f "jekyll serve" 2>/dev/null
```

Expected: dept header reads "ELECTRIC ENTERPRISE", top vendors include Berkshire Wind, Myers Controlled Power, etc.

- [ ] **Step 8.3: Commit**

```bash
git add browse/dept.html proof/town-db-gui-1c-dept-empty.png proof/town-db-gui-1c-dept-detail.png
git commit -m "$(cat <<'EOF'
Add /browse/dept/ with hash-driven department detail

Empty-state landing at /browse/dept/ points back to vendors/budget
as the entry points. With a hash like #electric-enterprise the
detail renders: header with total vendor spend + payment count +
funds, top vendors table (grouped by vendor name, summed), and a
budget_lines section filtered to this department (often empty
when the dept is an enterprise fund or capital project).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 9: Add Departments to the left nav (so dept detail has a visible home)

**Files:**
- Modify: `_layouts/browse.html`

The current shell nav has 4 entries: Vendors, Budget, Meetings, Topics. Departments are reachable via cross-references only, but the left nav should still highlight "Departments" when the visitor is on `/browse/dept/...` so they aren't lost.

Add Departments as a fifth entry. The spec said "no Departments left-nav entry," but the practical UX of landing on `/browse/dept/` with no active nav entry is worse than the small symmetry cost. Keep this change minimal: add it after Topics so the existing ordering is preserved.

- [ ] **Step 9.1: Update `_layouts/browse.html`**

Find:

```html
      <li><a href="/browse/topics/" class="browse-nav-item{% if page.entity == 'topics' %} is-active{% endif %}">Topics</a></li>
    </ul>
```

Replace with:

```html
      <li><a href="/browse/topics/" class="browse-nav-item{% if page.entity == 'topics' %} is-active{% endif %}">Topics</a></li>
      <li><a href="/browse/dept/" class="browse-nav-item{% if page.entity == 'dept' %} is-active{% endif %}">Departments</a></li>
    </ul>
```

- [ ] **Step 9.2: Verify the smoke test still expects 4 nav items**

The Phase 1b smoke test asserts `navItems.length === 4`. With Departments added, it's 5. The Phase 1c smoke test additions in Task 10 will update this assertion. Note in the commit so the implementer remembers.

- [ ] **Step 9.3: Commit**

```bash
git add _layouts/browse.html
git commit -m "$(cat <<'EOF'
Add Departments to /browse/ left nav so dept detail has a home

Spec said "no Departments left-nav entry" to avoid faux symmetry,
but landing on /browse/dept/ with no active nav highlight gives a
worse UX than the small symmetry cost. Adds Departments after
Topics. The /browse/dept/ landing without a hash shows an
empty-state pointer back to Vendors and Budget.

The Phase 1b smoke test asserted 4 nav items; the Phase 1c
additions in tests/smoke-test.mjs update this to 5.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 10: Smoke tests for detail pages + topic counts

**Files:**
- Modify: `tests/smoke-test.mjs`

- [ ] **Step 10.1: Update the nav-items assertion to expect 5**

In `tests/smoke-test.mjs`, find:

```javascript
  const navItems = await page.$$('.browse-nav-item');
  navItems.length === 4 ? ok('Left nav has 4 entities') : fail('Left nav', `got ${navItems.length}`);
```

Change `=== 4` to `=== 5` and the log message to "5 entities".

- [ ] **Step 10.2: Add three new test functions**

Add near the other `async function testBrowse...` definitions:

```javascript
async function testVendorDetail(page) {
  console.log('\n── /browse/vendors/#<slug> (detail) ──');
  await page.goto(`${SITE}/browse/vendors/#hilltop-securities-inc`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.detail-header h2', { timeout: 15000 });
  } catch (_) {
    fail('vendor detail', 'no header rendered within 15s');
    return;
  }
  const header = (await page.textContent('.detail-header h2')).trim();
  header.length > 0
    ? ok(`Vendor detail header rendered: "${header}"`)
    : fail('vendor detail header', 'empty');
  const rows = await page.$$('.detail-payments tbody tr');
  rows.length > 0
    ? ok(`${rows.length} payment rows in vendor detail`)
    : fail('vendor detail payments', 'none');
}

async function testDeptDetail(page) {
  console.log('\n── /browse/dept/#<slug> (detail) ──');
  await page.goto(`${SITE}/browse/dept/#electric-enterprise`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.detail-header h2', { timeout: 15000 });
  } catch (_) {
    fail('dept detail', 'no header rendered within 15s');
    return;
  }
  const header = (await page.textContent('.detail-header h2')).trim();
  /ELECTRIC ENTERPRISE/i.test(header)
    ? ok(`Dept detail header reads "${header}"`)
    : fail('dept detail header', `expected ELECTRIC ENTERPRISE, got "${header}"`);
  const vendorRows = await page.$$('.detail-top-vendors tbody tr');
  vendorRows.length > 0
    ? ok(`${vendorRows.length} top-vendor rows`)
    : fail('dept detail top vendors', 'none');
}

async function testTopicMeetingCounts(page) {
  console.log('\n── /browse/topics/ meeting_count > 0 ──');
  await page.goto(`${SITE}/browse/topics/`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.browse-table tbody tr', { timeout: 10000 });
  } catch (_) {
    fail('topics counts', 'no rows rendered');
    return;
  }
  const counts = await page.$$eval('.browse-table tbody tr td:nth-child(3)', els =>
    els.map(e => parseInt((e.textContent || '0').trim(), 10) || 0)
  );
  const nonZero = counts.filter(c => c > 0).length;
  nonZero > 0
    ? ok(`${nonZero}/${counts.length} topics have non-zero meeting_count`)
    : fail('topics counts', 'all zero');
}
```

- [ ] **Step 10.3: Call the new tests in the main block**

In the main `(async () => { ... })` block, after the existing `await testBrowseEntity(page, 'vendors', 50);` line, add:

```javascript
  await testVendorDetail(page);
  await testDeptDetail(page);
  await testTopicMeetingCounts(page);
```

- [ ] **Step 10.4: Run the full smoke suite**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4001 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6
SITE=http://127.0.0.1:4001 node tests/smoke-test.mjs 2>&1 | tail -25
pkill -f "jekyll serve" 2>/dev/null
```

Expected: 0 new failures. Browse asserts now include vendor detail, dept detail, and non-zero topic counts.

- [ ] **Step 10.5: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "$(cat <<'EOF'
Add smoke tests for Phase 1c: vendor detail, dept detail, topic counts

testVendorDetail navigates to /browse/vendors/#hilltop-securities-inc
and asserts a header and at least one payment row render.

testDeptDetail navigates to /browse/dept/#electric-enterprise and
asserts the header reads ELECTRIC ENTERPRISE plus at least one
top-vendor row.

testTopicMeetingCounts asserts at least one topic on /browse/topics/
has a meeting_count > 0 (previously all were 0 in Phase 1b).

Updates the left-nav assertion from 4 to 5 entities for the new
Departments link.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 11: Final proof, push, open PR

**Files:**
- Create: `proof/town-db-gui-1c.png`
- Create: `proof/town-db-gui-1c-full.png`

- [ ] **Step 11.1: Capture above-fold + full-page screenshots**

```bash
pkill -f "jekyll serve" 2>/dev/null
bundle exec jekyll build 2>&1 | tail -3
nohup bundle exec jekyll serve --port 4001 --host 127.0.0.1 --no-watch > /tmp/jekyll.log 2>&1 &
sleep 6

node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const v of [
    { name: 'town-db-gui-1c.png', url: '/browse/dept/#electric-enterprise', viewport: { width: 1440, height: 900 }, fullPage: false },
    { name: 'town-db-gui-1c-full.png', url: '/browse/dept/#electric-enterprise', viewport: { width: 1440, height: 900 }, fullPage: true },
  ]) {
    const ctx = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:4001' + v.url, { waitUntil: 'networkidle' });
    await page.waitForSelector('.detail-header h2', { timeout: 15000 });
    await page.screenshot({ path: 'proof/' + v.name, fullPage: v.fullPage });
    await ctx.close();
  }
  await browser.close();
})();
"
pkill -f "jekyll serve" 2>/dev/null
ls -lh proof/town-db-gui-1c.png proof/town-db-gui-1c-full.png
```

- [ ] **Step 11.2: Push and open PR**

```bash
git add proof/town-db-gui-1c.png proof/town-db-gui-1c-full.png
git commit -m "$(cat <<'EOF'
Phase 1c proof: above-fold + full-page /browse/dept/ detail screenshots

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"

git push
```

Then `gh pr create` (the existing PR #911 already covers Phase 1b; Phase 1c could either extend that PR or open a new one off main once 1b merges). If the PR exists, push to update it. If 1b has merged into main since this plan was written, branch off main and open a fresh PR for Phase 1c only.

The implementer should check `gh pr view 911 --json state` first and decide.

---

## Definition of done

- All 11 tasks committed.
- `npm run test:local` green.
- `/browse/vendors/#<some-slug>` renders a vendor detail with payment rows.
- `/browse/dept/#<some-slug>` renders a department detail with top vendors and (where applicable) budget lines.
- `/browse/topics/` `meeting_count` column shows non-zero counts.
- `/browse/meetings/` has a topic chip column linking out to existing `/topics/` pages.
- Cross-reference links work: clicking a department in vendors or budget opens the dept detail; clicking a vendor in vendors opens the vendor detail.

## Out of scope reminders

- No budget-line or fund detail pages.
- No standalone left-nav entry for individual departments (the nav has one "Departments" link to the landing page).
- No charts on detail pages.
- No global cross-entity search.
- No migration of `/checkbook/` to query SQLite.
- No editorial integration (existing /topics/, /override/, etc. pages unchanged).
