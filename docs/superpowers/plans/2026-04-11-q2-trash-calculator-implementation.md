# Q2 Trash Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static 8-row distributional table on `question-2-trash.html` with an embedded interactive calculator that takes a reader's assessed value and shows their personal cost under each Question 2 outcome (levy vs. flat Board of Health fee), in a strictly neutral presentation that does not tell readers how to vote.

**Architecture:** Vanilla HTML + scoped CSS + inline JS, matching the existing `charts/override_calculator.html` pattern. No new files, no build step, no framework. The calculator shares its `localStorage` key with the override calculator so assessed value carries across both tools. Fee figure shifts from $262 (Health Department base estimate) to $281 (opt-out-adjusted, what a paying household actually owes); this ripples through ~8 small prose edits on the page and 1 footnote edit on the override calculator page.

**Tech Stack:** Jekyll static site, vanilla JavaScript, CSS custom properties from `assets/site.css`. Preview via `bundle exec jekyll serve`.

**Reference:** [Design spec](../specs/2026-04-11-q2-trash-calculator-design.md)

**Prerequisite for executing this plan:** Start `bundle exec jekyll serve` in a separate terminal before Task 1 and leave it running for the duration. All verification steps assume the dev server is live at `http://localhost:4000`.

---

## File Structure

This plan modifies two existing files. No new files are created.

- **`question-2-trash.html`** (primary file) — receives the calculator HTML block, its scoped CSS, its inline JS, deletion of the `.dist-table` block and its CSS, and ~8 small prose edits to align the page on the $281 fee figure.
- **`charts/override_calculator.html`** (secondary file) — one character update in footnote 4 (`$22/mo` → `$23/mo`).

Files touched only in this plan — no other HTML pages, no CSS in `assets/site.css`, no `_includes/` partials, no `_config.yml`.

---

## Task 1: Add the calculator HTML layout with static placeholder values

**Goal:** Get the calculator's visual structure rendering on the page with hard-coded default values (no interactivity yet). This lets us verify layout, typography, and mobile responsiveness before wiring up logic. The calculator is positioned **above** the existing static table — the two will coexist temporarily.

**Files:**
- Modify: `question-2-trash.html` (insert new HTML block around line 425, just before the `<table class="dist-table">` element)

### Steps

- [ ] **Step 1.1: Locate the insertion point**

Open `question-2-trash.html` and find the section heading `<h2>What each outcome costs residents, by home value</h2>` (around line 421). Below it is the paragraph starting `<p>Marblehead's total residential assessed value is approximately $9.9 billion...` (around line 423). Below that is `<table class="dist-table">` (around line 425).

Insert the new HTML block **between the paragraph and the `<table>`** — i.e., the calculator appears above the old table temporarily.

- [ ] **Step 1.2: Insert the calculator HTML block**

Add this exact block in the location identified in Step 1.1:

```html
<div class="q2-calc">
  <div class="calc-input">
    <label for="trash-assessed">Your assessed value</label>
    <input id="trash-assessed" type="text" inputmode="numeric" value="$1,291,507" autocomplete="off">
    <span class="hint">Don't know it? <a href="https://epay.cityhallsystems.com/selection" target="_blank" rel="noopener">Look it up on the town's tax portal</a>.</span>
    <span class="hint-default">Defaults to the town's average single-family value.</span>
  </div>

  <div class="q2-calc-cards">
    <div class="q2-calc-card">
      <h3 class="q2-calc-card-label">If Question 2 passes</h3>
      <div class="q2-calc-card-sub">Levy increase, scales with home value</div>
      <div class="q2-calc-card-primary">
        <span id="levy-annual">$300</span><span class="q2-calc-card-unit">/yr</span>
      </div>
      <div class="q2-calc-card-monthly"><span id="levy-monthly">$25</span>/mo</div>
      <div class="q2-calc-card-context">
        <div>Median home ($1.01M): <span id="levy-median-out">$235/yr</span></div>
        <div>Average home ($1.29M): <span id="levy-avg-out">$300/yr</span></div>
      </div>
    </div>

    <div class="q2-calc-card">
      <h3 class="q2-calc-card-label">If Question 2 fails</h3>
      <div class="q2-calc-card-sub">Flat Board of Health fee, same for every household</div>
      <div class="q2-calc-card-primary">
        <span>$281</span><span class="q2-calc-card-unit">/yr</span>
      </div>
      <div class="q2-calc-card-monthly">$23/mo</div>
      <div class="q2-calc-card-context">
        <div>Median home: $281/yr</div>
        <div>Average home: $281/yr</div>
      </div>
    </div>
  </div>

  <p class="q2-calc-delta" id="delta-sentence">At your home value, the flat fee costs $19 less per year than the levy.</p>
</div>
```

