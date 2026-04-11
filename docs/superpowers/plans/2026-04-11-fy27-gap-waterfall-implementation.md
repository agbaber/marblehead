# FY27 Gap Waterfall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the FY27 gap waterfall section on `no-override-budget.html` plus a matching closing takeaway on `how-we-got-here.html`, reconciling the $8.47M FY27 operating gap to its ten component bars with full primary-source citation.

**Architecture:** One static SVG chart inserted into an existing Jekyll-rendered HTML page, plus a plain-text takeaway on a second page. All new CSS lives in `assets/site.css` following the existing component-style convention. Bar widths are hard-coded SVG rect attributes (no inline `style=""`) because the chart is a one-shot illustration with values known at authoring time. No JavaScript, no build-time data pipeline, no new templates.

**Tech Stack:** Jekyll (static build), plain HTML + SVG, CSS custom properties from the existing palette. No new dependencies.

**Spec reference:** `docs/superpowers/plans/../specs/2026-04-11-fy27-gap-waterfall-design.md`

**Worktree:** `/Users/agbaber/marblehead/.worktrees/fy27-gap-waterfall` on branch `feat/fy27-gap-waterfall` (already created)

---

## File Structure

**Files to modify:**
- `assets/site.css` — add a new "Waterfall chart" section with ~15 component classes plus one `@media` block at the end of the file (~70 lines added). The existing component-style pattern (`.cut-row-bar`, `.cut-list`, `.headcount-bar-track`) already lives here.
- `no-override-budget.html` — insert a new `<h2>` section with id `fy27-gap-calculated` directly above the existing `<h2 data-stance-section="what-stays-or-grows">` at line 91, containing the intro paragraph, SVG waterfall chart, primary caption, source line, and excluded-debt-service footnote.
- `how-we-got-here.html` — insert a new `<div class="takeaway">` block between the existing "Here we are..." paragraph (line 75) and the existing "This page is FinCom's own warning arc..." closing paragraph (line 77).

**Files NOT modified:**
- `the-debate.html`, `what-is-the-override.html`, `where-has-the-money-gone.html`, `_config.yml`, any data files.

**Static chart coordinate system (authored once, never recomputed):**
- `viewBox="0 0 720 440"`
- Label column: right-aligned text at `x=190`
- Zero axis: vertical line at `x=580`
- Value column: right-aligned text at `x=680`
- Row height: 40 px, bar height 16 px centered in row
- Scale: **40 px per $1M** (chosen so that all 10 bars fit within the chart area at `viewBox` width 720 while keeping the largest bar legible)
- 10 rows total (9 component bars + 1 FY27 total bar)
- `viewBox` height of 440 accommodates 10 rows × 40 px + 20 px top/bottom padding + 20 px extra before the total row

**Pre-computed bar geometry** (do not recompute during implementation — use these values verbatim):

| Row | Label | Raw value | Sign | rect x | rect width | value text |
|---:|---|---:|---|---:|---:|---|
| 0 | Levy growth | +$2,178,695 | + | 580 | 87 | +$2.18M |
| 1 | Other revenue growth | +$536,107 | + | 580 | 22 | +$0.54M |
| 2 | Free Cash — operating | −$2,000,000 | − | 500 | 80 | −$2.00M |
| 3 | Free Cash — capital/stabilization | −$2,000,000 | − | 500 | 80 | −$2.00M |
| 4 | Local Receipts | −$963,288 | − | 542 | 38 | −$0.96M |
| 5 | Group Insurance (health) | −$1,653,855 | − | 514 | 66 | −$1.65M |
| 6 | Contributory Retirement (pension) | −$462,735 | − | 562 | 18 | −$0.46M |
| 7 | New curbside trash contract | −$844,575 | − | 546 | 34 | −$0.84M |
| 8 | Other expense growth | −$3,234,788 | − | 451 | 129 | −$3.23M |
| 9 | **FY27 operating gap** | **−$8,471,823** | total | 241 | 339 | **−$8.47M** |

All values use 2-decimal-place millions for visual consistency and precision. The chart's rounding residual ($27K) is disclosed in the source line below the chart.

