# FY27 spending to date against FY26: what the checkbook and the budget portal show

*Working analysis. Not a public page. Compiled 2026-10-22 from the FY27
vendor checkbook through October 15, 2026 (3,681 rows, $41.74M), the
archived FY26 checkbook (full year, 17,903 rows, $113.96M), the Open
Budget portal's monthly exports through fiscal month October 2026
(payroll included), FY25 department actuals from the same portal, and the
primary sources cited inline. Checked on 2026-10-29 against the Town's
own "Fiscal Year 2027 First Quarter Update" of October 27, 2026
(archived as `data/2026-10-27_FY27_Q1_Update.txt`; section 12). Every
table quoted here is in the
companion file `2026-10-22-fy27-checkbook-vs-fy26-tables.md`, generated
by `scripts/analysis_checkbook_yoy.py`; re-run the script to regenerate
both the companion and the numbers below. Dollar figures are cash-basis
vendor payments unless marked "budget portal".*

## The short version

1. Vendor payments are running 12.7% ahead of the same July 1 to
   October 15 window last year: $41.74M against $37.03M. Most of the gap
   is one project. Take out the A11 2022 building article (the MHS roof
   and its companions) and the rest of the town is flat: $36,507,607
   to $36,456,822, down 0.1%.
2. The override's year-one dollars are visible in the adopted budget, and
   they reconcile to Article 29 almost to the dollar on the municipal
   side: public safety $547,635 in the portal against $546,946
   appropriated; human services $196,171 against $196,171.
3. The school share of the override is $0 in FY27 by design. The
   Town's first-quarter update gives the phase-in: schools receive
   $5,152,733 in FY28 and $3,349,502 in FY29. The FY27 school budget is
   the no-override figure, $47,620,287, which is what the portal shows.
4. The GIC health bill is up 8.7% to 8.8% in every month so far, not
   flat. The Finance Committee's March projection was 4% to 8% for rates;
   the bill also moves with enrollment. The Town's own update reports
   health insurance cost "up 11% over the first quarter of last year".
5. Pension was paid in full on July 1: $5.84M, up 8.6%, matching the
   "up half a million" the CFO gave Town Meeting.
6. Debt service is up only 1.8% so far, but the FY27 budget is up 17.8%
   because of the $26.2M bond sold in May. The jump lands in the second
   half of the year.
7. The school district pre-paid about half of its FY27 out-of-district
   special education tuitions in June from FY26's unexpended balance.
   That, not a cut, is why FY27 tuition payments are down 76% so far.
8. The trash hauler changed. Waste Management ($413,704 in last year's
   window) is gone, Republic Services is up to $284,805, and the Select
   Board approved a five-year Republic contract on October 14, 2026.
9. Fixed costs and assessments still move differently: Essex Tech's
   assessment is up 19.5% ($749,920 implied for the year), charter
   school tuition in the budget is up 26%, while MWRA and SESD payments
   are down 21% to 24% so far on timing.
10. 133 vendors paid in FY27 never appeared in FY26, $1.41M in total;
    three capital contractors account for $840K of it.

## 1. What is being compared, and the traps

- **Windows.** FY27 to date is July 1 through October 15, 2026, the as-of
  date of the published CSV. FY26 is cut at October 15, 2025 so both
  sides cover the same days. That window held 32.5% of FY26's full-year
  vendor payments, so "FY26 full" columns are there for scale, not for
  pacing, except in section 9.
- **The checkbook is accounts payable only.** No payroll, no transfers
  posted through the general ledger. The override is mostly positions,
  so section 3 reads payroll from the budget portal instead.
- **Voids stay in.** FY27 has 42 negative rows totaling -$3.93M, almost
  all a July 1 reversal of four U.S. Bank debt-service payments that were
  re-issued on July 8 and July 14. Netting them is the only honest
  treatment; section 6 lists them.
- **Division coding is unreliable for schools and capital.** Every
  General Fund - School row and most capital-article rows carry the
  division "UNDEFINED", so those lenses key on fund and vendor.
- **Budget columns post in July.** In the portal export, the annual
  original and revised budgets sit on the July row, so summing across
  months gives the annual figure. FY27's revised budget is $3.3M below
  its original only because water and sewer carry negative "other
  financing uses" revisions (-$2.11M and -$1.94M); see section 11.
- **FY27's October is partial** in the portal (export dated October 17),
  so quarter comparisons use July through September.

Data vintage:

| Source | Covers | File |
|---|---|---|
| FY27 checkbook | 2026-07-01 to 2026-10-15 | `data/checkbook_FY27_2026-10-15.csv` |
| FY26 checkbook | full year | `data/checkbook_FY26_2026-06-30.csv` |
| Budget portal FY26, FY27 | monthly, FY27 through October (partial) | `data/operating_budget_FY2{6,7}.csv` |
| Budget portal FY25 | year-end department actuals only | `data/budget_actual_FY25.json` |
| No-override FY27 proposal | by department | `data/town_budget_FY27.json` |
| Town's FY27 first-quarter update | quarter ended 2026-09-30, dated 2026-10-27 | `data/2026-10-27_FY27_Q1_Update.txt` (pdftotext of the Current's copy) |

