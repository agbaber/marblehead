# Balance the Budget tool

**Date:** 2026-04-24
**Page:** new, `balance-the-budget.html`
**Data sources:** `data/override_town_line_items.csv`, `data/override_school_items.csv`, `data/FY27_Proposed_Budget_No_Override.txt`, `data/FY26_budget_summary.json`, and a new hand-curated consequences table under `data/`.

## Problem

The no-override page (`no-override-budget.html`) shows what the town proposed to cut
in FY27 if the override fails. The override tier detail page
(`what-is-the-override.html`) shows what each tier would restore. Together they
describe the town's answer to the FY27 deficit.

A common counter-argument in public debate is that the town should just "be more
creative" or "manage more responsibly" and find the money without an override.
That argument rarely comes with specifics.

This tool asks the reader to provide those specifics themselves. Pick which cuts
you would make, from a list of actual line items with actual dollar amounts. See
whether the total reaches the tier gap you chose. See which state-law or
regulatory consequences your plan triggers. Decide whether your plan looks
materially different from what the Town Administrator proposed.

The tool is not an argument for or against the override. It is a sandbox for
the reader to test their own intuitions against the constraint math. Pro- and
anti-override readers should both feel it played fair.

## Scope

### In scope for v1

- Single-year view (FY27).
- Three tier targets at **FY27 draw amounts** from
  `data/override_draws_schedule.csv`: **Tier 1 = $1,269,564; Tier 2 =
  $2,805,236; Tier 3 = $4,296,718**. User-selectable, default Tier 1.
  The headline 3-year totals ($9M / $12M / $15M) appear as context in
  copy only, not as the target to close. Rationale: the override
  line items in `override_town_line_items.csv` are FY27 slices; summing
  all Tier 1 items gives $1,269,564, matching the Tier 1 FY27 draw. Using
  the 3-year headline as the target would make it impossible to close
  the gap even by cutting every listed item, because most tier dollars
  phase in FY28-FY29. The tool explicitly states this framing in the
  preamble.
- Discrete checkboxes for every item in `data/override_town_line_items.csv`
  (each item is the "Restore" or "Increase" line the town has already
  itemized).
- Scalar text input for the school top-line cut (default $1,500,000), with
  preset buttons ("Match Tier 1" / "Match Tier 2" / "Match Tier 3") that map
  to the school items in `data/override_school_items.csv`.
<!-- Road paving scalar removed; it is a regular checkbox. -->
- Consequences panel listing state-law / regulatory consequences triggered by
  the current plan. Updates live.
- Success state when the plan closes the selected tier gap: side-by-side
  comparison with the Town Administrator's proposed cuts, plus full list of
  consequences triggered.
- Cross-links from `no-override-budget.html` and `what-is-the-override.html`.

### Out of scope for v1

- Revenue-side toggles (meals tax, STR fee, parking, etc.). Covered in prior
  conversation: the realistic combined revenue-lever capacity is $500K-$1M,
  not needle-moving against a $9M gap, and adding a revenue panel dilutes
  the specific argument the tool is answering.
- Collective bargaining renegotiation as a lever. Too speculative to
  quantify honestly.
- Health insurance plan redesign under the 2011 Municipal Health Insurance
  Reform Act. Marblehead has already used that lever; no verifiable
  additional savings to list.
- Save/share plan via URL state. Nice to have, deferred to v2.
- Multi-year projections (FY28, FY29). V1 is FY27 only.
- Comparison of the reader's plan to other towns' historical cut choices.
- Mobile-first interactive drag-and-drop UI. Mobile is a responsive
  collapsed version of the desktop layout, not a separate experience.

## Design

### URL and framing

- New page at `balance-the-budget.html`.
- H1: "Balance the FY27 budget without the override."
- Preamble, 3-4 sentences, neutral tone per `STYLE_GUIDE.md`. Communicates
  the target (close the FY27 gap for the selected tier), the rule (no
  override means no new levy revenue), the multi-year context (the
  headline tier total is spread over three years; FY27 is the first-year
  slice), and the mechanic (choose cuts from a specified list). Must not
  editorialize about whether cuts are good or bad. Must not meta-narrate
  (no "This page lets you...", "This tool helps you..." per
  `CLAUDE.md`). Final copy to be reviewed against STYLE_GUIDE and
  CLAUDE.md at implementation time.

### Page layout (top to bottom)

1. **Preamble** (plain text, no callout box).