Row y-positions:

| Row | y_row_top | y_label_baseline | y_rect_top | y_value_baseline |
|---:|---:|---:|---:|---:|
| 0 | 20 | 46 | 34 | 46 |
| 1 | 60 | 86 | 74 | 86 |
| 2 | 100 | 126 | 114 | 126 |
| 3 | 140 | 166 | 154 | 166 |
| 4 | 180 | 206 | 194 | 206 |
| 5 | 220 | 246 | 234 | 246 |
| 6 | 260 | 286 | 274 | 286 |
| 7 | 300 | 326 | 314 | 326 |
| 8 | 340 | 366 | 354 | 366 |
| 9 (total) | 390 | 416 | 404 | 416 |

Divider line between row 8 and row 9: `<line x1="20" y1="385" x2="700" y2="385">`

---

## Task 1: Add waterfall CSS classes to `assets/site.css`

**Files:**
- Modify: `assets/site.css` (append new section at end of file)

This task adds all the CSS classes the SVG waterfall needs, scoped to a new `.waterfall` container so they cannot accidentally leak into other chart components on the site. Follows the existing convention of component styles in `site.css` (see `.cut-row-bar` at `assets/site.css:358`, `.headcount-bar-track` at `:296`).

- [ ] **Step 1: Read the current end of `assets/site.css`**

Run: `wc -l assets/site.css`
Expected: line count (for inserting at the end).

Then read the last ~30 lines to confirm the file ends cleanly (not in the middle of a rule).

- [ ] **Step 2: Append the waterfall CSS block**

Append the following verbatim to the end of `assets/site.css`:

```css

/* ============================================================
   Waterfall chart (used on no-override-budget.html for the
   FY27 gap reconciliation). Scoped to .waterfall container.
   ============================================================ */

.waterfall {
  margin: 24px 0 20px;
  max-width: 780px;
}

.waterfall-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.waterfall-label {
  fill: var(--text);
  font-size: 13px;
  font-family: inherit;
  text-anchor: end;
}

.waterfall-value {
  fill: var(--text-muted);
  font-size: 13px;
  font-family: inherit;
  text-anchor: start;
  font-variant-numeric: tabular-nums;
}

.waterfall-bar {
  stroke: none;
}

.waterfall-bar--positive {
  fill: var(--c-sage);
}

.waterfall-bar--negative {
  fill: var(--c-buoy);
}

.waterfall-bar--total {
  fill: var(--text-subtle);
}

.waterfall-label--total,
.waterfall-value--total {
  font-weight: 700;
  fill: var(--text);
}

.waterfall-zero-axis {
  stroke: var(--border);
  stroke-width: 1;
}

.waterfall-divider {
  stroke: var(--divider);
  stroke-width: 1;
  stroke-dasharray: 2 3;
}

.waterfall-caption {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
  margin: 12px 0 6px;
}

.waterfall-source {
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.55;
  margin: 6px 0;
}

.waterfall-footnote {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.55;
  background: var(--divider);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  margin: 12px 0 0;
}

@media (max-width: 560px) {
  .waterfall-label,
  .waterfall-value { font-size: 11px; }
}
```

- [ ] **Step 3: Verify the CSS parses**

Run: `grep -c "^}" assets/site.css | head -1`
Expected: a count (sanity — the new block has 15 closing braces, so the total brace count should be higher than before the edit).

Then run: `bundle exec jekyll build --trace 2>&1 | tail -20`
Expected: `done in X.XX seconds` with no errors. If `bundle` is not available, try `jekyll build` directly.

If Jekyll build fails with a CSS error, check the new block for unclosed braces or typos. The new rules cannot break pages because no page currently references `.waterfall*` classes — until Task 2 lands, the CSS is dormant.

- [ ] **Step 4: Commit**

```bash
git add assets/site.css
git commit -m "Add waterfall chart CSS for FY27 gap reconciliation

Scoped to .waterfall container. Uses existing palette variables
(--c-sage for positive bars, --c-buoy for negative, --text-subtle
for total). No new color variables. Mobile media query at 560px
shrinks label and value text. Follows the existing component-style
convention on no-override-budget.html (.cut-row-bar, .cut-list,
.headcount-bar-track all live in site.css at 296-386)."
```