- [ ] **Step 1.3: Add the calculator CSS to the page-scoped `<style>` block**

Find the existing `<style>` block at the top of `question-2-trash.html` (starts around line 7, after the frontmatter). Find the closing `</style>` tag (around line 295, after the mobile media query). **Before** the existing `@media (max-width: 600px)` block, add these new rules:

```css
  /* Q2 trash calculator — input, scenario cards, delta sentence */

  .q2-calc { margin: 20px 0 26px; }

  .calc-input { margin: 0 auto 22px; max-width: 420px; text-align: center; }
  .calc-input label {
    display: block; font-size: 12px; color: var(--text-subtle);
    text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px;
  }
  .calc-input input {
    width: 100%; padding: 10px 14px; font-size: 18px; font-weight: 600;
    color: var(--text); background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm); text-align: center;
    font-variant-numeric: tabular-nums; font-family: var(--font-sans);
  }
  .calc-input input:focus {
    outline: none; border-color: var(--link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--link) 22%, transparent);
  }
  .calc-input .hint { display: block; font-size: 12px; color: var(--text-subtle); margin-top: 8px; }
  .calc-input .hint a { color: var(--link); }
  .calc-input .hint-default { display: block; font-size: 11px; color: var(--text-faint); margin-top: 3px; }

  .q2-calc-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin: 18px 0;
  }
  .q2-calc-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px 22px;
    box-shadow: var(--shadow-sm);
  }
  .q2-calc-card-label {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 4px;
  }
  .q2-calc-card-sub {
    font-size: 12px;
    color: var(--text-subtle);
    margin-bottom: 14px;
    line-height: 1.4;
  }
  .q2-calc-card-primary {
    font-size: 28px;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .q2-calc-card-unit {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-subtle);
    margin-left: 2px;
  }
  .q2-calc-card-monthly {
    font-size: 13px;
    color: var(--text-subtle);
    font-variant-numeric: tabular-nums;
    margin-top: 4px;
  }
  .q2-calc-card-context {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--divider);
    font-size: 12px;
    color: var(--text-subtle);
    line-height: 1.7;
    font-variant-numeric: tabular-nums;
  }
  .q2-calc-delta {
    font-size: 14px;
    color: var(--text-muted);
    text-align: center;
    margin: 6px 0 0;
    font-style: italic;
  }
```

- [ ] **Step 1.4: Add mobile styles to the existing `@media (max-width: 600px)` block**

Find the existing `@media (max-width: 600px)` block (around line 276). It currently contains entries for `.trash-tldr`, `.dist-table`, `.peer-trash`, `.already-decided`, `.page-covers li`, `.pull-quote`, `.budget-shift`, etc. **Inside** that same media query block, before the closing `}`, add:

```css
    .q2-calc-cards { grid-template-columns: 1fr; gap: 10px; }
    .q2-calc-card { padding: 16px 18px; }
    .q2-calc-card-primary { font-size: 24px; }
    .calc-input { max-width: 100%; }
```

- [ ] **Step 1.5: Reload the page and verify desktop layout**

In the browser, navigate to `http://localhost:4000/question-2-trash.html` and hard-refresh (Cmd+Shift+R). Scroll to the "What each outcome costs residents, by home value" section.

