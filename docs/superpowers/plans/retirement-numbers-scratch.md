# Retirement page — confirmed numbers scratch note

Verification pass for the retirement-spending explainer page. Every headline number
confirmed against its primary source at write time (project cardinal rule: never author
financial claims from memory). This file grounds later authoring tasks and may be deleted
before the final PR.

Verified 2026-07-28 against `data/SOURCE_LOOKUP.md`, `data/checkbook_FY26_2026-06-30.csv`,
`data/pension_expenditure_FY01-24.csv`, and `where-has-the-money-gone.html`.

---

## 1. Pension APPROPRIATION (the budgetary number — what the town pays)

**FY26 general fund appropriation: $5,380,625** — CONFIRMED

- Source: FY27 Proposed Budget, **page 4, Line 217 "Contributory Retirement Fund"**
  (SOURCE_LOOKUP.md line 68-69).
- Cross-check: FY26 General Fund Budget (Excel), TOWN PIVOT TABLE, "CONTRIB RETIRE" =
  $5,380,625 (SOURCE_LOOKUP.md line 125). Two independent sources agree.
- **FY27 appropriation: $5,843,360** (same FY27 Proposed Budget document).

**FY26 appropriation by fund — from `data/checkbook_FY26_2026-06-30.csv`** (all dated
2025-07-02, vendor "MARBLEHEAD CONTRIBUTORY RETIREMENT SYSTEM", memo "FY26 Pension
Appropriation"):

| Fund | Amount |
|---|---|
| General Fund - Town | $5,380,625 |
| Sewer Enterprise Operating | $140,319 |
| Water Enterprise Operating | $157,447 |
| Electric Enterprise (MMLD) | $771,870 |
| Harbor Enterprise Operating | $77,742 |
| **Total town + all enterprises** | **$6,528,003** |

- NOTE: the task spec mentioned "general-fund + water + sewer" pieces; the checkbook
  actually carries FIVE pieces (also Electric/MMLD and Harbor). The **$5,380,625 general
  fund** figure is the one that matches the FY27 budget Line 217 and the pivot table. The
  enterprise pieces are additional (paid out of enterprise revenue, not the general fund /
  tax levy). If the page cites the town-wide pension cost, use $6,528,003; if it cites the
  general-fund budget line, use $5,380,625. Keep them labeled.
- The latest checkbook file on the branch is `checkbook_FY26_2026-06-30.csv` (the spec's
  `checkbook_FY26_2026-06-17.csv` filename is stale / superseded).

---

## 2. LIABILITIES + FUNDED RATIOS (FY25 ACFR, measurement date 6/30/2025 unless noted)

All from **FY25 ACFR**, SOURCE_LOOKUP.md lines ~90-110.

**Net Pension Liability (Town proportionate share): $40,112,618 (~$40.1M)** — CONFIRMED
- Source: FY25 ACFR **page 31** (Reconciliation, Net Pension Liability line) + **pp.86-90**
  (RSI pension schedules). Contributions schedule p.88.
- Was $42,840,952 at 6/30/2024.
- System funded ratio **72.49%** (FY24 measurement date), up from **69.77%** (FY23).

**Net OPEB Liability (Town only): $142,044,651 (~$142.0M)** — CONFIRMED
- Source: FY25 ACFR **page 31** (Reconciliation, Net OPEB Liability line) + **pp.91-94**
  (RSI OPEB schedules).
- Derivation (already recorded in SOURCE_LOOKUP): Total OPEB liability **$146,998,774**
  minus Plan fiduciary net position **$4,954,123** = **$142,044,651**.
- **Funded ratio 3.37%** (was 3.00% at 6/30/2024).
- CAVEAT: The "$136.3M" figure that appears in the long-term-liabilities note is the
  change-in-long-term-liabilities row total, which nets some items differently. The
  clean net-OPEB-liability number for the page is **$142.0M** (total minus fiduciary net
  position). Don't cite $136.3M as the net liability.
- Context (SOURCE_LOOKUP): ADC $9.93M vs $6.91M contributed = $3.0M under-funded for FY25
  (was $4.1M under for FY24). Discount rate 5.74% -> 5.51%.

**MMLD (Municipal Light Department) OPEB plan — SEPARATE plan** — CONFIRMED
- Net OPEB liability **$3,340,487** (Total $6,130,047 − fiduciary $2,789,560).
- **Funded ratio 45.51%.**
- CAVEAT: this is a distinct plan from the Town OPEB plan. Do not add it into the $142.0M
  town figure. If the page mentions it, flag it as separate and much better funded.

---

## 3. PAYOFF / AMORTIZATION SCHEDULE (PERAC 2024 valuation)

**Appropriation rising 8.6%/yr through FY2035; final amortization payment FY2036** —
recorded from secondary/internal sources; **live PERAC PDF UNVERIFIED (bot-blocked).**

- What the site already states — `where-has-the-money-gone.html` line 580 (verbatim):
  > "The 2024 valuation puts Marblehead on a funding schedule with the total pension
  > appropriation rising 8.6 percent each year through FY2035 and a final amortization
  > payment in FY2036."
- Citation of record — SOURCE_LOOKUP.md lines ~113-116:
  PERAC Marblehead Valuation Report 2024, **page 5** (Executive Summary), **page 14**
  (Section 8A); **funding schedule page 13**.
- Live-source re-verification ATTEMPTED and FAILED: the mass.gov URL
  `https://www.mass.gov/doc/marblehead-retirement-board-valuation-report-2024/download`
  returns HTTP 403 ("Not allowed | Mass Gov") to both WebFetch and curl from this box.
  No local copy of the PERAC PDF exists under `data/` (searched: no `*perac*` /
  `*valuation*2024*` file). **The 8.6%/yr and FY2035/FY2036 figures could NOT be
  re-confirmed against the primary PDF in this pass** — they are carried forward from the
  already-published page and SOURCE_LOOKUP citation. Later tasks should either (a) accept
  these as previously-cited-and-published, or (b) re-fetch the PERAC report from a
  residential IP to confirm page 13 before making it a new headline claim.

### CONFIRMED 2026-07-28 (Task 2) — PERAC PDF fetched via Playwright, read directly

The full PERAC **Marblehead Retirement System Actuarial Valuation Report, January 1,
2024** was downloaded (Playwright/Chromium reaches mass.gov where curl/WebFetch 403) and
read with the Read tool. The 8.6%/yr and FY35/FY36 figures are now CONFIRMED against the
primary source (verbatim quote):

- **Printed page 6** (Section 2, Executive Summary B, "Funding Schedule" heading):
  > "The funding schedule presented in this report was recently adopted by the Board. The
  > FY25 payment was maintained from the prior schedule. **The total appropriation
  > increases 8.6% each year through FY35 with a final amortization payment in FY36.** The
  > appropriation for FY25 is $6,127,331."
- So: **appropriation +8.6%/yr through FY35, final amortization payment FY36** — matches
  `where-has-the-money-gone.html` line 580 exactly. No correction needed.
- FY25 pension appropriation per PERAC funding schedule = **$6,127,331** (this is the
  full system-wide amortization payment; distinct from the $5.38M general-fund budget
  line — the difference is the enterprise-fund shares).

### CONFIRMED 2026-07-28 (Task 2) — PERAC funded ratio, valuation basis (differs from ACFR)

- **PERAC funded ratio = 71.5%** on the **actuarial value of assets** basis, as of the
  **1/1/2024 valuation** (printed page 2, Executive Summary A comparison table; was 71.4%
  at 1/1/2022). On a **market value** basis the funded ratio is **69.8%** and UAL is
  $54.0M (printed page 3).
- Underlying figures (printed page 2): Total Actuarial Liability $178,632,621; Actuarial
  Value of Assets $127,797,039; Unfunded Actuarial Liability $50,835,582 → 71.5% funded.
- **RECONCILE with the 72.49% in the scratch note above:** these are two different
  measurements. 72.49% is the GASB-67/68 fiduciary-net-position funded ratio at the
  **6/30/2024** measurement date (from the FY25 ACFR RSI). 71.5% is PERAC's
  actuarial-funding-basis ratio at the **1/1/2024** valuation date. Both are correct for
  their own basis. For the PEER COMPARISON use the PERAC actuarial-basis number (71.5%,
  1/1/2024), because that is the basis on which every other MA board is listed in PERAC's
  aggregate funded-ratio list — apples to apples. If the page instead reports the town's
  own GASB funded ratio, use 72.49% (6/30/2024) and cite the ACFR, not PERAC.

---

## 4. GASB-68 EXPENSE FIGURE (the "huge number trap" — NOT the appropriation)

**ACFR "Pension benefits" expense row, FY25 = $11,402,956** — CONFIRMED
- Source: FY25 ACFR **page 119**, "Changes in Fund Balances" table, "Pension benefits" row
  (SOURCE_LOOKUP.md lines ~61-64).
- This is the volatile GASB figure to CONTRAST against the ~$5.4M budgetary appropriation.
  The whole point of the page: these are two different numbers and conflating them is the
  error the page exists to correct.
- CAUTION (from SOURCE_LOOKUP): "This line is volatile due to GASB accounting changes. Not
  a clean trend." Recent-year values show the volatility:
  FY20 $14,608,035; FY21 $16,031,873; FY22 $10,372,915; FY23 $11,355,953; FY24 $12,491,338;
  FY25 $11,402,956.
- DATA-FILE NOTE: `data/pension_expenditure_FY01-24.csv` only runs FY01–FY24 (ends at
  FY24 = $12,491,338). The **FY25 = $11,402,956** value is NOT in that CSV; it comes from
  the FY25 ACFR p.119 (via SOURCE_LOOKUP). If a later task pulls the trend from the CSV,
  it must append FY25 from the ACFR, not stop at FY24.

---

## Two-number guardrail (do not conflate)

| | Value | What it is | Source |
|---|---|---|---|
| APPROPRIATION | $5,380,625 (FY26 GF) / $5,843,360 (FY27) | budgetary — cash the town pays into the system | FY27 Proposed Budget p.4 Line 217 |
| GASB-68 EXPENSE | $11,402,956 (FY25) | accrual accounting row, volatile | FY25 ACFR p.119 |

The page's core correction: the ~$11M "Pension benefits" expense is NOT the town's pension
bill. The town's pension bill is the ~$5.4M appropriation.
