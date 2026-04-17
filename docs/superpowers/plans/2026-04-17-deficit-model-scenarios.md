# Deficit model scenario-set refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prune 4 existing scenarios in `charts/deficit_model.html`, add 5 new ones (A, C, D, E, G), copy-edit 3 existing (#3, #5, #11), add an `fy27Step` control, and update the tour step 7 caption. Leave the overall UX and tour structure intact.

**Architecture:** All work lives in one file (`charts/deficit_model.html`). Each new scenario is a preset button that resets sliders to defaults then applies specific values in the stance click handler (line 1889). The `fy27Step` input is a number input inside the existing `<details>` "Assumptions" block, wired into the `compute()` and `computeTiers()` functions as a one-time additive shock to the FY27 projected expense value that does not propagate into forward compounding. D's compound-cut logic runs inside its own preset branch and stores an additional per-year cut delta used by `compute()`.

**Tech Stack:** Static HTML, inline JS, SVG, Jekyll (frontmatter only, no liquid). No test framework beyond `tests/smoke-test.mjs` (Playwright against a live URL).

**Spec:** `docs/superpowers/specs/2026-04-17-deficit-model-scenarios-design.md`

**Related issues:** #595 (town-wide cuts-only forecast), #596 (stance-based reorganization).

---

### Task 0: Verify FY27 step value and FY27 gap against primary sources

This is a research task before any code. No commit. The goal is to pin the two load-bearing numbers used in scenarios A and E so the preset values are defensible.

**Files consulted (not modified):**
- `data/2026-04-15_Override_Presentation_FINAL.txt` (latest override deck)
- `data/2026-04-08_Override_Presentation.txt` (prior deck for cross-check)
- FY27 proposed budget file in `data/` (find it)
- `charts/healthcare_costs.html` (trend context)

- [ ] **Step 1: Locate and read the FY27 proposed budget file**

Run:

```bash
ls data/ | grep -i "budget\|fy27"
```

Identify the FY27 budget file, read it, and note the total projected FY27 expenses and the healthcare line item specifically.

- [ ] **Step 2: Extract FY26 healthcare and FY27 healthcare from primary sources**

Goal: confirm or correct the memory note "HC is $15.1M" (FY26) and "+11%" (FY27 increase). Look at the April 15 deck `data/2026-04-15_Override_Presentation_FINAL.txt` for the healthcare line items. Note the exact figures.

- [ ] **Step 3: Compute the FY27 step**

Given normalized expense growth rate `g_norm` (3.8% per spec), the FY27 step is:

```
step = FY27_healthcare_actual - (FY26_healthcare * (1 + g_norm))
```

Record the computed step value. This is the preset value for scenario A.

Expected range: roughly +$1.0M to +$1.5M depending on exact FY26 and FY27 healthcare figures. If the computed step falls outside $0.5M to $2.5M, re-check inputs rather than shipping an outlier.

- [ ] **Step 4: Confirm the FY27 gap figure ($8.47M)**

In the April 15 deck, locate the stated FY27 deficit. Confirm it matches $8.47M, or record the correct figure. This is the preset target for scenario E.

- [ ] **Step 5: Record the verified numbers**

Append a short note to the spec file documenting the two verified numbers, with source citations:

```bash
cd /Users/agbaber/marblehead/.worktrees/deficit-model-scenarios
# Edit docs/superpowers/specs/2026-04-17-deficit-model-scenarios-design.md
# Add a "## Verified numbers" section at the bottom with:
#   - FY27 step = $X.XM (source: April 15 deck, page Y; FY27 budget line Z)
#   - FY27 gap = $X.XM (source: April 15 deck, page Y)
#   - Derivation shown
```

No commit yet. These numbers are inputs to later tasks.

---

### Task 1: Prune 4 scenarios (#6 cost-slows, #7 new-growth, #9 override-plus-cuts, #10 kitchen-sink)

**Files:**
- Modify: `charts/deficit_model.html`

- [ ] **Step 1: Read current state of the stance button block**

Run:

```bash
sed -n '792,846p' charts/deficit_model.html
```

Verify the scenario cards are still at these locations before editing. If line numbers have shifted, re-locate using `grep -n 'data-stance' charts/deficit_model.html`.

- [ ] **Step 2: Remove the four card buttons from the HTML**

Delete these four `<button>` elements (matched exactly — the scenarios they represent):

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="cost-slows">
  <span class="dm-scenario-title">Cost growth slows to 3%</span>
  <span class="dm-scenario-desc">If GIC moderates and contracts stay restrained, lines run roughly parallel.</span>
</button>
```

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="new-growth">
  <span class="dm-scenario-title">More new development</span>
  <span class="dm-scenario-desc">Revenue growth at 4.5% from sustained construction and new growth.</span>
</button>
```

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="override-plus-cuts">
  <span class="dm-scenario-title">Override + modest cuts</span>
  <span class="dm-scenario-desc">$12M override plus 20 position cuts.</span>