Expected:
- The input field shows `$1,291,507` centered above two side-by-side cards.
- Left card heading `If Question 2 passes`, sub-label `Levy increase, scales with home value`, primary `$300/yr`, secondary `$25/mo`, context lines showing median `$235/yr` and average `$300/yr`.
- Right card heading `If Question 2 fails`, sub-label `Flat Board of Health fee, same for every household`, primary `$281/yr`, secondary `$23/mo`, both context lines showing `$281/yr`.
- Delta sentence below, italic, centered: *"At your home value, the flat fee costs $19 less per year than the levy."*
- The old `.dist-table` is still visible below the calculator (expected — it's removed in Task 3).
- No console errors in browser devtools.

If the layout looks broken, stop and fix the CSS before proceeding. Common issues: missing `var(--*)` token, cards stretching too wide, input not centered.

- [ ] **Step 1.6: Verify mobile layout**

In browser devtools, open the responsive design mode and set the viewport to 375px wide (iPhone SE). Reload.

Expected:
- Cards stack vertically, each full width.
- Primary number font is 24px (smaller than desktop 28px).
- Card padding is tighter.
- No horizontal scroll.

- [ ] **Step 1.7: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/q2-trash-calculator
git add question-2-trash.html
git commit -m "$(cat <<'EOF'
Add Q2 trash calculator layout (static values, no JS yet)

Scenario cards for Question 2 pass vs fail outcomes, with placeholder
numbers matching the town average single-family assessment. Old static
table temporarily remains below the calculator — it is removed in a
later commit once interactivity is wired up and verified.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire up calculator interactivity (inline JavaScript)

**Goal:** Make the calculator respond to input changes, persist assessed value via shared `localStorage`, and update both cards + delta sentence live.

**Files:**
- Modify: `question-2-trash.html` (add `<script>` block immediately before the closing of the existing `.notes` `<div>` at the bottom, or at the very end of the file after the `.notes` div — whichever matches the override calculator's inline-script convention)

### Steps

- [ ] **Step 2.1: Locate the insertion point for the script**

Open `question-2-trash.html`. Scroll to the very bottom of the file. After the closing `</div>` of the `.notes` block (around line 582) and before the end of the Jekyll content, add a new `<script>` block on its own line.

- [ ] **Step 2.2: Insert the inline script**

Add this exact script:

```html
<script>
// Question 2 trash calculator.
// Constants and derivation: see docs/superpowers/specs/2026-04-11-q2-trash-calculator-design.md

// Ballot question: total levy authorization across FY27-FY29.
// Source: data/2026-04-08_Override_Presentation.pdf slide 20
const Q2_LEVY_TOTAL = 2298575;

// Total residential assessed value base for the distributional calculation.
// Derivation: $84.6M residential levy / $8.56 per $1000 residential rate.
// Source: MA DOR Tax Levies by Class FY2026.
const RESIDENTIAL_BASE = 9880000000;

// Additional levy rate per $1000 of assessed value.
const LEVY_RATE_PER_1000 = Q2_LEVY_TOTAL / (RESIDENTIAL_BASE / 1000);

// Board of Health flat fee, adjusted for 3% opt-out rate.
// Source: Marblehead Current, "Health Department estimates $281 for trash fee;
// BoH approves budgets" (2026-03-25). Base estimate $262 before adjustment.
const FLAT_FEE = 281;

// Anchor points for context lines.
// Source: FY26 tax classification hearing.
const MEDIAN_ASSESSED = 1010000;
const AVG_ASSESSED = 1291507;

// Shared with charts/override_calculator.html so assessed value carries
// across both calculators.
const STORAGE_KEY = 'mh_override_calc_assessed_value';

function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function parseAssessed(raw) {
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : AVG_ASSESSED;
}

function formatInput(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (e) { return null; }
}

function saveStored(value) {
  try { localStorage.setItem(STORAGE_KEY, String(value)); } catch (e) {}
}

function levyCost(assessedValue) {
  return (assessedValue / 1000) * LEVY_RATE_PER_1000;
}

function deltaSentence(userLevy, fee) {
  const diff = fee - userLevy;
  if (Math.abs(diff) < 10) {
    return 'At your home value, the two options cost about the same.';
  }
  if (diff > 0) {
    return 'At your home value, the levy costs ' + money(diff) + ' less per year than the flat fee.';
  }
  return 'At your home value, the flat fee costs ' + money(-diff) + ' less per year than the levy.';
}

function update() {
  const input = document.getElementById('trash-assessed');
  const value = parseAssessed(input.value);
  saveStored(value);
  const userLevy = levyCost(value);
  document.getElementById('levy-annual').textContent = money(userLevy);
  document.getElementById('levy-monthly').textContent = money(userLevy / 12);
  document.getElementById('delta-sentence').textContent = deltaSentence(userLevy, FLAT_FEE);
}

(function init() {
  // Static context lines computed once at load.
  document.getElementById('levy-median-out').textContent =
    money(levyCost(MEDIAN_ASSESSED)) + '/yr';
  document.getElementById('levy-avg-out').textContent =
    money(levyCost(AVG_ASSESSED)) + '/yr';

  const input = document.getElementById('trash-assessed');
  const stored = loadStored();
  if (stored !== null) input.value = formatInput(stored);
  input.addEventListener('input', update);
  input.addEventListener('blur', function() {
    input.value = formatInput(parseAssessed(input.value));
    update();
  });
  update();
})();
</script>
```

- [ ] **Step 2.3: Reload the page and verify the default render**

Hard-refresh `http://localhost:4000/question-2-trash.html`. Scroll to the calculator.

Expected (assuming no `localStorage` entry yet):
- Input shows `$1,291,507`.
- Levy card: `$300/yr`, `$25/mo`.
- Fee card: `$281/yr`, `$23/mo`.
- Levy card context: `Median home ($1.01M): $235/yr`, `Average home ($1.29M): $300/yr`.
- Delta sentence: *"At your home value, the flat fee costs $19 less per year than the levy."*
- No console errors.

- [ ] **Step 2.4: Verify interactive input updates**

Click in the input and change the value to `1,010,000` (median home). Tab or click out of the field.

Expected:
- Input reformats to `$1,010,000` on blur.
- Levy card primary updates to `$235`.
- Levy card monthly updates to `$20`.
- Delta sentence updates to: *"At your home value, the levy costs $46 less per year than the flat fee."*
- Fee card stays at `$281/yr`, `$23/mo` (unchanged).

- [ ] **Step 2.5: Verify $500K edge case**

Clear the input and type `500000`. Tab out.

Expected:
- Input shows `$500,000`.
- Levy card primary: `$116`. (calculation: 500 × 0.2326 = 116.30, rounds to 116)
- Levy card monthly: `$10`. (116 / 12 = 9.67, rounds to 10)
- Delta sentence: *"At your home value, the levy costs $165 less per year than the flat fee."* (281 - 116 = 165)

- [ ] **Step 2.6: Verify $3M edge case**

Clear and type `3000000`. Tab out.

Expected:
- Input shows `$3,000,000`.
- Levy card primary: `$698`. (3000 × 0.2326 = 697.80, rounds to 698)
- Levy card monthly: `$58`. (698 / 12 = 58.17, rounds to 58)
- Delta sentence: *"At your home value, the flat fee costs $417 less per year than the levy."* (698 - 281 = 417)

- [ ] **Step 2.7: Verify break-even sentence**

Clear and type `1208000`. Tab out.

Expected:
- Input shows `$1,208,000`.
- Levy card primary: `$281`. (1208 × 0.2326 = 280.98, rounds to 281)
- Delta sentence: *"At your home value, the two options cost about the same."*

- [ ] **Step 2.8: Verify persistence across pages**

With the input still showing `$1,208,000`, navigate to `http://localhost:4000/charts/override_calculator.html` in the same tab.

Expected: The override calculator's `Your assessed value` input is pre-populated with `$1,208,000` (or whatever value was last entered on either page).

Change it there to `$750,000`, blur, then navigate back to `http://localhost:4000/question-2-trash.html`.

Expected: The Q2 calculator's input now shows `$750,000`.

- [ ] **Step 2.9: Verify empty / bad input handling**

Clear the input completely and tab out.

Expected:
- Input reformats to `$1,291,507` (falls back to `AVG_ASSESSED`).
- Cards and delta sentence match the default render from Step 2.3.

Type garbage like `abc!@#`, tab out.

Expected: Same fallback to `$1,291,507`.

- [ ] **Step 2.10: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/q2-trash-calculator
git add question-2-trash.html
git commit -m "$(cat <<'EOF'
Wire up Q2 trash calculator interactivity

Inline vanilla-JS calculator backed by a shared localStorage key with the
override calculator. Derives the levy rate from the ballot authorization
($2,298,575) and the residential assessed base ($9.88B). Updates live on
input, reformats on blur, falls back to the town average on empty/bad
input.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Delete the old static `.dist-table`

**Goal:** Remove the now-redundant 8-row distributional table and its associated CSS.

**Files:**
- Modify: `question-2-trash.html` (delete HTML block lines ~425–484 and CSS rules ~58–108, plus mobile entries)

### Steps

- [ ] **Step 3.1: Delete the `.dist-table` HTML block**

Find the `<table class="dist-table">` element (around line 425) and its closing `</table>` tag (around line 484). Delete the entire table including both tags. The surrounding paragraphs (the intro `$0.23 per $1,000` paragraph above it, and the break-even / regressivity paragraphs below it) stay.

Before:
```html
<p>Marblehead's total residential assessed value ... they differ in who pays.</p>

<table class="dist-table">
  <thead>
    ... all the header and body rows ...
  </thead>
  <tbody>
    ... 8 rows ...
  </tbody>
</table>

<p>The break-even point, where the two options cost the same, is at roughly $1,140,000...
```

After:
```html
<p>Marblehead's total residential assessed value ... they differ in who pays.</p>

<p>The break-even point, where the two options cost the same, is at roughly $1,140,000...
```

(The calculator block added in Task 1 is already between the first paragraph and the deleted table's former position, so after deletion the calculator sits directly above the break-even paragraph.)

- [ ] **Step 3.2: Delete the `.dist-table` CSS rules**

In the page-scoped `<style>` block, find the `.dist-table` CSS rules (around lines 58–108). These are the rules starting with `/* Distributional analysis grid */` and ending at the last `.dist-table td.cheaper { ... }` rule. Delete all of them, including the section comment.

Also in the `@media (max-width: 600px)` block, find and delete these specific lines (they reference the now-deleted table):

```css
    .dist-table, .peer-trash { font-size: 12px; }
    .dist-table th, .dist-table td,
    .peer-trash th, .peer-trash td { padding: 9px 5px; }
```

Replace with just the `.peer-trash`-only entries:

```css
    .peer-trash { font-size: 12px; }
    .peer-trash th, .peer-trash td { padding: 9px 5px; }
```

- [ ] **Step 3.3: Reload the page and verify**

Hard-refresh `http://localhost:4000/question-2-trash.html`.

Expected:
- The calculator is now directly above the break-even paragraph — no table between them.
- The page reads naturally: intro paragraph → calculator → break-even paragraph → regressivity paragraph.
- No layout regression on desktop or mobile.
- No CSS console warnings about unused rules.

- [ ] **Step 3.4: Verify peer-trash table still styles correctly**

Scroll down to the "How other Massachusetts towns fund curbside trash" section. The `.peer-trash` table should still render with proper padding on mobile (the media query change in Step 3.2 preserved its own rules).

Resize to 375px wide and confirm the peer-trash table still has tight padding.

- [ ] **Step 3.5: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/q2-trash-calculator
git add question-2-trash.html
git commit -m "$(cat <<'EOF'
Remove Q2 static distributional table, superseded by calculator

The 8-row .dist-table and its scoped CSS are replaced by the interactive
calculator added in the previous commits. Mobile media query cleaned up
to keep only the .peer-trash rules.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Retroactive prose edits aligning the page on $281

**Goal:** Update the page's prose so every reference to the fee uses $281 (opt-out adjusted) instead of $262 (base estimate), matching the calculator. Recompute the break-even value and the regressivity-paragraph multiplier.

**Files:**
- Modify: `question-2-trash.html` (8 targeted text edits)

### Steps

- [ ] **Step 4.1: Update both `.key-stat-value` entries — flat fee AND break-even**

The `.key-stats` block at the top of the page has two key-stats affected by
the fee change: the flat fee value itself, and the break-even home value
(which is derived from the fee). Update both in one edit.

Before (around lines 299–316):
```html
<div class="key-stats">
  <div class="key-stat">
    <div class="key-stat-value">$2.30M</div>
    <div class="key-stat-label">Override ask</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">$262</div>
    <div class="key-stat-label">Flat fee</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">$1.14M</div>
    <div class="key-stat-label">Break-even value</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">~$1M</div>
    <div class="key-stat-label">Contract growth</div>
  </div>
</div>
```

After:
```html
<div class="key-stats">
  <div class="key-stat">
    <div class="key-stat-value">$2.30M</div>
    <div class="key-stat-label">Override ask</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">$281</div>
    <div class="key-stat-label">Flat fee</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">$1.21M</div>
    <div class="key-stat-label">Break-even value</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">~$1M</div>
    <div class="key-stat-label">Contract growth</div>
  </div>
</div>
```

Only two values change: `$262` → `$281` and `$1.14M` → `$1.21M`. The
`$2.30M` override-ask key-stat and the `~$1M` contract-growth key-stat are
unchanged.

(Note: the spec's Retroactive edits section did not explicitly list the
break-even key-stat as an edit — it only listed the break-even prose
paragraph. This is a spec gap caught in plan self-review and corrected
here. The key-stat must change in lockstep with the prose paragraph, or
the page becomes internally inconsistent.)

- [ ] **Step 4.2: Update the `.trash-tldr` paragraph (around line 335)**

Before:
```html
<p>Question 2 is about how to fund that new Curbside Collection line. A <strong>yes</strong> vote raises property taxes by $2.3&nbsp;million, distributed by assessed value. A <strong>no</strong> vote means the Board of Health imposes a flat curbside fee of roughly $262&ndash;$281 per household instead. Either way, residents pay for trash. The total revenue raised is approximately the same. The difference is who pays how much: the levy scales with assessed home value, the fee is identical for every household.</p>
```

After:
```html
<p>Question 2 is about how to fund that new Curbside Collection line. A <strong>yes</strong> vote raises property taxes by $2.3&nbsp;million, distributed by assessed value. A <strong>no</strong> vote means the Board of Health imposes a flat curbside fee of roughly $281 per household instead (the Health Department's $262 base estimate adjusted for an assumed 3% opt-out rate). Either way, residents pay for trash. The total revenue raised is approximately the same. The difference is who pays how much: the levy scales with assessed home value, the fee is identical for every household.</p>
```

- [ ] **Step 4.3: Update the intro paragraph above the calculator (around line 423)**

Before:
```html
<p>Marblehead's total residential assessed value is approximately $9.9 billion, and the override of $2,298,575 translates to roughly $0.23 per $1,000 of assessed value added to the tax rate. The Board of Health's fallback fee is a flat $262 per household (or $281 assuming a 3% opt-out rate that raises the per-household cost). Both options are designed to raise approximately the same total revenue; they differ in who pays.</p>
```

After:
```html
<p>Marblehead's total residential assessed value is approximately $9.9 billion, and the override of $2,298,575 translates to roughly $0.23 per $1,000 of assessed value added to the tax rate. The Board of Health's fallback fee is a flat $281 per household. That figure is the Health Department's $262 base estimate adjusted for an assumed 3% opt-out rate. Both options are designed to raise approximately the same total revenue; they differ in who pays.</p>
```

- [ ] **Step 4.4: Update the break-even paragraph (around line 486)**

Before:
```html
<p>The break-even point, where the two options cost the same, is at roughly $1,140,000 in assessed value. Below that, the levy is cheaper; above it, the flat fee is cheaper. The median single-family home in Marblehead is assessed at $1,010,000, so the typical homeowner pays slightly less under the levy. The average single-family assessment of $1,291,000 is skewed upward by a smaller number of high-value properties, so the average homeowner pays slightly less under the fee.</p>
```

After:
```html
<p>The break-even point, where the two options cost the same, is at roughly $1,210,000 in assessed value. Below that, the levy is cheaper; above it, the flat fee is cheaper. The median single-family home in Marblehead is assessed at $1,010,000, so the typical homeowner pays slightly less under the levy. The average single-family assessment of $1,291,000 is skewed upward by a smaller number of high-value properties, so the average homeowner pays slightly less under the fee.</p>
```

(Only the `$1,140,000` → `$1,210,000` number changes. The rest of the paragraph stays accurate with the new fee.)

- [ ] **Step 4.5: Update the regressivity paragraph (around line 488)**

Before:
```html
<p>A note on the shape of the choice: the flat fee is regressive compared to the levy. A household in a $500,000 home pays the same $262 as a household in a $3 million home. Under the levy, the $3 million home pays $699 (nearly 2.7 times the flat fee) while the $500,000 home pays $117 (less than half the flat fee). Whether that progressive distribution is better or worse depends on who you think should bear the cost.</p>
```

After:
```html
<p>A note on the shape of the choice: the flat fee is regressive compared to the levy. A household in a $500,000 home pays the same $281 as a household in a $3 million home. Under the levy, the $3 million home pays $699 (about 2.5 times the flat fee) while the $500,000 home pays $117 (less than half the flat fee). Whether that progressive distribution is better or worse depends on who you think should bear the cost.</p>
```

Changes:
- `$262` → `$281` (one occurrence)
- `nearly 2.7 times` → `about 2.5 times` (699 / 281 ≈ 2.49)
- `less than half the flat fee` unchanged (117 / 281 ≈ 0.42, still less than half)

- [ ] **Step 4.6: Update the peer-trash table Marblehead FY27 row (around line 526)**

Before:
```html
    <tr>
      <td><strong>Marblehead (FY27, either Q2 outcome)</strong></td>
      <td>Either a dedicated levy line (Q2 yes) or a Board of Health household fee (Q2 no). Plus the remaining Waste Collection budget for landfill, transfer station, and operational costs.</td>
      <td>$262&ndash;$281/yr flat fee, or levy scaling with home value</td>
    </tr>
```

After:
```html
    <tr>
      <td><strong>Marblehead (FY27, either Q2 outcome)</strong></td>
      <td>Either a dedicated levy line (Q2 yes) or a Board of Health household fee (Q2 no). Plus the remaining Waste Collection budget for landfill, transfer station, and operational costs.</td>
      <td>$281/yr flat fee (opt-out adjusted), or levy scaling with home value</td>
    </tr>
```

- [ ] **Step 4.7: Update the "Distributional calculation" sources paragraph (around line 578)**

Before:
```html
  <p><strong>Distributional calculation.</strong> Marblehead's total residential assessed value is estimated at approximately $9.9 billion based on the FY26 residential tax rate of $8.56 per $1,000 and the total residential levy of roughly $84.6 million (95.5% of the $88.6 million total tax levy per <a href="https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=propertytaxinformation.taxlevies.leviesbyclass">MA DOR Tax Levies by Class FY2026</a>). Adding $2,298,575 to that base gives a rate increase of approximately $0.23 per $1,000 of assessed value, applied to each home's assessment to produce the table above. Median and average single-family assessments ($1,010,000 and $1,291,000 respectively) are from the FY26 tax classification hearing.</p>
```

After:
```html
  <p><strong>Distributional calculation.</strong> Marblehead's total residential assessed value is estimated at approximately $9.9 billion based on the FY26 residential tax rate of $8.56 per $1,000 and the total residential levy of roughly $84.6 million (95.5% of the $88.6 million total tax levy per <a href="https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=propertytaxinformation.taxlevies.leviesbyclass">MA DOR Tax Levies by Class FY2026</a>). Adding $2,298,575 to that base gives a rate increase of approximately $0.23 per $1,000 of assessed value, applied to each home's assessment to drive the calculator above. The flat fee figure of $281 is the Health Department's base estimate of $262 per household adjusted for an assumed 3% opt-out rate. Median and average single-family assessments ($1,010,000 and $1,291,000 respectively) are from the FY26 tax classification hearing.</p>
```

Changes:
- `to produce the table above` → `to drive the calculator above`
- New sentence added explaining the $281/$262 relationship (since the calculator now shows $281 and readers may want the methodology).

- [ ] **Step 4.8: Verify no remaining `$262` references that shouldn't be there**

Run a search to audit remaining `$262` references:

```bash
cd /Users/agbaber/marblehead/.worktrees/q2-trash-calculator
grep -n '\$262' question-2-trash.html
```

Expected output: exactly **three** remaining matches:
1. The intro paragraph (Step 4.3 revised version) — the phrase `"$262 base estimate"` is now in explanatory context, not a current-fact claim
2. The regressivity paragraph already removed its `$262`, so should NOT appear (verify this line isn't in the grep)
3. The sources paragraph (Step 4.7 revised version) — `"$262 per household adjusted"` explanatory context
4. Line 577 (roughly) — the `$262 trash fee` inside the Marblehead Independent headline URL and article title, which is a literal news quotation and MUST stay

Count: should be exactly 3 matches. If there are more, grep each and decide whether it's a legitimate explanatory mention or a missed edit.

If there are fewer than 3 or the matches look wrong, re-check Steps 4.3 and 4.7.

- [ ] **Step 4.9: Reload the page and read through the full article**

Hard-refresh `http://localhost:4000/question-2-trash.html` and read the page top to bottom. Specifically confirm:

- Key-stat at top shows `$281 · Flat fee`.
- TL;DR paragraph says `$281 per household` with the $262 base-estimate explanation.
- Calculator intro paragraph says `$281 per household` with the base-estimate explanation.
- Calculator renders correctly (from Task 2).
- Break-even paragraph says `$1,210,000`.
- Regressivity paragraph says `$281` and `about 2.5 times`.
- Peer-trash table Marblehead FY27 row says `$281/yr flat fee (opt-out adjusted)`.
- Sources paragraph says `drive the calculator above` and includes the $262/$281 methodology note.
- Other paragraphs (Question 2 decides, Already decided, How trash has been funded, Why this changed for FY27, budget-shift diagram, peer-trash table for other towns, long-term alternatives, what the trickiness concern is, what this page does not cover) are unchanged.

- [ ] **Step 4.10: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/q2-trash-calculator
git add question-2-trash.html
git commit -m "$(cat <<'EOF'
Align Q2 page prose on $281 opt-out-adjusted fee

Switches the canonical fee number from $262 (Health Department base
estimate) to $281 (adjusted for a 3% opt-out rate, what a paying
household actually owes). Updates the key-stat, TL;DR, intro paragraph,
break-even figure, regressivity multiplier, peer-trash row, and sources
paragraph to match.

Break-even recomputed to ~$1,210,000 (was $1,140,000 at the lower fee).
Regressivity multiplier recomputed to ~2.5x (was 2.7x).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update override calculator footnote 4

**Goal:** Keep `charts/override_calculator.html` consistent with the new $281 fee by updating the monthly figure in footnote 4.

**Files:**
- Modify: `charts/override_calculator.html` (line ~83, one number change)

### Steps

- [ ] **Step 5.1: Locate footnote 4**

Open `charts/override_calculator.html`. Find the `.footnotes` block near line 79. Footnote 4 is the last `<p>` inside that block and currently reads:

```html
    <p><span class="footnote-marker"></span>Trash/recycling (Question 2) is not included above. You'll pay for it either way: as a levy increase (~$19/mo on a $1M home) or as a flat fee (~$22/mo per household) if the override fails. See <a href="../question-2-trash.html">Question 2: trash funding</a> for the full distributional table and context.</p>
```

- [ ] **Step 5.2: Update the monthly figure and correct the "distributional table" wording**

Before:
```html
    <p><span class="footnote-marker"></span>Trash/recycling (Question 2) is not included above. You'll pay for it either way: as a levy increase (~$19/mo on a $1M home) or as a flat fee (~$22/mo per household) if the override fails. See <a href="../question-2-trash.html">Question 2: trash funding</a> for the full distributional table and context.</p>
```

After:
```html
    <p><span class="footnote-marker"></span>Trash/recycling (Question 2) is not included above. You'll pay for it either way: as a levy increase (~$19/mo on a $1M home) or as a flat fee (~$23/mo per household) if the override fails. See <a href="../question-2-trash.html">Question 2: trash funding</a> for the full personal-cost calculator and context.</p>
```

Changes:
- `~$22/mo per household` → `~$23/mo per household` ($281 / 12 ≈ $23.42, rounds to $23)
- `full distributional table` → `full personal-cost calculator` (the target page no longer has a table, it has the calculator)

- [ ] **Step 5.3: Reload and verify**

Hard-refresh `http://localhost:4000/charts/override_calculator.html`. Scroll to the footnotes block at the bottom.

Expected: Footnote 4 reads `"...as a flat fee (~$23/mo per household)..."` and `"...full personal-cost calculator and context."`

Click the link and confirm it navigates to the Q2 trash page and the calculator is visible there.

- [ ] **Step 5.4: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/q2-trash-calculator
git add charts/override_calculator.html
git commit -m "$(cat <<'EOF'
Update override calc footnote for $281 trash fee

Footnote 4 referenced ~$22/mo per household (derived from the $262 base
estimate). Bumps to ~$23/mo ($281 / 12) and updates the linked target
description from "distributional table" to "personal-cost calculator"
since the Q2 page no longer has a static table.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Full end-to-end verification

**Goal:** Run through the full verification checklist from the design spec one last time before the branch is ready for push/PR. No code changes, no commit — just confirm everything works end to end.

**Files:** None modified.

### Steps

- [ ] **Step 6.1: Cold-load the Q2 trash page**

Open an incognito / private browser window. Navigate to `http://localhost:4000/question-2-trash.html` (so `localStorage` is empty).

Expected on first render:
- Key-stat block at top shows `$2.30M · Override ask`, `$281 · Flat fee`, `$1.21M · Break-even value`, `~$1M · Contract growth`. (Both the flat fee and break-even values should have been updated in Task 4 Step 4.1.)
- If either key-stat still shows the old value, return to Task 4 Step 4.1 and fix before continuing.

- [ ] **Step 6.2: Verify default calculator render matches the spec's verification step 2**

With the incognito window on the Q2 page, the calculator should show:
- Input: `$1,291,507`
- Levy card: `$300/yr`, `$25/mo`
- Fee card: `$281/yr`, `$23/mo`
- Levy median context: `$235/yr`
- Levy average context: `$300/yr`
- Delta: *"At your home value, the flat fee costs $19 less per year than the levy."*

- [ ] **Step 6.3: Run each calculator test value from the spec**

In order:
1. Enter `1,010,000` → Levy `$235/yr`, delta *"the levy costs $46 less per year than the flat fee"*
2. Enter `1,208,000` → Levy `$281/yr`, delta *"the two options cost about the same"*
3. Enter `500,000` → Levy `$116/yr`, delta *"the levy costs $165 less per year than the flat fee"*
4. Enter `3,000,000` → Levy `$698/yr`, delta *"the flat fee costs $417 less per year than the levy"*

- [ ] **Step 6.4: Verify cross-page persistence**

With the Q2 calculator showing `$3,000,000`, navigate in the same tab to `http://localhost:4000/charts/override_calculator.html`. The override calculator's input should show `$3,000,000`.

Change it to `$900,000` on the override calculator and blur. Navigate back to `question-2-trash.html`. The Q2 calculator should show `$900,000`.

- [ ] **Step 6.5: Mobile visual check**

In browser devtools, set viewport to 375px wide. Reload both pages. Confirm:
- Q2 calculator cards stack vertically, input full-width, numbers legible, no horizontal scroll
- Peer-trash table below the calculator still renders correctly with tight padding
- Override calculator page also still renders correctly at 375px (regression check)

- [ ] **Step 6.6: Spot-check the Q2 prose edits at 375px**

On mobile width, scroll through the Q2 page and verify every prose edit from Task 4:
- Key-stat `$281 · Flat fee`
- TL;DR `$281 per household` wording
- Intro paragraph above calculator
- Break-even paragraph `$1,210,000`
- Regressivity paragraph `$281` and `about 2.5 times`
- Peer-trash Marblehead FY27 row `$281/yr flat fee (opt-out adjusted)`
- Sources paragraph `drive the calculator above`

- [ ] **Step 6.7: Check git log and final diff**

```bash
cd /Users/agbaber/marblehead/.worktrees/q2-trash-calculator
git log --oneline origin/main..HEAD
git diff origin/main..HEAD --stat
```

Expected: 5 commits (one per Task 1–5, plus any Step 6.1 follow-up commit), touching `question-2-trash.html` and `charts/override_calculator.html`. Plus the earlier spec commit from brainstorming (`docs/superpowers/specs/2026-04-11-q2-trash-calculator-design.md`). And the plan commit (`docs/superpowers/plans/2026-04-11-q2-trash-calculator-implementation.md`) if it was committed before execution started.

- [ ] **Step 6.8: Summary**

Report to the user:
- All tasks completed and verified
- Any spec gaps encountered (e.g., the Step 6.1 key-stat break-even question)
- Ready to push branch `q2-trash-calculator` and open a PR (per CLAUDE.md's "always open a PR after pushing" rule)
- Ask whether to push+PR now or hold for further review
