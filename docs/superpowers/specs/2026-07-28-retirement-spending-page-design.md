# Retirement Spending Page — Design

**Date:** 2026-07-28
**Working title:** "What Marblehead spends on retirement"
**Proposed filename:** `retirement.html` (final name TBD in plan)

## Purpose

A standalone, plain-language explainer of what the town spends on employee
retirement benefits. Today retirement appears only as a stacked-area layer in
`where-has-the-money-gone.html` and a locked tier in
`what-is-actually-flexible.html`. There is no page a resident can read to
understand the two very different promises the town makes — a pension and
retiree health insurance (OPEB) — and how differently they are being funded.

## Audience and voice

- **Zero-context reader.** Someone who has never heard the words "OPEB,"
  "funded ratio," or "PERAC" must be able to read the main column top to
  bottom and come away with an accurate mental model.
- **Plain voice throughout**, matching the lead sections of the other content
  pages (see `feedback_plain_voice`). No drift into a dense, formal register in
  later sections.
- **Progressive disclosure.** Nuance, deep-dives, and the technical
  reconciliations live in optional `<details>`/expander blocks so the main read
  never clogs. Every interesting rabbit hole is available but never mandatory.
- **No editorial thumb on the scale** (README + STYLE_GUIDE editorial stance).
  Present the one real policy choice (pre-fund OPEB vs pay-as-you-go) without
  telling anyone how to vote. Neutral semantic colors, no green-good/red-bad.

## The animating spine (three parts, as the user framed it)

1. **How did we get here** — the town runs its own pension system and pays into
   it every year; that bill has grown. OPEB (retiree health) is the mirror
   image: never pre-funded, so a large promise accumulated off-budget.
2. **Is it sustainable?** — the pension is ~5% of the general fund and on a
   fixed schedule to be fully funded by FY2036; that part is fine. The genuine
   risk is OPEB: ~3.4% funded, ARC far above what's paid, FY27 transfer cut to
   $0.
3. **Can we change it? Should we?** — pension benefit levels are locked by
   state Chapter 32 + collective bargaining; the town cannot cut them. The one
   real local lever is whether to pre-fund OPEB or keep paying as the bills come
   due. Lay out the tradeoff, no recommendation.

## The core honest reframe

A zero-context reader arrives believing retirement is a runaway "huge %" of the
budget. The page opens with the question they'd actually ask ("aren't we
spending a fortune on retirement?") and answers it plainly:

- The **pension** is the *most predictable* big line the town has — fixed PERAC
  schedule, full funding by **FY2036**.
- The **real** sustainability problem is **OPEB**, precisely because it is a
  choice the town keeps making to defer.

The "huge number" people cite ($11M+ in the ACFR "Pension benefits" expense
row, which swings with market returns under GASB 68) is disarmed inside an
expander, not led with — showing it next to the ~$5.4M the town actually
appropriates and explaining why they differ.

## Page structure

### Opening (plain answer up front)
Two promises: a pension, and help with health insurance after retirement. One
is on track, one is not. No build-up, no tour-guide narration.

### 1. How did we get here
- Plain narrative: own retirement system; annual pension payment has grown.
- **Divergence chart:** pension (being funded) vs OPEB (never funded), same
  axis, so the reader sees the split visually.
- `▸ Why the pension bill jumped after 2008` — market losses + catch-up schedule.
- `▸ Wait, teachers aren't in this?` — teacher pensions are state-paid via MTRS,
  $0 to the town general fund (funded from taxes residents also pay).

### 2. Is it sustainable?
- Plain: pension ≈ 5 cents of every budget dollar, scheduled fully funded in
  **2036**. That part is fine.
- The real problem: retiree health — a **$142M** promise, **3.4% funded**, with
  **$0** put toward catch-up in the FY27 budget.
- `▸ The "huge number" trap` — the ~$11M GASB-68 ACFR expense row vs the ~$5.4M
  actually appropriated; why they differ.
- `▸ What "unfunded" actually means for a resident.`

### 3. Can we change it? Should we?
- Plain: the pension you basically can't touch — state law + union contracts.
- The one real choice: pre-fund OPEB now vs pay as the bills come and leave a
  bigger tab. Both sides laid out, no thumb on the scale.
- `▸ What other towns do about OPEB.`
- `▸ Who decides this` — retirement board, PERAC, Town Meeting.

### Comparison section (Marblehead vs other Massachusetts towns)
Full comparison, requires two new datasets (see Data dependencies).

- **Pension funded ratio** — Marblehead's system vs peer MA systems vs
  statewide. Story: MA law forces every local system onto a catch-up schedule
  to full funding by ~2036–2040; Marblehead is normal-to-healthy.
- **OPEB funded ratio** — the *calibrating* comparison. Marblehead's 3.4%
  sounds alarming until you see most MA towns are also near-zero. Frame
  honestly: this is a statewide deferral, not local mismanagement (and
  conversely, "everyone does it" is not the same as "it's fine").