</button>
```

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="kitchen-sink">
  <span class="dm-scenario-title">Pull every lever</span>
  <span class="dm-scenario-desc">$15M, healthcare reform, position cuts, fast spending ramp.</span>
</button>
```

- [ ] **Step 3: Remove the corresponding `stanceNotes` entries**

Around line 1760 in the `var stanceNotes = { ... }` block, delete the four entries keyed `cost-slows`, `new-growth`, `override-plus-cuts`, `kitchen-sink`. Their values are the existing realism text for each (preserved here for matching):

```js
'cost-slows': 'A stronger version of "Hold the line": 1.0pp off expense growth rather than 0.5pp. Requires GIC premium growth to moderate (state-controlled) and contracts to settle meaningfully below COLA. Not sustained in the last 20 years.',
'new-growth': 'Revenue growth at 4.5% depends on sustained construction and new growth. Marblehead averaged about 1.3pp of new growth FY15 to FY24; pushing to 2pp+ is bounded by zoning and build-out.',
'override-plus-cuts': 'Override paired with visible service reductions. Voters may read the cuts as evidence the override is needed; opponents may read them as proof the town can absorb cuts.',
'kitchen-sink': 'Every lever pulled at once: override, healthcare, cuts, fast spending. Depends on voter, union, and state GIC cooperation simultaneously. More a thought experiment than a plan.',
```

- [ ] **Step 4: Remove the corresponding preset branches in the click handler**

In the stance click handler (starts around line 1889), delete these `else if` branches:

```js
} else if (s === 'cost-slows') {
  expGrowthEl.value = 3.0;
} else if (s === 'new-growth') {
  revGrowthEl.value = 4.5;
}
```

```js
} else if (s === 'override-plus-cuts') {
  overrideEl.value = 12;
  positionCuts = 20;
}
```

```js
} else if (s === 'kitchen-sink') {
  overrideEl.value = 15;
  hcShareEl.value = 65;
  wageOffsetEl.value = 50;
  positionCuts = 10;
  ratchetEl.value = 3;
}
```

- [ ] **Step 5: Verify nothing else references the pruned slugs**

Run:

```bash
grep -n "cost-slows\|new-growth\|override-plus-cuts\|kitchen-sink" charts/deficit_model.html
```

Expected: no matches. If any remain, investigate and remove.

- [ ] **Step 6: Verify the file still parses**

Open the file in a browser:

```bash
open charts/deficit_model.html
```

Check the browser dev tools console for JS errors. Check that the 8 remaining scenario cards render and that clicking each of them (pick a sample of 3) still updates the chart without errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/deficit-model-scenarios
git diff --stat charts/deficit_model.html
git add charts/deficit_model.html
git commit -m "$(cat <<'EOF'
Deficit model: prune 4 scenarios

Removes cost-slows (superseded by the forthcoming one-time healthcare
spike scenario), new-growth (superseded by commercial-only), and the
two kitchen-sink variants (override-plus-cuts, kitchen-sink) that
duplicate existing combinations.

Part of the scenario-set refresh. Spec:
docs/superpowers/specs/2026-04-17-deficit-model-scenarios-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: `1 file changed, <few lines> insertions(+), <more lines> deletions(-)`.

---

### Task 2: Copy edits to #3, #5, #11

**Files:**
- Modify: `charts/deficit_model.html`

- [ ] **Step 1: Update card HTML for scenario #3 (stance `cut`)**

Replace the existing card:

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="cut">
  <span class="dm-scenario-title">Cut 50 positions</span>
  <span class="dm-scenario-desc">~$5M/yr saved. Slope unchanged; gap reopens on the same schedule.</span>
</button>
```

With:

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="cut">
  <span class="dm-scenario-title">Current pace of cuts</span>
  <span class="dm-scenario-desc">About 50 positions over FY25 to FY27, roughly matching what the town has already done. Slope unchanged; gap keeps widening.</span>
</button>
```

- [ ] **Step 2: Update the `stanceNotes.cut` entry**

Replace the existing entry:

```js
'cut': 'Direct payroll reduction of roughly 10% of the town workforce. Lowers the level but does not flatten the slope. Service impact would be visible across every department.',
```

With:

```js
'cut': 'Roughly matches the FY25 to FY27 reductions already in place through layoffs, unfilled vacancies, and stipend reductions. Lowers the level but does not flatten the slope. The site\u2019s staffing analysis identifies 7 to 13 positions as the discretionary slice; further reductions reach mandate-adjacent roles or non-school departments (see inside-school-staffing.html#options).',
```

Note the `\u2019` for the right single quotation mark (apostrophe in `site's`) since the string is JS-literal.

- [ ] **Step 3: Update card HTML for scenario #5 (stance `hold-line`)**

Replace the existing card desc. Keep title. Replace:

```html
<span class="dm-scenario-desc">Expense growth matches revenue at 3.5%. Contracts at COLA, enrollment flat, no new programs.</span>
```

With:

```html
<span class="dm-scenario-desc">Expense growth drops to revenue growth (3.5%). Contracts at COLA, no new programs.</span>
```