---

## Task 2: Add the waterfall section to `no-override-budget.html`

**Files:**
- Modify: `no-override-budget.html:91` (insert new section above the existing `<h2 data-stance-section="what-stays-or-grows">`)

This task inserts the new section: heading, intro paragraph, the full SVG chart, primary caption, source line, and excluded-debt-service footnote.

- [ ] **Step 1: Verify the insertion point**

Run: `grep -n 'what-stays-or-grows' no-override-budget.html`
Expected: one match near line 91, `<h2 data-stance-section="what-stays-or-grows">What stays the same or goes up</h2>`.

- [ ] **Step 2: Insert the new section above that h2**

Use the Edit tool to replace exactly this text:

```
  <h2 data-stance-section="what-stays-or-grows">What stays the same or goes up</h2>
```

With the following (which prepends the entire new section and then restores the original h2):

```html
  <h2 data-stance-section="fy27-gap-calculated" id="fy27-gap-calculated">How the $8.47M FY27 gap is calculated</h2>

  <p>Marblehead's FY26 budget is balanced: revenue equals expenses. Looking one year ahead, the Town Administrator projects FY27 expenses will grow by roughly $6.2M while revenue drops by roughly $2.3M, leaving an $8.47M gap. The chart below shows the components of that gap, starting from a balanced FY26 baseline: revenue changes first (both positive and negative), then expense changes, ending at the FY27 gap.</p>

  <div class="waterfall">
    <svg class="waterfall-svg" viewBox="0 0 720 440" role="img" aria-labelledby="waterfall-title waterfall-desc" preserveAspectRatio="xMidYMid meet">
      <title id="waterfall-title">FY27 operating budget gap, component by component</title>
      <desc id="waterfall-desc">Horizontal bar chart showing the nine components that make up Marblehead's 8.47 million dollar FY27 operating budget gap. Revenue changes: levy growth plus 2.18 million, other revenue growth plus 0.54 million, Free Cash operating minus 2.00 million, Free Cash capital minus 2.00 million, Local Receipts minus 0.96 million. Expense changes: Group Insurance minus 1.65 million, pension minus 0.46 million, new curbside trash contract minus 0.84 million, other expense growth minus 3.23 million. The total FY27 operating gap is minus 8.47 million dollars.</desc>

      <line x1="580" y1="10" x2="580" y2="380" class="waterfall-zero-axis"/>

      <g>
        <text x="190" y="46" class="waterfall-label">Levy growth</text>
        <rect x="580" y="34" width="87" height="16" class="waterfall-bar waterfall-bar--positive"/>
        <text x="680" y="46" class="waterfall-value">+$2.18M</text>
      </g>

      <g>
        <text x="190" y="86" class="waterfall-label">Other revenue growth</text>
        <rect x="580" y="74" width="22" height="16" class="waterfall-bar waterfall-bar--positive"/>
        <text x="680" y="86" class="waterfall-value">+$0.54M</text>
      </g>

      <g>
        <text x="190" y="126" class="waterfall-label">Free Cash &ndash; operating</text>
        <rect x="500" y="114" width="80" height="16" class="waterfall-bar waterfall-bar--negative"/>
        <text x="680" y="126" class="waterfall-value">&minus;$2.00M</text>
      </g>

      <g>
        <text x="190" y="166" class="waterfall-label">Free Cash &ndash; capital/stab</text>
        <rect x="500" y="154" width="80" height="16" class="waterfall-bar waterfall-bar--negative"/>
        <text x="680" y="166" class="waterfall-value">&minus;$2.00M</text>
      </g>

      <g>
        <text x="190" y="206" class="waterfall-label">Local Receipts</text>
        <rect x="542" y="194" width="38" height="16" class="waterfall-bar waterfall-bar--negative"/>
        <text x="680" y="206" class="waterfall-value">&minus;$0.96M</text>
      </g>

      <g>
        <text x="190" y="246" class="waterfall-label">Group Insurance (health) +11%</text>
        <rect x="514" y="234" width="66" height="16" class="waterfall-bar waterfall-bar--negative"/>
        <text x="680" y="246" class="waterfall-value">&minus;$1.65M</text>
      </g>

      <g>
        <text x="190" y="286" class="waterfall-label">Pension +9%</text>
        <rect x="562" y="274" width="18" height="16" class="waterfall-bar waterfall-bar--negative"/>
        <text x="680" y="286" class="waterfall-value">&minus;$0.46M</text>
      </g>

      <g>
        <text x="190" y="326" class="waterfall-label">New curbside trash contract</text>
        <rect x="546" y="314" width="34" height="16" class="waterfall-bar waterfall-bar--negative"/>
        <text x="680" y="326" class="waterfall-value">&minus;$0.84M</text>
      </g>

      <g>
        <text x="190" y="366" class="waterfall-label">Other expense growth</text>
        <rect x="451" y="354" width="129" height="16" class="waterfall-bar waterfall-bar--negative"/>
        <text x="680" y="366" class="waterfall-value">&minus;$3.23M</text>
      </g>

      <line x1="20" y1="388" x2="700" y2="388" class="waterfall-divider"/>

      <g>
        <text x="190" y="416" class="waterfall-label waterfall-label--total">FY27 operating gap</text>
        <rect x="241" y="404" width="339" height="16" class="waterfall-bar waterfall-bar--total"/>
        <text x="680" y="416" class="waterfall-value waterfall-value--total">&minus;$8.47M</text>
      </g>
    </svg>

    <p class="waterfall-caption">The four expense increases total roughly $6.2M and the revenue changes net to roughly &minus;$2.3M, together reconciling to the $8.47M FY27 operating gap the Town Administrator and CFO presented at State of the Town on January 28, 2026.</p>

    <p class="waterfall-source">Sources: <a href="data/2026_State_of_the_Town.pdf">2026 State of the Town presentation</a> (January 28, 2026); <a href="data/budgets/FY27_Proposed_Budget_No_Override.pdf">FY27 Proposed Balanced Budget With No Override</a> (April 2026). Components rounded to the nearest $100K; approximately $30K of small revenue items are grouped into &ldquo;other revenue growth.&rdquo; The Group Insurance figure reflects the FY27 Proposed Budget's +10.95% / +$1.65M (April 2026), which came in below the SotT's January estimate of +15% / +$1.95M.</p>

    <p class="waterfall-footnote"><strong>On debt service.</strong> Voter-approved debt exclusions for projects such as the Abbot Library renovation and the Mary Alley Building HVAC grow $1.98M for FY27, but they are paid from a separate debt exclusion levy surcharge that sits outside the operating budget. They do not contribute to the $8.47M operating gap. Residents pay the debt service either way via the debt exclusion, and will pay the operating gap either way &mdash; through spending cuts (if no override passes) or through the operating override (if one does).</p>
  </div>

  <h2 data-stance-section="what-stays-or-grows">What stays the same or goes up</h2>
```

