# Question 2 trash calculator — design

**Status:** brainstormed, pending user review
**Date:** 2026-04-11
**Author:** Claude Code (brainstorming session with Andrew)

## Problem

`question-2-trash.html` explains the Q2 ballot choice (levy increase vs. flat
Board of Health fee) and shows a static 8-row distributional table covering
home values from $500K to $3M. The table is useful context but does not
answer the question a reader wants answered: *"what does this cost me at my
home value?"* Readers have to eyeball the nearest row and interpolate.

The existing `charts/override_calculator.html` page already solves the same
"what does this cost me" problem for Question 1 (the operating override). Its
footnote 4 hand-waves Q2 back to the static table on `question-2-trash.html`,
so there is a direct asymmetry: Q1 has a personal calculator, Q2 does not.

## Goals

1. Let a reader enter their assessed value and immediately see the personal
   dollar cost under each Q2 outcome (levy passes vs. fee imposed).
2. Preserve the site's strict neutrality rule: no "vote yes / vote no"
   verdict, no green/red value judgments, no moralized framing.
3. Make the distributional fact of the choice (levy scales with home value,
   fee is flat) visible at the reader's own value without re-teaching
   material the page's prose already handles.
4. Be cheap to maintain: no new build step, no new JS files, no new shared
   CSS component, vanilla JS matching the existing override calculator
   pattern.

## Non-goals

- No flowchart / decision tree for Q1. Q1 has too many variables (tier
  combinations, service priorities, senior exemption eligibility pending
  H.4225) to reduce to a widget without smuggling in judgment. A future
  conversation can revisit this once Q2 is shipped.
- No equity preference toggle. The user's values are not a UI input on this
  site. The prose below the calculator handles the "who pays" framing; the
  calculator stays mechanical.
- No pay-as-you-throw cost calculator, no peer-town fee lookup, no
  assessed-value autocomplete from the town portal. Out of scope.
- No analytics, event tracking, or input telemetry.

## Placement

The calculator is embedded directly inside `question-2-trash.html`, replacing
the existing `.dist-table` block inside the section titled *"What each
outcome costs residents, by home value."*

- The intro paragraph above the table (the `$0.23 per $1,000` methodology
  sentence) stays in place as the methodological anchor, with a small
  edit updating the fee reference from `$262` to `$281` (see Retroactive
  edits §3).
- The regressivity paragraph below the table (the one containing the
  concrete `$500K → $117` and `$3M → $699` bookends) stays in place, with
  small updates to its fee references and the `2.7x` → `2.5x` multiplier
  (see Retroactive edits §6). Its concrete `$500K` and `$3M` levy numbers
  ($117, $699) are preserved in prose rather than deleted; the calculator
  does not try to duplicate them.
- The break-even paragraph gets a recomputed figure ($1,140,000 →
  $1,210,000) driven by the fee change (Retroactive edits §5).
- No section headings move. The page structure, peer town table,
  alternatives section, `what this page does not cover`, and most of the
  sources block are untouched. See Retroactive edits for the full list of
  in-place text changes.

A standalone calculator page at `charts/trash_calculator.html` was
considered and rejected. The Q2 narrative page is already the reader's
destination for this decision; splitting the calculator onto a separate page
would create a split-brain "calculator here, context there" problem without
meaningful upside.

## Retroactive edits alongside the calculator

Switching the canonical fee figure from $262 to $281 ripples across the
existing page content in several places. All of these edits happen in the
same change so the site stays internally consistent with the calculator.

1. **Key-stat on `question-2-trash.html` (line 305).** `.key-stat-value`
   currently shows `$262`. Change to `$281`. The label `Flat fee` stays.
2. **TL;DR paragraph in `.trash-tldr` (line 335).** Currently says *"a
   flat curbside fee of roughly $262–$281 per household."* Tighten to *"a
   flat curbside fee of roughly $281 per household (the Health Department's
   $262 base estimate adjusted for a 3% opt-out rate)."*