2. **Tier selector.** Three buttons with the FY27 target as the main
   number and the 3-year total as context:
   - "Tier 1 — FY27 gap: $1.27M (of $9M total over 3 years)"
   - "Tier 2 — FY27 gap: $2.81M (of $12M total over 3 years)"
   - "Tier 3 — FY27 gap: $4.30M (of $15M total over 3 years)"

   Default Tier 1. Switching tier prompts confirmation if any cuts are
   selected (prevents accidental plan loss).

3. **Running status bar**, sticky on scroll. Three values:
   - Target (e.g. "$9,000,000")
   - Cuts selected (live total of checked items + scalar values)
   - Gap remaining (target minus cuts selected; zero or negative = plan
     balances)

   When gap <= 0, bar background shifts to a neutral success color (use
   `--c-deep` or similar from existing palette; no green/red per
   `STYLE_GUIDE.md`) and the success block unfolds below.

4. **Cuts checklist**, grouped by `category` from
   `override_town_line_items.csv`:
   - Public Safety
   - Public Works
   - Recreation Library Parks
   - General Government
   - Health and Human Services
   - Other General Government

   Each row: checkbox, item description, dollar amount (right-aligned, match
   existing `.cut-row-dollar` style), and an inline mandate flag if the item
   has a consequence attached. Use the existing `.cut-row` / `.cut-row-name`
   / `.cut-row-dollar` classes from `no-override-budget.html` with additions
   for checkbox and flag columns. Do not introduce new color semantics.

