# Marblehead 101 — an 8-chapter primer

**Date:** 2026-06-08
**Owner:** Andrew Baber
**Status:** Draft (awaiting user review)

## Purpose

Add a course-shaped explainer to the site that a confused resident can read in ~25 minutes and come out knowing how the town works, where it spends money, and how to participate. Today the site has deep pages (`town-budget.html`, `town-school-admin.html`, `what-is-the-override.html`, etc.) for residents who already know what they're looking for; a first-time visitor has no single "start here" path. Marblehead 101 is that path.

The course is the **spine**. Existing deep pages are the **dig-ins**. The course does not duplicate those pages; it gives them a guided introduction and an exit ramp into each.

## Editorial stance

Same as the rest of the site:

- Claim-first, no meta-narration ("This chapter explains…"). State the claim.
- Neutral. No green/red value judgments, no override advocacy. A reader inclined either way on the FY27 override should read every chapter and find no tilt.
- Every number traceable to a primary source via the existing `assets/citations.js` `<sup class="cite">` pattern.
- No em-dashes anywhere in chapter copy.
- Plain English. No civics jargon used without a one-sentence definition the first time it appears.

## Architecture

### Files and URLs

A single folder holds both the landing page (`index.html`) and the eight chapter pages. No sibling `marblehead-101.html` at root, to avoid URL collision with the folder.

```
marblehead-101/index.html              → /marblehead-101/                       (landing)
marblehead-101/01-what-a-ma-town-is.html → /marblehead-101/01-what-a-ma-town-is
marblehead-101/02-branches.html        → /marblehead-101/02-branches
marblehead-101/03-where-money-comes-from.html → /marblehead-101/03-where-money-comes-from
marblehead-101/04-where-money-goes.html → /marblehead-101/04-where-money-goes
marblehead-101/05-budget-cycle.html    → /marblehead-101/05-budget-cycle
marblehead-101/06-structural-deficit.html → /marblehead-101/06-structural-deficit
marblehead-101/07-overrides.html       → /marblehead-101/07-overrides
marblehead-101/08-participate.html     → /marblehead-101/08-participate
```

Cloudflare auto-strips `.html` on serve; canonical URLs use the bare form.

### Entry points

1. **Top nav.** Insert a new first item "Primer" (or "101", TBD with user) in `_includes/nav.html` linking to `/marblehead-101/`. Position first so it reads as the front door.
2. **Homepage.** A new `.featured-card` (the component introduced for `the-debate.html`, reusable here) near the top of `index.html`, above the existing scroll-stop sequence. One sentence: "New here? Marblehead 101 walks you through it in 8 short chapters."
3. **Inbound deep links from chapter dig-ins** (already wired in chapter pages).

### Cross-page linking

- Every chapter's "Go deeper" cards link out to existing deep pages.
- Existing deep pages get an optional reverse link added in a later pass (out of scope for first commit).

## Visual identity

Locked via mockup `identity-mockups/b2-course.html` (revised B). Same colors, typography, and component idioms as the rest of the site (no new fonts, no new accent palette). Course-specific additions:

- **Sticky top bar** on chapter pages: brand + current position ("Chapter 3 of 8 · 37%") + progress fill underneath. On mobile, gains a **Chapters** button that opens a bottom drawer.
- **Desktop syllabus rail.** Left sidebar (240px) on chapter pages, sticky, showing all 8 chapters with checkmarks for completed, current chapter highlighted.
- **Mobile syllabus drawer.** Bottom-sheet pattern triggered by the **Chapters** button. Scrim closes on tap-outside.
- **Numbered chip** at the start of each chapter body identifying its part (Revenue, Government, etc.).
- **Big buoy-red chapter numbers** as the visual identifier for "this is a chapter of something."

The locked mockups are visible at preview `/identity-mockups/landing` and `/identity-mockups/b2-course`. These mockups are throwaway and will be removed from the repo when this work merges (or earlier if cluttering preview).

