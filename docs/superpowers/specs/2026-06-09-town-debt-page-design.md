# Town debt long-form page &ndash; design & handoff

**Status:** Built. ACFR fetched, page shipped as `town-debt.html`, data digest at `data/debt_summary.json`, browse card added under "History & background".
**Date:** 2026-06-09 (design); 2026-06-08 build (this session). Unblocked because a follow-up session had network access to `marbleheadma.gov` and the user delivered the PDF locally.

## Goal

A long-form explainer on Marblehead's debt, in the plain-language,
fully-sourced style of `where-has-the-money-gone.html`. It should answer,
simply:

1. **Where the debt came from** &ndash; which projects were borrowed for.
2. **How it has been managed** &ndash; from inception (ballot vote) to
   payment (or the future payoff plan).
3. **How it has performed** &ndash; with a peer comparison.

"Simple and easy to understand, like the rest of the site." Sentence-case
title, `page-lead` opener, `key-stats`, footnoted external sources via
`assets/citations.js`, `<abbr class="g">` on first use of ACFR / DOR / DLS,
neutral semantic colors (no green-good / red-bad), no em-dashes, no
meta-narration. See `STYLE_GUIDE.md`.

Proposed file: `town-debt.html`. Proposed h1: "How has Marblehead managed
its debt?" (sentence case). Page type: explainer (no body class,
`--page-max` 720px). Add a homepage question card (no tag, since it is
prose, not a chart).

## What is fully sourceable from data already in the repo

### A. Where the debt came from (the project list)

`data/dor_debt_exclusion_all.csv` (MA DOR debt-exclusion ballot history).
Filter `municipality == Marblehead`:

- **50 WIN / 1 LOSS** across debt-exclusion ballots, 1988&ndash;2025.
- Only loss: **Tucker's Wharf**, 2003 (Culture and Recreation).
- Schools dominate: high-school construction/conversion, Village School
  reconstruction, Glover, Elbridge Gerry School (study + new build).
- Non-school: fire pumper/quint trucks, drainage + transfer station,
  Fort Sewall, seawalls/fences, Abbot Public Library renovation, Old Town
  House / Abbot Hall tower, Council on Aging building, landfill cap.
- Recent (2018&ndash;2026): pumper truck, drainage/transfer station, Gerry
  School (2018 study, 2020 build), Fort Sewall, seawalls, Abbot Library
  (2023), FY24 bundle (roofs, roads/sidewalks, smart panels, HVAC, salt
  shed, HS boiler), FY26 Mary Alley HVAC + High School Roof & HVAC.

This is the spine of "where it came from": almost every capital project is
financed by a temporary, voter-approved debt exclusion outside Proposition
2.5.

### B. How it has been managed (the mechanism + the trend)

- **Nearly all debt service is excluded (voter-approved outside Prop 2.5).**
  FY23 Annual Report: "Total Excluded Debt Services $11,001,616" against
  total debt service of essentially the same amount. So the debt is paid by
  a separate, temporary tax voters approved per project, not buried in the
  operating levy.
- **Debt service trend** (`data/peer_schedule_a_expenditures.csv`, DLS
  Schedule A, Marblehead rows):

  | FY | Debt service | Total expenditures | Share |
  |----|-------------|--------------------|-------|
  | 2002 | $3,459,707 | $51,690,836 | 6.7% |
  | 2014 | $4,742,971 | $67,533,199 | 7.0% |
  | 2021 | $7,757,889 | $86,269,047 | 9.0% |
  | 2022 | $12,681,651 | $96,488,273 | 13.1% |
  | 2023 | $10,106,619 | $96,579,439 | 10.5% |
  | 2024 | $11,006,139 | $100,501,118 | 11.0% |

  (FY25 row is all zeros in the file &ndash; not yet reported.)

- **Annual appropriations** (town Annual Reports, Town Meeting articles):
  - FY24 (Annual Report 2024, Article 26): Maturing Debt $7,540,000 +
    Interest $3,518,075 = **$11,058,075**.
  - FY25 (Annual Report 2025, Article 22): Maturing Debt $5,955,000 +
    Interest $3,359,141 = **$9,314,141**.
  - FY27 Proposed Budget (`data/FY27_Proposed_Budget_No_Override.txt`):
    Total Debt Service column shows $11,058,075 / $11,085,298 / $9,314,141 /
    $11,098,398; Maturing Debt row $7,540,000 / $7,540,000 / $5,955,000 /
    $7,251,017.
  - Maturing principal eased FY24 $7.54M &rarr; FY25 $5.96M, a usable data
    point that some bonds are rolling off.

- **Debt as a slice of total spending:**
  `data/state_of_town_financials.json` total_with_debt: FY25 $105.1M,
  FY26 $112.4M, FY27 $120.6M (State of the Town, Jan 2026).
  `where-has-the-money-gone.html` already shows debt payments ~9% of the
  FY26 General Fund.

### C. Performance / peer comparison

