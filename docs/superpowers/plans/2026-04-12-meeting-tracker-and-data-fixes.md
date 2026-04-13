# Meeting Tracker Page + Data Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stale numbers on existing pages (school FTEs, trash fee amount), add an MOU section to the override page, and create a lightweight meeting-tracker page that gives residents a breadcrumb trail through public meetings without committing to full meeting recaps.

**Architecture:** Three independent workstreams: (A) data corrections to existing pages, (B) new MOU section on the override page, (C) new meeting-tracker.html page with a simple table linking meeting dates/bodies to topic pages. No new CSS beyond minimal tracker table styles scoped under a body class. No JavaScript.

**Tech Stack:** Static HTML (Jekyll), site.css, existing design system from STYLE_GUIDE.md.

**Primary sources for all changes:**
- [School Committee 4/9/26 meeting](https://www.youtube.com/watch?v=VFf_HUGS1o0) (YouTube auto-captions) for school FTE and budget detail
  - Agenda: https://marbleheadma.gov/wp-content/uploads/2026/04/2026-04-09-Marblehead-School-Committee-Agenda.pdf
  - Transcript: `data/school_committee_2026-04-09_transcript.txt`
- [Select Board 4/8/26 meeting](https://vimeo.com/1181632658) (Vimeo auto-captions) for MOU terms, trash fee confirmation, tier mechanics
  - Agenda (amended): https://marbleheadma.gov/wp-content/uploads/2026/04/2026-04-08-Select-Board-Agenda-AMENDED.pdf
  - Transcript: `data/select_board_2026-04-08_transcript.txt`
- Town Administrator's April 8, 2026 override presentation PDF (`data/2026-04-08_Override_Presentation.pdf`)
- Marblehead Independent coverage (already cited on existing pages)
- Marblehead Current, "Health Department estimates $281 for trash fee" (2026-03-25) -- already sourced on question-2-trash.html

**Date note:** The Select Board met April 8 (Wednesday). The School Committee met April 9 (Thursday). Earlier versions of this plan and the transcript filename incorrectly listed both as April 8.

**Source caveat:** Auto-generated captions are NOT primary sources. Any new claim that relies solely on what a speaker said in a meeting video must be flagged with a note like "per [speaker] at the [date] [body] meeting" and should be upgraded to a primary document citation when minutes or budget docs become available.

---

## Workstream A: Data corrections on existing pages

### Task 1: Fix trash fee from $262 to $281 on what-is-the-override.html

The question-2-trash.html page already uses $281 throughout. But what-is-the-override.html still says "$262" in two places, and index.html says "$262" in one place. The $281 figure comes from the Board of Health (Marblehead Current, 2026-03-25) and was confirmed at the April 8 Select Board meeting.

**Files:**
- Modify: `what-is-the-override.html:422` (scrolly step text)
- Modify: `what-is-the-override.html:497` (paragraph below sample ballot)
- Modify: `index.html:160` (question-2-trash card description)

- [ ] **Step 1: Fix line 422 in what-is-the-override.html**

Change the scrolly step paragraph from:
```
If it fails, the Board of Health implements a flat fee of roughly $262 per household instead.
```
to:
```
If it fails, the Board of Health implements a flat fee of roughly $281 per household instead.
```

- [ ] **Step 2: Fix line 497 in what-is-the-override.html**

Change from:
```
while the Board of Health's fallback is a flat fee of roughly $262 per household.
```
to:
```
while the Board of Health's fallback is a flat fee of roughly $281 per household.
```

- [ ] **Step 3: Fix line 160 in index.html**

Change from:
```
A $2.3M override for curbside trash, or a ~$262/household fee if it fails.
```
to:
```
A $2.3M override for curbside trash, or a ~$281/household fee if it fails.
```

- [ ] **Step 4: Grep to verify no remaining $262 references**

Run: `grep -rn '262' *.html` and confirm only the question-2-trash.html historical context references remain (where $262 is correctly described as an earlier estimate).

- [ ] **Step 5: Commit**

```bash
git add what-is-the-override.html index.html
git commit -m "Fix trash fee from $262 to $281 on override page and index

The Board of Health's fee estimate was updated from $262 to $281
(Marblehead Current, 2026-03-25). question-2-trash.html already
used the correct figure; these two pages still had the earlier one."
```

### Task 2: Update school position count from 14.75 to 18.25 FTE

The School Committee's April 9 meeting revealed that school-side FTE cuts grew from 14.75 to 18.25 after unexpected collaborative tuition increases. This changes:
- no-override-budget.html: the school section text and the page lead/og_description
- index.html: the card description for the no-override page

**Files:**
- Modify: `no-override-budget.html:4` (og_description)
- Modify: `no-override-budget.html:9` (page-lead paragraph)
- Modify: `no-override-budget.html:100` (school section body text)
- Modify: `no-override-budget.html:101` (source citation)
- Modify: `index.html:155` (card description)

- [ ] **Step 1: Update og_description in no-override-budget.html**

Change line 4 from:
```
og_description: "The line-item changes in the town's FY27 No-Override Balanced Budget: 22 town positions, 14 school positions, the library reduced 43 percent, and what comparable Massachusetts towns did after similar votes."
```
to:
```
og_description: "The line-item changes in the town's FY27 No-Override Balanced Budget: 22 town positions, 18 school FTEs, the library reduced 43 percent, and what comparable Massachusetts towns did after similar votes."
```

- [ ] **Step 2: Update page-lead in no-override-budget.html**

Change line 9 from:
```
<p class="page-lead">If the override fails, the town has a backup plan. It balances the budget by cutting 36 positions across town and school departments, reducing the library by 43%, and drawing down reserves. Here is what that looks like, line by line.</p>
```
to:
```
<p class="page-lead">If the override fails, the town has a backup plan. It balances the budget by cutting 22 town positions and 18.25 school <abbr class="g" title="Full-Time Equivalent">FTE</abbr>s, reducing the library by 43%, and drawing down reserves. Here is what that looks like, line by line.</p>
```

- [ ] **Step 3: Update school section body text at line 100**

Change from:
```
Separately, the superintendent's FY27 school budget identifies 14.75 <abbr class="g" title="Full-Time Equivalent positions">FTEs</abbr> (full-time-equivalent positions) through a combination of layoffs, unfilled vacancies, and stipend reductions.
```
to:
```
The superintendent's FY27 school budget now identifies 18.25 <abbr class="g" title="Full-Time Equivalent positions">FTEs</abbr> (full-time-equivalent positions) eliminated through a combination of layoffs, unfilled vacancies, and stipend reductions. The original figure was 14.75; it grew to 18.25 after unexpected increases in collaborative special education tuitions required deeper cuts. Of the 18.25, roughly 9.3 are currently filled positions and 8.95 are vacant.
```

- [ ] **Step 4: Update the source citation at line 101**

Append to the existing source paragraph:
```
; School Committee April 9, 2026 meeting for the revised 18.25 FTE figure and filled/vacant breakdown
```

- [ ] **Step 5: Update index.html card at line 155**

Change from:
```
<p>22 town positions removed, 14 school positions, library reduced 43%, and what other MA towns did after similar votes.</p>
```
to:
```
<p>22 town positions removed, 18.25 school FTEs, library reduced 43%, and what other MA towns did after similar votes.</p>
```

- [ ] **Step 6: Commit**

```bash
git add no-override-budget.html index.html
git commit -m "Update school FTE cuts from 14.75 to 18.25

School Committee 4/9/26 meeting: unexpected collaborative tuition
increases pushed school-side FTE eliminations from 14.75 to 18.25
(9.3 filled, 8.95 vacant)."
```

## Workstream B: MOU section on override page

### Task 3: Add MOU section to what-is-the-override.html

The April 8 meetings produced a 6-page Memorandum of Understanding between the Select Board, School Committee, and Finance Committee. This is significant new information that belongs on the override page as a standalone section between the cost section and the FinCom arc section.

**Files:**
- Modify: `what-is-the-override.html` (insert new section after the phase-chart / "What It Costs" section, before the FinCom history section)

- [ ] **Step 1: Identify insertion point**

Read the file around the end of the "What It Costs" section. The new section goes after the last element of the cost section and before the next `<h2>` (which is the FinCom arc or voting history).

- [ ] **Step 2: Insert MOU section**

Add the following new section. Place it after the phase-chart closing `</div>` and the tax-impact explanatory text, before the next major `<h2>`:

```html
  <h2 data-stance-section="mou-commitments" id="mou-commitments">The three-board commitment</h2>

  <p>On April 8, 2026, the Select Board, School Committee, and Finance Committee began voting on a Memorandum of Understanding that sets guardrails on how override funds would be spent. The MOU is a public commitment of intent, not a binding contract. Deviating from it requires a two-thirds vote of all three boards.</p>

  <div class="card">
    <h3>Key MOU terms</h3>
    <ul>
      <li><strong>No new general override until at least FY30</strong> if any tier passes, regardless of which tier.</li>
      <li><strong>Annual draw caps</strong> broken out by school and municipal, attached as an appendix with projected budgets.</li>
      <li><strong>Revenue overages</strong> go first to the stabilization fund (target: 5% of operating budget), then to capital needs, then to OPEB and pension liabilities.</li>
      <li><strong>Revenue shortfalls</strong> are absorbed in operating budgets. The boards commit not to draw more than the MOU caps.</li>
      <li><strong>Declining free cash reliance:</strong> $5M in FY27, $4M in FY28, $3M in FY29.</li>
      <li><strong>Health insurance projected at 6% annual growth</strong> (five-year average), below the recent 11% spike.</li>
      <li><strong>Reporting:</strong> annual override spend recap at State of the Town; quarterly updates from the superintendent and town administrator to the chairs of all three boards.</li>
      <li><strong>Tax relief:</strong> commitment to publicize abatement and relief programs, including the pending means-tested senior exemption (H.4225).</li>
    </ul>
    <p class="source">Source: Draft MOU presented at the April 8, 2026 Select Board and School Committee meetings. School Committee voted 4-0 to approve subject to final numbers. Select Board deferred vote pending school approval. Full document not yet publicly posted as of April 12, 2026.</p>
  </div>
```

- [ ] **Step 3: Verify the section renders in context**

Read the surrounding HTML to make sure the new section sits cleanly between existing sections and follows the `data-stance-section` / `id` pattern used elsewhere on the page.

- [ ] **Step 4: Commit**

```bash
git add what-is-the-override.html
git commit -m "Add MOU commitments section to override page

Three-board memorandum of understanding from 4/8/26 meetings:
no new override until FY30, annual draw caps, stabilization fund
target, declining free cash, quarterly reporting. SC voted 4-0;
SB deferred pending school vote."
```

## Workstream C: Meeting tracker page

### Task 4: Create meeting-tracker.html

A simple page with a running list of meetings. Each entry has the date, body, recording link, a summary of what changed, and inline links to relevant topic pages. Not a recap. Uses `layout: page` and `doc-page` body class.

**Files:**
- Create: `meeting-tracker.html`

- [ ] **Step 1: Create the page with frontmatter and structure**

```html
---
title: "Meeting tracker"
og_title: "Meeting tracker"
og_description: "A running log of Marblehead public meetings related to the FY27 budget and override, with links to what changed on the site."
body_class: doc-page
---
<h1>Meeting tracker</h1>

<p class="page-lead">A running log of public meetings where override, budget, or related topics were discussed. Each entry links to the recording and to the site pages where that information lives. This is not a recap of each meeting; it is a guide to what changed and where to find it.</p>

<p>Meetings are sourced from public video (Marblehead Community Media YouTube and Vimeo channels) and official agendas. Where auto-generated captions were used, claims are cross-referenced against primary documents before appearing on topic pages.</p>

<h2>April 9, 2026: School Committee</h2>

<p><a href="https://www.youtube.com/watch?v=VFf_HUGS1o0">Recording</a> · <a href="https://marbleheadma.gov/wp-content/uploads/2026/04/2026-04-09-Marblehead-School-Committee-Agenda.pdf">Agenda</a></p>

<ul>
  <li>School override tiers voted 4-0: $6.2M (Tier 1), $7.2M (Tier 2), $8.5M (Tier 3). <a href="what-is-the-override.html">Override page</a></li>
  <li>School FTE cuts grew from 14.75 to 18.25 after unexpected collaborative tuition increases (9.3 filled, 8.95 vacant). <a href="no-override-budget.html">No-override budget</a></li>
  <li>$1.5M special ed prepaid tuition bridge confirmed as one-time; eliminates the district's second-largest safety net.</li>
  <li>MOU (Joint Memorandum of Understanding) voted 4-0, subject to final numbers. <a href="what-is-the-override.html#mou-commitments">MOU section</a></li>
  <li>FY27 line-item budget voted 5-0.</li>
</ul>

<h2>April 8, 2026: Select Board</h2>

<p><a href="https://vimeo.com/1181632658">Recording</a> · <a href="https://marbleheadma.gov/wp-content/uploads/2026/04/2026-04-08-Select-Board-Agenda-AMENDED.pdf">Agenda</a></p>

<ul>
  <li>Override tiers presented with three-year draw schedules: $9M / $12M / $15M. <a href="what-is-the-override.html">Override page</a></li>
  <li>Town-side position detail for each tier: what is restored, what stays cut. <a href="what-is-the-override.html">Tier line items</a></li>
  <li>Separate $2.3M trash ballot question (Question 2). <a href="question-2-trash.html">Trash page</a></li>
  <li>MOU framework introduced: no new override until FY30, annual draw caps, quarterly reporting. <a href="what-is-the-override.html#mou-commitments">MOU section</a></li>
  <li>Tax impact presented per $1M and average single-family home ($1.291M). <a href="charts/override_calculator.html">Calculator</a></li>
  <li>Warrant articles reviewed; Article 29 (override authorization) held pending school vote.</li>
</ul>

<h2>Open research items</h2>

<p>Claims surfaced at meetings that are not yet verified against primary sources. These are listed as open items, not site content.</p>

<ul>
  <li><strong>Marblehead ranks 20th of 351 MA communities in per-capita income.</strong> Nick Ward, Select Board 4/8. Checkable via DOR Municipal Databank or Census ACS.</li>
  <li><strong>Essex North Shore Aggie Tech costs: $468K (FY25) to $750K (FY27).</strong> CFO Benjamin, Select Board 4/8. Driven by lottery-based enrollment change. Checkable via FY25-FY27 budget docs.</li>
  <li><strong>Home values and tax bills tracked together until COVID, then diverged.</strong> Kezer presentation, Select Board 4/8. Checkable via DOR assessor and tax rate data.</li>
  <li><strong>Social hosting law enforcement.</strong> Tom McMahon, School Committee 4/9. DA Paul Tucker event April 14. Not override-related; noted for completeness.</li>
</ul>
```

- [ ] **Step 2: Commit**

```bash
git add meeting-tracker.html
git commit -m "Add meeting tracker page

Running table of public meetings with override/budget relevance.
Links to topic pages rather than recapping meetings. Includes
open research items for unverified claims from 4/8/26 meetings."
```

### Task 5: Add meeting tracker to index.html navigation

The meeting tracker should appear in the homepage question list, near the bottom of the override section.

**Files:**
- Modify: `index.html` (add a card in the override question-list section)

- [ ] **Step 1: Find the right insertion point**

The card should go after the "What can you do?" card and before the data/charts section. Read the area around line 200-220 of index.html to find the exact spot.

- [ ] **Step 2: Add the card**

```html
    <a class="question" href="meeting-tracker.html">
      <h2>Meeting tracker</h2>
      <p>A running log of Select Board, School Committee, and Finance Committee meetings with links to what changed on the site.</p>
    </a>
```

- [ ] **Step 3: Add to nav if applicable**

Check `_includes/nav.html` to see if this page should appear in the navigation. If the nav already has a logical grouping for override pages, add it there. If not, skip -- the homepage card is sufficient.

- [ ] **Step 4: Commit**

```bash
git add index.html _includes/nav.html
git commit -m "Add meeting tracker card to homepage"
```

## Workstream D: Research verification (non-code, manual)

These items surfaced from the April 8 meetings and should be verified before adding to topic pages. They do not require code changes now but should be tracked.

### Task 6: Verify Nick Ward's per-capita income claim

- [ ] **Step 1:** Go to the DOR Municipal Databank or Census ACS data. Search for Marblehead per-capita income ranking among 351 MA municipalities. Record the actual rank and source URL.

- [ ] **Step 2:** If confirmed, add to why-not-elsewhere.html as a data point (Marblehead's income relative to peers). If not confirmed or the rank is materially different, note the discrepancy.

### Task 7: Verify Essex North Shore Aggie Tech cost trajectory

- [ ] **Step 1:** Check FY25, FY26, FY27 budget documents for the Essex North Shore line item. Confirm $468K / $627K / $750K figures.

- [ ] **Step 2:** If confirmed, this is a strong candidate for a new "uncontrollable cost drivers" section on how-we-got-here.html or no-override-budget.html, alongside health insurance and pensions.

### Task 8: Verify home value vs tax bill divergence

- [ ] **Step 1:** DOR has average single-family home values and tax bills by year. Pull Marblehead data for FY10-FY27. Check whether the divergence Kezer described (tracking together pre-COVID, splitting post-COVID) holds in the data.

- [ ] **Step 2:** If confirmed, this could be a chart on charts/levy_vs_bill.html or a new chart. The existing levy_vs_bill chart may already cover some of this.

---

**Plan complete.** Tasks 1-5 are code changes ready to execute. Tasks 6-8 are research items that feed future content. The code tasks can all run in parallel since they touch different files (except Tasks 1 and 3 both touch what-is-the-override.html, so run those sequentially).
