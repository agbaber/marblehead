# School Share Column — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "School share" sort button + table column to `charts/town_explorer.html`, surfacing each town's `education_pct_of_gf` from `data/dor_all_351_FY26.csv`.

**Architecture:** Single-file HTML/JS edit. The 351-row data is inlined as a JSON literal; a one-shot Python script augments each row with a new `esh` field, then the HTML/JS gets four small text edits to wire up the new column (sort button, table header, render cell, formatter, explainer). No new dependencies; no build pipeline.

**Tech Stack:** Python 3 (stdlib only) for the augmentation script. Inline vanilla JS in the Jekyll HTML page. Playwright for verification (existing `tests/` infrastructure).

---

## File Structure

**Create:**
- `scripts/add_school_share_to_explorer.py` — one-shot script to add `esh` field to inline DATA array

**Modify:**
- `charts/town_explorer.html` — five surgical text edits (sort button, table header, render cell, formatter, explainer + COL_LABELS, NCOLS, augmented DATA literal)

**No tests created.** The existing `tests/smoke-test.mjs` does not cover the explorer page, and adding a Playwright test for one column is over-engineering for this scope. Verification is a manual browser check + screenshot.

---

## Spec reference

Working from `docs/superpowers/specs/2026-04-29-school-share-column-design.md`. Key invariants:

- New field key: `esh` (numeric, 1 decimal place, 0–100 range)
- Source: `education_pct_of_gf` column in `data/dor_all_351_FY26.csv`
- Position: between "Tax per person" and "New construction" in both sort bar and table
- Default sort: ascending (no entry in `DESC_DEFAULT`)
- Explainer text: see Task 4 below
- Marblehead value: 45.8%
- No filter bar entry, no cohort preset changes

---

### Task 1: Augmentation script

**Files:**
- Create: `scripts/add_school_share_to_explorer.py`

- [ ] **Step 1: Write the script**

Create `scripts/add_school_share_to_explorer.py` with this content:

```python
#!/usr/bin/env python3
"""Add `esh` (education share of general fund) to charts/town_explorer.html.

Reads education_pct_of_gf from data/dor_all_351_FY26.csv and merges it as
a new `esh` field onto each town row in the inlined DATA JSON array in
charts/town_explorer.html.

Usage: python3 scripts/add_school_share_to_explorer.py
"""
import csv
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = REPO_ROOT / "data" / "dor_all_351_FY26.csv"
HTML_PATH = REPO_ROOT / "charts" / "town_explorer.html"


def load_school_share() -> dict[str, float]:
    """Return {municipality: education_pct_of_gf} as floats."""
    out = {}
    with CSV_PATH.open() as f:
        for row in csv.DictReader(f):
            out[row["municipality"]] = float(row["education_pct_of_gf"])
    return out


def main() -> int:
    shares = load_school_share()
    html = HTML_PATH.read_text()

    match = re.search(r"(  var DATA = )(\[.*?\])(;)", html)
    if not match:
        print("ERROR: could not locate `var DATA = [...]` in HTML", file=sys.stderr)
        return 1

    data = json.loads(match.group(2))

    missing = []
    for row in data:
        name = row["n"]
        if name not in shares:
            missing.append(name)
            continue
        if "esh" in row:
            print(f"WARN: {name} already has esh={row['esh']}, overwriting")
        row["esh"] = shares[name]

    if missing:
        print(f"ERROR: {len(missing)} towns in DATA not found in CSV: {missing[:5]}...", file=sys.stderr)
        return 1

    new_literal = json.dumps(data, separators=(",", ":"))
    new_html = html[: match.start(2)] + new_literal + html[match.end(2) :]

    HTML_PATH.write_text(new_html)
    print(f"OK: augmented {len(data)} towns with esh field")
    print(f"    Marblehead esh = {next(r['esh'] for r in data if r['n'] == 'Marblehead')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Make it executable and run it**

```bash
cd /home/claude/marblehead/.claude/worktrees/bridge-cse_01AwY5EENyT6xPyEM7BujHn2
chmod +x scripts/add_school_share_to_explorer.py
python3 scripts/add_school_share_to_explorer.py
```

Expected output:
```
OK: augmented 351 towns with esh field
    Marblehead esh = 45.8
```

- [ ] **Step 3: Verify the JSON is valid and Marblehead has the new field**

```bash
python3 -c "
import json, re
with open('charts/town_explorer.html') as f:
    content = f.read()