The `stanceNotes['hold-line']` entry stays as-is (the existing realism note already specifies "healthcare enrollment to stay flat" which is the accurate reading).

- [ ] **Step 4: Update card HTML for scenario #11 (stance `no-override-reform`)**

Replace the existing card desc. Keep title. Replace:

```html
<span class="dm-scenario-desc">30 positions cut plus 65% healthcare share. No new revenue.</span>
```

With:

```html
<span class="dm-scenario-desc">65% healthcare share plus 30 positions cut. No new revenue.</span>
```

- [ ] **Step 5: Update the `stanceNotes['no-override-reform']` entry**

Replace:

```js
'no-override-reform': 'No new revenue; 30 position cuts plus healthcare concessions carry the full load. The hardest path politically: the largest non-override concessions with nothing offered in return.',
```

With:

```js
'no-override-reform': 'No new revenue; 30 position cuts plus healthcare concessions carry the full load. 30 positions is more than double the site\u2019s 7 to 13 discretionary estimate (see inside-school-staffing.html#options), so the cuts reach mandate-adjacent roles or non-school departments. The hardest path politically: the largest non-override concessions with nothing offered in return.',
```

- [ ] **Step 6: Verify no em-dashes in the diff**

Run:

```bash
git diff charts/deficit_model.html | grep -E "—|&mdash;|(\s)--(\s)"
```

Expected: no matches.

- [ ] **Step 7: Open in browser and click each of #3, #5, #11**

```bash
open charts/deficit_model.html
```

For each scenario:
- Verify the card shows the new title/desc.
- Click it. Verify the readout panel shows the updated realism note.
- Verify no console errors.

- [ ] **Step 8: Commit**

```bash
git add charts/deficit_model.html
git commit -m "$(cat <<'EOF'
Deficit model: copy edits to #3, #5, #11

Re-title and re-describe #3 to reflect that ~50 positions matches the
FY25-FY27 cuts already in place, not a hypothetical reduction. Drop
ambiguous "enrollment flat" phrasing from #5. Extend #11 realism note
with the 7-13 discretionary-slice caveat from the site's staffing
analysis.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add `fy27Step` control and extend auto-explainer

**Files:**
- Modify: `charts/deficit_model.html`

- [ ] **Step 1: Add the HTML control**

Locate the `<details class="dm-controls-wrap" open>` block starting at line 876. Inside the inner `<div class="dm-controls">` (line 878), after the existing four controls (the last one ends around line 898), add:

```html
<div class="dm-control" style="grid-column: 1 / -1;">
  <span class="dm-control-label">FY27 one-time step ($M): <span class="dm-value" id="dm-fy27-step-val">$0.0M</span></span>
  <input type="number" id="dm-fy27-step" min="-5" max="5" step="0.1" value="0" style="width: 100px; font: inherit; padding: 4px 8px;">
  <div class="dm-hint" id="dm-fy27-step-hint">Use this if you believe FY27 has a one-time cost deviation outside the compound-rate trend (for example, the observed healthcare bump). Default is 0, meaning the compound rate captures everything.</div>
</div>
```

- [ ] **Step 2: Add the DOM reference and value element in the IIFE**

Around line 1043 (the DOM refs block), after the existing `wageOffsetVal` reference, add:

```js
var fy27StepEl = document.getElementById('dm-fy27-step');
var fy27StepValEl = document.getElementById('dm-fy27-step-val');
```

- [ ] **Step 3: Update the phaseYears index reference**

Confirm `phaseYears[0]` is FY27 (should be index 12 per line 991). No code change, just verify:

```bash
grep -n "phaseYears" charts/deficit_model.html | head -5
```

Expected: `var phaseYears = [12, 13, 14];  // FY27, FY28, FY29` or similar.

- [ ] **Step 4: Wire `fy27Step` into `compute()`**

In `compute()` (line 1149), after the line:

```js
var ratchetYears = parseInt(ratchetEl.value);
```

Add:

```js
var fy27Step = parseFloat(fy27StepEl.value) || 0;
```

Then locate the projection loop (line 1165). Replace:

```js
for (var i = histCount; i < nYears; i++) {
  r = r * (1 + revG);
  e = e * (1 + expG);
  // Phase in override over FY27-FY29
  if (ovr > 0) {
    for (var p = 0; p < phaseYears.length; p++) {
      if (i === phaseYears[p]) {
        var draw = ovr * phaseRatios[p];
        r += draw;
        // Schedule gradual expense absorption
        if (ratchetYears > 0) {
          pendingBumps.push({ startIdx: i, annualAmount: draw / ratchetYears });
        }
      }
    }
  }
  // Apply accumulated ratchet bumps
  for (var b = 0; b < pendingBumps.length; b++) {
    var bump = pendingBumps[b];
    var yearsSinceStart = i - bump.startIdx;
    if (yearsSinceStart >= 0 && yearsSinceStart < ratchetYears) {
      e += bump.annualAmount;
    }
  }
  rev.push(r);
  exp.push(e);
}
```