## Landing page anatomy (`marblehead-101.html`)

Locked via mockup `identity-mockups/landing.html`.

```
[topbar]
  Marblehead Data · All site sections →

[hero]
  eyebrow: "A primer"
  h1:       "Marblehead 101"
  lede:     "How the town works, where the money goes, and how a resident takes part,
             in 8 short chapters."
  meta:     "8 chapters · ~25 min total"
  ctas:     [Start with Chapter 1 →]  [Why this exists]

[syllabus, 3 grouped parts]
  Part I — How the town is structured   (chapters 01-02)
  Part II — Where the money flows       (chapters 03-06)
  Part III — How you take part          (chapters 07-08)
```

Chapter cards on the landing show: number, title, one-line description, read time. 2-column grid on desktop, stacks on mobile.

The "Why this exists" CTA scrolls to a footer section on the landing (not a separate page) with a short paragraph naming the editorial stance: neutral, primary sources, no advocacy. ~80 words.

## Chapter page anatomy

```
[sticky top bar]
  Marblehead Data · Marblehead 101   |   Chapter 3 of 8 · 37%   [Chapters drawer btn (mobile)]
  [progress fill bar underneath, width = position / 8]

[layout: sidebar (desktop) + main]

[sidebar — desktop only ≥980px]
  CHAPTERS
  ✓ 01  What a MA town is
  ✓ 02  Branches and who decides
  03  Where the money comes from   ← current (navy bg)
    04  Where the money goes
    05  The annual budget cycle
    06  Why structural deficits happen
    07  Overrides and debt exclusions
    08  How a resident participates

[main]
  [chip row]
    (3) Revenue · 4 min read

  h1: Where the money comes from
  dek: One-sentence answer the chapter argues for.

  [what you'll know after this — teal-bordered card]
    - 3 bullet points
    - each is a takeaway, not a topic

  [body: 600-900 words, 1-2 H2s]
    Anchor stat block (3 numbers) where a chapter has a clean 3-way split.
    Inline `<sup class="cite">` markers for sources.
    Inline links to relevant site pages where natural.

  [go deeper — card, 3 cards]
    TAG  · Title
    Description
    (cards: Tool, Chart, Data, or Page — color-tagged)

  [pager nav]
    ← Chapter 02: Branches…           Chapter 04 → Where the money goes (primary)

[mobile syllabus drawer]
  Triggered by Chapters button in sticky bar. Slide up from bottom. Backdrop scrim.
```

### Length target

Each chapter: **600-900 words** in the body. Hard target 850. Anything over 1000 means the chapter has scope creep and should push some to a dig-in.

### Where charts/embeds go

A chapter may include **at most one** stat block (3 numbers) OR one small inline mini-chart. Not both. Heavy charts live on the dig-in target pages, not in the chapter. The chapter's job is to be readable; the dig-in pages are where readers go for the full visualization.

### Sources

Every numeric claim or quoted official statement uses the existing `<sup class="cite" data-href="..." data-source="...">` pattern. `assets/citations.js` will auto-inject the Sources h2 at the bottom. No new citation infrastructure.

## The 8 chapters

For each: title, anchor question, key takeaways (the bullets the "What you'll know after this" box renders), and 2-3 dig-in targets pointing to existing site pages.

### Part I — How the town is structured

**01. What a Massachusetts town is** — *3 min*
- Anchor question: "Why doesn't Marblehead have a mayor?"
- Takeaways:
  - The "town" form of MA government is town meeting + select board, not mayor + city council
  - Town Meeting is the legislature; every registered voter can attend and vote on the floor
  - The Select Board is the executive (5 elected members, one of whom is chair)
  - The Town Administrator is hired by the Select Board, not elected
- Dig-ins: `meetings.html`, `info-guides.html`, `about.html`. (Note: `branches.html` is a verification-network page, not government-branches; do not use.)