3. **Intro paragraph above the old table (line 423).** Currently says
   *"The Board of Health's fallback fee is a flat $262 per household (or
   $281 assuming a 3% opt-out rate that raises the per-household cost)."*
   Change to *"The Board of Health's fallback fee is a flat $281 per
   household — the Health Department's $262 base estimate adjusted for an
   assumed 3% opt-out rate."* (No em-dash: use a period break instead.
   Revised: *"The Board of Health's fallback fee is a flat $281 per
   household. That figure is the Health Department's $262 base estimate
   adjusted for an assumed 3% opt-out rate."*)
4. **Delete the `.dist-table` HTML block** (roughly lines 425–484, about
   60 lines of `<thead>`/`<tbody>` markup) and its associated CSS rules in
   the page-scoped `<style>` block (`.dist-table`, `.dist-table th`,
   `.dist-table td`, `.dist-table tr.median td::after`, `.dist-table
   tr.avg td::after`, `.dist-table td.cheaper`, and the mobile media-query
   entries). The CSS is only used by that one table and becomes dead code
   after deletion.
5. **Break-even paragraph (line 486).** Currently says *"The break-even
   point, where the two options cost the same, is at roughly $1,140,000 in
   assessed value."* At the $281 fee, break-even moves to approximately
   $1,208,000 (`$281 / 0.0002326 ≈ $1,208,083`). Change to *"roughly
   $1,210,000 in assessed value."* The next sentence *"The median
   single-family home in Marblehead is assessed at $1,010,000, so the
   typical homeowner pays slightly less under the levy"* stays accurate
   (median is still below break-even). The sentence about the average home
   paying slightly less under the fee also stays accurate, though the gap
   narrows from $38 to $19 — the word *slightly* fits better than before.
6. **Regressivity paragraph (line 488).** Currently says *"A household in
   a $500,000 home pays the same $262 as a household in a $3 million home.
   Under the levy, the $3 million home pays $699 (nearly 2.7 times the flat
   fee) while the $500,000 home pays $117 (less than half the flat fee)."*
   Three updates, all driven by the fee change:
   - `$262` → `$281`
   - `nearly 2.7 times the flat fee` → `about 2.5 times the flat fee`
     (`$699 / $281 ≈ 2.49`)
   - `less than half the flat fee` stays accurate (`$117 / $281 ≈ 0.42`)
7. **Peer-trash table row for Marblehead FY27 (line 526).** Currently shows
   `$262–$281/yr flat fee, or levy scaling with home value` in the
   rightmost column. Tighten to `$281/yr flat fee (opt-out adjusted), or
   levy scaling with home value`.
8. **Sources paragraph (line 578).** Currently says *"applied to each
   home's assessment to produce the table above."* Change to *"applied to
   each home's assessment to drive the calculator above."*
9. **Footnote 4 on `charts/override_calculator.html`.** Currently reads
   `~$22/mo per household`. Update to `~$23/mo per household` to reflect
   the $281 annual figure (`$281 / 12 ≈ $23.42`).

**Not touched:** the ballot question box (it quotes the actual ballot text,
sacred), the `.already-decided` callout, the `.budget-shift` diagram, the
`How trash has been funded` and `Why this changed for FY27` sections, the
peer-trash table rows for other towns, the long-term alternatives section,
the *"what the trickiness concern is actually about"* section, the
*"what this page does not cover"* section, the rest of the sources block,
and the `$262` reference inside the Marblehead Independent headline URL in
the sources paragraph (that's a literal quotation of a news article title,
not a site claim — it stays as the source published it).

## Data sources and constants

Every number in the calculator traces to a primary source in line with the
project's "every number must trace to a primary source" rule.

