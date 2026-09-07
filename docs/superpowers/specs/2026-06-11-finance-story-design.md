# Finance story — a scrollytelling primer on how town money actually works

**Date:** 2026-06-11
**Owner:** Andrew Baber
**Status:** Draft (awaiting user review)

## Purpose

A scrollytelling primer that teaches a resident, concretely and in plain language, how Marblehead's money actually works. Aimed at the reader who got their tax bill, scrolled the Facebook page, or is considering board service, and wants the structural picture in 10-15 minutes.

The current site has Marblehead 101 (text-prose primer, 25 minutes) and many deep pages. What's missing is a **visual middle layer**: shorter than 101, more visual than the prose chapters, structurally honest about the four-buckets-of-town-money distinctions that residents constantly conflate.

This piece is **the primer's visual edition**. It composes with Marblehead 101, not replaces it. Each scrollytelling chapter exits into the equivalent 101 chapter and the relevant deep pages.

## Editorial stance

Same as the rest of the site:

- Claim-first. No meta-narration ("This chapter explains…"). State the claim.
- Neutral. No green/red value judgments, no override advocacy, no "what residents control" framing that implies voting prescriptions.
- Every number traceable to a primary source via `assets/citations.js`.
- No em-dashes in chapter copy.
- Plain English. No civics jargon used without a one-sentence definition the first time.
- Numbers approximate during draft; final numbers tied to FY26/FY27 budget book and ACFR before publish.

## Audience and success criteria

**Audience:** Tier B/C reader.

- B: just received tax bill, wants to know what they're paying for and why.
- C: considering FinCom or a town board, wants the structural picture before committing.

**Success criteria:** after reading, the reader can correctly answer:

1. What are the four buckets of town money, and which one funds what?
2. Why doesn't a water-rate increase go through Town Meeting?
3. What's the difference between general-obligation debt service and excluded debt?
4. Why does the operating budget keep growing when headcount is flat?
5. What fraction of the budget is a genuine annual choice?

If the reader can answer those without hedging, the piece worked.

## The arc

Seven chapters, ~one viewport per scene within each chapter, ~2-4 scenes per chapter. Roughly 8-12 minutes total reading. Each chapter ends in an "Open the data" CTA pointing to checkbook, 101, or a deep page.

### Chapter 1 — The four buckets

**Headline claim:** Town money lives in four separate buckets that don't mix.

**What it teaches:**
- General Fund operating (~$110M FY26): levy + state aid + local receipts, the "main" budget. Inside the Prop 2½ cap.
- Enterprise funds ($13M: water $6.9M, sewer $4.8M, harbor $1.3M): user-fee funded utilities. Cap doesn't apply. Rates set by the relevant board, not Town Meeting.
- Capital budget (variable, ~$5-15M/yr): the plan for buildings, equipment, infrastructure. Funded by bonds, free cash, or capital reserves. Becomes future debt service.
- Special/restricted (grants, gifts, revolving funds): can't be redirected.

**Headline number:** $127M total but $110M is the levy-touched portion.

**Visual:** Four-quadrant diagram or stacked tree with each bucket's size and funding source. Animation: buckets fill from their sources (property tax, user fees, bonds, grants).

**Sources:** ACFR Statement of Activities; FY27 Proposed Budget; DOR Schedule A.

### Chapter 2 — Where the dollar goes

**Headline claim:** Of every dollar Marblehead spends out of the General Fund, about 80¢ pays a person.

**What it teaches:**
- 80¢ / 15¢ / 5¢ split between compensation, set bills, and discretionary.
- "Set bills" = debt service, OPEB, state assessments (Essex Tech, MBTA, charter).
- The annual choice space is bigger than the 5¢: it's the 5¢ supplies/contracts/programs slice *plus* staffing decisions (which positions to fund, freeze, or cut) *plus* capital scope and timing. Once you hire, the stack on that hire is locked. Whether to hire at all is the annual lever.

**Headline number:** $99,750 = the loaded cost of a $75K hire.