**02. The branches and who decides what** — *4 min*
- Anchor question: "Why are there parallel town and school operations?"
- Takeaways:
  - School Committee is a constitutionally separate elected body (MGL c.71)
  - Town side: Select Board sets non-school policy, hires Town Admin, approves dept budgets before Town Meeting
  - School side: School Committee hires Superintendent, approves school budget separately
  - FinCom is a 9-member appointed body that reviews everything before Town Meeting votes
- Dig-ins: `town-school-admin.html`, `topics/admin-housekeeping.html`, `marblehead-voting-record.html`

### Part II — Where the money flows

**03. Where the money comes from** — *4 min*
- Anchor question: "Why is 79% of the budget property tax?"
- Takeaways:
  - MA cities/towns get property tax + state aid + local fees, almost nothing else
  - Income and sales taxes belong to the state, not the town
  - Prop 2½ caps annual growth of the property-tax pot at 2.5% plus new construction
  - State aid is a small share for wealthy towns (Marblehead included)
- Dig-ins: `cap-vs-cost.html`, `your-true-cost.html`, `charts/per_capita_levy.html`

**04. Where the money goes** — *4 min*
- Anchor question: "What does the town actually spend $123M a year on?"
- Takeaways:
  - Schools are the largest single bucket (roughly half of total spending)
  - Public safety, public works, and general government make up most of the town side
  - Fixed costs (health insurance, pensions, OPEB, debt) are a growing share
  - "Capital" is separate from operating — capital is one-time projects, often debt-funded
- Dig-ins: `town-budget.html`, `where-has-the-money-gone.html`, `charts/budget_flow.html`

**05. The annual budget cycle** — *3 min*
- Anchor question: "When does the budget get decided, and when can the public weigh in?"
- Takeaways:
  - Department requests start in August/September; FinCom hearings run through winter; Town Meeting votes in May
  - The FinCom report (April) is the most consequential public document of the cycle
  - Town Meeting can cut but cannot reallocate within the school bottom line
  - The public can speak at any FinCom hearing and at Town Meeting itself
- Dig-ins: `meetings.html`, `info-guides.html`, `topics/public-comment.html`

**06. Why structural deficits happen** — *3 min*
- Anchor question: "Why is the town short money every few years even when the economy is fine?"
- Takeaways:
  - Capped revenue grows 2.5%/year; uncapped costs (insurance, special ed, pensions) grow 5-9%/year
  - The gap compounds. Reserves close it for a while, then run out
  - "Structural" means the gap is built into the math, not caused by mismanagement
  - This is why overrides become a recurring question
- Dig-ins: `how-we-got-here.html`, `charts/sustainability.html`, `charts/deficit_model.html`

### Part III — How you take part

**07. Overrides and debt exclusions** — *4 min*
- Anchor question: "What's actually on the ballot when I see an override question?"
- Takeaways:
  - An **override** permanently raises the property-tax pot (the levy ceiling stays the same)
  - A **debt exclusion** temporarily raises the levy for a specific bond — it expires when the bond is paid off
  - Both require a separate ballot vote; Town Meeting cannot pass either
  - Marblehead has passed overrides before; the history is on the site
- Dig-ins: `what-is-the-override.html`, `charts/override_history.html`, `charts/override_landscape.html`

**08. How a resident participates** — *3 min*
- Anchor question: "Beyond voting, what can I actually do?"
- Takeaways:
  - Show up to Town Meeting (May), bring an ID, you can speak and vote on every article
  - Watch or attend FinCom and Select Board meetings (MHTV streams)
  - Run for office (no party affiliation; nomination papers in early spring)
  - Read the primary documents (linked here) instead of secondhand summaries
- Dig-ins: `what-you-can-do.html`, `info-guides.html`, `meetings.html`

## Mobile patterns