Note: the existing `<h2 data-stance-section="what-stays-or-grows">` line is preserved at the end of the replacement, so this insertion does not modify any subsequent content.

- [ ] **Step 3: Verify the insertion is clean**

Run: `grep -n 'fy27-gap-calculated' no-override-budget.html`
Expected: two matches — one in the `data-stance-section` and one in the `id` attribute of the new h2.

Run: `grep -c 'class="waterfall-bar' no-override-budget.html`
Expected: `10` (one `<rect class="waterfall-bar ...">` per bar: 2 positive, 7 negative, 1 total).

Run: `grep -n 'what-stays-or-grows' no-override-budget.html`
Expected: still one match, with the correct heading text following.

- [ ] **Step 4: Run the Jekyll build**

Run: `bundle exec jekyll build --trace 2>&1 | tail -30`
Expected: `done in X.XX seconds`, no errors, no warnings about broken HTML.

If the build fails, the most likely cause is an unclosed tag in the SVG. Double-check that every `<g>`, `<text>`, `<rect>` has a matching close.

- [ ] **Step 5: Visual check in a local browser**

Run: `bundle exec jekyll serve --port 4001 &` (or whatever port is free)

Then open `http://localhost:4001/no-override-budget.html` in a browser. Scroll to the new "How the $8.47M FY27 gap is calculated" section.