With:

```js
for (var i = histCount; i < nYears; i++) {
  r = r * (1 + revG);
  e = e * (1 + expG);
  // Phase in override over FY27-FY29
  if (ovr > 0) {
    for (var p = 0; p < phaseYears.length; p++) {
      if (i === phaseYears[p]) {
        var draw = ovr * phaseRatios[p];
        r += draw;
        // Schedule gradual expense absorption
        if (ratchetYears > 0) {
          pendingBumps.push({ startIdx: i, annualAmount: draw / ratchetYears });
        }
      }
    }
  }
  // Apply accumulated ratchet bumps
  for (var b = 0; b < pendingBumps.length; b++) {
    var bump = pendingBumps[b];
    var yearsSinceStart = i - bump.startIdx;
    if (yearsSinceStart >= 0 && yearsSinceStart < ratchetYears) {
      e += bump.annualAmount;
    }
  }
  // FY27 one-time step: add to reported value but do not propagate
  // into the forward compounding state.
  var reportedE = e;
  if (i === phaseYears[0] && fy27Step !== 0) {
    reportedE = e + fy27Step;
  }
  rev.push(r);
  exp.push(reportedE);
}
```

- [ ] **Step 5: Wire `fy27Step` into `computeTiers()`**

In `computeTiers()` (line 1209), apply the same pattern. Find:

```js
for (var i = histCount; i < nYears; i++) {
  r = r * (1 + revG);
  e = e * (1 + expG);
  baseRev.push(r);
  baseExp.push(e);
}
```

Replace with:

```js
var fy27Step = parseFloat(fy27StepEl.value) || 0;
for (var i = histCount; i < nYears; i++) {
  r = r * (1 + revG);
  e = e * (1 + expG);
  baseRev.push(r);
  var reportedE = e;
  if (i === phaseYears[0] && fy27Step !== 0) {
    reportedE = e + fy27Step;
  }
  baseExp.push(reportedE);
}
```

- [ ] **Step 6: Update the value readout on input change**

Locate where other controls wire their value displays (search for `revGrowthVal.textContent` around line 1270 or similar). Add an event listener for `fy27StepEl`:

```bash
grep -n "revGrowthEl.addEventListener\|onChange" charts/deficit_model.html | head -5
```

Near where other `addEventListener` calls are, add:

```js
fy27StepEl.addEventListener('input', function() {
  var v = parseFloat(fy27StepEl.value) || 0;
  fy27StepValEl.textContent = (v >= 0 ? '$' : '-$') + Math.abs(v).toFixed(1) + 'M';
  onChange();
});
```

Place this alongside the other controls' event listeners. If listeners are registered in a loop, add `fy27StepEl` to that list if the pattern supports it; otherwise add a standalone listener.

- [ ] **Step 7: Extend `updateScenarioReadout` to mention fy27Step**

In `updateScenarioReadout` (line 1775), find the block that appends growth rate info (around line 1798):

```js
if (Math.abs(rv - 3.5) > 0.05 || Math.abs(ev - 4.0) > 0.05) {
  parts.push('Growth set to <strong>revenue ' + rv.toFixed(1) + '%/yr</strong>, <strong>expenses ' + ev.toFixed(1) + '%/yr</strong> (defaults: 3.5% / 4.0%).');
}
```

Immediately before that block, read `fy27Step` and append a sentence when non-zero:

```js
var fy27Step = parseFloat(fy27StepEl.value) || 0;
if (Math.abs(fy27Step) > 0.01) {
  var sign = fy27Step >= 0 ? '+' : '-';
  parts.push('FY27 one-time step: <strong>' + sign + '$' + Math.abs(fy27Step).toFixed(1) + 'M</strong>, not propagated into the forward trend.');
}
```

- [ ] **Step 8: Update `resetToDefaults` (tour) and the preset click handler to reset `fy27Step`**

In `resetToDefaults()` (around line 1962) inside the tour IIFE, after `wageOffsetEl.value = 50;` add:

```js
fy27StepEl.value = 0;
fy27StepValEl.textContent = '$0.0M';
```

In the stance click handler (around line 1894) at the defaults-reset block, after `wageOffsetEl.value = 50;` add the same two lines.

- [ ] **Step 9: Verify in browser**

```bash
open charts/deficit_model.html
```

- Expand the "Assumptions" `<details>`. Verify the new "FY27 one-time step ($M)" input renders.
- Enter `1.1`. Verify:
  - The value readout shows `$1.1M`.
  - The expense line at FY27 jumps visibly.
  - The FY28 value snaps back near the compound-only projection.
  - No JS console errors.
- Enter `0`. Verify the expense line returns to the no-step baseline.
- Click an existing scenario (e.g. "Override buys time"). Verify fy27Step resets to 0.

- [ ] **Step 10: Commit**

