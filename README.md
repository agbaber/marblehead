# Marblehead Budget Data

An open dataset and visualization project tracking Marblehead, Massachusetts municipal finances, with a focus on the FY2027 budget deficit and proposed Proposition 2.5 override.

**This is not an advocacy project.** The goal is to make the data accessible and verifiable so residents can form their own opinions based on facts, not rhetoric.

## What's Here

### Data
- [`data/MASTER_DATA.csv`](data/MASTER_DATA.csv) -- Every verified time-series data point in one file (FY2001-FY2027)
- [`data/DATA_CATALOG.md`](data/DATA_CATALOG.md) -- What every field means, where it came from, and what the caveats are
- [`data/SOURCE_LOOKUP.md`](data/SOURCE_LOOKUP.md) -- Trace any number back to its specific document and page
- [`data/case_studies.md`](data/case_studies.md) -- What happened in Melrose and Stoneham after failed overrides

### Charts
Interactive HTML charts viewable at **[agbaber.github.io/marblehead](https://agbaber.github.io/marblehead/)** (or open the HTML files directly in a browser):

- **Tax Levy vs Health Insurance** -- actual spending indexed to FY2006, showing the divergence
- **Health Insurance & Staffing** -- spending vs employee headcount (stacked panels)
- **Premium Per Employee** -- GIC family plan cost from published rate sheets
- **Four Town Tax Rates** -- Marblehead vs Melrose, Swampscott, Stoneham (24 years, DOR data)
- **Marblehead vs Swampscott** -- detailed tax comparison with median home values
- **Override Calculator** -- what each tier costs monthly by home value
- **New Revenue vs New Costs** -- the annual structural gap
- **Tax Rate History** -- Marblehead + Swampscott rates over 24 years

### Primary Sources (not stored here due to size)
All data is drawn from publicly available documents:
- [Marblehead Annual Comprehensive Financial Reports (ACFRs), FY2004-FY2024](https://www.marbleheadma.gov/document/annual-comprehensive-financial-reports/)
- [Marblehead Finance Committee Reports](https://marbleheadma.gov/finance-committee/)
- [MA DOR Division of Local Services Tax Rates](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=PropertyTaxInformation.taxratesbyclass.taxratesbyclass_main)
- [MA DOR Average Single Family Tax Bill](https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=averagesingletaxbill.singlefamtaxbill_wrange)
- [GIC Benefit Rates](https://www.mass.gov/lists/gic-benefit-rates)
- [PERAC Marblehead Retirement Valuation](https://www.mass.gov/doc/marblehead-retirement-board-valuation-report-2024/download)
- [FY2027 Proposed Budget](https://marbleheadma.gov/wp-content/uploads/2026/04/PROPOSED-FY27-BALANCED-BUDGET-WITH-NO-OVERRIDE.pdf)
- [2026 State of the Town Presentation](https://marbleheadma.gov/wp-content/uploads/2026/02/2026-State-of-the-Town-Presenation-Final.pdf)

## Corrections Welcome

If you find an error, please open an issue or submit a pull request. Every number should be traceable to a primary source. If it's not, that's a bug.

## About

Built by a Marblehead resident trying to understand the town budget. Not affiliated with the Select Board, Finance Committee, or any override campaign.