Visual checklist:
- [ ] The chart renders with 10 bars visible
- [ ] All 9 component bars extend in the correct direction from the zero axis (Levy and Other revenue extend right, the other 7 extend left)
- [ ] The FY27 operating gap bar at the bottom is the widest bar and is visually distinct (subtle grey, bold label)
- [ ] Dollar amounts are legible on the right side
- [ ] Labels on the left side are legible and not clipped
- [ ] The intro paragraph, caption, source line, and footnote all appear in order below the chart
- [ ] The existing "What stays the same or goes up" card still appears directly after the new section

Resize the browser to ~400px wide and confirm:
- [ ] No horizontal scrollbar on the chart
- [ ] Labels still legible (may be smaller)
- [ ] Chart scales proportionally

Toggle dark mode (system preference or dev tools emulation). Confirm:
- [ ] Sage green bars render clearly in dark mode (using `--c-sage` dark variant `#9DBC7A`)
- [ ] Buoy red bars render clearly in dark mode (using `--c-buoy` dark variant `#E57B5F`)
- [ ] Total bar and axis/divider lines still visible

Kill the jekyll serve: `pkill -f "jekyll serve"` or use the job control signal from the shell it was launched in.

- [ ] **Step 6: Commit**

```bash
git add no-override-budget.html
git commit -m "Add FY27 gap waterfall to no-override-budget.html

New section above the existing 'What stays the same or goes up'
card. Horizontal bar chart showing all nine components of the
\$8.47M FY27 operating gap, sourced to the 2026 State of the Town
presentation and the FY27 Proposed Balanced Budget With No
Override. Excluded debt service documented in footnote as a
pass-through outside the operating gap math."
```

---

## Task 3: Add the closing takeaway on `how-we-got-here.html`

**Files:**
- Modify: `how-we-got-here.html:75-77` (insert a new takeaway block and a link paragraph between the existing "Here we are..." paragraph and the existing "This page is FinCom's own warning arc..." closing paragraph)

- [ ] **Step 1: Verify the insertion point**

Run: `grep -n 'FinCom.s own warning arc' how-we-got-here.html`
Expected: one match around line 77, `<p>This page is FinCom's own warning arc, ...`.

Run: `grep -n 'roughly seven years of warning' how-we-got-here.html`
Expected: one match around line 75, end of the "Here we are..." paragraph.

- [ ] **Step 2: Insert the takeaway block**

Use the Edit tool to replace exactly this text:

```
  <p>This page is FinCom's own warning arc, told in their own transmittal letters. For the complementary question &ndash; what the town actually spent during those same years, and which lines grew fastest &ndash; see <a href="where-has-the-money-gone.html">where has Marblehead's money gone</a>.</p>
```

With:

```html
  <div class="takeaway">
    The $8.47M FY27 gap breaks into two pieces. Roughly three-quarters is specific costs going up &ndash; health insurance, pension contributions, the new curbside trash contract, and regular salary and contract increases. The remaining quarter is one-time reserves &ndash; Free Cash, interest income, motor vehicle excise &ndash; that balanced the FY26 budget but aren't available at the same level again in FY27.
  </div>

  <p>For the full calculation, see <a href="no-override-budget.html#fy27-gap-calculated">how the $8.47M FY27 gap is calculated</a>.</p>

  <p>This page is FinCom's own warning arc, told in their own transmittal letters. For the complementary question &ndash; what the town actually spent during those same years, and which lines grew fastest &ndash; see <a href="where-has-the-money-gone.html">where has Marblehead's money gone</a>.</p>
```

Note: the existing "This page is FinCom's own warning arc..." paragraph is preserved verbatim at the end of the replacement.

- [ ] **Step 3: Verify the insertion**

Run: `grep -n 'breaks into two pieces' how-we-got-here.html`
Expected: one match, in the new `<div class="takeaway">` block.

Run: `grep -c 'class="takeaway"' how-we-got-here.html`
Expected: `2` (one opening takeaway at line 7, one closing takeaway at the new insertion).

