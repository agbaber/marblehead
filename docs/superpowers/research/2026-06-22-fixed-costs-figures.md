# Sourced figures for what-is-actually-flexible page

Date: 2026-06-22

---

## 1. SPED out-of-district tuition + transportation (FY27)

**Figure (gross, before offsets):** $6,627,626
**Figure (net, after Circuit Breaker + IDEA offsets):** $4,291,145
**Source:** `data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt`, lines 1188-1196 (transportation) and lines 1250-1255 (outside placements / tuition)
**Confidence:** high — line-item FY27 proposed figures from the FY27 school budget packet presented to the School Committee on 2026-02-05

### Tuition components (lines 1250-1255, "9000: Outside Placements"):

```
COLLABORATIVE TUITIONS         9940020 532003 500   FY26: $747,881   FY27: $777,796   +$29,915  +4.00%
COLLABORATIVE TUITIONS (PLACEHOLDERS)               FY26: $375,000   FY27: $375,000   $0        0.00%
PRIVATE DAY TUITIONS           9930020 532004 500   FY26: $2,454,755 FY27: $2,552,945 +$98,190  +4.00%
RESIDENTIAL TUITIONS           9930020 532007 500   FY26: $1,548,227 FY27: $1,610,156 +$61,929  +4.00%
CIRCUIT BREAKER OFFSET                              FY26: $(1,563,702) FY27: $(2,095,411)
Sub Total (net)                                     FY26: $3,562,161 FY27: $3,220,487
```

Tuition gross (before Circuit Breaker offset): **$5,315,897**
Tuition net (after Circuit Breaker offset): **$3,220,487** (note: larger CB offset in FY27 because CB reimbursement increased ~34%)

### Transportation components (lines 1188-1196, "3300: Transportation Services"):

```
HOMELESS STUDENTS              9330014 533000 535   FY27: $48,866
DCF TRANSPORTATION             9330014 533000 435   FY27: $53,000
SPECIAL EDUCATION - OOD        9330024 533000 500   FY27: $1,311,729
SPECIAL EDUCATION - OOD IDEA OFFSET                 FY27: $(241,070)
BUS DRIVER SALARIES - SPED     9330023 510300 535   FY27: $337,081
BUS DRIVER OT                  6330023 510311 535   FY27: $5,000
BUS AIDE SALARIES - SPED*      9330023 510317 535   FY27: $27,757
COORDINATOR SALARY             9330013 510315 535   FY27: $5,150
Sub Total                                           FY27: $1,547,512
```

SPED-specific OOD transport only (before IDEA offset): **$1,311,729**
SPED-specific OOD transport net of IDEA offset: **$1,070,659**

### Recommendation for data file

The page is about what portion of the budget is genuinely fixed/mandatory. Two framings are defensible:

- **Gross $6,627,626** (tuition gross + OOD transport line before offsets): represents the real cost obligation before state reimbursements are applied. Best for "this is what the district must spend."
- **Net $4,291,145** (after Circuit Breaker + IDEA offsets): represents the net local cost. Best for "this is what comes out of the local levy."

Recommend presenting net ($4,291,145) with a parenthetical noting the gross and offsets, consistent with how the school budget reports it.

Also note: the budget narrative at line 355 explicitly flags this category: "Increase Special Education Out of District Tuitions and Transportation to align with known expenses and DESE approved increases."

The FY26 data shows the OSD (Operational Service Division) consortium rate drives these increases; the SC chair noted a 12% consortium rate increase in the 2026-04-09 transcript (line 39). These are genuinely fixed obligations once students are placed.

---

## 2. OPEB contribution (FY27)

**In-budget FY27 figure:** $0 (the $250K transfer was eliminated in the no-override FY27 budget)
**Override Tier 1/2/3 restoration:** $96,771 (all three tiers restore this equally)
**FY24 Actuarially Determined Contribution (ARC):** $10,649,051
**FY24 Actual employer contribution:** $6,524,640
**FY24 Contribution deficiency:** $4,124,411

**Sources:**
- In-budget $0: `data/FY27_Proposed_Budget_No_Override.txt` line 201: "226 Other Post Employment Benefits  -  -  250,000  -  (250,000)  -100.00%"
- Override restoration $96,771: `data/town_budget_FY27.json` meta.override_tiers, entry: `{"category": "Other General Government", "description": "Restore Town Portion of OPEB Transfer", "tier_1": 96771, "tier_2": 96771, "tier_3": 96771}`
- ARC $10,649,051 and actual $6,524,640: FY24 ACFR page 92 of 132, "Schedule of Town Contributions to OPEB Plan," Year Ended June 30, 2024 row
- ACFR source: `data/town_docs/FY24_Town_of_Marblehead_ACFR.pdf` (PDF page 99 = report page 92)

**Confidence:** high for all three figures — primary documents read directly

### Verbatim source excerpts

From `data/FY27_Proposed_Budget_No_Override.txt` (line 201):
```
 226 Other Post Employment Benefits        -       -    250,000      -    (250,000)   -100.00%
```

From FY24 ACFR page 92, "Schedule of Town Contributions to OPEB Plan":
```
Year     Actuarially          Contributions        Contribution    Covered-        Contributions
Ended    Determined           in Relation to       Deficiency      Employee        as % of
June 30  Contribution         ADC                  (Excess)        Payroll         Payroll
2024     $10,649,051          $6,524,640           $4,124,411      $57,432,338     11.36%
2023     $9,797,520           $6,280,237           $3,517,283      $55,742,736     11.27%
```

From FY24 ACFR page 91, Net OPEB liability end of FY2024: **$147,053,595**

### Recommendation for data file