```bash
git add charts/deficit_model.html
git commit -m "$(cat <<'EOF'
Deficit model: add FY27 one-time step control

Introduces fy27Step input in the Assumptions panel. Shock applied at
FY27 only, not propagated into forward compounding (FY28+ compounds
from the pre-shock state). Unlocks the one-time-healthcare-spike
scenario landing next. Extends updateScenarioReadout to mention the
step when non-zero.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add scenario A (`hc-cliff` — One-time healthcare spike)

**Files:**
- Modify: `charts/deficit_model.html`

**Prerequisite:** Task 0 Step 3 must have produced a verified `fy27Step` value. Use that value in Step 2 below. If not yet verified, block this task.

- [ ] **Step 1: Add the card button**

In the first `<div class="dm-scenarios">` block (under "Try a scenario", around line 793), append a new card after the last existing entry in that group:

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="hc-cliff">
  <span class="dm-scenario-title">One-time healthcare spike</span>
  <span class="dm-scenario-desc">FY27 jump in healthcare, then expense growth returns to a normal rate.</span>
</button>
```

- [ ] **Step 2: Add the preset branch**

In the stance click handler, after the last existing `else if` in the "single-lever" group (after the `new-growth` block was removed in Task 1, the last single-lever scenario is `hold-line`), add:

```js
} else if (s === 'hc-cliff') {
  fy27StepEl.value = 1.1; // verified value from Task 0; update if pinned differently
  fy27StepValEl.textContent = '$1.1M';
  expGrowthEl.value = 3.8;
}
```

Use the actual verified number from Task 0 rather than 1.1 if different.

- [ ] **Step 3: Add the `stanceNotes` entry**

Add to `stanceNotes` (order: match the card's position in the UI):

```js
'hc-cliff': 'Tests the "cliff not chronic" read of FY27. Group insurance grew slower than CPI from FY12 to FY26 (about 29% vs. 37%, see healthcare_costs.html); if that pattern resumes after the FY27 step, the long-run rate returns to near the historical average. Depends on GIC premium behavior outside the town\u2019s control.',
```

- [ ] **Step 4: Verify in browser**

```bash
open charts/deficit_model.html
```

- Click the new "One-time healthcare spike" card.
- Verify `fy27Step` input shows the verified value, expense growth slider shows 3.8%, revenue growth slider shows 3.5%.
- Verify the chart shows a visible FY27 expense bump with FY28+ resuming a normal trajectory.
- Verify the "Scenario modeled" readout includes both "FY27 one-time step" and "expenses 3.8%/yr".
- Verify the "Realism" note matches the new text.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add charts/deficit_model.html
git commit -m "$(cat <<'EOF'
Deficit model: add "One-time healthcare spike" scenario

Tests the cliff-vs-chronic read of FY27. Uses the new fy27Step control
to apply a one-time shock at FY27 while expense growth goes to 3.8%
going forward. FY27 step value derived from FY27 healthcare deviation
from the normalized compound projection (see spec for derivation).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add scenario C (`commercial-only` — Commercial growth only)

**Files:**
- Modify: `charts/deficit_model.html`

- [ ] **Step 1: Add the card button**

In the "Try a scenario" `<div class="dm-scenarios">` block, append:

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="commercial-only">
  <span class="dm-scenario-title">Commercial growth only</span>
  <span class="dm-scenario-desc">Revenue lifted by realistic commercial redevelopment. No new residential from 3A.</span>
</button>
```

- [ ] **Step 2: Add the preset branch**

In the stance click handler, add after the `hc-cliff` branch:

```js
} else if (s === 'commercial-only') {
  revGrowthEl.value = 4.0;
}
```

- [ ] **Step 3: Add the `stanceNotes` entry**

```js
'commercial-only': 'Commercial redevelopment at the top of Marblehead\u2019s realistic range adds roughly $500K to $1M per year in recurring capacity. This scenario uses the middle of that range (~$500K/yr, +0.5pp on revenue growth). The existing gap from FY24 onward does not close because new growth compounds forward but does not retroactively close old deficits. Residential growth is excluded because new housing adds service demand too.',
```

- [ ] **Step 4: Verify in browser**

- Click the new "Commercial growth only" card.
- Verify revenue growth shows 4.0%, everything else at defaults.
- Verify the chart shows the expense and revenue lines running nearly parallel (both at 4.0% growth), with the FY24 gap persisting.
- Verify the "Realism" note matches.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add charts/deficit_model.html
git commit -m "$(cat <<'EOF'
Deficit model: add "Commercial growth only" scenario

Isolates the commercial component of new growth from residential 3A
housing, using the middle of the realistic commercial range
(~$500K/yr, +0.5pp on revenue growth). Replaces the pruned
new-growth scenario which conflated residential and commercial.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add scenario G (`bend-curve` — Bend the cost curve)

**Files:**
- Modify: `charts/deficit_model.html`

- [ ] **Step 1: Add the card button**

In the "Combine levers" `<div class="dm-scenarios">` block (the second one, around line 825), append:

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="bend-curve">
  <span class="dm-scenario-title">Bend the cost curve (3 to 5 years)</span>
  <span class="dm-scenario-desc">Structural reforms (collaboratives, in-district SPED, shared services) phased over 3 to 5 years.</span>
</button>
```