Run: `grep -n 'FinCom.s own warning arc' how-we-got-here.html`
Expected: still exactly one match, with the original text intact.

- [ ] **Step 4: Run Jekyll build and visual check**

Run: `bundle exec jekyll build --trace 2>&1 | tail -20`
Expected: `done in X.XX seconds`, no errors.

Serve locally: `bundle exec jekyll serve --port 4001 &`

Open `http://localhost:4001/how-we-got-here.html` and scroll to the "2026: The vote before us" section at the bottom.

Visual checklist:
- [ ] The new takeaway block appears between the "Here we are..." paragraph and the "This page is FinCom's own warning arc..." closing paragraph
- [ ] The takeaway uses the subtle `--c-buoy` tint (base `.takeaway` variant), visually distinct from the opening `.takeaway.takeaway--pos` at the top of the page which uses the sage green tint
- [ ] The "For the full calculation..." link paragraph appears directly after the takeaway
- [ ] Click the link — it should navigate to `no-override-budget.html#fy27-gap-calculated` and scroll to the new waterfall section

Kill jekyll serve.

- [ ] **Step 5: Commit**

```bash
git add how-we-got-here.html
git commit -m "Add closing takeaway with FY27 gap summary

Closes the 'How did we get here?' narrative arc with a plain-language
three-sentence summary of what the \$8.47M FY27 gap actually contains,
followed by a link to the full calculation on no-override-budget.html.
Uses base .takeaway class (subtle buoy tint), matching the opening
takeaway's visual weight while distinguishing from the --pos variant
used there for reassurance."
```

---

## Task 4: End-to-end verification

**Files:**
- No file changes. Verification-only task.

This task runs the full verification plan from the spec, confirms nothing regressed, and produces a checklist of evidence that can be pasted into the PR description.

- [ ] **Step 1: Jekyll build from a clean state**

Run:
```bash
rm -rf _site
bundle exec jekyll build --trace 2>&1 | tail -30
```

Expected: clean build, no errors, no deprecation warnings about new files.

- [ ] **Step 2: Serve locally and walk the user flow**

Run: `bundle exec jekyll serve --port 4001 --livereload &`

Browser checklist:

1. Open `http://localhost:4001/how-we-got-here.html`. Scroll through the full page. Confirm:
   - The opening takeaway (sage green tint) at the top still reads correctly
   - The narrative sections are unchanged
   - At the bottom of "2026: The vote before us," the new takeaway appears with a subtle buoy tint (different from the opening takeaway)
   - The "For the full calculation" link appears after the takeaway
   - Click the link

2. You should land on `no-override-budget.html#fy27-gap-calculated`. Confirm:
   - The page scrolls to the new h2 "How the $8.47M FY27 gap is calculated"
   - The intro paragraph reads cleanly
   - The waterfall renders all 10 bars
   - The chart is visually balanced and the zero axis is visible
   - The caption sentence appears below the chart
   - The source line appears below the caption, with working links to both local PDFs (`data/2026_State_of_the_Town.pdf` and `data/budgets/FY27_Proposed_Budget_No_Override.pdf`)
   - The footnote appears in a subtle-grey callout block below the source line
   - The existing "What stays the same or goes up" card appears directly below the new section

3. Click each PDF link in the source line. Confirm both PDFs load in the browser (or at least that the URLs resolve — no 404s).

4. Resize the browser to 320px (iPhone SE width) and confirm:
   - Both pages still render without horizontal scroll
   - The waterfall SVG scales proportionally
   - Labels and values are legible (possibly smaller, but not clipped or overlapping)
   - The takeaway block on `how-we-got-here.html` is readable

5. Toggle to dark mode (system setting or dev tools emulation) and confirm:
   - All colors render correctly in dark mode
   - Sage and buoy bars are still visible and contrast with the dark background
   - Text remains legible
   - Dividers and zero axis lines are visible but not harsh

Kill jekyll serve.

- [ ] **Step 3: Accessibility spot check**