`data/peer_schedule_a_expenditures.csv`, FY2024, debt service / total
expenditures across the 17-town peer set:

```
Arlington   11.4%   Marblehead 11.0%   Brookline  10.4%   Swampscott 10.1%
Wellesley   10.1%   Stoneham    9.9%   Winchester  9.7%   Needham     9.5%
Lexington    8.8%   Natick      8.5%   Duxbury     7.3%   Easton      7.3%
Hingham      6.8%   Newton      5.0%   Framingham  4.8%   Melrose     4.7%
Cohasset     3.2%
```

Marblehead is **2nd highest of 17** (peer median ~9.5%). Frame neutrally:
debt service has gone to durable capital assets, financed transparently
through voter-approved exclusions, and is largely self-extinguishing as
exclusions expire. Rule-of-thumb context: under ~10% of budget is
typically called low/conservative, 10&ndash;15% moderate. Present as
context, not a verdict (editorial stance).

## What is BLOCKED (needs the FY24 ACFR)

These numbers are the heart of the "inception-to-future-payment" ask and
are **not** in the repo. They live in the FY24 ACFR Long-Term Debt note:

1. Total general obligation bonds payable outstanding at 6/30/2024 (and
   prior year) &ndash; the headline "the town currently owes $X".
2. Debt maturity schedule: future principal + interest by fiscal year (the
   forward payoff plan).
3. Debt by purpose (school vs general/other).
4. Changes in long-term liabilities (additions / reductions).
5. Legal debt limit / debt margin and how much is used.
6. Authorized-but-unissued debt.

**Source:** FY24 Town of Marblehead ACFR,
`https://marbleheadma.gov/wp-content/uploads/2025/03/FY24-Town-of-Marblehead-ACFR.pdf`
(index: marbleheadma.gov ACFR document page).

Per the README rule ("every number must trace to a primary source"), do
NOT model or estimate these. Leave the payoff-schedule section as a marked
placeholder until the ACFR data is in the repo.

## Network constraint (why it is blocked in web sessions)

This environment routes outbound traffic through a proxy with a **host
allowlist**. `marbleheadma.gov` and `mass.gov` are not on it and return
`403 "Host not in allowlist"`. Confirmed 2026-06-09 across every tool:

- `curl`, WebFetch: 403 from the town and state hosts.
- Playwright: works as a browser (`registry.npmjs.org` &rarr; 200) but the
  same town host &rarr; 403. Playwright's own browser CDN
  (`cdn.playwright.dev`) is also blocked; a pre-installed browser exists at
  `/opt/pw-browsers/chromium-1194`. The proxy also does TLS interception
  (`CLAUDE_CODE_PROXY_RESOLVES_HOSTS`), so browsers need
  `ignoreHTTPSErrors`.

So no fetching tool in a default web session can pull the ACFR. To unblock,
one of:

1. **Expand the allowlist** to include `marbleheadma.gov` (and `mass.gov`
   for DOR/DLS), then fetch the ACFR directly. Network policy is set at
   environment creation; see
   https://code.claude.com/docs/en/claude-code-on-the-web.
2. **Commit the ACFR into the repo** (or paste the Long-Term Debt note),
   then digitize the six items above into a small CSV/JSON under `data/`
   alongside `SOURCE_LOOKUP.md` citations.

## Proposed page structure

1. `page-lead`: one plain-English paragraph &ndash; most of Marblehead's
   debt is voter-approved, project-specific, and paid by a temporary tax
   outside Proposition 2.5.
2. `key-stats`: e.g. 50/51 exclusions approved; debt service $3.5M&rarr;$11M
   (FY02&rarr;FY24); ~11% of spending; [total outstanding &ndash; pending ACFR].
3. `page-toc`.
4. **Where the debt came from** &ndash; prose + a project/category table from
   the debt-exclusion data; explain a debt exclusion in plain language
   (define before using the term, per STYLE_GUIDE).
5. **How an exclusion works, start to finish** &ndash; ballot vote &rarr;
   borrow &rarr; temporary tax surcharge &rarr; bonds mature &rarr; surcharge
   falls off. Note the 50/51 approval record and the lone Tucker's Wharf loss.
6. **What we pay now, and what's ahead** &ndash; debt-service trend chart
   (hand-built SVG, FY02&ndash;FY24/27). The forward maturity schedule is a
   marked placeholder pending the ACFR.
7. **How Marblehead compares** &ndash; peer debt-service-share chart, neutral
   colors, factual caption.
8. **What this means** &ndash; the operating deficit is largely separate from
   debt (excluded debt is paid by its own voter-approved tax). Link the
   override explainer and `where-has-the-money-gone.html`. No vote framing.
9. `details.notes`: sources and methodology.

## Verification

Run `npm run test:local` (52 pass / 0 fail expected) after building, plus a
manual read for STYLE_GUIDE compliance (abbr, footnotes, no em-dashes, no
meta-narration, neutral colors).
