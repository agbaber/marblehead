# Outcome assessment: data gaps from the minutes-catalog prototype

**Context.** The `claude/minutes-extraction-prototype` branch produces two
companion pages from 331 catalog entries:

- `is-the-board-trying.md` — catalog of attempts
- `what-have-we-tried.md` — attempts organized by topic

Natural next question: for any given attempt, did the fiscal outcome
actually move? A "What came of it?" third page would pair the activity
record against actual financial data.

This note inventories what the repo can and cannot support for that
kind of outcome check, based on spot-checks across six attempts.

## What the method can do today

For each attempt, extract:

1. The original claim from the meeting where it was made (quote, date, body).
2. Follow-up mentions in the same minutes corpus (the board's own description
   of what happened next).
3. Check against financial data in the repo where a line item exists.

## Prototype spot-checks

| # | Attempt | Activity traceable in minutes? | Outcome checkable in repo? | Notes |
|---|---|---|---|---|
| 1 | Feb 2021 "free cash unsustainable" warning | Yes | Yes | `free_cash_operating_history.csv` shows draws peaked FY23 at $10.2M then fell to $5M proposed FY27. Warning language re-appears as formal policy by Dec 2025. |
| 2 | 2023 SPED audit + program internalization | Yes | No | No SPED-tuition-only time series in repo; `education_expenditure_FY15-24.csv` is district total with a FY22→23 classification swing. |
| 3 | Bell → Brown school consolidation (4 → 1) | Yes | Partial | DESE `dese_total_educator_fte.csv` shows staffing decline (501.8 FY15 → 431.8 FY24). ACFR FTE series is the wrong one to use — `inside-school-staffing.html` already documents the FY23 counting-methodology issue. |
| 4 | 2023 failed override | Yes | Yes (DESE) | DESE FTE dropped ~14 post-override (FY23→FY24), not the full 33 the reduced-services budget named. Cumulative ~23 through FY25. |
| 5 | Apr 2024 OPEB $250K reduction | Yes | No | `employee_benefits_FY15-24.csv` bundles OPEB with active health, Medicare, life, dental. No OPEB-only series. |
| 6 | 2025 multi-year union MOAs (police, IUE/CWA) | Yes | Not yet | Contracts start FY26; wait for FY26 ACFR. |

## Data gaps, ranked

### Tier 1 — blocks multiple prototypes

1. **SPED tuition line, annual, FY15+.** Blocks #2. Source: school operating budget exhibits in ACFRs; school budget PDFs; possibly Schedule 19.
2. **Adopted school operating budget, annual, FY15+.** Blocks #4 precision and any override-vs-no-override comparison. Source: FinCom reports, school budget PDFs.
3. **OPEB funding schedule: ARC, actual contribution, funded ratio, assets, by FY.** Blocks #5. Source: ACFR notes on OPEB, PERAC valuations.

### Tier 2 — unlocks specific prototypes

4. **Building-level school operating cost (utilities, custodial, maintenance) before and after Brown opening.** Quantifies the operating side of #3.
5. **MSBA reimbursement actually received for Brown School project.** Confirms the 37.08% headline in the 2019 MSBA Project Scope and Budget Agreement.
6. **Property sale proceeds: Gerry (sold), Coffin (pending).** Offsets Brown capital cost for a net-project-cost view.
7. **Circuit Breaker offset history, annual.** Complements the SPED tuition series.

### Tier 3 — polish

8. **Fix or annotate `education_expenditure_FY15-24.csv`.** The FY22 $38M / FY23 $60M / FY24 $51M swing is almost certainly a classification shift, not real.
9. **Backfill FY18–FY21 free cash in `free_cash_operating_history.csv`.** Strengthens #1.

## What the repo already does well

- `free_cash_operating_history.csv` — clean enough for #1.
- `dese_total_educator_fte.csv` and related DESE series — clean, preferred over ACFR FTE for school staffing questions.
- `dor_override_history_all.csv` and `dor_debt_exclusion_all.csv` — statewide coverage.
- `gic_premium_rates_FY19-26.csv` — usable for healthcare context if healthcare attempts ever get indexed.

## Notes on voice if a "What came of it?" page is drafted

CLAUDE.md and STYLE_GUIDE forbid verdict framing ("the warning worked,"
"override failure cost the schools X"). The draft writeups in this
conversation used that language; a shipping version needs to restate
the same facts without editorial loading.

- "Free cash draws peaked at $10.2M in FY23 and have declined in each
  subsequent adopted budget" — fine.
- "The warning worked" — not fine.
- Override outcomes should not be presented as green/red — some residents
  read a position reduction as a loss, others as a correction. State
  numbers, let readers weigh them.

## Cross-check before publishing

The prototype caught one case where a prototype verdict contradicted
existing site content: using the ACFR FTE series for schools when
`inside-school-staffing.html` already documents that series as noisy.
Every outcome claim should be sweep-checked against existing pages
(at minimum `inside-school-staffing.html`, `where-has-the-money-gone.html`,
`how-we-got-here.html`) before it lands.

## Suggested sequence

1. Land the two companion pages on the minutes-extraction branch as
   drafts (sitemap: false, not yet linked).
2. Build Tier 1 item #1 (SPED tuition series) as its own PR.
3. Draft "What came of it?" page structure without outcome content, to
   agree on voice and layout.
4. Fill prototypes #1 and #4 first — they have clean data.
5. Backfill the remaining prototypes as Tier 1 data lands.