m = re.search(r'var DATA = (\[.*?\]);', content)
data = json.loads(m.group(1))
mhd = [t for t in data if t['n'] == 'Marblehead'][0]
print('rows:', len(data))
print('marblehead esh:', mhd['esh'])
print('keys count:', len(data[0].keys()))
assert all('esh' in t for t in data), 'some rows missing esh'
print('all rows have esh: OK')
"
```

Expected:
```
rows: 351
marblehead esh: 45.8
keys count: 22
all rows have esh: OK
```

- [ ] **Step 4: Commit**

```bash
git add scripts/add_school_share_to_explorer.py charts/town_explorer.html
git commit -m "Add esh (education share) field to Town Explorer DATA array

351-row augmentation pulled from education_pct_of_gf in
dor_all_351_FY26.csv. Marblehead = 45.8% (DOR Schedule A
education line as share of total GF expenditures).

Schedule A's Education line excludes benefits/OPEB/pension
costs (those sit under Fixed Costs). Same convention applies
to all 351 towns, so cross-town comparison is fair.
"
```

---

### Task 2: Wire the new column into the JS data plumbing

**Files:**
- Modify: `charts/town_explorer.html` (around lines 450, 500)

This task adds the `esh` key to `COL_LABELS`, adds an entry to `fmtVal()`, and bumps `NCOLS` from 16 to 17.

- [ ] **Step 1: Add `esh` to COL_LABELS**

Find line 450, which currently reads:

```js
  var COL_LABELS = { n:'name', p:'population', ipc:'income per person', bill:'avg tax bill', bpi:'bill as % of income', ahv:'avg home value', rate:'tax rate', rpct:'homeowner share', lpc:'tax per person', ng:'new construction growth', density:'people per sq mi', lpsm:'levy per sq mi', ovr:'overrides passed', opr:'override pass rate', yso:'years since override' };
```

Replace it with (one new entry inserted after `lpc:'tax per person'`):

```js
  var COL_LABELS = { n:'name', p:'population', ipc:'income per person', bill:'avg tax bill', bpi:'bill as % of income', ahv:'avg home value', rate:'tax rate', rpct:'homeowner share', lpc:'tax per person', esh:'school share', ng:'new construction growth', density:'people per sq mi', lpsm:'levy per sq mi', ovr:'overrides passed', opr:'override pass rate', yso:'years since override' };