5. **School section**. Top of section is a text input:
   - Label: "Your FY27 school cut: $"
   - Default value: 1,500,000 (the town's proposed FY27 cut)
   - Context note beneath the input: "No override tier restores school
     funding in FY27 (see `override_school_items.csv`). The $1.5M cut
     happens at every tier this year; tier restorations begin in FY28.
     Change this number to model cutting schools more or less than the
     town proposed."
   - The school cut number contributes to the running total as
     `(user_school_cut - 0)` — i.e., whatever the user enters is the
     savings the user is proposing, because the baseline (FY26 service
     level) would have been $1.5M higher than the no-override FY27
     budget. Default $1,500,000 matches the town's choice exactly.
   - Preset buttons: "Match town ($1.5M)", "Cut more ($2.5M)", "Cut less
     ($500K)", "Don't cut ($0)". These are editorial presets to show the
     tradeoff space; user can type any value.

6. (Intentionally removed.) Earlier drafts included a road paving
   scalar. Dropped: the town's no-override budget cuts paving by exactly
   $60,000 at every tier, represented by the "Restore Department of
   Public Works Hot Top Cuts" checkbox. No scalar needed; it is a
   regular discrete item.

7. **Consequences panel.** Right-hand sidebar on desktop
   (`position: sticky`). Collapsible accordion below the checklist on mobile.
   Each triggered consequence is a card with:
   - Consequence name (e.g. "MBLC library decertification")
   - Legal authority (e.g. "605 CMR 4.00; M.G.L. c. 78")
   - Effect, one paragraph
   - Optional link to primary source where one exists

   Panel title updates live: "0 consequences triggered" / "3 consequences
   triggered" etc.

8. **Success block**, hidden until gap <= 0. Contains:
   - Banner: "Your plan balances the Tier N gap."
   - **Comparison** to the Town Administrator's proposed cuts:
     - Total cuts in your plan vs. total in Town Admin's plan
     - Count of items you cut that the Town Admin also cut (overlap)
     - Items you cut that the Town Admin protected
     - Items you protected that the Town Admin cut
   - **Consequences list**, restated in full (same content as the live panel,
     but presented as a consolidated "here is what your plan does" summary).
   - Note text: neutral statement that these are the legal and regulatory
     consequences of the plan, not a judgment about whether the plan is
     good policy.

9. **Footer.** Reset button (clears all selections, returns scalars to
   defaults). Methodology link (a sibling page or inline disclosure). Cross-
   links: "See what the town proposed instead →" (to no-override-budget),
   "See what each tier restores →" (to what-is-the-override).

### Interaction details

- Checking a box adds its amount to the running total.
- Unchecking subtracts.
- Scalar inputs add their value (school cut text field, hot top cut text
  field) to the running total as typed. Empty or non-numeric input is
  treated as 0.
- Consequence triggering is deterministic: each checkbox or scalar
  threshold is mapped to zero or more consequence IDs in the data file.
  When the item is checked (or the threshold is crossed), its consequences
  appear in the panel; when unchecked or threshold uncrossed, they
  disappear.
- Over-cutting is allowed. If the user's plan exceeds the tier target,
  the gap-remaining value goes negative and the status bar shows "$X over
  target." The success block still unfolds because the plan closes the
  gap.
- Switching tiers resets the plan with a confirmation prompt if any box is
  checked or any scalar is non-default.
- Tier switch does NOT change the available checklist (every item is
  available at every tier); it only changes the target number. The
  checklist is always the full set of town-proposed restorations.

## Data model

### Items data file

New file: `data/balance_budget_items.json`, generated by a small script from
the two existing CSVs plus hand-authored consequence IDs. One-time generation,
checked into the repo. If the CSVs are updated, the JSON file is regenerated.

```json
[
  {
    "id": "library_accreditation",
    "category": "Recreation Library Parks",
    "department": "Library",
    "description": "Restore Abbot Library staffing for MBLC accreditation",
    "amount": 311183,
    "type": "discrete",
    "consequences": ["mblc_decertification"],
    "source_csv_row": 11
  },
  {
    "id": "sro_position",
    "category": "Public Safety",
    "department": "Police",
    "description": "Restore Police Department School Resource Officer",
    "amount": 65482,
    "type": "discrete",
    "consequences": [],
    "source_csv_row": 2
  },
  {
    "id": "schools_cut",
    "category": "Schools",
    "department": "Schools",
    "description": "Your proposed school cut (FY27)",
    "type": "scalar",
    "default": 1500000,
    "presets": {
      "tier_1": 1500000,
      "tier_2": 0,
      "tier_3": 0
    },
    "consequences": [
      {"threshold_gt": 2500000, "id": "nss_floor_violation"}
    ]
  }
]
```

Two item shapes: `discrete` (checkbox, fixed amount, consequences fire on
check) and `scalar` (text input, continuous amount, consequences fire at
threshold).

### Consequences data file

New file: `data/balance_budget_consequences.json`. Hand-authored. One entry
per consequence, keyed by ID.

```json
{
  "mblc_decertification": {
    "name": "Library loses MBLC state certification",
    "authority": "605 CMR 4.00; M.G.L. c. 78 ss 19A, 19B",
    "effect": "Abbot Library is decertified by the Massachusetts Board of Library Commissioners. Effects: NOBLE reciprocal borrowing suspended (residents cannot borrow from other MA libraries; other libraries can refuse to lend to Marblehead); state aid withheld; federal LSTA pass-through grants unavailable. (State aid dollar amount to be verified from MBLC State Aid to Public Libraries FY26 distribution report before publication; see 'Numbers requiring verification during implementation' below.)",
    "links": [
      {"label": "605 CMR 4.00", "url": "https://www.mass.gov/regulations/605-CMR-4-00-the-massachusetts-board-of-library-commissioners"}
    ]
  },
  "nss_floor_violation": {
    "name": "School budget below Net School Spending floor",
    "authority": "M.G.L. c. 70; Chapter 12 of the Acts of 2010 (Achievement Gap Act)",
    "effect": "District falls below the minimum Net School Spending requirement. DESE can intervene. For sustained underfunding, DESE may designate the district Level 5 and appoint a state receiver with full managerial authority, as happened with Lawrence (2011), Holyoke (2015), and Southbridge (2016).",
    "links": [
      {"label": "Chapter 70 overview", "url": "https://www.doe.mass.edu/finance/chapter70/"}
    ]
  }
}
```

### Consequence list for v1

Scoped to consequences that can be deterministically triggered by an item or
scalar in the tool. Pension contributions, debt service, and state
assessments are not toggleable in v1 (they are fixed costs not in the
override line items), so no consequences tied to them. Bulletproof citation
over breadth.

1. **MBLC library decertification.** Triggered when
   `library_accreditation` is unchecked. Cites 605 CMR 4.00 and M.G.L.
   c. 78 ss 19A, 19B.
2. **MBLC Materials Expenditure Requirement violation.** Triggered when
   `library_materials` is unchecked. Cites 605 CMR 4.01(7). (MER is a
   separate MBLC floor from MAR; worth splitting so the tool accurately
   reflects both.)
3. **Net School Spending floor violation.** Triggered when
   `schools_cut` exceeds the NSS gap-to-floor threshold. Cites M.G.L.
   c. 70 and the 2010 Achievement Gap Act. Threshold requires computing
   the FY27 gap between Marblehead's proposed spend and its NSS
   requirement; documented in implementation notes below.
4. **OPEB trust funding skipped.** Triggered when `opeb_transfer` is
   unchecked. Not a mandate violation; a rating-agency and GASB 75
   disclosure flag.
5. **Stabilization fund transfer skipped.** Triggered when
   `stabilization_transfer` is unchecked. Rating-agency flag;
   M.G.L. c. 40 s 5B context.
6. **Workers Comp / Section 111F transfer below funded level.**
   Triggered when `workers_comp_transfer` is unchecked. Cites M.G.L.
   c. 152 and c. 41 s 111F.
7. **School Resource Officer eliminated.** Triggered when `sro_position`
   is unchecked. Not a mandate violation; a named policy consequence
   worth surfacing because it is the most politically visible cut in
   the Tier 1 restoration list.

Each consequence card in the live panel includes a primary-source link
where one exists, per `CLAUDE.md`: "Every number should be traceable to a
primary source."

### Numbers requiring verification during implementation

The following consequence effects cite dollar figures that need primary-
source verification before the page goes live:

- Library state aid amount (I have used "approximately $40,000 per year"
  based on general MBLC formula knowledge; actual Abbot Public Library
  state aid for FY26 should be pulled from the MBLC State Aid to Public
  Libraries distribution report). If the verified number is not
  available, the consequence text should state the loss qualitatively
  ("state aid withheld") without a specific dollar amount.
- Net School Spending floor threshold for FY27. DESE publishes the
  required NSS amount per district each year. The threshold used to
  trigger the NSS consequence must come from the DESE Chapter 70 aid
  calculation for Marblehead, FY27.

## Consequence sources

Legal-authority citations required for each consequence. Research scope:

- **MBLC certification:** 605 CMR 4.00; M.G.L. c. 78 ss 19A, 19B.
- **Net School Spending / DESE intervention:** M.G.L. c. 70; Chapter 12 of the
  Acts of 2010 (Achievement Gap Act).
- **PERAC / pension funding:** M.G.L. c. 32 s 22D; PERAC funding schedules.
- **Debt service / bond covenants:** not a statute citation; explain as bond
  indenture contractual language and rating agency methodology (Moody's,
  S&P).
- **Workers Comp:** M.G.L. c. 152.
- **DLS tax rate certification:** M.G.L. c. 59 s 23.
- **OPEB trust:** GASB 74/75 accounting standards; M.G.L. c. 32B s 20.
- **Emerson College v. Boston** (fee-vs-tax test): already sourced in
  `data/case_law_fee_vs_tax.md`.

Each consequence card links to the authority where a web-addressable link
exists.

## Visual design

- Reuse `.cut-row` layout pattern from `no-override-budget.html` with
  extensions for checkbox and flag columns.
- Reuse `.calc-input` pattern from `senior-tax-relief.html` for scalar
  inputs.
- No new colors introduced. No green/red value judgments per
  `STYLE_GUIDE.md`.
- Status bar uses existing neutral palette: muted text for gap, slightly
  emphasized for zero or negative gap.
- Consequences panel uses `.already-decided` or similar soft-border pattern
  from `question-2-trash.html`.
- Typography and spacing match existing site conventions via
  `assets/site.css`.

## Implementation notes

- Pure client-side JavaScript. No build step beyond Jekyll's existing
  pipeline. Matches existing calculator pattern.
- Single page script (new file under `assets/` or inline in the page).
- Data files read at page load; no API calls.
- No tracking or analytics beyond what the site already has.
- Progressive enhancement: if JS is disabled, show a static version of the
  checklist as an information list with dollar amounts, and a note that the
  interactive version requires JavaScript. Does not need to be functional
  without JS.

## Testing

Because there is no local Jekyll dev server (per `CLAUDE.md`), testing is:

1. Visual and functional verification on the Cloudflare Pages preview URL
   after opening the PR.
2. Check that:
   - Each checkbox correctly updates the running total.
   - Scalar inputs accept numeric entry and update the total.
   - Consequences appear/disappear at the right thresholds.
   - Tier switching resets cleanly.
   - Success block unfolds at gap = 0 or below.
   - Mobile layout collapses consequence panel into an accordion.
   - Reset button clears all state.
3. Cross-browser check on the preview URL (Safari mobile, Chrome desktop
   at minimum).

No automated tests. This is a small client-side widget, matching existing
site practice.

## Deployment

- Build PR as usual; preview URL from Cloudflare Pages (sticky
  `preview-url` comment on the PR).
- Post preview URL to the user for live review before merging, per
  `CLAUDE.md`.
- Default to manual merge, not auto-merge, per `CLAUDE.md`.

## Open questions for later

- Save/share plan via URL state (v2 candidate).
- Extend to FY28 / FY29 with the school-side tier restorations that span
  multiple years (v2 candidate; `override_school_items.csv` has the data).
- Adding a short list of items the reader could NOT cut even if they
  wanted to (debt service, pension contribution, state assessments) as a
  grayed-out "untouchable" section at the bottom, to surface the
  structural-cost math. Not in v1 but worth considering if reader feedback
  suggests the tool feels arbitrary.
