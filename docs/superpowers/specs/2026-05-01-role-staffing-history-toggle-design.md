# Role staffing history toggle chart

## Goal

Add a historical role-by-role FTE chart to `inside-school-staffing.html` so
readers can see how each major staffing category in Marblehead has changed
over the last 19 years and whether peer districts followed the same
trajectory. The page currently shows only a SY2025–26 snapshot.

## Source data

DESE EPIMS via the E2C Hub Socrata API
(`educationtocareer.data.mass.gov/resource/j5ue-xkfn.json`).

- Coverage: SY2008 through SY2026 (19 years)
- Districts pulled: Marblehead, Melrose, Swampscott, Stoneham
- Granularity: `jobclass_cat` (12 categories) plus selected `jobclass`
  rows aggregated where the page's role definitions cross categories
  (paraprofessionals, tutors, school counselors all live under
  `Instructional Support Staff` in EPIMS but are reported separately on
  this site)
- Output file: `data/dese_role_staffing_history.csv`
  (district, school_year, role_category, fte, source)

## Roles included in the toggle

Seven curated roles, ordered by SY2026 Marblehead FTE:

1. Tutors (default)
2. Paraprofessionals
3. Co-teachers
4. Special ed related staff
5. School counselors
6. Administrators
7. Teachers (core)

Cut: Instructional coaches, Teachers support content, Office and
clerical, Medical and health, Instructional support and SPED shared.
The full source CSV is linked from the chart's caption for anyone who
wants the rest.

## Chart UI

- Placement: within the existing "What the positions are" section, after
  the SY2026 bar chart and the tutor-classification data note, before
  the section closes. Adds historical context to the snapshot already
  on the page.
- Layout: inline SVG line chart, viewBox 720×360, four lines per role
  (Marblehead emphasized, three peers muted). Colors reuse existing
  `.s-marblehead`, `.s-melrose`, `.s-swampscott`, `.s-stoneham` classes
  from `assets/site.css`.
- X axis: SY2008 through SY2026 with sparse labels (every ~3 years).
- Y axis: starts at 0; max scales to the selected role's max value
  across all four districts (rounded up to a clean number) so the
  visual baseline doesn't lie when the user toggles.
- Toggle UI: row of seven labeled radio buttons / pill buttons above
  the chart. Active button uses the existing focused-state styling.
  Mobile: buttons wrap to two rows.
- Implementation: pure inline `<script>` block on the page reading data
  from a JSON `<script type="application/json">` embedded next to the
  SVG. No new global script file. No build step.
- Accessibility: each line has its district label rendered as a small
  text annotation at the right end of the line, not just in a separate
  legend, so screen-reader users and color-blind users get the same
  identification.

## Caption and source citation

Caption pattern matches existing charts on the page:

> "Staff FTE by role, four North Shore districts, SY2008 through
> SY2026. Click a role above to switch the chart. DESE EPIMS via E2C
> Hub Socrata API."

Source link in the `<sup class="cite">` points to
`data/dese_role_staffing_history.csv`.

## Build and verify

- Pull script committed under `scripts/pull_dese_role_history.py`,
  idempotent (just re-fetches if the file is missing or stale).
- After committing the chart change, run `npm run dev` locally and
  capture two Playwright screenshots into `proof/`:
  the chart in default state (Tutors selected), and one alternate
  toggle state (e.g. Counselors) to prove the toggle works.
- Open a PR; link the Cloudflare Pages preview URL in the PR body
  once available.

## Out of scope

- No change to the existing SY2026 bar chart.
- No change to `enrollment_vs_staffing.html`.
- No new page in `charts/`. The chart lives inline on the staffing
  page where its narrative context already sits.