- [ ] **Step 2: Add the preset branch**

In the stance click handler, after the last combo branch (`permanent-close`), add:

```js
} else if (s === 'bend-curve') {
  expGrowthEl.value = 3.7;
}
```

- [ ] **Step 3: Add the `stanceNotes` entry**

```js
'bend-curve': 'Matches the site\u2019s framing of these reforms as cost-curve benders, not immediate substitutes for override revenue (see inside-school-staffing.html#options). Realistic impact from collaborative expansion, bringing out-of-district SPED placements back in, and shared back-office sums to roughly 0.3 to 0.5 percentage points off expense growth, but not until FY30 at the earliest. The compound-rate projection in this model applies the reduction uniformly, so the near-term years look more optimistic than reality.',
```

- [ ] **Step 4: Verify in browser**

- Click "Bend the cost curve".
- Verify expense growth shows 3.7%.
- Verify the realism note surfaces the uniform-application caveat.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add charts/deficit_model.html
git commit -m "$(cat <<'EOF'
Deficit model: add "Bend the cost curve" scenario

Models structural reforms (collaboratives, in-district SPED, shared
services) as a uniform 0.3pp reduction in expense growth. Realism
note surfaces the limitation that the model applies the reduction
uniformly, while in reality these reforms would not start until FY30
at the earliest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Add scenario E (`composite-cuts` — No override, no growth, just cuts)

**Files:**
- Modify: `charts/deficit_model.html`

**Prerequisite:** Task 0 Step 4 must have confirmed the FY27 gap figure ($8.47M). Use it to compute `positionCuts`:

```
positionCuts_E = round(FY27_gap / 0.1)   # $100K per position
```

At $8.47M, that is 85 positions. Confirm before use.

- [ ] **Step 1: Add the card button**

In the "Combine levers" block, append:

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="composite-cuts">
  <span class="dm-scenario-title">No override, no growth, just cuts</span>
  <span class="dm-scenario-desc">Both levers off the table. Cuts absorb the full FY27 gap.</span>
</button>
```

- [ ] **Step 2: Add the preset branch**

In the stance click handler, after `bend-curve`:

```js
} else if (s === 'composite-cuts') {
  positionCuts = 85; // derived from FY27 gap / $100K per position; update if Task 0 pinned differently
}
```

- [ ] **Step 3: Add the `stanceNotes` entry**

```js
'composite-cuts': 'Reflects the no-3A, no-override, yes-cuts composite position. Closing the $8.47M FY27 gap at roughly $100K per position implies on the order of 85 positions. Only 7 to 13 can come from the site\u2019s discretionary slice of school staffing (see inside-school-staffing.html#options); the remainder requires mandate relief, non-school department reductions, or both. Shows the magnitude, not which commitments to unwind.',
```

- [ ] **Step 4: Verify in browser**

- Click "No override, no growth, just cuts".
- Verify `positionCuts` shows 85.
- Verify the chart shows expenses stepped down substantially at FY25 then resuming compound growth.
- Verify the "Scenario modeled" readout reports the position-cut dollar savings (~$8.5M/yr).
- Verify the realism note matches.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add charts/deficit_model.html
git commit -m "$(cat <<'EOF'
Deficit model: add "No override, no growth, just cuts" scenario

Composite anti-3A, anti-override, yes-cuts position. Closes the
$8.47M FY27 gap via ~85 position cuts ($100K/pos). Realism note
surfaces the 7-13 discretionary-slice ceiling from the site's
staffing analysis, so readers understand where the remaining cuts
would have to land.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Add scenario D (`forced-equilibrium` — Cuts to match the trend)

**Files:**
- Modify: `charts/deficit_model.html`

D is the most load-bearing scenario. Its realism copy is intentionally conservative and links to #595. The compound-cut math lives inside the preset branch as a stored delta applied in `compute()`.

- [ ] **Step 1: Add a shared state variable for compound cuts**

Near the other shared state declarations (around line 1010, where `positionCuts = 0` is declared), add:

```js
var forcedEquilibriumActive = false;
```

- [ ] **Step 2: Add the card button**

In the "Combine levers" block, append:

```html
<button type="button" class="dm-scenario-card dm-stance-btn" data-stance="forced-equilibrium">
  <span class="dm-scenario-title">Cuts to match the trend</span>
  <span class="dm-scenario-desc">Ongoing cuts each year that keep expenses growing at revenue\u2019s rate.</span>
