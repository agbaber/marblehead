# Labor contracts page design

Date: 2026-07-05. Status: approved in session, building.

## Purpose

Evergreen reference page (`/labor-contracts.html`) showing when each town
union contract expires, what the last settlements were, and where the
public record ends. Post-override rationale: personnel costs are set in
these documents on these dates, not at Town Meeting; the mid-2028
expiration cluster is the main variable in whether the override MOU's
"no new override through FY2030" pledge holds.

## Hero stat (derived, shown with derivation)

FY26 general fund operating budget (Open Budget export,
`data/operating_budget_FY26.csv`, original budget, excluding capital
character code 08):

- Total: $109,288,284
- Salaries (character codes 01/02/03): $58,196,892 (53.3%)
- Group insurance (health $11,828,487 + Medex $2,534,769 + Medicare
  reimb $730,651 + life $90,998): $15,184,905
- Contributory retirement: $5,380,625
- Personnel-driven total: $78.8M = 72% of general fund operating

## School-side units (documents in `data/schools/contracts/`)

Five units, all expiring mid-2028. Two were renamed at the 2024-25
settlement round; cards show lineage.

| Unit | Term | Wage terms (signed) |
|---|---|---|
| MEA Unit A (teachers, nurses) | Sep 1 2025 - Aug 31 2028 | Y1 2% (Step 12: 3%); Y2 3% (Step 12: 4%); Y3 3.5% Steps 2-12, Step 2 eliminated, new Step 13 at 2% above Step 12. Successor talks open no later than Dec 2027. Source: MOA Nov 26 2024 (`unit-a-3-year-moa-2025-2028.txt`) |
| Custodians' Association | Jul 1 2025 - Jun 30 2028 | 2% / 2.5% / 2.5% all steps (`custodian-3-year-moa-2025-2028.txt`) |
| MEA Instructional Assistants (formerly Tutors) | Sep 1 2025 - Aug 31 2028 | Hourly Step A $26.18 / $26.70 / $27.37 (derived +2.0%, +2.5%); Step E added Y2; $1/hr SPED differential (`instructional-assistants-2025-2028.txt`, `tutors-3-year-moa-2025-2028.txt`) |
| MEA Permanent Substitutes | Sep 1 2025 - Aug 31 2028 | Salary Step 3 $30,600 / $31,200 / $31,980 (derived +2.0%, +2.5%); Step 2 eliminated Y1, Step 8 added Y2 (`permanent-substitute-3-year-2025-2028.txt` + MOA) |
| MEA Operational Support Personnel (formerly Paraprofessionals; recognition effective Jan 1 2025: lunchroom/recess monitors, van monitors, Village + Middle clerical) | Sep 1 2025 - Aug 31 2028 | Group A Step 3 $16.32 / $16.65 / $17.07 (derived +2.0%, +2.5%); new Step 9 (`operational-support-personnel-2025-2028.txt`, `paraprofessional-3-year-moa-2025-2028.txt`) |

Derived percentages are shown with one example division on the page.

Step-increase note (approved): the page states once, neutrally, that
employees below the top step also advance steps, so actual payroll
growth for a given roster runs above the listed percentage increases.

## PEC health agreement

Last published agreement (`public-employee-committee-health-agreement.txt`)
ran Jul 1 2018 - Jun 30 2024. Governs GIC participation and
premium-split terms - the largest structural cost lever in the budget.
No successor on file; page states this as an open question, neutrally
(either a successor exists and is unpublished, or coverage has
continued without one).

## Town side: not published

Police, fire, DPW, library agreements are not published anywhere we can
find: not on town site, not in ACFRs (FY25 ACFR names no bargaining
units), ratifications occur in executive session. The page says exactly
that and explains the public records request path. No synthetic cost
figure: the "$1.5M collective bargaining" line in the 2026 FinCom
Report is a free-cash item mixed with revised receipts, so it is NOT
used as a settlement cost.

## Page mechanics

- Root-level explainer page, sentence-case title, own style block with
  `lc-` prefixed classes (override-tracker pattern)
- Timeline SVG: one row per unit + PEC row; x-axis Jul 2025 - Dec 2028;
  vertical markers at Dec 2027 (Unit A successor talks) and mid-2028
  expirations; chart classes from STYLE_GUIDE, no inline SVG styles,
  neutral colors
- Citations via `<sup class="cite">` + `scripts: [citations]`;
  contract .txt files served by Jekyll are the cite targets
- `<abbr class="g">` for GIC, MEA, PEC, SPED, DPW, first use
- Cross-links: town-budget.html, what-is-actually-flexible.html,
  override-tracker.html, /meetings/
- Inbound links from those pages in the same PR
