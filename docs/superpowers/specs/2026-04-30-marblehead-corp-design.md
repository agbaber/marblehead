# MARBLEHEAD CORP — Design Spec

A single-page deadpan parody of a corporate annual report, used to demonstrate why "the town should run like a business" doesn't survive contact with Massachusetts municipal law. The page steelmans the business framing first and then lets MGL citations do the demolition. Every "absurdity" traces to a real statute. Every number traces to a primary source.

## Goal

Make the meta-argument — without taking a position on the override — that a Massachusetts municipality is so heavily structured by state law that the "run it like a business" framing collapses under its own weight when applied literally. The page does not argue the framing is wrong as a *value* statement (some readers think those constraints are bad); it argues the framing is wrong as a *factual* description.

The page is a piece of writing that is sharable on its own merits and that earns its register through commitment to the format. It is meant to be either chuckled at or grimly appreciated, depending on the reader's priors.

## Editorial constraints

1. **No advocacy.** Does not say or imply "vote yes" or "vote no" on the override or any other ballot question.
2. **No people quoted.** Does not quote, name, or paraphrase any actual resident, official, or commenter making the "run it like a business" argument. Punches at the framing, not at people.
3. **Every number traces to a primary source.** ACFR page numbers, DLS reports, MGL citations, FY26 budget book pages — all in the Notes section.
4. **No editorial language in the narrator's voice.** No "shocking," "absurd," "ridiculous," etc. The format is the argument; the prose stays deadpan.
5. **No em-dashes.** (Site convention.)
6. **No green-good / red-bad.** If color is used to mark contrast (e.g. "what a business does" vs "what MGL requires"), use neutral semantic colors from the existing palette.
7. **Site neutrality stance preserved.** Reader can finish the page with either reaction — "the framing is bad reasoning" or "those constraints are dumb" — and the page accommodates both.

## File layout