## 2. Headline

| | FY26 window | FY27 to date | change | FY26 full |
|---|---:|---:|---:|---:|
| Vendor payments | $37,025,269 | $41,742,048 | +12.7% | $113,964,571 |
| Rows | 4,038 | 3,681 | | 17,903 |
| Distinct vendors | 729 | 748 | | 2,201 |

By who voted on the money (the site's `bucket_for_fund` rules):

| Bucket | FY26 window | FY27 to date | change |
|---|---:|---:|---:|
| Town Meeting (general fund) | $24,371,931 | $25,074,061 | +2.9% |
| Ratepayer (electric, water, sewer, harbor) | $10,369,117 | $10,257,437 | -1.1% |
| Ballot (debt-excluded capital) | $546,575 | $5,355,159 | +879.8% |
| State and federal | $958,718 | $288,810 | -69.9% |
| Revolving | $482,923 | $322,659 | -33.2% |
| Other | $296,006 | $443,921 | +50.0% |

The ballot bucket is the MHS roof and the rest of the 2022 building
article (section 5). The state and federal bucket is ARPA winding down
($549,084 to $53,515) and school grant funds not yet drawing.

## 3. The override: is the money where the record says it should be?

### 3a. Article 29 against the adopted budget

Town Meeting's Article 29 (May 4, 2026) appropriated supplemental FY27
funds "contingent upon the passage of a Proposition 2.5 override", by
function. Tier 3 passed on June 9. The Town's first-quarter update
(October 27, 2026, Appendix 1) then published the revised FY27 general
fund budget it built "to incorporate the override": $98,822,778 from
Town Meeting plus $4,296,718 of override, $103,119,496 in all, with the
override column by department.

| Function | Article 29, Tier 3 year one | Town's revised budget, override column | Portal adopted minus no-override proposal |
|---|---:|---:|---:|
| General government | $1,250,302 | $1,360,302 | $1,350,302 |
| Public safety | $546,946 | $537,635 | $547,635 |
| Public works and facilities | $477,286 | $526,986 | $646,986 |
| Human services | $196,171 | $196,171 | $196,171 |
| Culture and recreation | $973,941 | $823,552 | $823,552 |
| Other general government | $852,072 | -$147,928 | -$719,743 |
| Capital funding | (inside the line above) | $1,000,000 | $1,000,000 |
| Schools | (no line) | $0 | -$127,499 |
| **Total** | **$4,296,718** | **$4,296,718** | |

Three readings of the same $4,296,718. The middle column is the Town's
own allocation. Against the Article 29 motion it moves $150,389 out of
culture and recreation and $9,311 out of public safety into general
government (+$110,000) and public works (+$49,700); the sum of the moves
is zero. "Other general government" nets to -$147,928 because the
override adds $470,433 of reserves (workers' compensation $97,662,
stabilization $250,000, OPEB $96,771, Finance Committee reserve
$26,000) and removes $592,361 of unemployment cost that had been
budgeted for layoffs that did not happen; add the $1,000,000 capital
line and it is Article 29's $852,072 exactly.

The right-hand column is what this document reconstructed before the
Town published Appendix 1: the FY27 original budget in the portal minus
each department's line in the February "no override" proposal, over the
37 departments that match by name. It lands within $10,000 of the Town's
column on general government and public safety; the residue is two
lines where the proposal differs from the final Town Meeting budget
(Human Resources and Building Inspections, $10,000 each) and Fire's
$143,238 from Article 19, which sits outside the portal's original
budget. Public works is $120,000 over because the proposal's "Public
Works (Highway, Tree, Drains)" line does not map onto the portal's
separate PUBLIC WORKS and DRAINS departments; the $592,361 unemployment
reduction explains all of the "other general government" gap. Appendix
1 supersedes the reconstruction.

### 3b. Department by department

Adopted FY27 budget minus the no-override proposal, the lines the
override bought back (budget portal):

| Department | FY26 budget | FY27 adopted | No-override proposal | Adopted minus proposal | Tracker item |
|---|---:|---:|---:|---:|---|
| Abbot Library | $1,493,292 | $1,595,790 | $857,633 | +$738,157 | #10 full restoration |
| Public Works | $2,646,764 | $3,063,365 | $2,474,771 | +$588,594 | #13 restoration plus 4 positions |
| Public Buildings | $772,112 | $701,225 | $178,671 | +$522,554 | #14 two custodians, $450K maintenance |
| Community Development and Planning | $494,402 | $581,657 | $203,682 | +$377,975 | #15 director, planner, conservation agent, grant writer |
| Finance | $1,942,698 | $2,125,453 | $1,778,805 | +$346,648 | |
| Fire | $5,586,722 | $6,312,967 | $6,016,967 | +$296,000 | #12 four firefighters |
| Police | $4,988,272 | $5,415,360 | $5,216,914 | +$198,446 | #11 SRO, 29 to 33 officers |
| Council on Aging | $423,460 | $523,548 | $387,377 | +$136,171 | |
| Parks and Recreation | $1,045,002 | $1,088,429 | $1,003,034 | +$85,395 | |
| Town Clerk | $244,733 | $268,002 | $201,877 | +$66,125 | |
| Health | $326,141 | $399,320 | $339,320 | +$60,000 | #16 $60K mental health counseling |
| Cemetery | $518,043 | $468,931 | $410,539 | +$58,392 | |
| Building Inspection | $687,313 | $676,519 | $623,330 | +$53,189 | |
| Capital Administration | $0 | $1,000,000 | (none) | | #17 $1M recurring capital |

Two things the table says that the tracker does not. The library's
"restoration" is a restoration relative to the proposal, which had cut
it from $1.49M to $0.86M; against FY26 the library is up 6.9%. The same
holds for Public Buildings and Community Development: large against the
proposal, modest or negative against FY26. Harbor is also $350,000 above
its proposal line, but harbor is an enterprise funded by user fees, not
the override.

The Town's Appendix 2 itemizes the same money as $1,711,376 of restored
cuts and $1,135,342 of new positions and services (plus the $1,000,000
capital and $450,000 maintenance lines): library salaries and materials
$699,779 and two part-time library hires $38,378; Community Development
salaries $307,975 and a $70,000 grant revenue and development
coordinator; DPW salaries and materials $200,594 plus a GIS position,
a heavy equipment operator and a foreman at $70,000 to $74,000 each;
four firefighters $296,000; the police student resource officer $67,482
and two officers $130,964; two Public Buildings custodians $122,554;
Finance's IT director $150,000, budget analyst $70,000 and $147,648 of
restored clerk, training and equipment lines; Council on Aging salaries
$76,171 plus a part-time social worker $45,000; mental health
counseling $60,000; a cemetery laborer $58,392; a Town Clerk special
clerk $66,125; Building Inspections software $43,189; a Recreation and
Parks groundskeeper $43,395 and $42,000 of utilities and park
maintenance.

### 3c. First-quarter payroll, July to September (budget portal)

Operating actuals with transfers, assessments and placeholders excluded;
salaries are the three salary categories.

| Department | Q1 FY26 operating | Q1 FY27 operating | change | Q1 FY26 salaries | Q1 FY27 salaries | change |
|---|---:|---:|---:|---:|---:|---:|
| Fire | $1,273,854 | $1,647,527 | +29.3% | $1,201,057 | $1,435,488 | +19.5% |
| Police | $1,156,214 | $1,335,591 | +15.5% | $1,069,985 | $1,202,746 | +12.4% |
| Public Works | $506,346 | $611,621 | +20.8% | $343,683 | $372,482 | +8.4% |
| Public Buildings | $119,821 | $190,348 | +58.9% | $29,221 | $38,639 | +32.2% |
| Abbot Library | $360,485 | $371,766 | +3.1% | $237,306 | $251,119 | +5.8% |
| Community Development and Planning | $103,002 | $78,546 | -23.7% | $102,849 | $76,220 | -25.9% |
| Council on Aging | $97,447 | $113,846 | +16.8% | $93,730 | $96,856 | +3.3% |
| Health | $56,272 | $67,653 | +20.2% | $47,453 | $54,296 | +14.4% |
| Finance | $620,461 | $649,658 | +4.7% | $181,100 | $226,887 | +25.3% |
| Building Inspection | $150,636 | $175,149 | +16.3% | $117,766 | $134,602 | +14.3% |
| Town Clerk | $50,801 | $60,674 | +19.4% | $49,648 | $57,934 | +16.7% |
| Parks and Recreation | $274,043 | $269,400 | -1.7% | $189,574 | $201,922 | +6.5% |
| All departments | $34,590,010 | $36,829,131 | +6.5% | $9,692,477 | $9,955,499 | +2.7% |

Reading it with the commitments:

| Commitment | Budget signal | Q1 payroll signal | Town's hiring status, Oct 27 |
|---|---|---|---|
| #10 Library restored | +$738K vs proposal, +6.9% vs FY26 | salaries +5.8% | part-time custodian hired in September; part-time assistant interviewing |
| #11 Police SRO, 29 to 33 officers | +$198K vs proposal, +8.6% vs FY26 | salaries +12.4% | one officer in the academy; a second to be hired in January |
| #12 Fire, four firefighters | +$296K vs proposal, +13.0% vs FY26 | salaries +19.5% | two started August 6; two in process |
| #13 DPW restoration plus 4 | +$589K vs proposal, +15.7% vs FY26 | salaries +8.4% | heavy equipment operator filled; GIS and foreman job descriptions being drafted |
| #14 Public Buildings custodians, $450K maintenance | +$523K vs proposal | salaries +32.2% on a small base | facilities maintenance manager job description being finalized; $276,000 of facility maintenance funds in the budget |
| #15 Community Development hires | +$378K vs proposal | salaries -25.9% | grant coordinator job description being finalized; vacancies named as an "area of focus" |
| #16 $60K counseling via Health | +$60,000 vs proposal, exact | salaries +14.4% | funded |
| #17 $1M recurring capital | $1,000,000 new line | $98,223 spent through September | earmarked for Mary Alley alternative bids, police and fire building work, school gym lighting, Village field structure, Brown playground shade, snow equipment |

The Town's count is "6 of 16 override-funded hires in place" as of
October: two firefighters, one police officer, the DPW heavy equipment
operator, the library custodian, and the budget analyst role, whose
"duties [were] assumed by Town Accountant for an annual stipend". Five
positions were still at the job-description stage, four in process, one
with a candidate selected.

The salary growth in public safety cannot be split between new positions
and the collective bargaining agreements Town Meeting funded ($1.3M on
the town side, $1.8M on the school side, per the CFO on May 4). The
Department Explorer's headcount feed is the place to separate them when
the fall payrolls settle.

### 3d. Schools

The school share of the override is $0 in FY27 by design. The Town's
first-quarter update publishes the phase-in that the tracker and the
April presentation never showed in dollars:

| | FY27 | FY28 | FY29 | Cumulative |
|---|---:|---:|---:|---:|
| Town | $4,296,718 | $1,170,782 | $1,030,267 | $6,497,766 |
| Schools | $0 | $5,152,733 | $3,349,502 | $8,502,234 |
| Total | $4,296,718 | $6,323,514 | $4,379,768 | $15,000,000 |

The planned school uses start in FY28 (contractual salary increases,
out-of-district special education tuition, free full-day kindergarten,
revolving-fund positions returned to the general fund, technology
leases, curriculum and professional development) and FY29 adds the
post-graduate special education program and the school building capital
fund. That is consistent with everything the data showed:

- The portal's FY27 school budget by cost center sums to $47,620,287,
  the "VOTE TOTAL SCHOOLS" line of the no-override proposal to the
  dollar, and Appendix 1 of the Q1 update carries the School Department
  at $47,620,287 with an override column of zero.
- Article 29's year-one motion lists six municipal functions and no
  school line, and the CFO's August forecast describes FY27 as "drawing
  $4.2M off the levy per the MOU".
- The tracker's own text describes preservation, not restoration: #18,
  "$6.2M school-side floor preserves the staffing left after the FY27
  balanced budget eliminated 18.25 FTEs"; #19, "The FY27 gap was closed
  in part by a one-time $1.5M SPED OOD prepayment."

The Q1 update's school figure matches this document's to the dollar:
"$5.3M of $47.6M" spent through September 30 (11.1%), against the
script's $5,303,786 for the education function. The Town attributes the
low share to "teacher payroll drops in the summer months". Quarter-one
school salaries are 5.7% below last year ($4,024,956 to $3,796,780),
but the district re-mapped cost centers between years (Districtwide's
budget fell $4.74M while the High School's rose $2.45M) and a September
with a different number of pay dates moves a quarter by several
percent, so the district total through November is the first clean
read.

What is clear is the special-education prepayment. On June 12, 2026 the
district's finance director reported "an unexpended balance of
approximately $1.7 million through 11 months" and that the "district is
pre-paying approximately half of next year's out-of-district special
education tuitions". The checkbook shows it: General Fund - School
payments to placement schools and collaboratives were $1,187,209 in June
2026, four times any other month, and $106,762 so far in FY27 against
$444,993 in the same window last year. Section 8 has the monthly table.
The Q1 update also records that the school district's Superintendent of
Finance and Operations position is eliminated in November, with a
Finance Director (an internal hire) and the Facilities Director
reporting to the Superintendent.

### 3e. Trash

The curbside question's carve-out is now a department. CURBSIDE
COLLECTION appears for the first time with a $2,186,516 FY27 budget
($2,117,516 curbside, $69,000 senior clerk) and WASTE COLLECTION falls
from $2,943,402 to $1,790,344. The Board of Health opened bids in January
("The current trash disposal contract ends July 1; curbside collection
ends late September/early October", January 13, 2026); the Finance
Committee called the new contract "a million bucks increase year over
year" on April 27; the Select Board approved "contract 26F26 for trash
and recycling collection with Republic Services for up to five years" on
October 14, 2026. In the checkbook, Waste Management's $413,704 in last
year's window is $0 this year, Republic Services is $284,805 against
$86,103, and the curbside line shows $185,767 of actuals through
September. The transfer-station cart purchases (Rehrig Pacific) and
their reversals in the Waste Revolving Fund are the other moving part.

## 4. Fixed costs and assessments

| Item | FY26 window | FY27 to date | change | FY26 full |
|---|---:|---:|---:|---:|
| Pension (Contributory Retirement System, all funds) | $6,528,003 | $7,089,412 | +8.6% | $6,536,756 |
| GIC health bill (Commonwealth of MA, "MB" invoices) | $6,324,275 | $6,881,430 | +8.8% | $18,884,227 |
| Debt service (U.S. Bank, general fund, voids included) | $7,603,556 | $7,738,584 | +1.8% | $14,236,643 |
| Essex North Shore Agricultural and Technical | $156,831 | $187,480 | +19.5% | $627,645 |
| MWRA | $1,278,088 | $1,002,866 | -21.5% | $3,756,709 |
| South Essex Sewerage District | $1,442,762 | $1,096,980 | -24.0% | $3,267,245 |
| Other insurance (MIIA and others) | $913,073 | $799,638 | -12.4% | $943,905 |

**Pension.** The general fund appropriation was paid on July 1 both
years: $5,380,625 in FY26 and $5,843,360 in FY27 (+8.6%). The CFO told
Town Meeting on May 4 that "pension contributions are up half a million
dollars, following the schedule set by our retirement board to fully
fund the town's pension liability by the state-imposed deadline of
2040"; on August 12 the forecast put full funding "around 2037", with
PERAC pushing boards to 110 to 120%, so freed capacity is modeled from
2041. The long-run series shows how unusual an 8.6% year is: pension
expenditure grew 3.1% a year from FY14 to FY24 and 0.7% a year from FY19
to FY24.

**GIC.** The monthly bill is $1.71M to $1.74M this year against $1.57M to
$1.60M last year, up 8.7% to 8.8% in each of July through October. The
bill is the gross premium (the town's share, employee and retiree shares
withheld through payroll, and the enterprise funds' shares), so it is
larger than the group insurance budget line ($16,754,748 for FY27, up
11.0% on FY26's $15,100,893; 3.0% a year over FY22 to FY27). The
Finance Committee heard on March 2 that FY27 GIC rates were projected
"at roughly 4 to 8% in the aggregate" after the GIC dropped GLP-1
weight-loss drugs, and on April 6 that "GIC health insurance rates have
risen 5 to 12% annually over the past four years". A bill up 8.8% with
rates up 4 to 8% implies enrollment or plan mix also moved. The CFO's
10-year plan "assumes inflation at or below 10%" and names sustained
inflation above that as the key risk. The Q1 update itself reports
health insurance for active employees and retirees at "$3.9M of
$16.0M" (24.1%) spent through September and "up 11% over the first
quarter of last year, in line with expectations". That is the town's
net cost in the budget portal; the 8.8% here is the gross GIC bill.
Both say the same thing: high single digits to eleven percent, on a
budget line that assumed eleven.

**Debt service.** The FY26 pattern is lumpy: $6.81M in July, $0.80M in
August, $1.26M in January, $0.25M in February, $5.12M in May. FY27's
July and August match it ($6.93M, $0.80M), which is why the year-to-date
change is 1.8% while the budget line is up 17.8% to $10,971,016. Town
Meeting heard on May 4 of a "new bond issuance of $26.2M (net $24,975K
after $1.5M premium) at 3.75% true interest cost"; its first payments
fall in the second half. Debt outstanding was $146,297,626 through 2056,
with S&P's AAA outlook revised to negative.

**Essex Tech.** The October 15 installment of $187,480 is one quarter of
$749,920; Town Meeting approved a $749,000 assessment for 35 students on
May 4. FY26 paid $627,645. On March 25 a resident told the Select Board
that enrollment was rising from 35 to 55 and that "the original $750,000
projection had grown to $1.1 million after a state formula change"; the
assessment for FY28 is the thing to watch.

**State assessments.** The budget line is up $528,475 (+21.3%) to
$3,004,090, almost all charter school tuition: $2,305,546 budgeted
against $1,827,544 on the FY26 cherry sheet (+26%), with the MBTA
assessment flat at $524,918 against $519,178. These are charged through
the cherry sheet, not the checkbook.

**MWRA and SESD.** Both are down 21% to 24% so far. Assessment billing
timing differs from year to year; FY26's full-year totals ($3.76M and
$3.27M) are the right scale and nothing here is a savings claim.

## 5. Capital

Article 11 of the 2022 Town Meeting ("Capital Improvements for Public
Buildings") is the fund behind most of the year's increase:

| Vendor, A11 2022 CAPITAL IMPROVEMENT | FY26 full | FY27 to date | What it is |
|---|---:|---:|---|
| Homer Contracting | $4,675,244 | $3,740,036 | MHS roof and HVAC general contractor |
| D & R General Contracting | $1,297,918 | $953,072 | roadway and sidewalk, contract 2024-030 |
| Raymond Design Associates | $918,860 | $20,138 | roof designer |
| MDM Engineering | $823,141 | $60,723 | Mary Alley and Jacobi roofs |
| Richard D. Ambrosia | $575,211 | $28,396 | sidewalk and ADA transition |
| Leftfield | $359,395 | $114,290 | MHS roof owner's project manager |
| PAQCON | $0 | $339,150 | Vets D-wing roof |

The Select Board awarded Homer the MHS roof and HVAC contract on November
25, 2025 for $8,970,000, "approximately $2.1 million under the
construction estimate"; Town Meeting heard on May 4 that the project
"has begun work" and "is currently on budget". Homer has been paid
$8,415,280 across the two years, 94% of the contract. On the water side,
N. Granese & Sons' Contract 190 water main work ($685,808 in the 2026
water article plus $266,400 through the 2023 MWRA loan) is the new
spend, and National Water Main Cleaning ($292,217) is drawing the 2024
sewer article. ARPA is almost spent out ($1,318,879 in FY26, $53,515 so
far). The Gerry Playground donation fund paid Belko Landscaping
$208,525.

Articles with no FY27 payment yet, where FY26 was active: the 2025 sewer
construction article ($654,565 in FY26), the harbor access grant
($591,015), the 2024 capital improvement article ($191,234), the 2023
water article ($83,203), and the cemetery improvements article
($126,856). Quiet is not stalled; the drill page's status inference is
the better instrument once a few more months pass.

## 6. Vendors

**Top of the list.** Ten vendors are 82% of FY27 payments to date (81%
last year in the window; 63% over a full year, when the long tail of
small vendors fills in). The top four are the same both years: U.S. Bank
(debt), the retirement system, the Commonwealth (GIC), and Berkshire
Wind Power (MMLD's purchased power, $3,900,599, down $253,402).

**New.** 133 vendors paid in FY27 never appear in FY26, $1,413,355 in
total. The top three are contractors: PAQCON ($339,150, Vets roof),
National Water Main Cleaning ($292,217, sewer article), Belko Landscaping
($208,525, Gerry Playground). After them the list is ordinary: a mail-order supplier on the new "capital recurring" division ($65,450), the Housing
Authority through an MAPC grant ($34,356), a handful of new
special-education placements and evaluators on the school fund.

**Gone.** Paid at least $20K in last year's window, nothing this year:
Myers Controlled Power ($659,472; $1,011,084 for FY26; an MMLD project
vendor), Waste Management ($413,704; the contract ended), Kittredge
Equipment ($125,610), Design Built ($115,782), Marcotte Ford ($115,640,
vehicle purchases under 2025 articles), LA Management ($90,352, harbor),
and a string of special-education placements and transporters, which
is the prepayment story in section 8.

**Legal.** Mead Talerman & Costa, the town's outside counsel, is flat
($40,683 to $41,304 in the window; $208,050 for FY26). The school
district's counsel Valerio Dominello & Hillman fell from $43,250 to
$4,320. The town counsel budget line itself rose from $115,000 to
$278,000, which the no-override proposal already carried.

**Screens.** Identical rows (same vendor, date, amount and description)
in FY27 are listed in the companion. They are not findings; the portal
publishes no invoice numbers, so a pair can be two units or a duplicate
posting. The ones large enough to ask about: three $15,379 rows to First
American Commercial Bancorp on September 29 for financed cart payments,
plus a $15,379 pair to Rehrig Pacific on September 22; two $10,851 rows
to Riverview School and two $9,752 rows to Williams Bridge Academy
(plausibly two students each); two $6,970 fire-alarm inspection rows
to American Service Co.; and two $5,806 Konica copier-lease rows to U.S.
Bank on September 16 on top of one on August 7. The 14-day near-duplicate
screen, with the recurring GIC, pension and debt vendors excluded, found
nothing.

**Reversals.** The July 1 U.S. Bank reversals (-$1,945,000, -$473,125,
-$440,000, -$141,525) match four payments re-issued July 8 and again
July 14 with an "R" suffix; the net for those four is one payment each.
N. Granese's August 20 reversals (-$405,365 in the water article,
-$266,400 in the MWRA loan) carry the same Contract 190 descriptions as
positive rows in the same two funds, so they look like a move between
funds rather than money returned. Rehrig Pacific's October 1 reversals
(-$60,100, -$20,500, -$15,379) offset cart charges booked in September;
the descriptions do not say why. None of these reads as a refund, but
the portal does not say.

## 7. Enterprise funds

| Fund | FY26 window | FY27 to date | change | FY26 full |
|---|---:|---:|---:|---:|
| Electric | $6,789,822 | $6,030,144 | -11.2% | $21,117,305 |
| Water operating | $1,577,125 | $1,343,171 | -14.8% | $4,510,587 |
| Sewer operating | $1,710,775 | $1,401,972 | -18.1% | $3,981,053 |
| Harbor | $274,760 | $208,697 | -24.0% | $506,781 |
| Water capital articles | $16,535 | $687,268 | | $1,081,814 |
| Sewer capital articles | $100 | $319,784 | | $1,041,784 |

The electric decline is Myers Controlled Power's FY26 project ($659,472
in the window) not recurring and Berkshire Wind $253,402 lower; MMLD's
own pension share is up ($771,870 to $838,251). Water and sewer operating are down
on the MWRA and SESD timing noted above, while their capital articles are
up about $1M together. In the budget portal, MMLD's first-quarter
salaries are down 20% ($864,984 to $691,074), which is worth a question
given the department's staffing history on the site.

## 8. Schools' vendor spending

General Fund - School vendor payments are $1,487,430 so far against
$1,914,511 in last year's window (-22.3%; $10,704,394 for FY26). By
vendor-name category:

| Category | FY26 window | FY27 to date | change | FY26 full |
|---|---:|---:|---:|---:|
| Special education, out of district | $444,993 | $106,762 | -76.0% | $3,361,307 |
| Transportation | $100,552 | $78,783 | -21.6% | $1,284,309 |
| Legal | $166,015 | $152,672 | -8.0% | $791,114 |
| Technology and software | $74,438 | $90,162 | +21.1% | $158,029 |
| Utilities and energy | $9,155 | $44,001 | +380.6% | $421,238 |
| Other | $1,119,357 | $1,015,050 | -9.3% | $4,688,397 |

Special-education placements by month, FY26: $136K in August, $111K in
September, $416K in October, then $100K to $250K most months, $497K in
May and $1,187K in June. FY27 so far: $46K, $42K, $18K. The June spike
is the prepayment the finance director described on June 12, 2026
("pre-paying approximately half of next year's out-of-district special
education tuitions"), funded from the district's FY26 unexpended balance
of about $1.7M, and the School Committee's May 21 proclamation calls it
"a one-time $1.5M SPED prepayment in FY27". Two consequences: the FY27
checkbook will understate this year's tuition cost by roughly that
amount all year, and the same trick is not available next June unless
there is a surplus again. The Circuit Breaker fund, the state's
special-education reimbursement, paid $1,996,900 in FY26 and $25,579 so
far. Descriptions on these rows are redacted by the site's pipeline, so
the vendor names are the only handle.

## 9. Full-year projection

Projected FY27 = FY27 to date divided by the FY26 window's share of the
FY26 full year, by group. Useful only where the spending is smooth.

| Group | FY26 window share | FY27 to date | Projected FY27 | vs FY26 full |
|---|---:|---:|---:|---:|
| Town Meeting bucket | 40.9% | $25,074,061 | $61,332,042 | +2.9% |
| Ratepayer bucket | 30.7% | $10,257,437 | $33,465,612 | -1.1% |
| GIC (general fund) | 35.2% | $5,957,990 | $16,906,626 | +6.8% |
| Pension (general fund) | 100% | $5,843,360 | $5,843,360 | +8.6% |
| Debt service (general fund) | 53.4% | $7,738,584 | $14,489,465 | +1.8% |
| General Fund - School | 17.9% | $1,487,430 | $8,316,502 | -22.3% |
| All vendor payments | 32.5% | $41,742,048 | $128,482,916 | +12.7% |

Read the last line as "capital", not "the town". Debt service will land
above its projection because the May bond's payments have not started;
the school line will land above its projection by the prepayment; the
ballot bucket cannot be projected this way at all (the window held 4.9%
of FY26's capital spend).

## 10. What to watch

- **November checkbook:** whether special-education tuition invoices
  start arriving (the prepaid half should keep them low; the unpaid half
  should appear), and the first payment under the May bond.
- **October and November payroll in the portal:** school salaries after
  the pay-calendar effect; Community Development's four hires; Fire's
  four; whether MMLD's salary drop persists.
- **The first quarterly financial review (tracker #23)** and whatever the
  boards say about the school share of year one.
- **GIC:** any month above $1.75M, and the FY28 rate vote in the spring.
- **Essex Tech:** the December installment (FY26 paid two that month) and
  the FY28 assessment against the 35-to-55 enrollment warning.
- **Curbside collection:** actuals against the $2,186,516 budget as the
  Republic contract takes over.
- **Capital administration:** pace of the $1M line after $98,223.
- **MWRA and SESD** catching up to FY26's run rate.
- **The quiet articles** in section 5.
- **The screens** in section 6, if anyone with access to invoice numbers
  wants to close them.
- **The ten unfilled override hires** on the Town's October list: the
  second police officer and the COA social worker are dated January;
  the grant coordinator, DPW GIS and foreman, and facilities manager
  were still job descriptions.
- **The FY27 tax rate**, set in January with both overrides; the
  February 1 and May 1 bills carry the increase plus a true-up for the
  two preliminary quarters.
- **Mary Alley alternative bids** and the rest of the $1M capital
  earmarks; the Town Administrator selection in early November.

## 11. Open questions that need a primary source

Resolved by the Town's first-quarter update of October 27, 2026:

- The school share of the override in FY27 is $0; the schedule is
  $5,152,733 in FY28 and $3,349,502 in FY29 (section 3d).
- "Other general government" sits $592,361 below the no-override
  proposal because the override budget removed that much unemployment
  cost; it is not a health-insurance re-estimate (section 3a).

Still open:

1. The negative "other financing uses" revisions on water (-$2.11M) and
   sewer (-$1.94M) and water's $2.40M first-quarter OFU actual.
2. The DPW scope difference between the proposal and the portal, now
   moot for the override column (Appendix 1 gives it directly) but still
   relevant to any FY26-to-FY27 department comparison.
3. The identical-row items in section 6.
4. Pipeline, not finance: the FY27 drill file behind the live checkbook
   page has an as-of of July 5, because no workflow re-crawls FY27. Logged
   as a follow-up to PR #1300.

## 12. Checked against the Town's first-quarter update

The Town published its "Fiscal Year 2027 First Quarter Update" (quarter
ended September 30, 2026; dated October 27; PowerPoint export, 17
pages) on October 28; the Current hosted the file. It is the first
quarterly report under the override MOU (tracker #23). Where it and
this document measure the same thing:

| Measure | Town's Q1 update | This document | Note |
|---|---:|---:|---|
| Override, FY27 | $4,296,718 | $4,296,718 | Article 29 Tier 3 |
| Revised FY27 general fund budget | $103,119,496 | | $98,822,778 plus override; excludes debt service, assessments, enterprise funds |
| School department, FY27 budget | $47,620,287 | $47,620,287 | no override in FY27 |
| School spending through Sept 30 | $5.3M (11.1%) | $5,303,786 | education function, operating |
| Public safety spending through Sept 30 | $3.1M of $12.6M (24.7%) | $3,199,867 | this document's function includes $143,238 less budget (Article 19) and a slightly wider category set |
| Retirement assessment | $5.8M of $5.8M (100%) | $5,843,360 paid July 1 | |
| Insurance premiums | $800K of $908K (88%) | $799,638 | "other insurance" division, all vendors |
| Health insurance, active and retirees | $3.9M of $16.0M, "up 11%" | GIC bill +8.8% per month | net cost vs gross premium |
| Override hires in place | 6 of 16 | fire and police salaries up, planning down | section 3c |

What the update adds that the data could not show: the three-year
phase-in by town and schools; the department-level override column;
the hiring status of all 16 positions; the $450,000 maintenance split
($276,000 facility funds, $112,000 facilities maintenance manager,
$50,000 rail trail, $12,000 superintendent of buildings stipend); the
$1,000,000 capital earmarks; a health-insurance opt-out paying $4,000
(individual) or $8,000 (family) with net savings the Town estimates at
about $5,000 and $18,000 per participant; the elimination of the
schools' Superintendent of Finance and Operations post; the Town
Administrator and Finance Director searches; the senior property tax
exemption applications due November 30, 2026; and the warning that the
February and May tax bills will be higher once the FY27 rate, with the
$4.3M override and the $2.2M trash override, is set in January.

Two notes on the update's own framing. Its "Department Spending on
Track" page compares spending to annual budget by function, which is
the right test for staying within appropriation and a weak test for
year-over-year change; this document's same-window comparison is the
complement, not a contradiction. And its revised budget "excludes debt
service and state assessments", the two lines growing fastest in the
portal (+17.8% and +21.3%); section 4 covers them.

## Appendix: reproduction

```
python3 scripts/fetch_operating_budget.py --year 2025     # one-off; CSV not committed
python3 scripts/build_budget_actual.py --year 2025        # writes data/budget_actual_FY25.json
python3 scripts/analysis_checkbook_yoy.py > docs/analysis/2026-10-22-fy27-checkbook-vs-fy26-tables.md
python3 scripts/analysis_checkbook_yoy.py --json /tmp/yoy.json   # same tables as JSON, for the page
```

Method notes: the FY26 window end is the FY27 as-of month and day one
year earlier; buckets and general-fund carve-outs reuse
`scripts/build_checkbook_view.py`; "GIC" rows are Commonwealth of MA
payments whose description carries an "MB" invoice number or the word
GIC; school vendor categories are keyword matches on vendor names, listed
in the script; department names between the portal and the proposal are
joined by a normalizer plus the alias map in the script; the Article 29
amounts are transcribed from the Town Meeting transcript of May 4, 2026
at 1:50:27 and sum to the $4,296,718 Tier 3 total read into the record.