Use the **$96,771** as the in-budget OPEB figure (it is the operating budget transfer the town was making before FY27 cuts, and what the override restores). Note that this is a fraction of the actuarial ARC ($10.6M); the gap between what the town contributes and what the actuary says is needed accumulates in the unfunded liability ($147M net OPEB liability as of FY2024). The page should flag this gap — the $96,771 restores a token transfer, not full ARC funding.

The Override Presentation (line 198) frames the no-override consequence as: "No contribution to Stabilization Fund or OPEB liability ($250K each)."

---

## 3. State assessments (FY26 used; FY27 cherry sheet pending)

**Figure (FY26):** $2,530,068
**Source:** `data/cherry_sheet_FY26.csv`, Marblehead row, field `total_charges`
**Confidence:** high for FY26 — direct from DOR DLS cherry sheet CSV. FY27 figure not yet published by DLS.

### Components of FY26 total_charges:

```
mbta_charge:        $519,178
charter_send:     $1,827,544
school_choice_send:  $99,126
mapc_charge:         $12,309
mosquito_charge:     $46,126
total_charges:    $2,530,068
```

### FY27 cherry sheet status

The DOR DLS has not yet published the FY27 cherry sheet as of 2026-06-22. `ls data/cherry_sheet_FY*.csv` returns only `cherry_sheet_FY26.csv`. The FY27 figures are typically finalized in late summer/fall before the fiscal year begins (July 1). MBTA and charter send amounts can fluctuate year to year based on student counts and state ridership formulas.

### Recommendation for data file

Use FY26 total_charges ($2,530,068) with a note: "FY27 cherry sheet not yet published by DOR DLS; FY26 figure used as proxy. Charter school send ($1,827,544) is the largest component and varies with student enrollment in charter schools." The charter_send line is the most volatile: if another family chooses a charter school, that tuition obligation is mandatory and fixed once enrollment is locked.

---

## 4. Average town employee salary (FY27, derived)

**Total General Fund non-school non-enterprise salaries (FY27 proposed):** $18,645,274
**FTE count:** ~161 (post-cut, no-override FY27 budget)
**Average:** ~$115,809

**Sources:**
- Salary total: `data/town_budget_FY27.json`, all rows where `level == 'line'`, `spend_type == 'salaries'`, `function != 'schools'`, and function not in `{water_enterprise, sewer_enterprise, harbor_enterprise}`. Computed value: $18,645,274.
- FTE count: derived from `data/_enrichment/fy27_personnel.yml`, field `fy27_headline.town_position_cuts_basis`: "FinCom Report 2026 (FY27 page): 'The reduction of 22 FTEs, representing a 12% reduction in the total Town workforce funded by the General Fund.'" => pre-cut total = 22 / 0.12 = 183 FTE; post-cut (no-override) = 183 - 22 = 161 FTE.
- The Override Presentation (`data/2026-04-15_Override_Presentation_FINAL.txt`, line 202) rounds to "Cuts 21.5 Positions."

**Confidence:** medium — salary total is high-confidence (direct from MUNIS-derived JSON); FTE count is derived (FinCom percentage math), not read from a published FY27 authorized-positions schedule (the town does not publish one).

### Derivation detail

```
GF non-school non-enterprise salary functions:
  public_safety:          $11,222,274
  public_works:            $2,882,616
  general_government:      $2,339,959
  culture_recreation:      $1,369,796
  human_services:            $685,629
  other_general_government:  $145,000
  TOTAL:                 $18,645,274

FTE derivation:
  FinCom: "22 FTEs = 12% of total Town GF workforce"
  Pre-cut: 22 / 0.12 = 183.3 FTE
  Post-cut FY27 (no-override): 183 - 22 = 161 FTE
  Average: $18,645,274 / 161 = $115,809
```

### Why the personnel yml position count (217) differs from 161

The `fy27_personnel.yml` positions[] tally of 217 uses `fy26_filled_count` (FY26 baseline headcount) for pool lines (Firefighters, Patrolmen, etc.), and does not yet deduct the 22 eliminated positions from that roster. The FinCom-published 22 FTE / 12% math is the authoritative post-cut figure. The 217 is also inflated by seasonal and part-time headcount that is not 1.0 FTE each.

### Recommendation for data file

Use $115,809 as the derived average with a note explaining the methodology. This is appropriate for a "what does a typical town employee cost" illustration, not a precise budget line. If the downstream task needs higher confidence, it could alternatively use the personnel yml salary total ($18,580,174) divided by 161 = $115,404 — nearly identical.

The enterprise fund employees (water/sewer/harbor) are excluded because they are funded by enterprise revenues, not the general fund levy.

---

## Summary table

| Figure | Value | Confidence | Primary source |
|--------|-------|-----------|----------------|
| SPED OOD tuition + transport (gross) | $6,627,626 | high | FY27 school budget packet, lines 1190-1196, 1250-1255 |
| SPED OOD tuition + transport (net of CB + IDEA offsets) | $4,291,145 | high | same |
| OPEB in-budget FY27 | $0 (cut) | high | FY27 no-override budget line 201 |
| OPEB override Tier 1/2/3 restoration | $96,771 | high | town_budget_FY27.json override_tiers |
| OPEB FY24 actuarial ARC | $10,649,051 | high | FY24 ACFR page 92 |
| State assessments (FY26 proxy) | $2,530,068 | high (FY26) | cherry_sheet_FY26.csv |
| State assessments (FY27) | not yet published | n/a | DOR DLS cherry sheet not available |
| Avg town employee salary (FY27) | ~$115,809 | medium | derived: JSON salary / FinCom FTE math |