- **No state-vs-state comparison.** MA pensions run on the state-specific
  Chapter 32 system that does not map cleanly onto other states; a state
  comparison would be apples-to-oranges and hard to source honestly. The
  meaningful comparison is Marblehead vs other Massachusetts municipalities.

### Sources footer
Every number cited to ACFR page / FY27 budget line / PERAC valuation page / DLS
dataset, per house style (`citations.js` `<sup class="cite">` markers; note it
injects its own `<h2>Sources</h2>` at runtime — see
`project_citations_h2_injection`).

## Data inventory

### Already in repo (verified)
- `data/pension_expenditure_FY01-24.csv` — ACFR "Pension benefits" expense row
  (GASB-68 basis; volatile). **Caveat: not the cash appropriation.**
- `data/pension_assessment_FY01-14.csv` — earlier assessment series.
- `data/opeb_membership_FY12-24.csv` — active/retired member counts.
- FY26 pension appropriation **$5,380,625** — FY27 Proposed Budget p.4, line 217
  "Contributory Retirement Fund"; cross-checked in the FY26 checkbook.
- Net Pension Liability **$40.1M** (6/30/25) — FY25 ACFR p.31 + pp.86–90 RSI.
- Net OPEB Liability **$142.0M**, funded ratio **3.37%** — FY25 ACFR p.31 +
  pp.91–94 RSI. (MMLD OPEB plan is separate: $3.34M net, 45.5% funded.)
- OPEB membership FY25: 748 retirees + 645 active — FY25 ACFR p.67.
- PERAC system FY24: 358 active / 339 retired — PERAC Marblehead Valuation
  Report 2024, pp.5 & 14.
- Funding schedule: appropriation rising 8.6%/yr through FY2035, final
  amortization payment FY2036 (2024 valuation). **Confirm exact figures against
  the PERAC report when building the sustainability section.**

### Data dependencies to pull (blocks the comparison section only)
1. **PERAC pension funded ratios** for MA retirement systems (peer set + Marblehead
   + statewide). Source: PERAC actuarial valuation reports / PERAC published
   funded-ratio tables. Store as `data/perac_funded_ratios_*.csv` with per-value
   source citations in `SOURCE_LOOKUP.md`.
2. **DLS OPEB funded ratios** by municipality (peer set + Marblehead +
   statewide distribution). Source: MA DLS "Other Post-Employment Benefits"
   dataset. Store as `data/dls_opeb_funded_ratios_*.csv` with citations.

Peer set to match existing pages: Arlington, Brookline, Cohasset, Duxbury,
Easton, Framingham, Hingham, Lexington, Marblehead, Melrose (from
`data/peer_schedule_a_expenditures.csv`).

**Known gap:** `data/peer_schedule_a_expenditures.csv` bundles pension into a
"fixed_costs" bucket, so it cannot supply a clean per-town retirement line on
its own — hence the two dependencies above.

## Data-integrity rules for this page (must-follow)

- **Two pension numbers, never conflated.** The budgetary *appropriation* (what
  the town pays, ~$5.4M) and the ACFR *expense* row (GASB-68, ~$11M, volatile)
  are different bases. Lead with the appropriation; explain the expense figure
  only inside the "huge number trap" expander with its caveat.
- **GASB volatility caveat** surfaced where the volatile numbers appear, not
  hidden (per `feedback_data_accuracy`, STYLE_GUIDE volatile-data rule).
- **Every number traces to a primary source** at write time — grep/Read the
  source doc so the verbatim value is in context; do not author from memory
  (`feedback_citation_discipline`).
- Teacher-pension `$0`-to-town framing must note the state still funds it from
  taxes residents pay (don't imply teachers are free).

## Style / build constraints

- No em-dashes in site copy; no inline `style=""` on SVG elements; no
  standalone CPI comparison; no green/red value judgments (STYLE_GUIDE).
- Charts follow the SVG chart classes and principles in STYLE_GUIDE.
- Add to nav / topics / relevant cross-links (`where-has-the-money-gone`,
  `what-is-actually-flexible`) so the page is discoverable.
- Passes `tests/smoke-test.mjs` (0 fail invariant) and the `lint.yml` content
  guardrails (no `marbleheadma.gov/wp-content` URLs, per-line acronym wraps,
  no Liquid in new hrefs).

## Out of scope (YAGNI)

- State-vs-state comparison (unsourceable cleanly).
- Reworking `where-has-the-money-gone` or `what-is-actually-flexible`; this page
  links to them, it does not absorb them.
- MMLD's separate OPEB plan beyond a one-line mention (it's small and 45% funded).
- Any interactive per-employee pension calculator.

## Success criteria

- A reader with zero prior knowledge finishes the main column with an accurate
  model: pension = funded, scheduled, ends 2036; OPEB = large, unfunded, a
  deferred choice.
- The "huge %" misconception is corrected without ever having been endorsed.
- The comparison section calibrates Marblehead against MA peers on both funded
  ratios, sourced to PERAC + DLS.
- Every number on the page traces to a primary document.
- Neutral throughout; a reader cannot tell how the author would vote on OPEB
  pre-funding.
