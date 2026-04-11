# Spending Story and Homepage UX: Design

**Date:** 2026-04-10
**Scope:** One new long-form page, one new homepage section, one hero trust signal.

## Problem

The site answers many tough questions about the FY2027 override, but two specific concerns that drive no-votes have no front door in the current information architecture:

1. **"Will my money be wasted?"** The sharpest objection a skeptical voter raises is that the town already gets plenty and spends it badly. The existing Cost Drivers section explains *why* costs rose (health insurance, enrollment vs staffing), but causal explanation is not accountability. A skeptic reads "enrollment down, staffing up" as evidence of waste, not vindication.
2. **"How has the money actually been spent?"** There is no page that stitches Marblehead's 21 years of audited data into a narrative. The charts show slices. No page says "here is where each additional dollar went."

Both concerns point at the same missing artifact: a narrative walkthrough of Marblehead spending that is honest about what grew, surfaces the independent oversight that already exists, and presents verifiable criticisms rather than dodging them.

The current homepage also buries the site's strongest trust signal (full source traceability) in an appendix-style "Data & Sources" section at the bottom.

## Goals

- Give a skeptical voter an obvious entry point for the waste question without requiring persona routing or restructuring.
- Present Marblehead's spending history as a coherent story grounded in data already in the repository.
- Present verifiable criticisms (school staffing growth vs falling enrollment, recent town counsel increase, retiree benefits trust contribution zeroing out, reliance on leftover surplus from prior years) as facts with sources, without framing.
- Surface the existing independent oversight (outside audits, state certifications, Finance Committee reports) as the site's answer to "is anyone watching."
- Preserve the current Q&A format, tone, and existing cards on the homepage. Additions are welcome; restructuring of existing content is not. No persona routing, no marketing copy.
- Follow the site's existing writing preferences: minimize acronyms, neutral framing, no em-dashes, every claim linked to a primary source.

## Non-goals

- Redesigning the homepage around voter personas.
- Restructuring existing cards, sections, or tags.
- Writing new copy for existing pages.
- Introducing any new visual style or component library.
- Changing any existing chart or calculator.
- Editorializing. The page must not frame data as supporting or opposing the override.

## Design

### Piece 1. New page: `where-has-the-money-gone.html`

A single scroll-to-read page. Five sections, top to bottom. No tabs, no toggles beyond an optional longer-context expansion.

**Section 1. Hero**

One-sentence claim and scope statement. Example copy: *"The property tax levy doubled from $39M in 2005 to $82M in 2024. Here is where every additional dollar went, who has been checking the books, and what grew faster than it probably should have."* Headline time window is 2015 to 2026 (ten years). An optional `<details>` disclosure labeled *"Show the full 2005 to 2026 view"* can wrap an additional chart or table for readers who want the fuller arc. Implementation of the disclosure is deferred and may be cut if the page reads cleaner without it.

**Section 2. Act 1: Where it went**

The answer-in-one-chart moment. A stacked area chart showing Marblehead spending from 2015 to 2026, broken into six plain-language categories:

- Health insurance
- Pensions
- Debt payments
- Schools
- Public safety
- Everything else

Prose underneath quantifies the allocation of the additional annual spending since 2005 across these buckets. Sources are the 21 independent annual audits in `data/acfr/` plus the FY27 proposed budget.

Followed by a department-by-department table comparing 2015 and 2026 for every general-fund line item the audits cover. Static HTML, not interactive. Rows ordered by absolute dollar delta, largest first, so the departments driving the change surface at the top. Deltas shown in both dollars and percent. No color coding that implies judgment (per writing preferences). The table is the "prove it" backing to the headline chart.

**Section 3. Act 2: Who has been checking the books**

A plain-language list of the independent reviewers who have signed off on Marblehead's finances in the past ten years. Each with a one-line description of what the review actually checks, in terms a resident would recognize:

- Independent annual audit (outside accounting firm, every year 2001 to 2024)
- State Department of Revenue tax rate certification (every year)
- State pension regulator actuarial review (every two years)
- Finance Committee reports (2016, 2019, 2021, 2022, 2025, 2026)
- Auditor management letters (publicly posted for recent years)
- Town Meeting votes on the annual budget

Short prose on what reviewers have flagged over the years, specifically the Finance Committee's repeated warning about using leftover surplus from prior years ("free cash") to balance the budget. The framing is descriptive: "here are the checks that exist; here is what they have found," not "everything is fine."

**Section 4. Act 3: What grew faster**

Neutral section title: *"The lines that grew faster than enrollment, inflation, or headcount would explain."* Four bulleted items, each linked to a specific primary source, stated as facts with no framing:

- School staffing up 9.6% while enrollment fell 19% between 2015 and 2024. With special education and state-mandated service context noted as known partial explanations.
- Town counsel up 142% between the FY2026 and FY2027 budgets.
- The retiree benefits trust contribution being zeroed out in the no-override budget.
- Leftover surplus from prior years used to balance the operating budget for several years running, a pattern the Finance Committee has flagged repeatedly.

Each bullet links to the specific document or line item. No commentary beyond what the source says.

**Section 5. Close**

Short closing section. States what the record shows and what it does not show. Links to `what-is-the-override.html`, `charts/override_calculator.html`, and `charts/sustainability.html`. No flowery ending.