```

- [ ] **Step 2: Add `esh` formatting to `fmtVal()`**

Find this block at line 654:

```js
  function fmtVal(col, v) {
    if (col === 'bpi' || col === 'rpct') return v.toFixed(1) + '%';
    if (col === 'ng') return v.toFixed(2) + '%';
    if (col === 'rate') return v.toFixed(2);
```

Replace it with (new line added that reuses the 1-decimal-percent rule):

```js
  function fmtVal(col, v) {
    if (col === 'bpi' || col === 'rpct' || col === 'esh') return v.toFixed(1) + '%';
    if (col === 'ng') return v.toFixed(2) + '%';
    if (col === 'rate') return v.toFixed(2);
```

- [ ] **Step 3: Bump NCOLS from 16 to 17**

Find line 500:

```js
  var NCOLS = 16;
```

Replace with:

```js
  var NCOLS = 17;
```

- [ ] **Step 4: Commit**

```bash
git add charts/town_explorer.html
git commit -m "Wire esh column into COL_LABELS, fmtVal, and NCOLS

Plumbing for the new School share column. Format reuses the
one-decimal-percent rule that bpi and rpct already use.
NCOLS goes from 16 to 17 to match the new table column count
(used by mh-divider and no-results colspan).
"
```

---

### Task 3: Add the sort button

**Files:**
- Modify: `charts/town_explorer.html` (sort bar, around line 380)

- [ ] **Step 1: Insert the new sort button between "Tax per person" and "New construction"**

Find this block in the sort bar:

```html
  <button type="button" class="sort-btn" data-sort="lpc">Tax per person</button>
  <button type="button" class="sort-btn" data-sort="ng">New construction</button>
```

Replace with:

```html
  <button type="button" class="sort-btn" data-sort="lpc">Tax per person</button>
  <button type="button" class="sort-btn" data-sort="esh">School share</button>
  <button type="button" class="sort-btn" data-sort="ng">New construction</button>
```

- [ ] **Step 2: Verify in browser (no commit yet — bundling with table column)**

Start the dev server in a background process:

```bash
cd /home/claude/marblehead/.claude/worktrees/bridge-cse_01AwY5EENyT6xPyEM7BujHn2
npm run dev > /tmp/jekyll.log 2>&1 &
sleep 8
curl -s http://localhost:4000/charts/town_explorer.html | grep -c 'data-sort="esh"'
```

Expected output: `1`

(The sort button is now in the page. The table column is the next task.)

---

### Task 4: Add the table column header, the renderRow cell, and the COL_EXPLAINERS entry

**Files:**
- Modify: `charts/town_explorer.html` (table header ~line 415, renderRow ~line 720, COL_EXPLAINERS ~line 451)

- [ ] **Step 1: Add the `<th>` to the table header**

Find this block in the table `<thead>`:

```html
        <th data-col="lpc" title="Total property tax collected divided by population">Tax per person <span class="sa"></span></th>
        <th data-col="ng" title="Revenue from new construction as % of total levy: how much the tax base grows without a vote">New construction <span class="sa"></span></th>
```

Replace with:

```html
        <th data-col="lpc" title="Total property tax collected divided by population">Tax per person <span class="sa"></span></th>
        <th data-col="esh" title="Education spending as a share of general-fund spending (DOR Schedule A)">School share <span class="sa"></span></th>
        <th data-col="ng" title="Revenue from new construction as % of total levy: how much the tax base grows without a vote">New construction <span class="sa"></span></th>
```

- [ ] **Step 2: Add the cell in `renderRow()`**

Find this block in `renderRow()` (around line 720):

```js
      '<td>' + f$(t.lpc) + '</td>' +
      '<td>' + fP2(t.ng) + '</td>' +
```

Replace with:

```js
      '<td>' + f$(t.lpc) + '</td>' +
      '<td>' + fP(t.esh) + '</td>' +
      '<td>' + fP2(t.ng) + '</td>' +
```

(Note: `fP` = one-decimal-percent, matches the `fmtVal` entry from Task 2.)

- [ ] **Step 3: Add the explainer entry in `COL_EXPLAINERS`**

Find this block (around line 451):

```js
    lpc: 'Total property tax collected divided by population. Shows the overall tax burden regardless of how it splits between residential and commercial.',
    ng: 'Revenue from new construction as a share of total levy. This is how the tax base grows without an override vote. Marblehead\'s 0.38% is among the lowest in the state. <a href="/why-not-elsewhere.html#new-growth">New growth explained</a>.',
```

Replace with:

```js
    lpc: 'Total property tax collected divided by population. Shows the overall tax burden regardless of how it splits between residential and commercial.',
    esh: 'Education spending as a share of total general-fund spending. Source: DOR Schedule A, most recent year filed.',
    ng: 'Revenue from new construction as a share of total levy. This is how the tax base grows without an override vote. Marblehead\'s 0.38% is among the lowest in the state. <a href="/why-not-elsewhere.html#new-growth">New growth explained</a>.',
```

- [ ] **Step 4: Verify the page loads and the column renders**

If the dev server is still running from Task 3, just refresh; otherwise:

```bash
cd /home/claude/marblehead/.claude/worktrees/bridge-cse_01AwY5EENyT6xPyEM7BujHn2
# kill any old dev server
pkill -f "jekyll serve" 2>/dev/null; true
npm run dev > /tmp/jekyll.log 2>&1 &
sleep 8

# verify the column header shows up
curl -s http://localhost:4000/charts/town_explorer.html | grep -c 'data-col="esh"'
```

Expected output: `1`

```bash
# verify Marblehead's row contains the value
curl -s http://localhost:4000/charts/town_explorer.html | grep -c '"esh":45.8'
```

Expected output: `1`

- [ ] **Step 5: Capture a Playwright screenshot showing the new column sorted**

Capture two screenshots — default page load, and after clicking the new sort button:

```bash
cd /home/claude/marblehead/.claude/worktrees/bridge-cse_01AwY5EENyT6xPyEM7BujHn2
mkdir -p proof

cat > /tmp/screenshot.mjs <<'JSEOF'
import { chromium } from 'playwright';
const url = 'http://localhost:4000/charts/town_explorer.html';
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.click('button.sort-btn[data-sort="esh"]');
await page.waitForTimeout(300);
await page.screenshot({ path: 'proof/' + process.argv[2] });
await browser.close();
JSEOF

BRANCH=$(git branch --show-current)
node /tmp/screenshot.mjs "${BRANCH}.png"
ls -la proof/${BRANCH}.png
file proof/${BRANCH}.png
```

Expected: PNG written, file size > 100KB, dimensions reported as roughly 2880×1800.

- [ ] **Step 6: Run the smoke test to confirm nothing else broke**

```bash
cd /home/claude/marblehead/.claude/worktrees/bridge-cse_01AwY5EENyT6xPyEM7BujHn2
SITE=http://localhost:4000 node tests/smoke-test.mjs
```

Expected: 52 pass / 0 fail (or whatever the existing baseline is — see CLAUDE.md). The smoke test does not cover the explorer page directly, but it should still pass cleanly. If it fails, the failure is unrelated to this change OR something in `town_explorer.html` is now syntactically broken — investigate before continuing.

- [ ] **Step 7: Stop the dev server**

```bash
pkill -f "jekyll serve" 2>/dev/null; true
```

- [ ] **Step 8: Commit**

```bash
git add charts/town_explorer.html proof/*.png
git commit -m "Add School share sort + table column to Town Explorer

New primary sort button between 'Tax per person' and 'New
construction'; matching table column; one-line explainer noting
the DOR Schedule A 'Education' line excludes benefits and OPEB
(same caveat across all 351 towns, so the comparison is fair).

Marblehead lands at 45.8%. Range across the 351 towns runs from
0% (towns that contract schools to a regional district and have
no own Education line) up to 78%.

Proof: proof/<branch>.png shows the column sorted ascending.
"
```

---

### Task 5: Push and open PR

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
cd /home/claude/marblehead/.claude/worktrees/bridge-cse_01AwY5EENyT6xPyEM7BujHn2
BRANCH=$(git branch --show-current)
# Use the PAT URL form on first push (memory: feedback_pat_first_push)
GITHUB_TOKEN=$(grep '^GITHUB_TOKEN=' /home/claude/marblehead/.env | cut -d= -f2)
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/agbaber/marblehead.git" "${BRANCH}:${BRANCH}"
```

- [ ] **Step 2: Open the PR**

```bash
cd /home/claude/marblehead
gh pr create \
  --title "Town Explorer: add School share column" \
  --body "$(cat <<'EOF'
## Summary

Adds a primary sort button + matching table column to `/charts/town_explorer.html` showing each town's school spending as a share of total general-fund spending. Marblehead lands at 45.8%.

## What changed

- New `esh` field merged into the inline 351-row `DATA` array, sourced from `education_pct_of_gf` in `data/dor_all_351_FY26.csv` (DOR Schedule A).
- New `School share` button in the sort bar between "Tax per person" and "New construction", matching column in the table.
- One-line explainer states the metric and source (DOR Schedule A); no editorial caveat.
- Default sort ascending (bars climb left-to-right).
- One-shot Python script `scripts/add_school_share_to_explorer.py` that performed the augmentation; committed for future column additions.

## Preview URL

Cloudflare Pages preview will appear in the sticky preview comment once the workflow finishes.

## Test plan

- [ ] Open the preview URL → `/charts/town_explorer.html`
- [ ] Click "School share" in the sort bar → bars climb left-to-right, low-school towns first
- [ ] Marblehead row shows 45.8%
- [ ] Hover a bar → tooltip shows "school share: X.X%"
- [ ] Click the column header → toggles sort direction
- [ ] Click again to confirm reverse sort works
- [ ] Confirm explainer text appears below the sort bar when "School share" is active

## Proof of work

See `proof/<branch>.png` committed to this PR — Playwright screenshot of the page sorted by the new column.
EOF
)"
```

- [ ] **Step 3: Report the PR URL**

After `gh pr create` returns, the URL is the last line of stdout. Echo it back to the user along with a one-line summary of what merged.

---

## Self-Review Checklist

Before claiming this plan is done:

- [x] Spec coverage: every spec section has a task (data merge → Task 1, sort button → Task 3, table column → Task 4, formatter → Task 2, explainer → Task 4 step 3, NCOLS bump → Task 2, verification → Task 4 steps 4–6)
- [x] No placeholders ("TBD", "implement later", etc.)
- [x] Type/key consistency: `esh` used consistently across COL_LABELS, fmtVal, sort button, table header, renderRow, COL_EXPLAINERS
- [x] Bumping NCOLS is in the plan (it's used by `mh-divider` colspan and `no-results` colspan; missing it would cause visual regression)
- [x] PR memory rules: PAT URL on first push (memory `feedback_pat_first_push`), open PR after push (CLAUDE.md), preview URL referenced in PR body, proof of work committed
