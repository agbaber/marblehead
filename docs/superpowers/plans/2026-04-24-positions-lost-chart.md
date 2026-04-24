# Positions-lost chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone chart at `charts/positions-lost.html` visualizing town-side FTE losses FY18-FY27 (~199 to ~190), with one circle per position (filled = still funded, outlined = eliminated), grouped into rows by department. Link it from `what-has-the-town-done.html`.

**Architecture:** Jekyll-served static HTML page. Hand-authored inline SVG with `viewBox` for responsive scaling. Small page-scoped `<style>` block for the chart's dot/row classes. No JavaScript, no chart library, no data files. Follows the pattern of `charts/per_capita_levy.html`.

**Tech Stack:** Jekyll 3.x, raw HTML5, inline SVG, CSS variables from `assets/site.css`. No build step beyond Jekyll.

**Important constraints (from CLAUDE.md memory):**
- No local Jekyll dev server. Visual verification happens on the Cloudflare Pages preview after each push. Plan groups visual tasks to minimize push cycles.
- Always commit via worktree, never in main working directory. Git identity pinned per-repo.
- Site copy rules (STYLE_GUIDE): no em-dashes, no inline `style=""` on SVG, no green/red value judgments, every number traceable.
- Always open a PR after pushing.

**Spec:** `docs/superpowers/specs/2026-04-24-positions-lost-chart-design.md`

---

## Task 0: Create implementation worktree

**Files:**
- Create: `.worktrees/positions-lost-chart/` (isolated branch)

- [ ] **Step 1: Fetch latest main and create worktree**

```bash
cd /Users/agbaber/marblehead
git fetch origin main --quiet
git worktree add .worktrees/positions-lost-chart -b claude/positions-lost-chart origin/main
cd .worktrees/positions-lost-chart
```

Expected: "Preparing worktree (new branch 'claude/positions-lost-chart')" followed by HEAD SHA.

- [ ] **Step 2: Confirm clean starting state**

```bash
git status --short
```

Expected: empty output. If anything shows, investigate before proceeding.

- [ ] **Step 3: Verify spec file is present (merged from spec PR, or still on its branch)**

```bash
ls docs/superpowers/specs/2026-04-24-positions-lost-chart-design.md 2>&1
```