**Visual:** A dollar bill that splits into three weighted bars, then the People bar zooms in and the loaded-cost stack (salary + pension + GIC + Medicare + workers' comp) builds on top.

**Sources:** FY27 Proposed Budget; GIC rate sheet; ERRS valuation; town benefits ledger.

### Chapter 3 — The 1,020 people

**Headline claim:** The budget is mostly a payroll, and the payroll has barely grown in twenty years.

**What it teaches:**
- ~1,020 FTE in FY26 (626 school + 394 town). 19-year history hovers in a 200-person band.
- Composition shifted: special-ed support up, IT created from zero, clerical down.
- Cost-per-FTE grew faster than CPI, driven mostly by GIC premium growth.

**Headline number:** Budget grew 2.7×; FTE grew 2%; cost per FTE grew about 90%.

**Visual:** A grid of 1,020 dots, color-coded by category. Stream graph of composition over time underneath. Trajectory of $/FTE alongside CPI.

**Sources:** `data/town_employee_headcount_FY08-26.csv`, `data/dese_role_staffing_history.csv`, `data/employee_benefits_FY05-24.csv`, BLS CPI.

### Chapter 4 — Two pillars, one tax base

**Headline claim:** Marblehead has two parallel governments that share a tax base and not much else.

**What it teaches:**
- Town side: Select Board → Town Administrator → departments.
- School side: School Committee → Superintendent → schools.
- Voters elect both. Neither pillar supervises the other.
- FinCom (appointed by Moderator) is the only body that looks at both before Town Meeting.

**Headline number:** ~60 unpaid residents serve on elected and appointed boards.

**Visual:** Two-pillar diagram with the unpaid decision layer ringed around the top. Dot-clusters per department within each pillar.

**Sources:** MGL c.71 §34, c.150E §1, c.71 §59B; town board roster from `meetings.html` data.

### Chapter 5 — How debt actually works

**Headline claim:** Debt has two flavors. One is inside the Prop 2½ cap and one is not.

**What it teaches:**
- General-obligation debt service: inside the levy cap, paid out of the General Fund operating budget as an annual line item.
- Excluded debt service: outside the levy cap, separately approved by debt-exclusion override votes (school feasibility 2026-06-09, fire HQ 2026-06-09).
- Capital budget cycle: voted at Town Meeting, bonded by Treasurer, becomes operating-budget debt service for the bond's life.
- The annual debt-service line on the tax bill has two parts; many residents don't realize.

**Headline number:** Current excluded-debt service vs. inside-cap debt service.

**Visual:** Levy chart with the excluded-debt band layered on top. Bond-life timeline showing a debt exclusion vote → bond issuance → 20 years of payments.

**Sources:** ACFR Schedule of Long-Term Debt; `data/dor_debt_exclusion_all.csv`; Town Election results 2026-06-09.

### Chapter 6 — Enterprise funds

**Headline claim:** Water, sewer, and harbor pay for themselves. Their costs don't touch your tax bill.

**What it teaches:**
- Each enterprise fund is self-funded: user fees cover the operating costs and the fund's own debt service.
- Rates set by the relevant board (Water/Sewer Commission, Harbormaster's authority), not Town Meeting.
- Reserve mechanics: reserves are restricted to that fund; can't be used for general-fund needs.
- Why this matters: a water-rate increase isn't a "tax increase" and a property-tax override doesn't affect water rates.

**Headline number:** ~$13M annual enterprise budget (Water $6.9M + Sewer $4.8M + Harbor $1.3M).

**Visual:** A side-by-side showing the General Fund and Enterprise Funds as two separate flow diagrams that never connect.

**Sources:** FY27 Proposed Budget enterprise pages; ACFR Enterprise Funds Statement.

### Chapter 7 — Twenty years

**Headline claim:** The total grew 2.7×. Headcount stayed flat. The difference was cost per employee.

**What it teaches:**
- Long-run trajectory of operating budget.
- Drivers: GIC premium, ERRS pension assessment, salary cycles, SpEd costs.
- Where reserves and free cash absorbed the difference; what happened when they ran out.

**Headline number:** $47M (FY05) → $127M (FY26).

**Visual:** Animated trajectory chart drawing itself. Annotations at key inflection points (2008 financial crisis, COVID dip, FY27 override).

**Sources:** Schedule A series 2005-2026, FY26 Excel, FY27 Proposed Budget.

## Treatment direction

Take **v5 (brand-report)** as the base layout pattern: section-at-a-time, big serif italics, cream/navy/teal alternating panels, sticky bottom progress bar with CTA, scroll-driven SVG line drawings, photo+quote-card composition for transition moments.

Borrow from **v3 (narrative-motion)** for the *data-viz moments inside chapters*: the dot-grid, the stack-building, the stream-graph. These embed as components inside v5's section pattern, played when scrolled into view.

Reject **v4 (cartoon-explainer)** for this project. Doesn't fit the editorial tone (illustrative cartoons clash with "primary sources" credibility), and the per-scene auto-play model fights with the section-at-a-time reading rhythm.

Polish targets:
- Real type system (Source Serif 4 for headlines, Source Sans 3 for body, locked via Jekyll layout).
- Real photography. Abbot Hall, Town Meeting at the field house, school exterior, harbor, DPW yard. Probably 8-12 photos total. Source: commission from a local photographer, or pull from Wikimedia + town's public Flickr where attribution is clean.
- Accessibility pass: high contrast, focus rings, reduced-motion fallback that disables transitions and reveals.
- Mobile pass: every viewport tested at 375px, 414px, 768px.
- Citations: every number wired through `assets/citations.js`.
- Dark mode: handled via existing `prefers-color-scheme` in `site.css`.

## Production approach

Build one chapter end-to-end to production polish, then template the rest. Suggested first chapter: **Chapter 1 (the four buckets)** because (a) it's the highest-leverage teaching content and (b) it forces the design system decisions that all the others will reuse.

After Chapter 1 ships, the remaining six chapters take ~3-5 days each rather than the full polish budget, because the layout primitives, type system, animation patterns, and citation infrastructure are already locked.

Rough timeline:
- Week 1: design system + Chapter 1 to production polish (with real photos commissioned in parallel).
- Weeks 2-4: Chapters 2-4.
- Weeks 5-6: Chapters 5-7.
- Week 7: cross-page polish, dark mode QA, accessibility audit, copy-editing pass.

Each chapter is its own PR. They all merge to `main` independently and the piece grows over ~7 weeks rather than landing as one big drop.

## Files and URLs

```
finance-story/index.html              → /finance-story/                          (landing + table of contents)
finance-story/01-four-buckets.html    → /finance-story/01-four-buckets
finance-story/02-where-the-dollar-goes.html → /finance-story/02-where-the-dollar-goes
finance-story/03-the-people.html      → /finance-story/03-the-people
finance-story/04-two-pillars.html     → /finance-story/04-two-pillars
finance-story/05-how-debt-works.html  → /finance-story/05-how-debt-works
finance-story/06-enterprise.html      → /finance-story/06-enterprise
finance-story/07-twenty-years.html    → /finance-story/07-twenty-years
```

Cloudflare auto-strips `.html`.

Landing page at `/finance-story/` shows all seven chapters with read times, the headline claim each makes, and a "Start with Chapter 1" CTA. Entry points: homepage tile (replacing or augmenting one of the existing six), top-nav link, and exits from each Marblehead 101 chapter.

## Relationship to Marblehead 101

- 101 stays as the text-prose primer (25 min, deep-reading).
- Finance story is the visual edition (10-15 min, scroll-reading).
- Every finance-story chapter links to the equivalent 101 chapter for the prose treatment.
- 101 doesn't have to be retrofitted to link back in this PR; that's a separate later pass.

## Open questions for user review

1. **Number of chapters.** Seven is what feels right to me from the topic structure. If you want to merge or split any (e.g. fold Chapter 6 enterprise into Chapter 1 four-buckets), the arc adjusts.

2. **Treatment direction.** I'm recommending v5 brand-report base + v3 data-viz components embedded. If you'd rather a different mix (e.g., v5 base but no embedded data-viz, just static charts), say.

3. **Photography.** This pattern *requires* real photos. Are we commissioning, pulling from public sources, or holding the piece until that's resolved? The mockup gradients don't survive production.

4. **Headline language.** I've drafted neutral claim-first headlines. Read through and flag any that drift toward advocacy or feel too dry for the brand-report aesthetic.

5. **First chapter to build.** I'm recommending Chapter 1 (four buckets). Alternative: Chapter 5 (how debt works), since that's the most-misunderstood and would be the strongest standalone teaching artifact if we want to validate the format before committing to all seven.

6. **Scope of citations.** Every number sourced is the site-wide rule; I want to confirm the same standard applies here, including for the headline stats that appear in the hero of each chapter.