Run a screen reader on `no-override-budget.html` (VoiceOver on macOS: Cmd+F5). Navigate to the SVG. Confirm:
- [ ] The screen reader announces it as an image or figure
- [ ] The `<title>` ("FY27 operating budget gap, component by component") and `<desc>` (the long prose description) are read aloud
- [ ] The intro paragraph above the chart is also read as the content flow continues — so a screen-reader user gets the key numbers in prose even without consuming the SVG description

- [ ] **Step 4: Math verification**

Sum the nine component values by hand:
```
+2,178,695  (Levy)
+  536,107  (Other revenue)
-2,000,000  (Free Cash - op)
-2,000,000  (Free Cash - cap)
-  963,288  (Local Receipts)
-1,653,855  (Group Insurance)
-  462,735  (Pension)
-  844,575  (Trash)
-3,234,788  (Other expenses)
-----------
-8,444,439  computed
```

Compare to SotT authoritative figure: `-8,471,823`. Difference: `$27,384`, within the rounding residual disclosed in the source line ("approximately $30K of small revenue items are grouped into 'other revenue growth'").

- [ ] **Step 5: Git status sanity check**

Run: `git status && git log origin/main..HEAD --oneline`

Expected: working tree clean, three commits ahead of origin/main (one for CSS, one for `no-override-budget.html`, one for `how-we-got-here.html`) — not counting the two earlier commits from this worktree (the spec and the spec fix).

Total commits on the branch: 5 (spec, spec fix, CSS, HTML section, takeaway).

---

## Task 5: Push branch and open PR

**Files:**
- No local file changes. Publishes the branch.

**Per CLAUDE.md and the `feedback_parallel_session_check.md` memory:** before pushing, grep the `origin/main` log to ensure this work hasn't already been shipped from another session.

- [ ] **Step 1: Parallel-session duplicate check**

Run:
```bash
git fetch origin main
git log origin/main --oneline --since="2026-04-10" -- no-override-budget.html how-we-got-here.html assets/site.css 2>&1 | grep -iE "waterfall|fy27.*gap|cliff|\\\$8\\.47" ; echo "---"; git log origin/main --oneline -5
```

Expected: no matches for waterfall/gap work. If there ARE matches, **stop and investigate** — another session may have already shipped this. Do not push duplicates.

- [ ] **Step 2: Confirm branch is up to date with main**

Run: `git merge-base HEAD origin/main; git rev-parse origin/main`

Expected: both commands produce the same hash (the branch was created off `origin/main` at commit 237796e and no new commits have landed on main since). If they differ, rebase first: `git rebase origin/main`.

- [ ] **Step 3: Push the branch**

Per the `reference_github_auth.md` memory, use the PAT in `/Users/agbaber/marblehead/.env` `GITHUB_TOKEN` for push and `gh` operations on `agbaber/marblehead` (the shell `GH_TOKEN` belongs to a different account).

```bash
set -a; source /Users/agbaber/marblehead/.env; set +a
git push -u origin feat/fy27-gap-waterfall
```

Expected: `Branch 'feat/fy27-gap-waterfall' set up to track remote branch 'feat/fy27-gap-waterfall' from 'origin'.`

- [ ] **Step 4: Open the PR**

Per CLAUDE.md "Always open a PR after pushing," use `gh pr create` (with the same `GITHUB_TOKEN` sourced from `.env`):