- Sidebar collapses below 980px. Sticky top bar gains the **Chapters** button.
- Chapters drawer is a bottom sheet (slide up, 80vh max, scroll inside). Tap outside closes.
- "What you'll know after this" box collapses padding; remains visible (not collapsed by default).
- Stat blocks become 3-column grid on mobile (numbers stay small enough at 22px to fit).
- Dig-in cards stack to one column.
- Pager nav stacks (prev on top, next on bottom).

## Completed-state persistence

- LocalStorage key: `marblehead-101-progress`, JSON: `{ "01": "viewed", "02": "viewed", "03": "current" }`
- A chapter is marked **viewed** when its page is loaded and the user scrolls past 50% of body height (or stays 30s).
- The sidebar checkmarks and landing-page card states reflect this. If localStorage is empty (new visitor or private browsing), no checks shown; nothing breaks.
- This is **progressive**. The course works without JS or without storage; checkmarks are decoration on top.

## Reusable components introduced

These are new CSS classes added inline to the chapter template and (where shared) to `assets/site.css`:

- `.m101-stickybar` — fixed top progress bar with title, position, drawer button.
- `.m101-progressfill` — the buoy-red fill underneath.
- `.m101-syllabus` — desktop sidebar.
- `.m101-drawer` + `.m101-drawer-scrim` — mobile bottom-sheet syllabus.
- `.m101-chip` — numbered "Chapter N · Part" chip.
- `.m101-objectives` — teal-bordered "What you'll know after this" box.
- `.m101-stats` — 3-up stat block (`.s`, `.v`, `.l`).
- `.m101-digin` — wrapping container with `.m101-digin-card` items, tagged Tool/Chart/Data/Page.
- `.m101-pager` — prev/next at chapter foot.

Most styles live inline in the chapter pages for now, following the existing site pattern (e.g., `town-budget.html`). When two pages need the same component, hoist to `site.css` with `m101-` prefix.

## Drafting approach

**Phase 1 (first commit):**
- Landing page (`marblehead-101.html`) with all 8 chapter cards linking to placeholder chapter pages
- All 8 chapter pages with full skeleton (top bar, sidebar, chip, h1, dek, objectives box, stats placeholder, body lorem, dig-in cards, pager)
- New nav link (test on 375px width)
- New featured card on homepage
- Mobile drawer JS (~30 LOC)
- LocalStorage progress tracking (~40 LOC)

**Phase 2 (writes the chapters):**
- One chapter per commit, written from primary sources, with citations and dig-ins
- Order: 01, 02, 03 first (these set up the rest). Then 06 (the structural gap), then 04, 05, 07, 08
- After each commit, user reviews on preview before merging

**Phase 3 (polish):**
- Optional: inbound links from existing deep pages back to relevant chapters
- Optional: hero "anchor" stat or chart per chapter where one is genuinely useful

## Out of scope

- Videos, audio, animations
- Quiz/test-yourself widgets
- Per-chapter share images (default OG image is fine)
- New chart types — chapters reuse existing chart pages via dig-ins
- Multi-language
- A "next election" countdown — too volatile
- Tying chapter completion to community-pulse reactions
- Comments/discussion on chapters
- A printed PDF version

## Open questions for review

1. **Nav label.** "Primer" or "101" or "Marblehead 101" or something else? "Primer" is shortest; "101" is most memorable. Default proposal: **"Primer"**.
2. **The order of chapters 5 vs 6.** I have 5 (budget cycle) before 6 (structural deficit). Argument for swap: structural deficit explains *why* the cycle matters. Default: keep current order — cycle first describes the mechanism, deficit then explains the pressure on it.
3. **Featured-card or scroll-stop on the homepage?** The Debate page uses a featured card; the Calculator gets a scroll-stop. Marblehead 101 is more "front door" than either. Default: **featured card above the scroll-stops**, like the debate page treatment.
4. **localStorage tracking — opt-in?** No banner, no toggle. It's just decoration that some browsers will show and others won't. Acceptable?