If file is missing (spec PR #653 not yet merged), proceed anyway. The plan document in this worktree has the full design. If the spec file will be merged later, no action needed.

---

## Phase 1: Data verification (blocking)

Goal: resolve the "to verify during implementation" items from the spec before writing chart content. The Community Development FY18 baseline question is an acceptance-criteria blocker.

### Task 1: Resolve Community Development FY18 baseline

The spec flags this as the highest-risk accuracy question. If Community Development didn't exist as a 4-person department in FY18, the "Community Development 4 → 1" row is misleading and must be reframed or removed.

**Files:**
- Read: `data/savings_measures_compiled.md`
- Read: FinCom Annual Reports in `data/` directory (PDFs), if available
- Update (if needed): `docs/superpowers/specs/2026-04-24-positions-lost-chart-design.md`

- [ ] **Step 1: Re-read the relevant section of savings_measures_compiled.md**

```bash
grep -A 8 "Community Development" data/savings_measures_compiled.md
```

Expected: the spec says the department was "created FY26" with a FY26 budget of $494,402. If the department was created in FY26, the FY18 starting count of "4" is not a per-department-line historical fact: it refers to staff that existed in some other organizational form (e.g., a Planning Office under the Select Board in FY18, plus a part-time conservation agent, etc.).

- [ ] **Step 2: Check FinCom reports for pre-FY26 planning/community-development staffing**

```bash
ls data/*FinCom*.pdf data/*fincom*.pdf 2>/dev/null | head
# If PDFs are present, search for "Planning" line-items in FY17-FY19 budgets
# (pdftotext is a common tool if needed)
```

If FinCom Annual Reports PDFs exist in `data/`, extract the Planning Board and related lines for FY18. Look specifically for staffed positions (Planning Director, planner, conservation agent) versus unpaid board members.

- [ ] **Step 3: Decide the row outcome**

Three possible outcomes:

| Finding | Action |
|---|---|
| FY18 had 4+ FTEs doing planning/CD work under any department | Keep row as "Community Development 4 → 1" with a footnote noting the reorg; cite the FY18 FinCom Report for the position count. |
| FY18 had fewer FTEs (e.g., 2) and the growth to 4 was internal hiring before the FY26 reorg | Adjust row to FY18 actual count. |
| FY18 had essentially no dedicated CD/Planning staff and the 4-person department is a FY26-era creation | Remove the row. Add a note in the chart caption: "Community Development as a distinct department was created in FY26 and partially dismantled by FY27; because there is no comparable FY18 headcount, it is not shown here." |

- [ ] **Step 4: Update the spec if the row is reframed or removed**

If any change to the Community Development row content, update `docs/superpowers/specs/2026-04-24-positions-lost-chart-design.md` in the same task. The implementation should not proceed with spec and actual chart diverging.

- [ ] **Step 5: Commit the verification outcome**

If the spec changed:

```bash
git add docs/superpowers/specs/2026-04-24-positions-lost-chart-design.md
git commit -m "Spec: resolve Community Development FY18 baseline question"
```

If the spec did not change (row stands), add a note to this plan file and commit:

```bash
# Edit the plan file adding a "Verification outcome" paragraph under this task
git add docs/superpowers/plans/2026-04-24-positions-lost-chart.md
git commit -m "Plan: confirm Community Development FY18 baseline stands"
```

### Task 2: Attempt to resolve DPW FY18 headcount

**Files:**
- Read: FinCom Annual Reports in `data/` (if present)
- Update (if found): spec and this plan

- [ ] **Step 1: Search data directory for FY18 FinCom report and DPW line item**

```bash
ls data/*FinCom*.pdf data/*2018*.pdf 2>/dev/null
grep -rE "heavy equipment|working foreman|DPW|Public Works" data/savings_measures_compiled.md data/DATA_CATALOG.md 2>/dev/null | head
```

- [ ] **Step 2: If a FY18 headcount is locatable, update spec**

If FinCom FY18 report or similar primary source lists DPW FTE count (e.g., "30" or "31"), update the spec and this plan to use that number and cite the source. Otherwise keep "~31" with the quote attribution footnote.

- [ ] **Step 3: Commit if updated**

```bash
git add docs/superpowers/specs/2026-04-24-positions-lost-chart-design.md
git commit -m "Spec: update DPW FY18 headcount from <primary source>"
```

If no update, proceed to next task without commit.

### Task 3: Attempt to resolve Fire Department count

**Files:**
- Read: FinCom Annual Reports in `data/`
- Update (if found): spec

- [ ] **Step 1: Search for Fire Department authorized strength**

```bash
grep -riE "fire department.*FTE|firefighters? (authorized|position)" data/ | head -10
```

- [ ] **Step 2: If count found, convert Fire from callout to dot row; otherwise keep as callout**

If primary source gives FY18 Fire firefighter count and a FY27 count (or "several" quantified as an integer), update spec to add dots. Otherwise Fire stays as a prose callout with the 96-hour-shift detail.

- [ ] **Step 3: Commit if changed**

Same pattern as Task 2.

---

## Phase 2: Chart page scaffold

### Task 4: Create `charts/positions-lost.html` with frontmatter, lead, and legend

**Files:**
- Create: `charts/positions-lost.html`

- [ ] **Step 1: Create the file with frontmatter and introductory HTML**

```bash
touch charts/positions-lost.html
```

Write this content to `charts/positions-lost.html`:

```html
---
title: "Town positions lost, FY18 to FY27"
og_title: "Town positions lost, FY18 to FY27"
og_description: "A visualization of the nine town-side positions Marblehead has eliminated between FY18 and FY27 while holding the tax levy roughly flat. One circle per position, grouped by department."
og_url: https://marbleheaddata.org/charts/positions-lost.html
scripts: [citations]
---
<h1 class="h-center">What Marblehead lost to keep the levy flat</h1>
<p class="subtitle h-center">Town-side municipal positions, FY18 to FY27. Each circle is one job.</p>

<p>Between FY18 and FY27, Marblehead's town government shrank from approximately 199 positions to approximately 190, according to Town Administrator Thatcher Kezer at the March 2026 budget hearings. The nine-position net loss is not evenly spread. It concentrated in four departments: DPW, Community Development, Police, and the Engineering Department (eliminated entirely and absorbed into DPW).</p>

<p>The outlined circles below represent positions that were eliminated. Each row is one department; each circle is one full-time-equivalent (FTE) position.</p>

<div class="legend">
  <div class="legend-item"><span class="pl-legend-dot pl-legend-filled"></span><span class="legend-text">Position still funded</span></div>
  <div class="legend-item"><span class="pl-legend-dot pl-legend-empty"></span><span class="legend-text">Position eliminated</span></div>
</div>
```

- [ ] **Step 2: Grep-check for em-dashes and inline styles**

```bash
grep -n "—\|&mdash;\|style=\"" charts/positions-lost.html
```

Expected: empty output. If any match, fix before committing.

- [ ] **Step 3: Commit the scaffold**

```bash
git add charts/positions-lost.html
git commit -m "charts/positions-lost: page scaffold with frontmatter, lead, legend"
```

---

### Task 5: Add scoped CSS for the chart rows

**Files:**
- Modify: `charts/positions-lost.html` (add `<style>` block)

- [ ] **Step 1: Append a scoped style block to the chart file**

Append after the legend block (before the chart SVG, which doesn't exist yet):

```html
<style>
  /* Scoped styles for positions-lost chart */
  .pl-legend-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 6px;
  }
  .pl-legend-filled { background: var(--text); }
  .pl-legend-empty {
    background: transparent;
    border: 1.5px solid var(--text-subtle);
  }
  .pl-chart-wrapper {
    margin: 24px 0 16px;
  }
  .pl-row {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 16px;
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
    align-items: start;
  }
  .pl-row-total {
    border-top: 2px solid var(--border);
    border-bottom: none;
    padding-top: 20px;
    margin-top: 8px;
  }
  .pl-row-label {
    font-weight: 600;
  }
  .pl-row-delta {
    display: block;
    font-weight: 400;
    color: var(--text-subtle);
    font-size: 0.92em;
    margin-top: 2px;
  }
  .pl-row-content { min-width: 0; }
  .pl-dots {
    display: block;
    line-height: 0;
    margin-bottom: 8px;
  }
  .pl-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin: 2px 4px 2px 0;
    vertical-align: middle;
  }
  .pl-dot-filled { background: var(--text); }
  .pl-dot-empty {
    background: transparent;
    border: 1.2px solid var(--text-subtle);
  }
  .pl-total .pl-dot { width: 14px; height: 14px; }
  .pl-row-note {
    font-size: 0.95em;
    color: var(--text);
    margin: 0;
  }
  .pl-fire-row .pl-row-content {
    font-size: 0.95em;
    color: var(--text);
  }
  @media (max-width: 600px) {
    .pl-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .pl-dot { width: 10px; height: 10px; margin-right: 3px; }
    .pl-total .pl-dot { width: 12px; height: 12px; }
  }
</style>
```

- [ ] **Step 2: Confirm the CSS does not contain inline SVG style= or em-dashes**

```bash
grep -n "—\|&mdash;\|style=\"" charts/positions-lost.html
```

Expected: empty. The `<style>` tag itself is fine; the rule bans inline `style="..."` attributes on SVG elements.

- [ ] **Step 3: Commit**

```bash
git add charts/positions-lost.html
git commit -m "charts/positions-lost: scoped styles for dot rows"
```

---

## Phase 3: Build chart rows

Each department gets a `.pl-row` div. The HTML uses `<span class="pl-dot pl-dot-filled"></span>` and `<span class="pl-dot pl-dot-empty"></span>` repeated N times for the dot rows.

### Task 6: Add the chart wrapper and first row (Engineering)

Engineering is the simplest row (2 dots, both empty) so it's a good first implementation.

**Files:**
- Modify: `charts/positions-lost.html` (append after the `<style>` block)

- [ ] **Step 1: Append chart-wrapper div and Engineering row**

Append after the closing `</style>`:

```html
<div class="pl-chart-wrapper" role="img" aria-label="Chart of town-side positions lost between FY18 and FY27, by department. Each filled circle represents one position still funded; each outlined circle represents one position eliminated.">

  <div class="pl-row">
    <div class="pl-row-label">Engineering Department
      <span class="pl-row-delta">FY18 2 &rarr; FY27 0 (eliminated)</span>
    </div>
    <div class="pl-row-content">
      <div class="pl-dots">
        <span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span>
      </div>
      <p class="pl-row-note">Department eliminated in FY26; budget zeroed (-$210,559). Functions absorbed into <abbr class="g" title="Department of Public Works">DPW</abbr>.<sup class="cite" data-href="data/2026_FinCom_Report.pdf" data-source="2026 FinCom Report, Table of Estimated Appropriations (Engineer lines 105-106 zeroed for FY26)"></sup></p>
    </div>
  </div>

</div>
```

- [ ] **Step 2: Commit**

```bash
git add charts/positions-lost.html
git commit -m "charts/positions-lost: Engineering row (template for subsequent rows)"
```

---

### Task 7: Add DPW, Community Development, and Police rows

These three rows use the same pattern as Engineering. Dot counts:
- DPW: 19 filled + 12 empty = 31 total dots (FY18 ~31, FY27 19). Note: starting count is an approximation per spec.
- Community Development: 1 filled + 3 empty = 4 total. (If Task 1 resolved to remove/reframe this row, adapt accordingly.)
- Police (sworn): 30 filled + 2 empty = 32 total.

**Files:**
- Modify: `charts/positions-lost.html` (add three rows inside `.pl-chart-wrapper`, ordered by absolute loss descending after Engineering)

**Row order within the chart (by absolute FTEs lost, descending):** DPW (~12), Community Development (3), Police (2), Engineering (2).

So the final row order in HTML is: DPW, Community Development, Police, Engineering, Fire (callout, next task), All other, Town total.

Restructure accordingly: remove the Engineering row from its current position (inserted first in Task 6) and insert DPW-first.

- [ ] **Step 1: Restructure so DPW is first, Community Development second, Police third, Engineering fourth**

Inside the `.pl-chart-wrapper` div, replace the single Engineering row with these four rows in order. Complete HTML:

```html
  <div class="pl-row">
    <div class="pl-row-label">DPW
      <span class="pl-row-delta">FY18 ~31 &rarr; FY27 19</span>
    </div>
    <div class="pl-row-content">
      <div class="pl-dots">
        <span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span>
      </div>
      <p class="pl-row-note">Lost over multiple years: heavy equipment operator, working foreman, general laborer.<sup class="cite" data-href="https://www.marbleheadindependent.com/select-board-confronts-the-limits-of-marbleheads-tax-cap/" data-source="Marblehead Independent: Noonan on DPW staffing reduction from 30+ to 19"></sup></p>
    </div>
  </div>

  <div class="pl-row">
    <div class="pl-row-label">Community Development
      <span class="pl-row-delta">FY18 4 &rarr; FY27 1</span>
    </div>
    <div class="pl-row-content">
      <div class="pl-dots">
        <span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span>
      </div>
      <p class="pl-row-note">Director role eliminated in FY27 budget; reduced from a four-person office to one vacant planner plus a clerk.<sup class="cite" data-href="https://www.marbleheadindependent.com/cuts-across-departments-shape-select-boards-56-6m-budget/" data-source="Marblehead Independent: Community Development cuts in FY27 Select Board budget"></sup></p>
    </div>
  </div>

  <div class="pl-row">
    <div class="pl-row-label">Police (sworn)
      <span class="pl-row-delta">FY18 32 &rarr; FY27 30</span>
    </div>
    <div class="pl-row-content">
      <div class="pl-dots">
        <span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-filled"></span><span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span>
      </div>
      <p class="pl-row-note">School Resource Officer reassigned to patrol; one full-time officer defunded over five years of level-funding.<sup class="cite" data-href="https://www.marbleheadindependent.com/select-board-confronts-the-limits-of-marbleheads-tax-cap/" data-source="Marblehead Independent: Noonan on Police staffing reduction from 32 to 30"></sup></p>
    </div>
  </div>

  <div class="pl-row">
    <div class="pl-row-label">Engineering Department
      <span class="pl-row-delta">FY18 2 &rarr; FY27 0 (eliminated)</span>
    </div>
    <div class="pl-row-content">
      <div class="pl-dots">
        <span class="pl-dot pl-dot-empty"></span><span class="pl-dot pl-dot-empty"></span>
      </div>
      <p class="pl-row-note">Department eliminated in FY26; budget zeroed (-$210,559). Functions absorbed into <abbr class="g" title="Department of Public Works">DPW</abbr>.<sup class="cite" data-href="data/2026_FinCom_Report.pdf" data-source="2026 FinCom Report, Table of Estimated Appropriations (Engineer lines 105-106 zeroed for FY26)"></sup></p>
    </div>
  </div>
```

- [ ] **Step 2: Verify the dot counts**

```bash
awk '/pl-row-label">DPW/,/<\/div>\s*<\/div>/' charts/positions-lost.html | grep -c "pl-dot-filled"
# Expected: 19
awk '/pl-row-label">DPW/,/<\/div>\s*<\/div>/' charts/positions-lost.html | grep -c "pl-dot-empty"
# Expected: 12
```

Repeat for Police (30 filled, 2 empty), Community Development (1 filled, 3 empty), Engineering (0 filled, 2 empty). If any count is off, fix the HTML.

- [ ] **Step 3: STYLE_GUIDE scan**

```bash
grep -n "—\|&mdash;\|style=\"" charts/positions-lost.html
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add charts/positions-lost.html
git commit -m "charts/positions-lost: DPW, Community Development, Police, Engineering rows"
```

---

### Task 8: Add Fire callout row (no dots)

**Files:**
- Modify: `charts/positions-lost.html` (append after Engineering row, before "all other" row)

- [ ] **Step 1: Append Fire callout row**

```html
  <div class="pl-row pl-fire-row">
    <div class="pl-row-label">Fire
      <span class="pl-row-delta">Several positions defunded</span>
    </div>
    <div class="pl-row-content">
      <p class="pl-row-note">Several firefighter positions defunded through level-funding; one vacancy was unfilled for over a year, forcing 96-hour shifts. Exact count not quantified in primary sources.<sup class="cite" data-href="https://www.marbleheadindependent.com/cuts-across-departments-shape-select-boards-56-6m-budget/" data-source="Marblehead Independent: Fire staffing testimony at March 2026 budget hearing"></sup></p>
    </div>
  </div>
```

- [ ] **Step 2: Commit**

```bash
git add charts/positions-lost.html
git commit -m "charts/positions-lost: Fire callout row"
```

---

### Task 9: Add "All other" and "Town total" rows

All-other is a derived residual. Town total anchors the chart. Both use the same dot pattern but at larger volumes. For readability on mobile, use per-row dot size overrides or accept that these rows will wrap to multiple visual lines.

For the "All other" row, dots (~130 filled, 0 empty approximately) would be overwhelming. Use a compressed representation: one row of dots sized smaller, or a textual "~130 filled, ~0 eliminated" summary. Use the compressed dot approach for consistency: 130 small dots in a wrap is visually OK on desktop and acceptable on mobile.

**Files:**
- Modify: `charts/positions-lost.html` (append after Fire row)

- [ ] **Step 1: Append "All other" row**

Since 130 dots would be tedious to hand-author, and the row communicates "many filled, no change" rather than specific counts, use a simplified representation:

```html
  <div class="pl-row">
    <div class="pl-row-label">All other departments (est.)
      <span class="pl-row-delta">FY18 ~130 &rarr; FY27 ~130</span>
    </div>
    <div class="pl-row-content">
      <div class="pl-dots" aria-hidden="true">
        <!-- 130 filled dots, no eliminations. Rendered as a block for visual weight. -->
        <!-- If you need a literal count, render 130 dots; otherwise a compact bar conveys "no change". -->
      </div>
      <p class="pl-row-note">All other municipal departments combined; net change approximately zero. Derived as the residual of 199 minus the named-department starting counts above. Not an audited per-department figure.</p>
    </div>
  </div>
```

Note on implementation: the comment `<!-- 130 filled dots -->` is a placeholder. The engineer has two options:

**Option A (literal):** Generate 130 `<span class="pl-dot pl-dot-filled"></span>` elements. Bash one-liner:

```bash
# Preview the string first, then paste it into the HTML between the pl-dots div tags.
printf '<span class="pl-dot pl-dot-filled"></span>%.0s' {1..130}
echo
```

**Option B (abstraction):** Replace the `.pl-dots` block with a visual summary like a solid horizontal bar, to avoid overwhelming the chart. Example:

```html
<div class="pl-dots-summary" style="height: 12px; background: var(--text); width: 100%; opacity: 0.8;" aria-hidden="true"></div>
```

**Decision:** Use Option A (literal 130 dots) for visual consistency with the other rows. The "1 dot = 1 position" invariant is preserved. If the rendered result looks overwhelming on the preview (Task 13), revisit and switch to Option B, but only if a reviewer agrees.

Important: Option B uses `style="..."` which the STYLE_GUIDE bans. If Option B is chosen, move the styling into the scoped CSS block added in Task 5.

- [ ] **Step 2: Generate and insert the 130 filled dots**

```bash
printf '<span class="pl-dot pl-dot-filled"></span>%.0s' {1..130} > /tmp/all_other_dots.txt
# Then copy the contents of /tmp/all_other_dots.txt into the HTML at the placeholder location.
# Or use sed:
sed -i '' '/<!-- 130 filled dots/r /tmp/all_other_dots.txt' charts/positions-lost.html
sed -i '' '/<!-- 130 filled dots/d' charts/positions-lost.html
sed -i '' '/<!-- If you need/d' charts/positions-lost.html
```

After running, visually verify the file: open `charts/positions-lost.html` and check that the "All other" row has the 130 filled dots inline (no visible comment placeholders remaining).

- [ ] **Step 3: Append Town total row**

Append after the "All other" row, at the end of the `.pl-chart-wrapper` div:

```html
  <div class="pl-row pl-row-total pl-total">
    <div class="pl-row-label">Town total
      <span class="pl-row-delta">FY18 ~199 &rarr; FY27 ~190</span>
    </div>
    <div class="pl-row-content">
      <div class="pl-dots" aria-hidden="true">
        <!-- 190 filled + 9 empty dots -->
      </div>
      <p class="pl-row-note">Nine positions eliminated on the town side over nine years. Town population served (about 20,000) has not declined materially over the same period.<sup class="cite" data-href="https://www.marbleheadindependent.com/marblehead-advances-122-8m-budget-built-on-cuts-defers-override-decisions/" data-source="Marblehead Independent, March 2026: Kezer on town workforce count 199 to approximately 190"></sup></p>
    </div>
  </div>

</div>
```

Generate the 190 filled + 9 empty dots:

```bash
{
  printf '<span class="pl-dot pl-dot-filled"></span>%.0s' {1..190}
  printf '<span class="pl-dot pl-dot-empty"></span>%.0s' {1..9}
} > /tmp/total_dots.txt
sed -i '' '/<!-- 190 filled + 9 empty/r /tmp/total_dots.txt' charts/positions-lost.html
sed -i '' '/<!-- 190 filled + 9 empty/d' charts/positions-lost.html
```

- [ ] **Step 4: Verify total dot counts**

```bash
grep -o "pl-dot-filled" charts/positions-lost.html | wc -l
# Expected: 19 (DPW) + 1 (CD) + 30 (Police) + 0 (Engr) + 130 (All other) + 190 (Total) = 370
grep -o "pl-dot-empty" charts/positions-lost.html | wc -l
# Expected: 12 (DPW) + 3 (CD) + 2 (Police) + 2 (Engr) + 0 (All other) + 9 (Total) = 28
```

If either total is off, hunt down the discrepancy. Off-by-one errors in the big rows are likely.

- [ ] **Step 5: STYLE_GUIDE scan**

```bash
grep -n "—\|&mdash;" charts/positions-lost.html
# Expected: empty
grep -n 'style="' charts/positions-lost.html
# Expected: empty (no inline styles on any element)
```

- [ ] **Step 6: Commit**

```bash
git add charts/positions-lost.html
git commit -m "charts/positions-lost: all-other and town-total rows"
```

---

## Phase 4: Caption, school pointer, sources, cross-links

### Task 10: Caption, school-side pointer, and sources block

**Files:**
- Modify: `charts/positions-lost.html` (append after closing `</div>` of `.pl-chart-wrapper`)

- [ ] **Step 1: Append the caption, school pointer, sources, and read-next**

```html
<p class="caption">Every outlined circle represents one full-time-equivalent position that was eliminated, left unfilled long enough to be defunded, or absorbed into another department. "Lost" does not mean layoffs; most reductions came through attrition. Town total rows are approximations; Kezer cited "about 190" in public testimony rather than an audited figure.</p>

<div class="notes">
  <p><strong>About the school side.</strong> The school workforce also declined over the same period. DESE data shows Marblehead teacher FTE fell from 261.0 in FY18 to 224.8 in FY26, a drop of 36 teachers. But K-12 enrollment also fell by a comparable percentage (from 3,096 in FY18 to roughly 2,500 in FY26). Students-per-teacher was essentially unchanged. This chart does not show the school side because the staffing story there is different in kind: positions declined roughly in proportion to enrollment, rather than while the population served stayed constant. For the school staffing and enrollment picture, see <a href="enrollment_vs_staffing.html">School enrollment vs. staffing over time</a>.</p>
  <p><strong>On the DPW starting count.</strong> The FY18 DPW headcount is quoted as "30+ workers" by Select Board member Erin Noonan in late-2025 testimony. The chart uses ~31 as a plausible round figure but the exact FY18 audited headcount was not located in the primary sources available at publication. If a precise figure surfaces, the row will be updated.</p>
  <p><strong>On "all other departments."</strong> The ~130 starting figure is derived as the residual: 199 total minus the named-department starting counts. It is not an audited per-department figure.</p>
  <p><strong>On Community Development.</strong> Community Development as a distinct, separately budgeted department was created in FY26. The "4 &rarr; 1" figures refer to the staff count within that department at its creation (FY26) versus after the FY27 cuts. Some of those four staff previously worked in other units (Planning Board support, conservation, etc.). The chart shows a net reduction in dedicated planning/community-development FTE over the FY18-FY27 window.</p>
</div>

<p class="source"><strong>Sources.</strong> Town total ("199 to approximately 190") from Town Administrator Thatcher Kezer, March 2026 budget hearings, as reported by <a href="https://www.marbleheadindependent.com/marblehead-advances-122-8m-budget-built-on-cuts-defers-override-decisions/">Marblehead Independent</a>. DPW and Police reductions from Select Board member Erin Noonan, late 2025, as reported by <a href="https://www.marbleheadindependent.com/select-board-confronts-the-limits-of-marbleheads-tax-cap/">Marblehead Independent</a>. Engineering Department elimination from the <a href="data/2026_FinCom_Report.pdf">2026 FinCom Annual Report</a>, Table of Estimated Appropriations. Community Development and Fire testimony from <a href="https://www.marbleheadindependent.com/cuts-across-departments-shape-select-boards-56-6m-budget/">Marblehead Independent</a>, March 2026. Compiled in <a href="data/savings_measures_compiled.md">savings_measures_compiled.md</a>.</p>

<div class="read-next">
  <div class="read-next-label">Read next</div>
  <a class="read-next-link" href="../what-has-the-town-done.html">
    <div class="read-next-title">What has the town already done to save? &rarr;</div>
    <div class="read-next-desc">The full record of cost-control measures Marblehead has taken before asking voters for an override, including free-cash discipline, departmental consolidation, and contract renegotiations.</div>
  </a>
  <a class="read-next-link" href="enrollment_vs_staffing.html">
    <div class="read-next-title">School enrollment vs. staffing &rarr;</div>
    <div class="read-next-desc">How Marblehead school enrollment and teacher FTE moved together over the same period.</div>
  </a>
</div>
```

- [ ] **Step 2: STYLE_GUIDE scan**

```bash
grep -n "—\|&mdash;\|style=\"" charts/positions-lost.html
# Expected: empty
grep -inE "shocking|outrage|crisis|skyrocket|good for|bad for|win|lose" charts/positions-lost.html
# Expected: the word "lose" may appear in "Why they chose to lose..." if accidentally used; it should not. Similarly for "lost", those are fine. The target is editorial words.
```

- [ ] **Step 3: Commit**

```bash
git add charts/positions-lost.html
git commit -m "charts/positions-lost: caption, school-side pointer, sources, read-next"
```

---

### Task 11: Add btn-link from `what-has-the-town-done.html`

**Files:**
- Modify: `what-has-the-town-done.html` (add a `btn-link` anchor near line 66, next to the existing `enrollment_vs_staffing` link)

- [ ] **Step 1: Locate the existing enrollment_vs_staffing btn-link**

```bash
grep -n "btn-link.*enrollment_vs_staffing" what-has-the-town-done.html
```

Expected: `66:  <a class="btn-link" href="charts/enrollment_vs_staffing.html">School enrollment vs. staffing over time</a>`

- [ ] **Step 2: Add the new btn-link directly above it**

Use the Edit tool to replace line 66's context:

```
Before:
  <a class="btn-link" href="charts/enrollment_vs_staffing.html">School enrollment vs. staffing over time</a>

After:
  <a class="btn-link" href="charts/positions-lost.html">Town workforce, FY18 to FY27: 199 to ~190 positions</a>
  <a class="btn-link" href="charts/enrollment_vs_staffing.html">School enrollment vs. staffing over time</a>
```

- [ ] **Step 3: Verify no em-dash was introduced**

```bash
grep -n "—\|&mdash;" what-has-the-town-done.html
# Expected: empty (the page was clean before; don't regress)
```

- [ ] **Step 4: Commit**

```bash
git add what-has-the-town-done.html
git commit -m "what-has-the-town-done: link to positions-lost chart in staffing section"
```

---

## Phase 5: Preview, QA, and PR

### Task 12: Push and review on Cloudflare preview

**Files:** none.

- [ ] **Step 1: Push the branch**

```bash
# From the worktree:
source /Users/agbaber/marblehead/.env
git push -u "https://${GITHUB_TOKEN}@github.com/agbaber/marblehead.git" claude/positions-lost-chart
# Then reset upstream to plain origin (avoids embedded PAT in config):
git fetch origin claude/positions-lost-chart --quiet
git branch --set-upstream-to=origin/claude/positions-lost-chart
```

Expected: "new branch created" message and origin tracking configured without embedded PAT.

- [ ] **Step 2: Open the PR**

```bash
source /Users/agbaber/marblehead/.env
GH_TOKEN="$GITHUB_TOKEN" gh pr create --title "charts/positions-lost: FY18-FY27 town positions visualization" --body "$(cat <<'PRBODY'
## Summary
- New standalone chart at \`charts/positions-lost.html\` visualizing the ~9 town-side positions lost between FY18 and FY27 (199 to ~190).
- One circle per position, grouped by department; filled = still funded, outlined = eliminated.
- Linked from \`what-has-the-town-done.html\` in the #staffing section.

## Test plan
- [ ] Visual review on Cloudflare preview URL (see sticky preview comment)
- [ ] Mobile check at 375px width, no horizontal scroll
- [ ] Dot counts match the claimed FY18-FY27 numbers
- [ ] STYLE_GUIDE compliance (no em-dashes, no inline style=, no green/red, numbers traceable)

Spec: \`docs/superpowers/specs/2026-04-24-positions-lost-chart-design.md\`
Implementation plan: \`docs/superpowers/plans/2026-04-24-positions-lost-chart.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

Expected: PR URL on stdout.

- [ ] **Step 3: Wait for preview comment, then fetch the Branch URL**

```bash
PR_NUMBER=<the number from Step 2>
# Poll for the preview comment:
source /Users/agbaber/marblehead/.env
GH_TOKEN="$GITHUB_TOKEN" gh api repos/agbaber/marblehead/issues/${PR_NUMBER}/comments --jq '.[] | select(.body | startswith("### Preview")) | .body' | head -20
```

Extract the `**Branch URL:**` value from the comment. If no preview comment yet, wait (the workflow takes ~2-4 minutes) and retry.

- [ ] **Step 4: Open the preview in a browser and verify**

Open `<BRANCH_URL>/charts/positions-lost.html` in a browser. Verify:

1. The chart renders: all six department rows plus the total row visible.
2. Dot counts look right at a glance: DPW has a long row of filled with a dozen outlined at the end; Police has an even longer row of filled with two outlined; Engineering has two outlined only.
3. Legend shows at the top.
4. Caption and notes appear below the chart.
5. School-side pointer is present and the link goes to `enrollment_vs_staffing.html`.
6. No rendering glitches (broken layouts, misaligned rows, overflowing text).

Open the browser's device emulation at 375px width. Verify:

1. Rows stack vertically (label on top, dots below, sentence below).
2. No horizontal scroll.
3. Dots don't overlap or clip.

Also open `<BRANCH_URL>/what-has-the-town-done.html` and click the "Town workforce" btn-link. It should land on the new chart page.

- [ ] **Step 5: If issues are found, iterate and push fixes**

For each issue:

1. Edit the file in the worktree.
2. Commit with a message describing the fix.
3. Push.
4. Wait for new preview; re-verify.

If the "All other" row with 130 dots looks visually overwhelming and distracts from the claim, consider switching to Option B from Task 9 (a compact solid bar representation). Move the styling into the scoped CSS block in Task 5 to avoid inline `style=`.

- [ ] **Step 6: Request Andrew's review**

Once all verifications pass, post the Branch URL in the conversation with:

"Ready for your eyes: <BRANCH_URL>/charts/positions-lost.html. Also check the link from <BRANCH_URL>/what-has-the-town-done.html. If the chart holds up, we can merge."

---

### Task 13: Merge after approval

**Files:** none.

- [ ] **Step 1: Wait for Andrew's explicit approval**

Don't merge autonomously. Wait for the user to say "merge it" or similar.

- [ ] **Step 2: Manual merge (not auto-merge)**

Per CLAUDE.md: default to manual merge unless explicitly asked for fire-and-forget.

From the **parent** worktree (not inside `.worktrees/`), per memory `feedback_gh_pr_merge_from_worktree.md`:

```bash
cd /Users/agbaber/marblehead
source .env
GH_TOKEN="$GITHUB_TOKEN" gh pr merge <PR_NUMBER> --squash --delete-branch
```

Verify `mergeStateStatus == CLEAN` first if using `--delete-branch`:

```bash
GH_TOKEN="$GITHUB_TOKEN" gh pr view <PR_NUMBER> --json mergeStateStatus
# Expected: "mergeStateStatus": "CLEAN"
```

- [ ] **Step 3: Clean up the worktree**

```bash
cd /Users/agbaber/marblehead
git worktree remove .worktrees/positions-lost-chart
git fetch origin main --quiet
```

- [ ] **Step 4: Confirm merge landed**

```bash
git log origin/main --oneline -5 | grep positions-lost
```

Expected: the squash commit appears on main.

---

## Self-review checklist (run before declaring plan done)

**1. Spec coverage:**
- [ ] Task 4-5: chart page scaffold and CSS. (Spec: Visual design)
- [ ] Task 6-9: all six rows (DPW, Community Dev, Police, Engineering, Fire, All other, Town total). (Spec: Data, Chart structure)
- [ ] Task 10: caption, school-side pointer, sources, disclosures for each honesty call (DPW approximation, all-other derivation, CD reorg note). (Spec: Honesty calls)
- [ ] Task 11: btn-link from parent page. (Spec: Integration)
- [ ] Task 12: mobile check, STYLE_GUIDE check. (Spec: Responsive behavior, Color and style constraints)
- [ ] Tasks 1-3: verification of all four "to verify during implementation" items from the spec.
- [ ] Acceptance criteria #7 (Community Development FY18 baseline) is addressed by Task 1 being a blocker.

**2. Placeholder scan:**
- All HTML snippets contain full content (no "...", no "TODO", no "add appropriate handling").
- Task 9 mentions "Option A vs Option B" for the 130-dot row; the plan explicitly commits to Option A with a fallback path, not a handwave.
- Acceptance criteria are concrete ("empty grep output", "19 filled dots for DPW").

**3. Type / naming consistency:**
- CSS class names: `pl-row`, `pl-row-label`, `pl-row-delta`, `pl-row-content`, `pl-row-note`, `pl-dots`, `pl-dot`, `pl-dot-filled`, `pl-dot-empty`, `pl-fire-row`, `pl-row-total`, `pl-total`, `pl-legend-dot`, `pl-legend-filled`, `pl-legend-empty`, `pl-chart-wrapper`. All defined in Task 5; all used consistently in Tasks 6-10.
- File paths: `charts/positions-lost.html` consistent throughout.
- Branch name: `claude/positions-lost-chart` consistent throughout.

**4. Known soft spots:**
- Task 1 may discover that Community Development's FY18 baseline is unverifiable. The plan handles this by updating the spec and this plan in-task rather than proceeding with a shaky row.
- Task 9's 130-dot decision is load-bearing for the chart's visual balance. If the rendered preview looks bad, Task 12 Step 5 explicitly allows iteration.

---

**Execution handoff:** This plan is saved at `docs/superpowers/plans/2026-04-24-positions-lost-chart.md`. Two execution options:

1. **Subagent-Driven (recommended):** Dispatch a fresh subagent per task, review between tasks. Fast iteration, clean context per step.
2. **Inline Execution:** Execute tasks in the current session using executing-plans. Batch execution with checkpoints.

Which approach?