</button>
```

Use the literal right single-quote character in the HTML (copy-paste from above, not `\u2019`). The HTML accepts unicode directly; only JS strings need the escape.

- [ ] **Step 3: Add the preset branch**

In the stance click handler, after `composite-cuts`:

```js
} else if (s === 'forced-equilibrium') {
  forcedEquilibriumActive = true;
}
```

Also update the defaults-reset block at the top of the click handler (line 1893-1900) to include:

```js
forcedEquilibriumActive = false;
```

This ensures other scenarios don't inherit the flag.

- [ ] **Step 4: Apply compound cuts inside `compute()`**

In `compute()`, inside the main projection loop (after the override/ratchet logic, before the `fy27Step` block added in Task 3), add:

```js
// Forced-equilibrium cuts: subtract (expG - revG) x current expense
// each projected year so the effective expense growth matches revenue.
if (forcedEquilibriumActive && expG > revG) {
  e -= (expG - revG) * e;
}
```

Place this before the `reportedE` assignment. The compounding state `e` is reduced in-place so the next iteration compounds from the cut value - this is intentional and reflects ongoing cuts. The `reportedE` push uses this reduced `e`.

Also apply the same logic in `computeTiers()`. Inside its base-projection loop (added in Task 3 Step 5), before the `reportedE` assignment, add:

```js
if (forcedEquilibriumActive && expG > revG) {
  e -= (expG - revG) * e;
}
```

- [ ] **Step 5: Add the `stanceNotes` entry (interim copy)**

```js
'forced-equilibrium': 'Requires ongoing annual cuts to keep expenses growing at revenue\u2019s rate. At the default rate gap (0.5pp), the scale is roughly half a percent of the budget per year, compounding forward. Only 7 to 13 school positions are documented as discretionary per the site\u2019s staffing analysis (inside-school-staffing.html#options); town-wide discretionary capacity has not yet been quantified. See github.com/agbaber/marblehead/issues/595 for the pending town-wide analysis.',
```

- [ ] **Step 6: Extend `resetToDefaults` (tour IIFE) to reset the flag**

In `resetToDefaults()` inside the tour block, after the other resets, add:

```js
forcedEquilibriumActive = false;
```

- [ ] **Step 7: Extend `updateScenarioReadout` to surface forced-equilibrium in the auto-explainer**

In `updateScenarioReadout`, after the fy27Step branch added in Task 3 Step 7 and before the growth-rate block, add:

```js
if (forcedEquilibriumActive && ev > rv) {
  var gap = (ev - rv).toFixed(1);
  parts.push('<strong>Compound cuts</strong> applied each year equal to the expense-to-revenue gap (about ' + gap + '% of the budget annually), so the expense line stays parallel to revenue rather than running at the underlying ' + ev.toFixed(1) + '% rate.');
}
```

Without this, the chart shows parallel lines for D but the readout just reports the slider rates (3.5% / 4.0%), which would read as inconsistent. This branch makes the cut mechanism explicit.

- [ ] **Step 8: Verify in browser**

- Click "Cuts to match the trend".
- Verify the expense line runs parallel to revenue (both at 3.5% effective growth).
- Verify the "Scenario modeled" readout shows the compound-cuts sentence from Step 7.
- Verify clicking any other scenario returns the flag to false and the chart to that scenario's behavior.
- Verify switching between D and Hold the line produces the same chart shape but different realism notes.
- Confirm the realism note includes the #595 link.
- No console errors.

- [ ] **Step 9: Commit**

```bash
git add charts/deficit_model.html
git commit -m "$(cat <<'EOF'
Deficit model: add "Cuts to match the trend" scenario (interim copy)

Models compound annual cuts that force expense growth down to revenue
growth's rate. Realism note is intentionally conservative and links to
issue #595, where the town-wide forced-equilibrium forecast
investigation is tracked. Once #595 lands, D's realism note gets
upgraded in a follow-up PR with the specific derived forecast.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Update tour step 7 caption

**Files:**
- Modify: `charts/deficit_model.html`

- [ ] **Step 1: Locate the tour steps array**

Tour steps are defined starting at line 1973 as `var steps = [ ... ]`. Step 7 is the final entry in the array.

- [ ] **Step 2: Replace step 7's caption**

Find:

```js
{
  caption: 'Your turn. Pick any scenario below to see how different levers shape the chart. Each one lists its assumptions, how realistic it is, and what is doing the work. There is no single answer; the point is to see how the tradeoffs compare.',
  setup: function() { resetToDefaults(); }
}
```

Replace with:

```js
{
  caption: 'Your turn. Scenarios below are framed around positions in the override debate. Each one lists its assumptions and how realistic it is. Pick one to see the chart shift. There is no single answer; the point is to see how the tradeoffs compare.',
  setup: function() { resetToDefaults(); }
}
```

- [ ] **Step 3: Verify in browser**

- Open the page, click "Show me how this works".
- Step through all 7 tour steps.
- At step 7, verify the caption shows the new debate-stance framing.
- Verify the total step count shows "Step 7 of 7" (it should, since `totalEl.textContent = steps.length` runs dynamically).
- Exit the tour, click a scenario, verify normal behavior resumes.

- [ ] **Step 4: Commit**