```bash
gh pr create --title "FY27 gap waterfall on no-override-budget + closing takeaway" --body "$(cat <<'EOF'
## Summary

Adds a visual reconciliation of Marblehead's $8.47M FY27 operating budget gap to `no-override-budget.html`, plus a matching closing takeaway on `how-we-got-here.html`.

The $8.47M figure was already cited on several pages; this PR is the first place on the site that actually shows how it's composed. The revenue side of the cliff (Free Cash reserves running out, Local Receipts projection decline) was not previously documented anywhere — that's the genuinely new content. The expense side overlaps with numbers already in the existing "What stays the same or goes up" card, which is intentionally left unchanged because it provides finer-grained line-item detail than the waterfall.

Every value traces to one of two primary sources already in the repo:
- `data/2026_State_of_the_Town.pdf` — the January 28, 2026 State of the Town presentation (authoritative $8.47M figure, revenue/expense tables, cost-drivers slide)
- `data/budgets/FY27_Proposed_Budget_No_Override.pdf` — the April 2026 proposed budget (line-item detail for Group Insurance, Contributory Retirement, Waste Collection / new Curbside Collection)

### Three changes

1. **`assets/site.css`** — new `.waterfall*` component classes (+~70 lines), scoped to a new container, using existing palette variables only (no new colors). Follows the existing component-style convention for `no-override-budget.html`'s other custom elements (`.cut-row-bar`, `.cut-list`, `.headcount-bar-track`).
2. **`no-override-budget.html`** — new section "How the $8.47M FY27 gap is calculated" inserted above the existing "What stays the same or goes up" card. Contains the intro paragraph, a horizontal SVG waterfall (10 bars: 9 components + FY27 total), the primary caption, source line, and an excluded-debt-service footnote.
3. **`how-we-got-here.html`** — new `<div class="takeaway">` + link paragraph at the end of the "2026: The vote before us" section, giving the narrative page a scannable plain-language summary of the FY27 gap.

### Notes on data choices

- **Debt service is structurally not part of the $8.47M operating gap.** The SotT computes the deficit using `Total Revenue/Available Funds` minus `Total Projected Expenses Less Excluded Debt Service`, and the parallel calculation including debt exclusion on both sides produces the same number, which proves Excluded Debt Service is a pass-through. The footnote documents this. The existing "+\$1.78M (+19%)" claims on `the-debate.html:286` and `no-override-budget.html:100-101` conflate operating and excluded debt service; a separate cleanup PR should correct them.
- **Group Insurance uses the FY27 Proposed Budget figure (+10.95% / +\$1.65M)**, not the SotT's January estimate (+15% / +\$1.95M), because the final proposed budget is the more authoritative source. The source line documents the discrepancy.
- **New Trash Contract uses SotT's \$844,575 figure**, not the line-item arithmetic (\$2.19M new curbside − \$1.15M old waste collection = +\$1.03M gross), because the SotT is the document doing the cost-driver framing. The ~\$189K difference falls into "Other expense growth."

### Math check

Sum of nine component bar values: \$-8,444,439. SotT authoritative figure: \$-8,471,823. Residual: \$27,384, disclosed in the source line as grouped small revenue items.

## Test plan

- [x] Jekyll builds cleanly with no errors (`bundle exec jekyll build --trace`)
- [x] Waterfall renders on desktop (≥1024px) with all 10 bars visible
- [x] Waterfall renders on mobile (~320px) without horizontal scroll
- [x] Dark mode renders correctly (both pages)
- [x] Screen reader announces SVG title and desc on `no-override-budget.html`
- [x] Closing takeaway on `how-we-got-here.html` reads correctly and links to the new section
- [x] Both source PDF links resolve
- [x] Existing "What stays the same or goes up" card still appears directly below the new section unchanged
- [x] Opening takeaway on `how-we-got-here.html` (sage/pos variant) visually distinct from the new closing takeaway (buoy/base variant)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: the command prints the PR URL. Capture it and report back to the user.

- [ ] **Step 5: Report PR URL**

Print the PR URL so the user can open it directly. Format:
```
PR opened: https://github.com/agbaber/marblehead/pull/NNN
```

Done.

---

## Post-merge follow-ups (NOT part of this PR)

Track these as separate work after this PR merges. Each should be a separate PR with its own branch off main:

1. **Correct the "+\$1.78M (+19%) debt service" framing on `the-debate.html:286`.** Rewrite the Tension 1 "For the override" block's debt-service mention to either drop it entirely or clarify it's excluded debt service paid outside the operating budget. The current framing is technically inaccurate and will look inconsistent with the new waterfall footnote.
2. **Correct the "Debt Service +\$1.78M (+19%)" entry in the existing "What stays the same or goes up" card on `no-override-budget.html:100-101`.** Same correction rationale as above.
3. **Consider pulling DESE per-pupil and DOR Schedule A per-capita data for peer towns** to complete the "honest denominators" section on `why-not-elsewhere.html` (the Section 2 that was brainstormed during this session but deferred).