- **HTML page:** `marblehead-corp.html` at the repo root.
- **URL:** `https://marbleheaddata.org/marblehead-corp.html`.
- **Nav placement:** **None.** Page is unlinked from the site nav, the homepage, the footer, and `info-guides.html`. It is discoverable only by direct URL or by sharing.
- **Sitemap:** Excluded from `sitemap.xml` (so it isn't auto-promoted via search), but allowed in `robots.txt` (search engines can index it if a third party links). Decision rationale: we don't promote it, but we don't actively hide it either; it just isn't part of the site's official taxonomy.
- **Search index (Pagefind):** Excluded. Add `data-pagefind-ignore` on the body or the relevant frontmatter equivalent so the site's cmd-K search doesn't surface it. Same rationale as sitemap.
- **Layout:** Uses Jekyll's `default` layout for `<head>` and the standard site nav (so analytics, fonts, citations.js etc. still load), but the page body below the nav is its own visual world.
- **Stylesheet:** A scoped block in `assets/site.css` keyed off `body.corp-page` (or a dedicated `assets/marblehead-corp.css` if the rules grow large). Uses existing palette tokens. Adds typographic conventions specific to financial documents (see Visual Register below).
- **No new layouts, no new includes** unless something in implementation forces it.

## Visual register

Berkshire-Hathaway-spartan, not glossy modern SaaS investor-relations. Single accent color from the existing palette. No photos, no glossy charts, no decorative SVGs. The visual restraint is part of the joke.

### Cover block (above the body)

Centered, narrow, separated from the rest of the page by thin horizontal rules above and below.

```
                          ─────────────

                          MARBLEHEAD CORP
                       FY 2025 ANNUAL REPORT

                         Established 1649

              Listed on: Annual Town Meeting (Marblehead)
                    Symbol: MHD · CUSIP: N/A

                          ─────────────
```

Serif display face for "MARBLEHEAD CORP" (use the site's existing serif if it has one, otherwise system serif). Smaller small-caps for the rest. A faint horizontal rule above and below.

### Body typography

- Serif body face, justified paragraphs, slightly tighter line height than the rest of the site.
- Section headers in small-caps with a leading "ITEM N." in the SEC-form style: e.g. **ITEM 1A. RISK FACTORS**, **ITEM 11. EXECUTIVE COMPENSATION**, etc.
- A drop cap on the opening letter from Management.
- Footnote superscripts (¹ ² ³) inline; footnote bodies live in the **Notes** section near the bottom.
- Tabular numerals, right-aligned, in any data column.
- Small-caps for "the Company," "the Board of Directors," etc. — old-school 10-K style.

### Color and chart use

- Single accent color from the existing palette for headers, rules, and emphasis.
- No charts unless one earns its keep. Default to no charts. If a chart is added (e.g. a tiny revenue-segment bar), it must use the site's existing chart classes per STYLE_GUIDE — no inline `style=""` on SVG.

## Section-by-section content

The page scrolls top-to-bottom in this order. Each item below specifies what content goes in the section, what data is needed, and where it comes from. Anywhere a specific number is required, the source is named so implementation is mechanical.

### 1. Cover block

As above. "FY 2025" because that is the most recent fiscal year *in progress* at the time of publication; data on the page is drawn from the FY24 ACFR (most recent audited figures) and the FY26 budget book (most recent forward-looking spend authorization). Treat the asymmetry the way a real annual report does: cover says current FY, body draws on most-recent-audited.

### 2. Letter from Management

Opens with: **"We do not have a Chief Executive Officer."**

Then, in three to four short paragraphs of deadpan corporate-letter prose:

- Explains the actual Marblehead governance chain: Annual Town Meeting (the assembled body of registered voters with the legal authority to appropriate funds) → elected Select Board (five members, three-year terms, unpaid) → appointed Town Administrator (current incumbent's name and start date in a footnote).
- Notes that "the Annual Shareholder Meeting" requires physical attendance, has no proxy voting, and historically has been held continuously in some form since the seventeenth century.
- Closes with a sentence acknowledging that the structure is "unusual by industry standards" and directing the reader to **Item 1A. Risk Factors** for material constraints on operations.

Signed: **The Office of the Town Administrator, Marblehead, Massachusetts.** (No individual name in the signature line — keeps the bit; the actual incumbent's name is footnoted only.)

**Sources required:** name and title of current Town Administrator (footnote only); first year of recorded Town Meeting in Marblehead (footnote only — best available citation; if uncertain, footnote phrases as "since the seventeenth century").

### 3. Company at a Glance

A KPI strip across the page — six cells in two rows, or one row of six on wide screens. Each cell: large numeral, small-caps label below, footnote superscript pointing to the source.

Required cells:

| Cell | Value | Source |
|---|---|---|
| Customers | Population (most recent ACS) | ACS B01003 or DOR `dor_income_eqv_pop_FY27.csv` |
| Employees (FTE) | FY24 total FTE | FY24 ACFR p.136 |
| FY25 Revenue (Operating) | Total general fund revenue, FY24 actual | FY24 ACFR p.[appropriate page in MD&A or schedule] |
| Bond Rating | Aa1 (Moody's) | FY24 ACFR — bond rating disclosure section |
| Levy Ceiling Utilization | (FY26 levy) / (FY26 levy ceiling), as % | DOR Tax Recap; `dor_all_351_FY26.csv` |
| Fund Balance (Stabilization) | Most recent stabilization balance | FY24 ACFR or FY26 budget book |

If any of these is unavailable at implementation time, drop the cell rather than estimate. The strip looks fine with five.

### 4. Item 1. Business

Two short paragraphs. Describes "the Company" as a Massachusetts municipal corporation incorporated in 1649, principal office at Abbot Hall, primary line of business: provision of K-12 education, public safety, public works, and ancillary services within a service area of approximately 4.5 square miles.

Then a small **Business Segments** table:

| Segment | FY26 Budgeted Spend | % of Total |
|---|---|---|
| Education (K-12) | from FY26 budget summary | computed |
| Public Safety (Police + Fire) | from FY26 budget summary | computed |
| Public Works | from FY26 budget summary | computed |
| General Government | from FY26 budget summary | computed |
| Employee Benefits | from FY26 budget summary | computed |
| Debt Service | from FY26 budget summary | computed |
| Other | from FY26 budget summary | computed |

Right-aligned numerals. Source footnote: `data/FY26_budget_summary.json` and the FY26 budget book pages cited there.

### 5. Item 1A. Risk Factors

The heart of the joke. Numbered 1A.1 through 1A.10. Each entry is two sentences:

1. **Sentence 1** — the corporate convention, stated as if from a normal 10-K Risk Factor.
2. **Sentence 2** — the MGL provision (or other binding constraint) that prevents the Company from operating that way, stated as a flat factual disclosure.

Body of the section is a single block; subheaders are in small-caps with an italic risk title:

> **1A.1.** *Revenue growth.* The Company's pricing power is statutorily limited. The aggregate annual increase in property tax revenue is capped at 2.5% over the prior year's levy limit, plus new growth, except by majority vote of the Company's customers (M.G.L. c. 59, §21C, "Proposition 2½"). The Company has no ability to expand into new geographic markets, as service area boundaries are fixed by colonial charter and adjacent municipal incorporation.

> **1A.2.** *Customer selection.* The Company is statutorily prohibited from selecting its customer base. K-12 educational services must be provided to all residents under age 22, regardless of ability to pay or service cost (M.G.L. c. 71, §1, §5; IDEA, 20 U.S.C. §1400 et seq. for special education). Emergency public safety services must be provided to all persons within the service area without regard to residency or payment.

> **1A.3.** *Workforce reductions.* The Company's ability to terminate employees is materially constrained. Teachers with three or more years of service may not be dismissed except for cause, after a hearing (M.G.L. c. 71, §42). Public safety employees in civil service positions are subject to additional removal protections (M.G.L. c. 31).

> **1A.4.** *Collective bargaining.* A substantial portion of the Company's workforce is covered by collective bargaining agreements pursuant to M.G.L. c. 150E, including but not limited to teacher, paraprofessional, police, fire, public works, library, and clerical bargaining units. Unilateral changes to wages, hours, or terms and conditions of employment are not permitted during the term of an agreement.

> **1A.5.** *Communications and information security.* All material non-public deliberations of the Company's Board of Directors must be noticed in advance and conducted in public (M.G.L. c. 30A, §§18–25, "Open Meeting Law"). Internal communications, including correspondence among officers, are subject to disclosure on request (M.G.L. c. 66, §10, "Public Records Law"). Strategic plans cannot be developed in private session except in narrowly enumerated circumstances.

> **1A.6.** *Procurement.* The Company cannot select preferred vendors based on relationship, brand preference, or convenience. Purchases of supplies and services in excess of $50,000 require sealed competitive bidding; purchases between $10,000 and $50,000 require written quotations from at least three vendors (M.G.L. c. 30B). Contracts for public construction projects exceeding $50,000 are subject to additional bidding and prevailing-wage requirements (M.G.L. c. 30, §39M; c. 149, §44A et seq.).

> **1A.7.** *Employee benefits.* The Company's authority to modify employee health insurance plan design and contribution share is limited. Such changes may be made only through collective bargaining or, in lieu of bargaining, by a 70% supermajority vote of a Public Employee Committee composed of representatives of each affected bargaining unit (M.G.L. c. 32B, §19, §22). The Company's premium contribution share is currently 83%.

> **1A.8.** *Capital structure.* Major capital expenditures and new borrowing require approval at the in-person Annual or Special Town Meeting. There is no proxy voting; each shareholder appears in person (M.G.L. c. 39, §10). Borrowing in excess of debt limits is permitted only by separate ballot (M.G.L. c. 59, §21C(k), "debt exclusion").

> **1A.9.** *Insolvency.* The Company is not eligible to file for protection under Chapter 9 of the United States Bankruptcy Code. Massachusetts has not enacted general legislation authorizing its municipalities to file (11 U.S.C. §109(c)(2) requires specific state authorization, which Massachusetts has not provided).

> **1A.10.** *Governance.* The Board of Directors consists of five members elected by customers to staggered three-year terms. Board members are uncompensated (M.G.L. c. 41, §108 permits stipends; the Company's Board has historically declined). The Board may be replaced in whole or in part by majority vote of customers at each annual election.

Each citation at the end of a Risk Factor links nowhere by default — these are statutory citations, not URLs — but the **Notes** section at the bottom provides a short plain-English gloss for any reader who wants more detail.

### 6. Item 7. Management's Discussion and Analysis

One short paragraph noting that the Company's most recent audited financial statements are for the fiscal year ended June 30, 2024, and directing readers to the FY24 ACFR for full financial detail. Footnote with the URL to the ACFR in the site's primary-source archive.

### 7. Item 11. Executive Compensation

A single small table, played straight:

| Position | Holder (Title) | FY26 Cash Compensation |
|---|---|---|
| Chair, Board of Directors | Select Board Chair | $0 (M.G.L. c. 41, §108 permits stipend; Board has historically declined) |
| Director (×4) | Select Board (4 members) | $0 each |
| Town Administrator | [Current incumbent] | [FY26 budgeted salary] |

Below the table, a brief paragraph titled **Industry Comparables** notes (without commentary) the publicly disclosed total compensation of the chief executive at one or two area private employers — e.g. Eastern Bank (publicly traded, proxy disclosure) and L.L. Bean (privately held, but historically reported in business press). If clean comparable figures are not available at implementation time, drop the comparables paragraph and let the salary stand on its own.

**Editorial guardrail:** the comparables are presented in a single neutral sentence each (position, employer, total comp, year, source). No commentary on the gap. The reader's reaction (it's huge / it's reasonable) is the reader's reaction.

**Sources required:** Town Administrator's FY26 base salary (FY26 budget book — General Government section); current incumbent's name and start date; comparables compensation figures from latest available proxy or business press.

### 8. Notes to Financial Statements

Small type. Numbered footnotes (¹ ² ³ ...) corresponding to every superscript on the page. Each footnote one sentence:

- Source citation in the form `FY24 ACFR, p. X, "Table Name"` or `MGL c. N, §M` or `DOR DLS Tax Recap, FY26` or similar.
- Where useful, a one-line plain-English gloss after the citation (e.g. "M.G.L. c. 30B is the Uniform Procurement Act; it sets the bidding thresholds quoted above").

This section is what makes the page pass the site's "every number traces to a primary source" rule.

### 9. Forward-Looking Statements

Closing block, also played straight, mimicking SEC safe-harbor disclaimer language but with real contingencies:

> *Statements in this Annual Report regarding future operations, including but not limited to projections of the FY27 operating deficit, planned modifications to the FY27 levy, and changes to executive compensation, constitute forward-looking statements within the meaning of Section 27A of the Securities Act of 1933 and Section 21E of the Securities Exchange Act of 1934. Such statements are subject to material uncertainties, including but not limited to: the outcome of the FY27 Proposition 2½ override and Question 2 ballot questions; appropriations made at the May 4, 2026 Annual Town Meeting; pending legislation in the 194th General Court of the Commonwealth, including H.4225 (senior tax exemptions); and the funding policies of the Group Insurance Commission. Actual results may differ materially.*

Italicized, smaller type, justified.

End of page. No CTA. No "subscribe to our newsletter." No reactions. The page does not invite engagement; it is a document, not a conversation.

## What the page deliberately does NOT include

- No call to action.
- No "vote yes / vote no" anywhere.
- No reactions widget or community pulse.
- No quotes from real people.
- No green-good / red-bad coloring.
- No charts unless one earns its keep.
- No links to `the-debate.html`, `whats-on-the-ballot.html`, or any other site page from the page body. (Footnotes may link to source PDFs in the archive, but the page does not promote sibling pages — it stands alone.)
- No homepage link, footer link, or nav link to the page.

## Test for whether it's working

A reader who came in believing "the town should run like a business" should finish the page with one of two reactions:

- "OK, fair, when you actually try to map the analogy, it breaks at every joint."
- "Right — and *that's the point*, those constraints are exactly what's wrong with how towns work."

Both reactions are acceptable outcomes. The page does not need to win a fight; it needs to make the framing's literal application visible.

A reader who came in indifferent to the framing should finish either chuckling at the format or, more likely, having absorbed a fair amount of municipal civics by accident.

## Implementation considerations

- **Sources to look up at implementation time:**
  - FY24 ACFR specific page numbers for: total FTE, total revenue, bond rating disclosure, stabilization fund balance.
  - FY26 budget book page numbers for: spending by major category (for the Business Segments table); Town Administrator salary line item.
  - Current Town Administrator's name, title, and start date (footnote).
  - DOR FY26 levy ceiling utilization figure for Marblehead.
  - Two industry-comparable executive compensation figures (Eastern Bank, L.L. Bean, or alternatives) — drop the comparable paragraph if clean data is not findable in a reasonable amount of time.
  - The actual current PEC contribution-share percentage (83% per existing site content).
- **CSS scoping:** scope all new rules under `body.corp-page` so they don't leak. Reuse palette tokens (`--ink`, `--paper`, accent colors) from the existing stylesheet.
- **Pagefind exclusion:** add `data-pagefind-ignore` on the page body. Verify the search modal does not surface it.
- **Sitemap exclusion:** add the page to whatever exclusion mechanism `sitemap.xml` uses (Jekyll's default `sitemap` plugin excludes pages with `sitemap: false` in front matter; check the existing setup and conform).
- **Smoke test:** add the new URL to `tests/smoke-test.mjs` so the page is checked for 200 status and basic rendering on each build, even though it's unlinked.

## Out of scope

- A homepage card, nav entry, or footer link. (If the user changes their mind later, that's a separate change.)
- Translations of MGL into "what this actually means in practice" beyond what's in the Notes section — the page is not a civics primer, it's a parody that happens to be educational.
- Charts. Unless one is genuinely irresistible during implementation, the page is text-and-tables.
- Any visual that requires a new chart class or layout file in the site's chart system.
- Sequel pages ("Marblehead Corp Q1 2026 Earnings Call," etc.). One page, one bit, well-executed.

## Open questions for implementation phase

These are deferred to the writing-plans / executing-plans phase, not blockers for this design:

1. Whether the Industry Comparables paragraph in Exec Comp survives — depends on whether two clean publicly disclosed figures are findable.
2. Whether a single Business Segments visualization (e.g. a stacked bar) earns its keep, or whether the table alone is funnier.
3. Final dropcap implementation — pure CSS or inline span.
4. Whether the "Listed on: Annual Town Meeting" line on the cover gets a witty footnote or stays unannotated.
