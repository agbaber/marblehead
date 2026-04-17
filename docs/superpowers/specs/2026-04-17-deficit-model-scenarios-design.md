---
title: "Deficit model: scenario-set refresh (Approach 2)"
date: 2026-04-17
status: approved
---

# Deficit model: scenario-set refresh

## Summary

The deficit model at `charts/deficit_model.html` has 12 scenarios. This spec
prunes 4, adds 5, edits the copy of 3, and adds one new control to the
"Assumptions" panel so the added scenarios can be modeled honestly. Total
scenarios after: 13.

The new scenarios codify the analytical positions active in the override
debate, so voters can find the case that matches their own stance and see
what it does to the gap. Two deeper analyses (town-wide cuts forecast;
stance-based reorganization of the scenario area) are deferred to follow-up
issues (#595, #596).

## Scope

### In scope

- Prune 4 existing scenarios: #6, #7, #9, #10.
- Edit copy on 3 existing scenarios: #3, #5, #11.
- Add 5 new scenarios: A, C, D, E, G (detail below).
- Add one new control, `fy27Step`, inside the existing `<details>`
  "Assumptions" block. Default 0.
- Add compound-cut logic for scenarios D and E inside their preset handlers.
  No new UI control, math applied within preset code.
- Extend the auto-generated "Scenario modeled" explainer in
  `updateScenarioReadout` to mention `fy27Step` when non-zero.
- Update the caption on tour step 7 to name the debate-stance framing
  explicitly. No change to step count, no new step.
- Every new or edited scenario has a card title, a one-line card
  description, and a realism note in `stanceNotes`.

### Out of scope (deferred)

- Issue #595: town-wide forced-equilibrium forecast investigation. The D
  scenario ships with interim realism copy that points at this issue.
- Issue #596: stance-based reorganization of the scenario area (Approach 3),
  including multiple new controls and a restructured tour.

### Hard constraints

- No em-dashes in new copy.
- No meta-narration ("this scenario shows&hellip;", "this chart
  demonstrates&hellip;") per the added CLAUDE.md rule.
- No green/red semantic color cues on new scenarios.
- Every numerical claim in new copy cites a primary source or links to a
  site page that does.

## Scenario inventory

### Keep (8)

| ID | Title | Action |
|----|-------|--------|
| #1 | Override buys time | unchanged |
| #2 | Override spent immediately | unchanged |
| #3 | "Cut 50 positions" | retitle and re-describe (see below) |
| #4 | Healthcare share to 50% | unchanged |
| #5 | Hold the line | drop ambiguous "enrollment flat" phrase from card desc |
| #8 | Override + HC reform | unchanged |
| #11 | No override, just reform | extend realism note with discretionary-slice caveat |
| #12 | Permanently close the gap | unchanged |

### Prune (4)

| ID | Title | Why |
|----|-------|-----|
| #6 | Cost growth slows to 3% | Superseded by A (one-time healthcare spike). |
| #7 | More new development | Conflates commercial and residential growth. Superseded by C (commercial only). |
| #9 | Override + modest cuts | Duplicative of #8 and #11. |
| #10 | Pull every lever | Kitchen sink. #12 already carries the best-case case with a cleaner frame. |

### Add (5)

| ID | Title | Group |
|----|-------|-------|
| A | One-time healthcare spike | Try a scenario |
| C | Commercial growth only | Try a scenario |
| D | Cuts to match the trend | Combine levers |
| E | No override, no growth, just cuts | Combine levers |
| G | Bend the cost curve (3 to 5 years) | Combine levers |

Grouping placement keeps the existing "Try a scenario" / "Combine levers"
split. Stance-based regrouping is deferred to #596.

## Scenario copy

### Edit #3

Current:

- Title: "Cut 50 positions"
- Card desc: "~$5M/yr saved. Slope unchanged; gap reopens on the same schedule."

Proposed:

- Title: "Current pace of cuts"
- Card desc: "About 50 positions over FY25 to FY27, roughly matching what
  the town has already done. Slope unchanged; gap keeps widening."
- Realism: "Roughly matches the FY25 to FY27 reductions already in place
  through layoffs, unfilled vacancies, and stipend reductions. Lowers the
  level but does not flatten the slope. The site's staffing analysis
  identifies 7 to 13 positions as the discretionary slice; further
  reductions reach mandate-adjacent roles or non-school departments."
- Links: `inside-school-staffing.html#options`.

### Edit #5

Current:

- Title: "Hold the line"
- Card desc: "Expense growth matches revenue at 3.5%. Contracts at COLA,
  enrollment flat, no new programs."

Proposed:

- Title: "Hold the line" (unchanged)
- Card desc: "Expense growth drops to revenue growth (3.5%). Contracts at
  COLA, no new programs."
- Realism: unchanged (existing text is accurate; the "healthcare enrollment"
  clarification it already contains is sufficient).

Reason for the card desc change: the phrase "enrollment flat" is ambiguous
between student enrollment (which is already declining 19% per
`charts/enrollment_vs_staffing.html`, so "flat" would misread the reality)
and healthcare enrollment (which is what the realism note actually means).
Dropping the phrase removes the ambiguity without changing the scenario's
math.

### Edit #11

Current:

- Title: "No override, just reform"
- Card desc: "30 positions cut plus 65% healthcare share. No new revenue."

Proposed:

- Title: "No override, just reform" (unchanged)
- Card desc: "65% healthcare share plus 30 positions cut. No new revenue."
- Realism: "No new revenue; 30 position cuts plus healthcare concessions
  carry the full load. 30 positions is more than double the site's 7 to 13
  discretionary estimate, so the cuts reach mandate-adjacent roles or
  non-school departments. The hardest path politically: the largest
  non-override concessions with nothing offered in return."
- Links: `inside-school-staffing.html#options`.

### Add A (stance slug: `hc-cliff`)

- Title: "One-time healthcare spike"
- Card desc: "FY27 jump in healthcare, then expense growth returns to a
  normal rate."
- Realism: "Tests the 'cliff not chronic' read of FY27. Group insurance
  grew slower than CPI from FY12 to FY26 (about 29% vs. 37%); if that
  pattern resumes after the FY27 step, the long-run rate returns to near
  the historical average. Depends on GIC premium behavior outside the
  town's control."
- Links: `charts/healthcare_costs.html`.
- Preset: `fy27Step` = the deviation between actual FY27 healthcare and
  what the normalized compound projection would give. At `expGrowth` =
  3.8%, the compound projection of FY26 $15.1M gives FY27 healthcare
  &asymp; $15.67M. Actual FY27 at +11% gives $16.76M. Step &asymp; +$1.1M.
  This is smaller than the $1.7M total FY27 healthcare increase; the
  difference is the portion of growth already captured by the compound
  rate. Final value confirmed against FY27 proposed budget and April 15
  override deck before ship. `expGrowth` = 3.8%, `revGrowth` = 3.5%.

### Add C (stance slug: `commercial-only`)

- Title: "Commercial growth only"
- Card desc: "Revenue lifted by realistic commercial redevelopment. No new
  residential from 3A."
- Realism: "Commercial redevelopment at the top of Marblehead's realistic
  range adds roughly $500K to $1M per year in recurring capacity. This
  scenario uses the middle of that range. The existing gap from FY24
  onward does not close because new growth compounds forward but does not
  retroactively close old deficits. Residential growth is excluded because
  new housing adds service demand too."
- Preset: `revGrowth` = 4.0% (+0.5pp from baseline), `expGrowth` = 4.0%
  default.

### Add D (stance slug: `forced-equilibrium`)

- Title: "Cuts to match the trend"
- Card desc: "Ongoing cuts each year that keep expenses growing at
  revenue's rate."
- Realism (interim, pending #595): "Requires ongoing annual cuts to keep
  expenses growing at revenue's rate. At the default rate gap (0.5pp),
  the scale is roughly half a percent of the budget per year, compounding
  forward. Only 7 to 13 school positions are documented as discretionary
  per the site's staffing analysis; town-wide discretionary capacity has
  not yet been quantified. See issue #595 for the pending analysis."
- Links: `inside-school-staffing.html#options`, issue #595.
- Preset: compound-cut logic inside the preset handler. Each projected
  year, subtract `(expGrowth - revGrowth) x currentExpense` from the
  expense line. Stored separately from the `positionCuts` counter so the
  existing position-cut slider is not affected.
- Realism upgrade: once #595 lands with a town-wide page, D's realism note
  is updated in a follow-up PR to cite the specific forecast and link the
  new page.

### Add E (stance slug: `composite-cuts`)

- Title: "No override, no growth, just cuts"
- Card desc: "Both levers off the table. Cuts absorb the full FY27 gap."
- Realism: "Reflects the no-3A, no-override, yes-cuts composite position.
  Closing the $8.47M FY27 gap at roughly $100K per position implies on
  the order of 85 positions. Only 7 to 13 can come from the site's
  discretionary slice of school staffing; the remainder requires mandate
  relief, non-school department reductions, or both. Shows the
  magnitude, not which commitments to unwind."
- Links: `inside-school-staffing.html#options`.
- Preset: `positionCuts` &asymp; 85 (front-loaded; exact number derived from
  confirmed $8.47M FY27 gap divided by $100K per position), `override` = 0,
  growth rates default.

### Add G (stance slug: `bend-curve`)

- Title: "Bend the cost curve (3 to 5 years)"
- Card desc: "Structural reforms (collaboratives, in-district SPED, shared
  services) phased over 3 to 5 years."
- Realism: "Matches the site's framing of these reforms as cost-curve
  benders, not immediate substitutes for override revenue. Realistic
  impact from collaborative expansion, bringing out-of-district SPED
  placements back in, and shared back-office sums to roughly 0.3 to 0.5
  percentage points off expense growth, but not until FY30 at the
  earliest. The compound-rate projection in this model applies the
  reduction uniformly, so the near-term years look more optimistic than
  reality."
- Links: `inside-school-staffing.html#options`.
- Preset: `expGrowth` = 3.7% (-0.3pp), with the uniform-application
  limitation flagged in the realism note.

## Model changes

### New control: `fy27Step`

- Location: inside the existing `<details>` "Assumptions" block, below
  the existing four sliders. Not on the main controls area.
- Shape: number input (not a range slider). Unit: millions.
- Default: 0.
- Label: "FY27 one-time step ($M)"
- Hint: "Use this if you believe FY27 has a one-time cost deviation
  outside the compound-rate trend (for example, the observed healthcare
  bump). Default is 0, meaning the compound rate captures everything."
- Math: applied as an additive shock to projected expenses in the FY27
  year only. Not propagated into the compounding trend. FY28+ computes
  from the pre-shock FY26 value compounded forward, not from (FY27 +
  step) x (1 + expGrowth).
- Rationale: lets scenario A (one-time healthcare spike) visualize a
  genuine cliff + normalization path. The model notes already flag
  "constant annual compounding, which is a simplification," so this
  extension is in-spirit.

### Compound-cut logic for D and E

- D: preset setup function applies `(expGrowth - revGrowth) x
  currentExpense` to each projected year's expense value. Logic lives in
  the stance preset handler, not in shared model code.
- E: preset setup function sets `positionCuts` to the value calculated
  from the confirmed FY27 gap (&asymp;85 positions at $8.47M / $100K per
  position). Existing model math handles the rest.

### Auto-explainer extension

- The existing `updateScenarioReadout` function (line 1775 of the current
  file) composes "Scenario modeled" text from slider values: override,
  positionCuts, hcShare, revGrowth, expGrowth.
- Add one branch: when `fy27Step` is non-zero, append a sentence like
  "FY27 one-time step: +$X.XM, not propagated into the forward trend."
- Ordering: place the new sentence after the override/cuts/healthcare
  sentences and before the growth-rate sentence, so it reads as a
  historical-anchor note rather than a forward-projection note.

### Tour integration

- Existing tour has 7 steps (`dm-tour-total` is set dynamically by JS at
  line 2021 from `steps.length`; the `6` in the HTML literal at line 775
  is a placeholder).
- Update **only** step 7's caption. Current text reads "Your turn. Pick
  any scenario below to see how different levers shape the chart. Each
  one lists its assumptions, how realistic it is, and what is doing the
  work. There is no single answer; the point is to see how the tradeoffs
  compare."
- Proposed replacement: "Your turn. Scenarios below are framed around
  positions in the override debate. Each one lists its assumptions and
  how realistic it is. Pick one to see the chart shift. There is no
  single answer; the point is to see how the tradeoffs compare."
- Net step count: still 7. No new step added.
- Rationale: the existing step 7 already points readers at the scenarios.
  Updating its caption to name the stance framing is additive rather than
  structural, which respects the current tour tuning.

## File and commit organization

### Files touched

- `charts/deficit_model.html` - all work lives here:
  - Scenario card HTML (prune 4, add 5, edit 3 copy).
  - `stanceNotes` entries for 5 new + 3 edited (updating existing `cut`,
    `hold-line`, `no-override-reform`).
  - Preset setup functions for 5 new scenarios.
  - `fy27Step` control markup inside `<details>` "Assumptions".
  - `fy27Step` math in the compute function.
  - Extended `updateScenarioReadout` branch.
  - Updated tour step 7 caption.

### Commit shape (for the implementation plan)

1. Prune 4 scenarios (card HTML + `stanceNotes` entries).
2. Copy edits to #3, #5, #11.
3. Add `fy27Step` control and extend auto-explainer.
4. Add scenario A (one-time healthcare spike), using `fy27Step`.
5. Add scenario C (commercial growth only).
6. Add scenario G (bend the cost curve).
7. Add scenario E (no override, no growth, just cuts).
8. Add scenario D (cuts to match the trend) with interim realism copy
   linking #595.
9. Update tour step 7 caption.

One PR, 9 commits. D is last because its copy is the most load-bearing
and may need iteration against the live preview.

### Verification gates before merging

- FY27 step value (&asymp; +$1.1M preliminary estimate) reconciled against
  FY27 proposed budget, April 15 Select Board override deck (commit
  `69314c3`), and current expense growth rate assumption. The step
  represents deviation from the compound projection, not the total FY27
  healthcare increase.
- `$8.47M` FY27 gap in E's `positionCuts` calculation confirmed against
  the April 15 FINAL override presentation.
- Tour plays through cleanly on desktop and mobile (the tour was
  explicitly flagged as carefully tuned).
- All new scenarios produce readable explainer + realism text at their
  preset values.
- No em-dashes in new copy.
- No meta-narration in new copy.

## Related issues

- **#595** Investigate cuts-only path: town-wide forecast for
  forced-equilibrium. D's realism note links to this issue. Once the
  issue's output lands, D's realism note is upgraded in a follow-up PR.
- **#596** Deficit model: stance-based scenario reorganization
  (Approach 3). Future enhancement covering stance-based grouping,
  additional new controls (cuts ramp timing, structural reform start
  year), and tour restructure.