### Piece 2. Homepage changes

Three edits to `index.html`:

1. **Inline trust signal in the hero.** Add a "See all sources" link to the hero paragraph pointing to the existing Data & Sources section (via anchor `#data-sources`). One line. No new component, no layout shift.

2. **New section: "The record".** Insert between the existing "The override" section and the existing "Cost drivers" section. Contains one card linking to `where-has-the-money-gone.html`:
   - Title: *Where has Marblehead's money gone?*
   - Description: *A ten-year walkthrough of how Marblehead has actually spent the tax levy, who has been checking the books, and what grew faster than enrollment or inflation would explain.*
   - Tag: `Analysis`

3. **Anchor on Data & Sources.** Add `id="data-sources"` to the existing `.data-section` element so the hero link targets it. No other change to that section.

### Piece 3. Writing discipline

All copy on the new page and the new homepage card follows the existing site writing preferences:

- Minimize acronyms in user-facing text. ACFR → "independent annual audit," PERAC → "state pension regulator," OPEB → "retiree benefits trust," DOR → "state Department of Revenue," FTE → "staffing" or "full-time positions," free cash → "leftover surplus from prior years" (with the term parenthetically on first use for readers who already know it). FY is acceptable given existing site usage.
- No em-dashes.
- No framing of data as supporting or opposing the override.
- No color coding that implies judgment (no green/yellow/red).
- Every factual claim links to a primary source.
- Every official quote requires a hard-copy primary source (not news paraphrases).

## Architecture

- New file: `where-has-the-money-gone.html` at repo root, alongside the existing long-form pages (`what-is-the-override.html`, `what-fails.html`, `why-not-elsewhere.html`).
- Reuses the existing `assets/site.css` stylesheet unchanged. All necessary classes (`.page`, `.card`, `.section-label`, `.takeaway`, `.notes`, `.source`, `.back`, `.cut-item`, chart classes) already exist.
- One new inline SVG chart for the stacked spending categories. Built by hand in the same style as existing charts (see `charts/real_cost_comparison.html` and `charts/sustainability.html` for reference patterns). Uses existing `.chart` and `.s-*` series classes.
- The department-by-department table uses the existing `.table-wrap` + `table.data` pattern already present in the CSS.
- `index.html` edits are additive and local. No CSS changes required.

## Data sources

All content draws exclusively from files already in the repository:

- `data/MASTER_DATA.csv`: 2001 to 2027 annual rollup (tax levy, staffing, enrollment, health insurance, pensions)
- `data/acfr/`: 21 independent annual audits, FY2004 to FY2024 (gitignored, referenced via footnotes)
- `data/FY26_budget_summary.json`: current budget line items
- `data/revenues_FY15-24.csv`, `data/employee_benefits_FY15-24.csv`, `data/fte_employees_FY15-24.csv`, `data/pension_expenditure_FY15-24.csv`, `data/education_expenditure_FY15-24.csv`: the ten-year window backing the headline
- `data/2016_FinCom_Report.pdf` through `data/2026_FinCom_Report.pdf`: Finance Committee reports for Act 2
- `data/FY22_Management_Letter.pdf`, `data/FY23_Management_Letter.pdf`: management letters
- `data/PERAC_Marblehead_Valuation_2024.pdf` (and earlier): state pension regulator valuations
- `data/2026-04-08_Override_Presentation.pdf`: current override presentation for the Act 1 comparison
- FY27 proposed no-override budget (already linked from `what-fails.html`)

## Testing

This is a static content site. Verification is manual:

- Open the new page in a local browser. Check that every section renders, the chart displays correctly, and all source links resolve to real documents.
- Spot-check every numerical claim against its cited source before considering the page complete. Per the data accuracy feedback memory, news reports are not sufficient. Primary documents only.
- View the homepage. Confirm the new "The record" section appears between "The override" and "Cost drivers," the inline hero link jumps correctly to `#data-sources`, and no other section has shifted.
- Check light mode and dark mode in the browser. The existing CSS handles both via `prefers-color-scheme`; the new page should inherit correctly.
- Check mobile layout (viewport narrower than 600px). The existing responsive rules cover the page shell, chart text, and tables.

## Risks and open questions

- **Town counsel +142% is listed as a verifiable fact, but the reason is unknown.** The page should state the delta without speculating on the cause. If a primary source explaining the increase exists in the data directory or in a linked meeting record, cite it. If not, state that the reason is not publicly documented.
- **School staffing growth needs special-education context to be honest.** The 9.6% headline is real, but special education and state-mandated services are a substantial driver. The page must include this context without using it to dismiss the headline.
- **Stacked category boundaries are a choice.** The six categories proposed (health insurance, pensions, debt payments, schools, public safety, everything else) must be built from line items in the audits, and the mapping should be documented in the page's footnotes so a reader can verify the buckets.
- **The longer-context 2005 to 2026 view is optional in this spec.** If implementation reveals that the earlier years pull focus or confuse the story, it can be cut without loss of core meaning.

## Out of scope (explicitly deferred)

- Persona-based homepage restructuring.
- New landing pages per voter archetype.
- Any change to existing charts, calculators, or analysis pages.
- Any change to the navigation or brand.
- Writing posts or Facebook content derived from the new page.