| Constant | Value | Source |
|---|---|---|
| `Q2_LEVY_TOTAL` | `2298575` | `data/2026-04-08_Override_Presentation.pdf` slide 20 (ballot question text) |
| `RESIDENTIAL_BASE` | `9880000000` | MA DOR Tax Levies by Class FY2026: $84.6M residential levy / $8.56 per $1000 residential rate |
| `LEVY_RATE_PER_1000` | derived: `Q2_LEVY_TOTAL / (RESIDENTIAL_BASE / 1000)` ≈ `$0.2326` | computed from the two above |
| `FLAT_FEE` | `281` | Marblehead Current, *"Health Department estimates $281 for trash fee; BoH approves budgets"* (2026-03-25). Base $262 estimate adjusted for 3% opt-out assumption. |
| `MEDIAN_ASSESSED` | `1010000` | FY26 tax classification hearing, already cited on the page |
| `AVG_ASSESSED` | `1291507` | Same as above; also the default input value on the override calculator |
| `STORAGE_KEY` | `'mh_override_calc_assessed_value'` | Shared with `charts/override_calculator.html` so assessed value carries across both calculators |

### Why $281 rather than $262

The Board of Health's base estimate is $262/household assuming 100%
participation. The town's planning model adjusts this upward to $281 to
account for an assumed 3% opt-out rate (residents who use the transfer
station sticker program instead). $281 is the number a paying household
would actually owe if Q2 fails; $262 is an intermediate methodological step.
The calculator's job is *"what does this cost me,"* so the actually-billed
number is the correct one. The key-stat and footnote edits above bring the
rest of the site into consistency with this choice.

## Input

Single text input, matching `.calc-input` from the override calculator
exactly:

- `<label for="trash-assessed">Your assessed value</label>`
- `<input id="trash-assessed" type="text" inputmode="numeric">`
- Hint line: `"Don't know it? Look it up on the town's tax portal."` with
  the same link to `https://epay.cityhallsystems.com/selection` that the
  override calculator uses.
- Secondary hint: `"Defaults to the town's average single-family value."`
- Default value: `AVG_ASSESSED` = $1,291,507
- Persistence: shared `localStorage` key
  `mh_override_calc_assessed_value`. On load, check storage; fall back to
  `AVG_ASSESSED` if empty or unparseable. On input, save to storage.
- Behavior: live update on `input` event, reformat with `$` and commas on
  `blur`.

The input ID is `trash-assessed` (not `assessed-value` as on the override
calculator page) to avoid any accidental collision if the two calculators
are ever embedded on the same page in the future. The shared storage key
lives in JavaScript, not the DOM, so this naming difference is safe.

## Output — two scenario cards

Two scenario cards, side-by-side on desktop, stacked on mobile. Each card
presents one ballot outcome. Both cards use identical neutral styling
(`var(--surface)` background, `var(--border)` border, `var(--radius-md)`
corners, `var(--shadow-sm)` shadow). No green/red, no "winner" highlight,
no tinted backgrounds.

### Card 1 — "If Question 2 passes"

- Sub-label: `"Levy increase, scales with home value"`
- Primary number: user's annual levy cost, computed as
  `(assessedValue / 1000) * LEVY_RATE_PER_1000`, displayed as e.g.
  `$235/yr`. Rounded to whole dollars.
- Secondary line: monthly equivalent, `$20/mo`. Rounded.
- Context lines (subdued text):
  - `Median home ($1.01M): $235/yr`
  - `Average home ($1.29M): $300/yr`
- Context lines are static — they do not change with user input. They are
  computed once at page load from `MEDIAN_ASSESSED` and `AVG_ASSESSED` and
  left in place for reference.

### Card 2 — "If Question 2 fails"

- Sub-label: `"Flat Board of Health fee, same for every household"`
- Primary number: `$281/yr` — static, same for every household.
- Secondary line: `$23/mo`.
- Context lines (subdued text):
  - `Median home: $281/yr`
  - `Average home: $281/yr`
- The deliberately identical context lines are the point: they make
  visible, without prose, that the fee does not vary with home value.

### Delta sentence below both cards