```bash
git add charts/deficit_model.html
git commit -m "$(cat <<'EOF'
Deficit model: update tour step 7 to name debate-stance framing

Updates the final step's caption to tell readers the scenarios below
map to positions in the override debate. No structural change to the
tour: still 7 steps, same setup, same flow. Keeps the tour's current
tuning intact while tying it to the refreshed scenario set.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Push, open PR, and verify preview

**Files:** none (git operations only)

- [ ] **Step 1: Verify branch is clean and all commits are stacked**

```bash
cd /Users/agbaber/marblehead/.worktrees/deficit-model-scenarios
git status
git log origin/main..HEAD --oneline
```

Expected: 9 commits ahead of main (the spec commit plus 9 implementation commits = 10; count is 10 if the spec commit hasn't been pushed yet). All commits should be on `deficit-model-scenarios`.

- [ ] **Step 2: Push using the PAT from `.env`**

```bash
set -a && . /Users/agbaber/marblehead/.env && set +a
git push "https://${GITHUB_TOKEN}@github.com/agbaber/marblehead.git" deficit-model-scenarios:deficit-model-scenarios -u
```

If the push fails because the branch already exists remotely, investigate whether another session has pushed to the same branch name before proceeding.

- [ ] **Step 3: Open the PR**

```bash
set -a && . /Users/agbaber/marblehead/.env && set +a
GH_TOKEN="$GITHUB_TOKEN" gh pr create --repo agbaber/marblehead --base main --head deficit-model-scenarios --title "Deficit model: scenario-set refresh (Approach 2)" --body "$(cat <<'EOF'
## Summary

Prunes 4 scenarios in `charts/deficit_model.html`, adds 5 new ones (A, C, D, E, G), copy-edits 3 existing (#3, #5, #11), adds an `fy27Step` control to the Assumptions panel, and updates the final tour step caption.

New scenarios codify analytical positions active in the override debate so voters can find the case that matches their view and see what it does to the gap.

## Scenarios

Added:
- **One-time healthcare spike** - tests cliff vs. chronic read of FY27
- **Commercial growth only** - isolates commercial from 3A residential
- **Cuts to match the trend** - compound annual cuts (interim copy, links #595)
- **No override, no growth, just cuts** - composite anti-3A + anti-override position
- **Bend the cost curve (3 to 5 years)** - structural reforms

Pruned: Cost growth slows to 3%, More new development, Override + modest cuts, Pull every lever.

Copy-edited: #3 (now "Current pace of cuts"), #5 (drop ambiguous enrollment phrasing), #11 (add 7-13 discretionary caveat).

## Architecture

One file touched (`charts/deficit_model.html`). Two deferred follow-ups:

- #595 tracks the town-wide cuts-only forecast investigation. D's realism note links here.
- #596 tracks Approach 3 (stance-based reorganization) for future work.

## Test plan

- [ ] Open the preview URL and click each of the 13 scenario cards; verify each sets the expected sliders and produces a readable realism note.
- [ ] Step through the "Show me how this works" tour; verify step 7 shows the new debate-stance framing.
- [ ] Enter values in the FY27 one-time step input; verify the expense line shows a visible FY27 shock that does not propagate into FY28+.
- [ ] Run `node tests/smoke-test.mjs` against the preview URL (`SITE=<preview URL>`).
- [ ] Eyeball the scenario layout on mobile (Safari responsive mode, 375px width).

Spec: `docs/superpowers/specs/2026-04-17-deficit-model-scenarios-design.md`
EOF
)" 2>&1 | tail -5
```

Record the PR URL returned.

- [ ] **Step 4: Wait for the preview deploy and fetch the Branch URL**

Preview deploys take about 2 minutes. Fetch the preview comment:

```bash
set -a && . /Users/agbaber/marblehead/.env && set +a
GH_TOKEN="$GITHUB_TOKEN" gh pr view <PR_NUMBER> --repo agbaber/marblehead --json comments --jq '.comments[] | select(.body | startswith("### Preview")) | .body' | head -20
```

Extract the `**Branch URL:**` value from the sticky comment.

If the comment is not there yet, wait and re-poll. Do not send a bare PR link in the next step.

- [ ] **Step 5: Smoke-test against the preview URL**

```bash
SITE=<BRANCH_URL> node tests/smoke-test.mjs
```

Expected: all existing smoke tests pass. If a test fails, diagnose before asking for review.

- [ ] **Step 6: Report PR URL and preview URL**

Tell the user:
- The PR URL
- The preview Branch URL (full URL, not abbreviated)
- Confirmation that smoke tests pass

---

## Self-review checklist (before handing off)

- [ ] Every new scenario has: card HTML, `stanceNotes` entry, preset branch, rendered correctly in browser.
- [ ] Every edited scenario's copy matches the spec.
- [ ] No em-dashes in any added copy.
- [ ] No meta-narration in any added copy.
- [ ] Every numerical claim links to a primary source or site page that carries one.
- [ ] `fy27Step` default is 0; non-zero values do not propagate into FY28+ compounding.
- [ ] `forcedEquilibriumActive` resets to false whenever another scenario is picked or defaults are applied.
- [ ] Tour still has 7 steps (not 8).
- [ ] Total scenario count is 13 (was 12).
- [ ] All 9 commits are on `deficit-model-scenarios`; PR is open; smoke tests pass against preview.
