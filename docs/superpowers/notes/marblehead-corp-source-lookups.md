# Marblehead Corp &mdash; source lookups

Working reference for `marblehead-corp.html`. Every value appears with its source so the page's Notes section can cite directly.

## Cover and Letter from Management

- **Town founded / first recorded Town Meeting:** Town of Marblehead established 1649 (incorporation as a town separate from Salem). Open Town Meeting form of government has operated continuously since the seventeenth century. &mdash; Massachusetts Office of the Secretary of State, Marblehead municipal records; Town of Marblehead website. For the page, cite as "Established 1649" and footnote Town Meeting governance as "since the seventeenth century" (no single primary document fixes a precise first-meeting date earlier than that available locally).
- **Current Town Administrator:** Thatcher W. Kezer III, Town Administrator. Appointed by the Select Board on May 18, 2022 (motion: "to appoint Thatcher W. Kezer Town Administrator subject to successful contract negotiations," unanimous polled vote). Contract extended through 2028 with $16K raise approved June 2, 2025. &mdash; Source: Select Board minutes, May 18, 2022 (`data/minutes/select_board/2022-05-18.cleaned.txt`, lines 21-29); Marblehead Current, ["Select Board approves Kezer contract through 2028"](https://marbleheadcurrent.org/2025/06/02/select-board-approves-kezer-contract-through-2028-gives-16k-raise/); Select Board minutes, June 25, 2025 (`data/minutes/select_board/2025-06-25.cleaned.txt`).
- **Select Board (FY26):** five members, three-year staggered terms, $0 stipend. &mdash; M.G.L. c. 41, &sect;108 (board may set its own stipend; Marblehead's local practice is no stipend).

## Company at a Glance (KPI strip)

| Cell | Value | Source |
|---|---|---|
| Customers (population) | 20,576 | FY24 ACFR p.126, "Demographic and Economic Statistics," 2024 row (also matches DOR `dor_income_eqv_pop_FY27.csv` Marblehead row, population column). U.S. Census source per ACFR footer. |
| Employees (FTE, FY24) | 706.00 | FY24 ACFR p.128, "Full-time Equivalent Town Employees by Function," 2024 column total. |
| FY24 Revenue (general fund total) | $106,757,460 | FY24 ACFR p.34, "Statement of Revenues, Expenditures, and Changes in Fund Balances - Governmental Funds," General Fund Total Revenues, year ended June 30, 2024. (All-governmental-funds total is $123,579,949 on the same page; use general-fund figure to match the operating-budget framing.) |
| Bond Rating | **AAA (S&P), outlook negative** | S&P Global Ratings letter to Finance Director Aleesha Benjamin, April 10, 2026, archived as [`2026-04-10_SP_Rating_Letter.pdf`](https://github.com/agbaber/marblehead/releases/download/source-archive-v1/2026-04-10_SP_Rating_Letter.pdf), reference 40447311. **DECIDED: page uses "AAA (S&P), outlook negative" — not the spec scaffold's Aa1/Moody's, which was incorrect.** |
| Levy Ceiling Utilization (FY26) | 36.2% | DOR `dor_all_351_FY26.csv` (Marblehead row): total_tax_levy = $84,388,724; total_assessed_value = $9,324,720,913. M.G.L. c. 59, &sect;21C levy ceiling = 2.5% &times; full and fair cash value = $233,118,023. Utilization = $84,388,724 &divide; $233,118,023 = 36.20%. |
| Reserves (Free Cash, FY26) | **$9,488,848 (Free Cash, certified FY26)** | DOR `dor_all_351_FY26.csv` (Marblehead row, free_cash column). **DECIDED: cell is labeled "Reserves (Free Cash, FY26)" with value `$9.5M`. Footnote captures the nuance: Marblehead does not currently fund a separate Stabilization Fund line item — the FY27 proposed budget shows the Stabilization Fund line at $0 for FY25, FY26, and FY27. Free Cash is the closest publicly-reported reserve indicator.** |

Notes on cells:

- The bond-rating cell in the original scaffold ("Aa1 (Moody's)") is wrong for Marblehead. The current rating is **AAA (S&P)** with outlook **negative** as of April 10, 2026. The page should use AAA + S&P or simply "AAA, outlook negative (S&P, April 2026)."
- Stabilization vs. Free Cash: Marblehead's reported reserve is its Free Cash certification, not a separate Stabilization Fund balance. Don't conflate the two on the page; use Free Cash as the reported number and footnote the absence of a stabilization-fund transfer in current budgets.
- Six cells fit the scaffold; none DROPPED.

## Item 1. Business Segments (FY26 budgeted spend)

Mapping logic: the FY26 budget book groups spending into seven VOTE TOTAL categories that sum exactly to TOTAL GENERAL FUND ACCOUNTS = $106,206,380. The "Other General Government" VOTE TOTAL ($22,499,072) bundles employee benefits, debt service, pensions, and a small residual; the table below splits that bundle into the segments the scaffold asks for.

| Segment | $ | % |
|---|---|---|
| Education (K-12) | $49,120,287 | 46.2% |
| Public Safety (Police + Fire) | $11,237,760 | 10.6% |
| Public Works | $5,844,487 | 5.5% |
| General Government | $4,754,738 | 4.5% |
| Employee Benefits | $21,409,518 | 20.2% |
| Debt Service | $9,314,141 | 8.8% |
| Other | $4,525,449 | 4.3% |
| **Total General Fund** | **$106,206,380** | **100.0%** |

Component derivations (FY26 budget column from `data/FY27_Proposed_Budget_No_Override.txt`):

- **Education:** VOTE TOTAL SCHOOLS = $49,120,287 (matches `FY26_budget_summary.json` School_Grand_Total).
- **Public Safety:** VOTE TOTAL PUBLIC SAFETY = $11,237,760 (Police $4,987,087 + Fire $5,561,260 + remainder per JSON reconciles).
- **Public Works:** VOTE TOTAL PUBLIC WORKS AND FACILITIES = $5,844,487.
- **General Government:** VOTE TOTAL GENERAL GOVERNMENT = $4,754,738 (Select Board, Finance, Town Counsel, Town Clerk, Election, Assessor, etc.).
- **Employee Benefits:** sum of Group Insurance ($15,100,893, line 221) + Contributory Retirement / Pension ($5,380,625, line 217) + Workers' Comp transfer ($398,000, line 219) + Medicare ($280,000, line 218) + OPEB transfer ($250,000, line 226). Total $21,409,518.
- **Debt Service:** Maturing Debt $5,955,000 + Interest $3,359,141 = TOTAL DEBT SERVICE $9,314,141 (matches `FY26_budget_summary.json` Debt_Service).
- **Other:** Human Services $898,026 + Culture and Recreation $2,537,869 + Other-General-Government residual (Street Lighting $60,000 + Other Insurance $964,554 + Salary Reserve $50,000 + Training $15,000) $1,089,554 = $4,525,449.

Verification: 49,120,287 + 11,237,760 + 5,844,487 + 4,754,738 + 21,409,518 + 9,314,141 + 4,525,449 = $106,206,380 = TOTAL GENERAL FUND ACCOUNTS.

Sources: `data/FY26_budget_summary.json`; `data/FY27_Proposed_Budget_No_Override.txt` FY26 column ("FY2026 BUDGET"); cross-referenced to FY26 General Fund Budget Excel (per SOURCE_LOOKUP.md). No "Other" row DROPPED; the residual is non-trivial and correctly labeled.

## Risk Factors &mdash; confirmed citations

(Already verified in the spec; copy as-is.)

- 1A.1: M.G.L. c. 59, &sect;21C (Prop 2&frac12;) &mdash; verified.
- 1A.2: M.G.L. c. 71, &sect;1, &sect;5; 20 U.S.C. &sect;1400 (IDEA) &mdash; verified.
- 1A.3: M.G.L. c. 71, &sect;42 (teacher dismissal); M.G.L. c. 31 (civil service) &mdash; verified.
- 1A.4: M.G.L. c. 150E (public employee collective bargaining) &mdash; verified.
- 1A.5: M.G.L. c. 30A, &sect;&sect;18&ndash;25 (OML); c. 66, &sect;10 (Public Records) &mdash; verified.
- 1A.6: M.G.L. c. 30B (sealed bid &gt;$50K, three quotes $10K&ndash;$50K); c. 30 &sect;39M; c. 149 &sect;44A &mdash; verified.
- 1A.7: M.G.L. c. 32B, &sect;&sect;19, 22 (PEC, 70% supermajority) &mdash; verified.
- 1A.8: M.G.L. c. 39, &sect;10 (open Town Meeting); c. 59, &sect;21C(k) (debt exclusion) &mdash; verified.
- 1A.9: 11 U.S.C. &sect;109(c)(2) &mdash; MA has not enacted enabling legislation. Verified.
- 1A.10: M.G.L. c. 41, &sect;108 (Board may receive stipend); local practice $0.

## Executive Compensation

- **Town Administrator FY26 base salary:** $207,732 &mdash; FY26 General Fund Budget Excel, TOWN BUDGET sheet, "SB-DEPT HEAD" line (per SOURCE_LOOKUP.md, "FY26 Budget Line Items"). Falls within the FY26 Select Board "Salaries" line of $502,138 (FY27 proposed budget, line 3). Holder: Thatcher W. Kezer III.
- **Industry comparable A:** Eastern Bankshares, Inc. (NASDAQ: EBC), CEO Denis K. Sheahan (CEO since July 2024). **DECIDED: use the proxy's Summary Compensation Table figure of $1,291,168 for FY2024.** Primary source: Eastern Bankshares, Inc. 2024 Definitive Proxy Statement (Form DEF 14A), filed with the U.S. Securities and Exchange Commission, Summary Compensation Table. The filing is available on SEC EDGAR (CIK 0001810546): [EDGAR filings for Eastern Bankshares, Inc.](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001810546&type=DEF+14A). The page's footnote should cite the DEF 14A directly and note that Sheahan became CEO in July 2024 (mid-year transition), so the $1.29M figure reflects a partial year as CEO. Do not cite Salary.com, Simply Wall St, or other tertiary aggregators on the page; the SCT in the proxy is the primary record.
- **Industry comparable B:** L.L. Bean &mdash; **DROPPED**. L.L. Bean is privately held; no SEC-filed compensation disclosure exists. Per the task plan ("If only one clean comparable is findable, drop the second"), the page presents Eastern Bankshares alone as a single-comparable framing.

## Notes on what was DROPPED

- L.L. Bean CEO compensation: dropped (private company, no clean public disclosure within the time budget). Task plan explicitly authorizes this drop.
- Bond rating cell as scaffolded ("Aa1 / Moody's"): replaced with verified AAA / S&P / outlook negative; this is a correction, not a drop.
- "Stabilization Fund (most recent)" cell: replaced with Free Cash because Marblehead does not currently fund a separate Stabilization Fund line; this is a substitution with footnote, not a drop.