A single plain sentence reflecting the user's specific cost comparison:

- If `userLevy < fee - 10`:
  `"At your home value, the levy costs $X less per year than the flat fee."`
- If `userLevy > fee + 10`:
  `"At your home value, the flat fee costs $X less per year than the levy."`
- Otherwise:
  `"At your home value, the two options cost about the same."`

The $10 tolerance around break-even prevents a $1 flicker at the threshold.
No "you save" framing, no "cheaper" highlighting, no color emphasis. Pure
factual comparison.

## Math

```javascript
function levyCost(assessedValue) {
  return (assessedValue / 1000) * LEVY_RATE_PER_1000;
}

function deltaSentence(userLevy, fee) {
  const diff = fee - userLevy;
  if (Math.abs(diff) < 10) {
    return 'At your home value, the two options cost about the same.';
  }
  if (diff > 0) {
    return `At your home value, the levy costs ${money(diff)} less per year than the flat fee.`;
  }
  return `At your home value, the flat fee costs ${money(-diff)} less per year than the levy.`;
}
```

All dollar values rounded to whole dollars via the `money()` helper
(`'$' + Math.round(n).toLocaleString('en-US')`), matching the override
calculator's convention. Monthly = `Math.round(annual / 12)`.

### Sanity check against the existing static table

With `LEVY_RATE_PER_1000 = $0.2326`:

| Home value | Calculated | Existing table | Note |
|---|---|---|---|
| $500,000 | $116 | $117 | ±$1 from existing table's $0.23 rounding |
| $1,010,000 (median) | $235 | $235 | exact |
| $1,291,000 (avg) | $300 | $301 | ±$1 |
| $3,000,000 | $698 | $699 | ±$1 |

The $1 discrepancies come from the existing table using a pre-rounded $0.23
rate. The calculator uses the un-rounded `LEVY_RATE_PER_1000`. This is fine
because the existing table is being deleted; no inconsistency remains on the
page. The sources block paragraph that mentions `"approximately $0.23 per
$1,000"` stays accurate because it says *approximately*.

## DOM structure

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

`<h3>` is used for card labels to match the page's existing heading
hierarchy (`<h2>` for section headings, `<h3>` for subsections).

## CSS

All new styles go in the page-scoped `<style>` block at the top of
`question-2-trash.html`, alongside the existing `.trash-tldr`,
`.budget-shift`, `.peer-trash`, etc. blocks.

- `.calc-input` and its children: copied from
  `charts/override_calculator.html` verbatim. Not lifted into
  `assets/site.css`: with only two calculators on the site, duplicating ~25
  lines is cheaper than creating a shared component.
- `.q2-calc` container: `margin: 20px 0 26px;`
- `.q2-calc-cards`: `display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px; margin: 18px 0;`
- `.q2-calc-card`: `background: var(--surface); border: 1px solid
  var(--border); border-radius: var(--radius-md); padding: 20px 22px;
  box-shadow: var(--shadow-sm);`
- `.q2-calc-card-label`: `font-size: 15px; font-weight: 700; color:
  var(--text); margin: 0 0 4px;` (h3 tag, tight)
- `.q2-calc-card-sub`: `font-size: 12px; color: var(--text-subtle);
  margin-bottom: 14px; line-height: 1.4;`
- `.q2-calc-card-primary`: `font-size: 28px; font-weight: 700; color:
  var(--text); font-variant-numeric: tabular-nums; line-height: 1.1;`
- `.q2-calc-card-unit`: `font-size: 14px; font-weight: 500; color:
  var(--text-subtle); margin-left: 2px;`
- `.q2-calc-card-monthly`: `font-size: 13px; color: var(--text-subtle);
  font-variant-numeric: tabular-nums; margin-top: 4px;`
- `.q2-calc-card-context`: `margin-top: 14px; padding-top: 12px;
  border-top: 1px solid var(--divider); font-size: 12px; color:
  var(--text-subtle); line-height: 1.7; font-variant-numeric:
  tabular-nums;`
