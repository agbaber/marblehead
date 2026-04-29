# General Government Over Time — design

Standalone multi-view chart page answering *"how has general government spending changed over time, in real terms, and how does Marblehead compare to peer towns?"*

## Why this page

General government (the select board, town admin, finance, clerk, assessor, IT, legal, treasurer/collector) is a frequent target in override debates — *"trim the fat at town hall"* — but the site currently has no time-series view of it. Schedule A data goes back to FY02 for Marblehead and 16 peer towns. The data is sitting in `data/peer_schedule_a_expenditures.csv` unused.

The page is factual, not polemical. It states the trajectory and lets the reader decide whether GG looks bloated or compressed. Per editorial stance: no green/red value judgments, no advocacy framing.

## Page location and shape

- **File:** `charts/general_government_over_time.html`
- **Layout:** Jekyll page (default `layout: page`), follows the structure of `charts/healthcare_costs.html` exactly: `<h1>` + subtitle + intro paragraph + three numbered `<h2>` sections, each with one chart, a legend, and a 1-2 paragraph caption stating facts (no conclusions).
- **Scripts:** `[chart-tooltip]` for hover values on the SVG charts.
- **OG tags:** `og_title`, `og_description`, `og_url` filled in.

## The three views

### View 1 — Indexed growth, FY02-FY24

Single line chart, three series, all = 100 at FY02:

- **Marblehead general government** (Schedule A `general_government` column)
- **Marblehead total expenditures** (Schedule A `total_expenditures` column)
- **CPI-U** (`data/cpi_us.csv`, national All Urban Consumers, calendar year matched to fiscal year, indexed to 2002)

Answers: *did GG grow faster or slower than the rest of the town budget, and faster or slower than inflation?*

Annotation calling out any year where the lines visibly diverge (to be identified during implementation by inspecting the actual data; not pre-committed in the spec).

### View 2 — Real per-capita, FY02-FY24

Single line chart, single series:

- **Marblehead GG per resident, in 2024 dollars**
- Source: Schedule A `general_government` ÷ `data/demographics_FY01-24.csv` `Population`, then deflated by `data/cpi_us.csv` to 2024 dollars.

Y-axis is dollars. X-axis is FY02-FY24. Faint horizontal line at the 23-year mean for context.

Answers: *in real per-capita terms, has the GG burden grown, held flat, or fallen?*

### View 3 — Peer comparison, FY24 snapshot

Horizontal bar chart, sorted ascending by FY24 GG per capita:

- **9 bars:** Marblehead + 8-town wealthy-suburb cohort (Brookline, Wellesley, Hingham, Winchester, Lexington, Needham, Newton, Natick) — same cohort used in `charts/peer_compensation.html`
- **Marblehead bar in `s-emphasis` color**, peers in neutral.
- Per-capita values use FY24 Schedule A divided by population from `data/dor_income_eqv_pop_FY27.csv`. The population field reflects the most recent DOR vintage (FY27 dataset), not FY24 specifically. For these towns, populations move <2% over a few years, so the approximation is fine for ranking but a chart caption footnote will explicitly state the population vintage.
- Caption states where Marblehead ranks (e.g. "3rd lowest of 9").

Answers: *where does Marblehead sit on this category vs. similar towns?*

Per existing feedback memory ("bar charts always climb"), sort order is ascending by value — lowest at top, highest at bottom — regardless of where Marblehead lands.

## Definitional callout

Below view 1, an info box ("Why this number isn't $6.89M"):

> The Schedule A "general government" total for Marblehead in FY24 is $3.31M. The town's internal FY27 budget shows $6.89M for "general government," because Marblehead's local grouping rolls in some functions that DOR's Schedule A categorizes elsewhere (notably facilities and IT). For peer-comparable history, this page uses the DOR Schedule A definition. For the local FY27 figure, see [Where the money goes](budget_flow.html).

## Data sources

| File | Used for | Coverage |
|---|---|---|
| `data/peer_schedule_a_expenditures.csv` | GG and total expenditures by town/year | 17 towns, FY02-FY24 |
| `data/demographics_FY01-24.csv` | Marblehead population for per-capita | FY01-FY24 |
| `data/cpi_us.csv` | Real-dollar deflator and CPI-indexed line | 1988-2024 |
| `data/dor_income_eqv_pop_FY27.csv` | Peer-town population for FY24 per-capita | All 351 towns, single year |

Source attribution in the page subtitle: *"Source: Massachusetts DOR Schedule A municipal expenditure reports, BLS CPI-U All Urban Consumers (US), and DOR per-capita income and population dataset."*

Each chart caption cites the specific file. Per the project rule (every number traces to a primary source), the SOURCE_LOOKUP.md will get one new entry pointing to the DOR Schedule A program.

## Style conformance

Per `STYLE_GUIDE.md`:

- No inline `style=""` on SVG; all styling via classes in `assets/site.css` (reuse `s-revenue`, `s-neutral`, `s-emphasis`, `data-line`, `chart` etc.).
- No em-dashes in body copy; use "and" or hyphen.
- No editorial language in captions ("modest", "concerning", "good news"). State the number, state what it measures, end.
- No green-good / red-bad on bars. Use neutral cohort color + emphasis color for Marblehead.
- Acronyms wrapped: `<abbr class="g" title="...">DOR</abbr>`, etc., on first use per page.

## Linking from elsewhere

- `index.html`: add to the existing chart index (or relevant Q&A card if one fits — likely "What does the town spend on?" type question).
- `charts/budget_flow.html`: footnote on the General Government slice linking here.
- `charts/healthcare_costs.html`: add to the "Read next" block if it has room.
- `data/SOURCE_LOOKUP.md`: add Schedule A entry.

## Out of scope (explicit YAGNI)

- **No projection** to FY25-FY27. Schedule A FY25 hasn't been published yet (CSV shows zeros). The chart ends FY24.
- **No expansion to all 17 towns.** The 8-town cohort is the right peer set; the rest of the CSV stays available for future drill-down via Town Explorer.
- **No breakdown of GG sub-departments** (select board vs finance vs clerk vs IT). Schedule A doesn't break it down, and the town-internal data that does isn't peer-comparable.
- **No interactive year selector.** Static SVGs with hover-on-line tooltips, same as healthcare_costs.html.
- **No "fix this" call to action.** Page is factual.

## Success criteria

- All three charts render at 1440px and 375px viewports without layout breakage.
- Chart-tooltip hover shows correct dollar / index values per FY.
- Numbers in view 1 and view 2 reconcile: nominal GG / population / CPI deflator gives the real-per-capita value.
- Peer-comparison sort order is ascending; Marblehead's rank stated correctly in caption.
- All acronyms (`DOR`, `CPI-U`, `GG`, `OPEB`) are `<abbr>`-wrapped on first use.
- No inline `style=""` attributes.
- No editorial language flagged by site lint (CLAUDE.md content guardrails).
- Smoke test (`npm run test:local`) passes, including any new test added for the new page.