- `.q2-calc-delta`: `font-size: 14px; color: var(--text-muted); text-align:
  center; margin: 6px 0 0; font-style: italic;`

Mobile breakpoint (`max-width: 600px`) adds:
- `.q2-calc-cards { grid-template-columns: 1fr; gap: 10px; }`
- `.q2-calc-card { padding: 16px 18px; }`
- `.q2-calc-card-primary { font-size: 24px; }`

The existing `@media (max-width: 600px)` block at the bottom of the page's
`<style>` gets the additions appended.

### Palette compliance

Per `STYLE_GUIDE.md`: no inline `style=""` attributes on SVG (there is no
SVG in this calculator), palette uses `var(--surface)`, `var(--border)`,
`var(--text)`, `var(--text-subtle)`, `var(--text-muted)`, `var(--divider)`,
`var(--radius-md)`, `var(--shadow-sm)` — all existing tokens. No new color
tokens introduced. No em-dashes in any copy (the delta sentences use plain
"less per year than" phrasing; ballot labels use period breaks).

## JavaScript

Inline `<script>` at the bottom of `question-2-trash.html`, matching the
pattern on `charts/override_calculator.html`. Approximately 70 lines.

Structure:

```javascript
// Constants (see Data sources and constants table above)
const Q2_LEVY_TOTAL = 2298575;
const RESIDENTIAL_BASE = 9880000000;
const LEVY_RATE_PER_1000 = Q2_LEVY_TOTAL / (RESIDENTIAL_BASE / 1000);
const FLAT_FEE = 281;
const MEDIAN_ASSESSED = 1010000;
const AVG_ASSESSED = 1291507;
const STORAGE_KEY = 'mh_override_calc_assessed_value';

// Helpers
function money(n) { /* ... */ }
function parseAssessed(raw) { /* ... */ }
function formatInput(n) { /* ... */ }
function loadStored() { /* ... */ }
function saveStored(value) { /* ... */ }

// Core math
function levyCost(assessedValue) { /* ... */ }
function deltaSentence(userLevy, fee) { /* ... */ }

// Render
function update() {
  const input = document.getElementById('trash-assessed');
  const value = parseAssessed(input.value);
  saveStored(value);
  const userLevy = levyCost(value);
  document.getElementById('levy-annual').textContent = money(userLevy);
  document.getElementById('levy-monthly').textContent = money(userLevy / 12);
  document.getElementById('delta-sentence').textContent = deltaSentence(userLevy, FLAT_FEE);
  // Median and average context lines are computed once at init, not on every update.
}

// Init: compute static context lines, wire events, render once
(function init() {
  document.getElementById('levy-median-out').textContent =
    money(levyCost(MEDIAN_ASSESSED)) + '/yr';
  document.getElementById('levy-avg-out').textContent =
    money(levyCost(AVG_ASSESSED)) + '/yr';

  const input = document.getElementById('trash-assessed');
  const stored = loadStored();
  if (stored !== null) input.value = formatInput(stored);
  input.addEventListener('input', update);
  input.addEventListener('blur', () => {
    input.value = formatInput(parseAssessed(input.value));
    update();
  });
  update();
})();
```

`money()`, `parseAssessed()`, `formatInput()`, `loadStored()`, and
`saveStored()` are duplicated from the override calculator rather than
factored out. They are small, and the two calculators live in different
files, so inlining them keeps each page self-contained. This matches how
the rest of the site handles small helpers.

## Edge cases

- Empty input → falls back to `AVG_ASSESSED` on update, reformats to
  `$1,291,507` on blur.
- Non-numeric characters → stripped by `replace(/[^0-9.]/g, '')`, then
  parsed.
- Zero or negative → falls back to `AVG_ASSESSED`.
- Very large values ($100M+) → calculated correctly, no upper clamp.
- Pasted value with commas and `$` → cleaned and parsed normally.
- No separate validation messaging. Bad input silently resolves to the
  default, matching the override calculator's behavior.

## Accessibility

- `<label for="trash-assessed">` associates the label with the input.
- The existing `.calc-input input:focus` rule provides a visible focus
  ring via `box-shadow: 0 0 0 3px color-mix(in srgb, var(--link) 22%,
  transparent)`.
- Card labels use `<h3>` so screen readers pick up the heading hierarchy.
- The delta sentence is plain text in a `<p>`, read naturally.
- No `aria-live` needed — the user is driving the updates via their own
  keystrokes.

## Verification steps

Once implemented:

1. `bundle exec jekyll serve` and open
   `http://localhost:4000/question-2-trash.html`.
2. Default render (AVG_ASSESSED): levy card shows `$300/yr · $25/mo`, fee
   card shows `$281/yr · $23/mo`, delta reads *"At your home value, the
   flat fee costs $19 less per year than the levy."*
3. Enter `1,010,000` (median): levy card shows `$235/yr · $20/mo`, delta
   reads *"At your home value, the levy costs $46 less per year than the
   flat fee."*
4. Enter `1,208,000` (approximate break-even): levy card shows ~$281,
   delta reads *"At your home value, the two options cost about the
   same."*
5. Enter `500,000`: levy card shows `$116/yr`, delta reads *"At your home
   value, the levy costs $165 less per year than the flat fee."*
6. Enter `3,000,000`: levy card shows `$698/yr`, delta reads *"At your
   home value, the flat fee costs $417 less per year than the levy."*
7. Persistence: enter a value, navigate to
   `http://localhost:4000/charts/override_calculator.html`, confirm the
   value carries over. Then change it on the override calculator,
   navigate back, confirm it carries back.
8. Mobile layout: resize to 375px width. Confirm cards stack vertically,
   font sizes tighten, no horizontal overflow.
9. Key-stat: confirm the page header now shows `$281 · Flat fee` instead
   of `$262`.
10. Footnote on override calculator: confirm footnote 4 shows
    `~$23/mo per household`.

## Build and dependency notes

- No `_config.yml` changes. Jekyll rebuilds automatically.
- No new files created. All changes are edits to
  `question-2-trash.html` and one number on
  `charts/override_calculator.html`.
- No new JS dependencies. Vanilla JS, inline `<script>`, no imports.
- No new CSS dependencies. All styles use existing design tokens in
  `assets/site.css`.
- `citations.js` is already loaded via `_includes/head.html` — unchanged.

## Scope estimate

- **Added (new calculator):** ~50 lines HTML, ~80 lines CSS, ~70 lines JS
  in `question-2-trash.html`.
- **Edited (retroactive prose edits on `question-2-trash.html`):** ~8
  small in-place text edits spanning the key-stat (§1), the TL;DR
  paragraph (§2), the intro paragraph above the calculator (§3), the
  break-even paragraph (§5), the regressivity paragraph (§6), the
  peer-trash table Marblehead FY27 row (§7), and the sources paragraph
  (§8). Most are one-line or single-phrase changes.
- **Edited (retroactive on `charts/override_calculator.html`):** 1 line
  (footnote 4 dollar figure) per Retroactive edits §9.
- **Deleted:** ~60 lines HTML (the `.dist-table` block) and ~50 lines
  CSS (the `.dist-table` rules and its media-query entries) in
  `question-2-trash.html`.
- **Net diff:** slightly positive — the calculator HTML/CSS/JS is a bit
  larger than the deleted table, but the retroactive prose edits are
  near-zero line delta.
- **New files:** none.

## Out of scope / future work

- Q1 override flowchart / decision tree — separate conversation once Q2
  ships. Q1 has too many variables to reduce to a widget responsibly.
- Tax-portal lookup integration — stays as a plain link.
- PAYT or regional shared services cost modeling — the existing peer
  town section handles this narratively.
- Analytics on input usage — no.
