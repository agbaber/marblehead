# Marblehead 101 — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Marblehead 101 course skeleton: a landing page at `/marblehead-101/`, eight chapter pages with full layout chrome (sticky top bar, desktop sidebar, mobile drawer, prev/next pager, "Go deeper" cards, localStorage progress), a nav link, and a homepage featured card. Chapter bodies are placeholder lorem; real content is written in Phase 2 (separate plan).

**Architecture:** Jekyll-rendered static site. New `_data/marblehead_101.yml` is the single source of truth for the chapter list (used by the landing, the layout's sidebar/drawer, and prev/next pager). New `_layouts/m101.html` handles all chapter-page chrome. New `assets/m101.css` holds all course-specific styles. New `assets/m101.js` handles the mobile drawer toggle and localStorage progress. No build step beyond Jekyll. No new dependencies.

**Tech Stack:** Jekyll 3.10 (locked via Gemfile), HTML, CSS custom properties (already defined site-wide in `assets/site.css`), vanilla JavaScript (no frameworks), Playwright for smoke tests.

---

## File Structure

**Files to create:**
- `_data/marblehead_101.yml` — chapter list (slug, number, title, part, read_time, dek, objectives, dig_ins). Single source of truth.
- `_layouts/m101.html` — chapter page layout. Renders site nav, sticky course bar with progress, desktop sidebar, mobile drawer, prev/next pager. Calls `{{ content }}` for the chapter body.
- `assets/m101.css` — all course-specific styles (sticky bar, sidebar, drawer, chip, objectives box, stats, dig-in cards, pager).
- `assets/m101.js` — drawer toggle, localStorage progress tracker, sidebar/landing checkmark renderer.
- `marblehead-101/index.html` — landing page (uses `layout: page`).
- `marblehead-101/01-what-a-ma-town-is.html` — Chapter 01 skeleton.
- `marblehead-101/02-branches.html` — Chapter 02 skeleton.
- `marblehead-101/03-where-money-comes-from.html` — Chapter 03 skeleton.
- `marblehead-101/04-where-money-goes.html` — Chapter 04 skeleton.
- `marblehead-101/05-budget-cycle.html` — Chapter 05 skeleton.
- `marblehead-101/06-structural-deficit.html` — Chapter 06 skeleton.
- `marblehead-101/07-overrides.html` — Chapter 07 skeleton.
- `marblehead-101/08-participate.html` — Chapter 08 skeleton.

**Files to modify:**
- `_includes/nav.html` — insert "Primer" as the first nav link.
- `index.html` — insert a featured card pointing to Marblehead 101 above the existing scroll-stop sequence.
- `tests/smoke-test.mjs` — add a Marblehead 101 section: landing renders, all 8 chapter pages return 200, current-chapter is highlighted in the sidebar.

**Files to remove (cleanup):**
- `identity-mockups/` (the entire folder — these were brainstorm mockups, not site content).

**Out of scope for Phase 1 (deferred to Phase 2):**
- Writing the actual chapter copy (Phase 2: one chapter per commit, primary-source-cited).
- Per-chapter stat blocks with real numbers (Phase 2 fills these as each chapter is written).
- Inbound back-links from existing deep pages.
- Anchor visual or chart embedded in any chapter (Phase 3).

---

## Pre-task: clean the mockup branch

The current branch carries identity-mockup HTML/PNG files that should not ship to production. Plan execution starts from a clean main + spec doc only. The mockups stay in `worktree-bridge-cse_019rvrKXXGmTrupWoiXb7Hwo` history for posterity but are removed from this implementation branch.

- [ ] **Step 0.1: Verify branch state**

Run:
```bash
git status
git log --oneline origin/main..HEAD | head -5
```
Expected: working tree clean; commits should include the spec doc and the mockup work. If implementation work has not yet started, proceed.

- [ ] **Step 0.2: Remove the mockup folder**

Run:
```bash
git rm -r identity-mockups/
git commit -m "Remove identity mockups (brainstorm artifacts, design now locked in spec)"
```
Expected: 17 files deleted (8 HTML, 8 PNG, 1 mjs).

---

## Task 1: Add chapter data file

The chapter list is referenced by the landing page, every chapter's layout chrome, the sidebar, the mobile drawer, and the prev/next pager. Storing it in `_data/marblehead_101.yml` means changes to titles or read times propagate everywhere.

**Files:**
- Create: `_data/marblehead_101.yml`

- [ ] **Step 1.1: Write the chapter data**

Create `_data/marblehead_101.yml`:

```yaml
# Marblehead 101 — chapter list
# Used by: marblehead-101/index.html, _layouts/m101.html
# Schema: chapters is an ordered array; each chapter has:
#   num: zero-padded string, used in URLs and as the big visual number
#   slug: matches the chapter filename (without .html)
#   title: shown in card, pager, sidebar, drawer, page <h1>
#   part: "Government" | "Money" | "Participation" (used by the chip)
#   read_time: integer minutes (rendered as "N min")
#   dek: one-sentence answer the chapter argues for (rendered under <h1>)
#   objectives: 3-4 bullets for the "What you'll know after this" box
#   dig_ins: 2-3 dig-in cards. Each has:
#     tag: "Tool" | "Chart" | "Data" | "Page"
#     href: existing site URL
#     title: card title
#     desc: one-sentence description

parts:
  - id: i
    roman: "Part I"
    title: "How the town is structured"
    desc: "Who actually runs what."
    chapters: ["01", "02"]
  - id: ii
    roman: "Part II"
    title: "Where the money flows"
    desc: "$123M in, $123M out, plus the gap in the middle."
    chapters: ["03", "04", "05", "06"]
  - id: iii
    roman: "Part III"
    title: "How you take part"
    desc: "From ballot to Town Meeting floor."
    chapters: ["07", "08"]

chapters:
  - num: "01"
    slug: "01-what-a-ma-town-is"
    title: "What a Massachusetts town is"
    part: "Government"
    read_time: 3
    dek: "Town Meeting, no mayor, and the form of government most Marbleheaders never learned."
    objectives:
      - "The 'town' form of MA government is Town Meeting plus Select Board, not mayor plus city council"
      - "Town Meeting is the legislature; every registered voter can attend and vote on the floor"
      - "The Select Board is the executive; the Town Administrator is hired, not elected"
    dig_ins:
      - tag: "Page"
        href: "meetings.html"
        title: "All public meetings"
        desc: "Live and archived video from Select Board, School Committee, FinCom."
      - tag: "Page"
        href: "info-guides.html"
        title: "Resident guides"
        desc: "Plain-English explainers on each town body."
      - tag: "Page"
        href: "about.html"
        title: "About this site"
        desc: "How marbleheaddata.org is built, sourced, and maintained."

  - num: "02"
    slug: "02-branches"
    title: "The branches and who decides what"
    part: "Government"
    read_time: 4
    dek: "Select Board, School Committee, Town Meeting, Town Admin, and how they actually interact."
    objectives:
      - "School Committee is a constitutionally separate elected body (MGL c.71)"
      - "Town side: Select Board sets non-school policy and approves department budgets"
      - "FinCom is a 9-member appointed body that reviews everything before Town Meeting votes"
    dig_ins:
      - tag: "Page"
        href: "town-school-admin.html"
        title: "Why two sets of departments?"
        desc: "The legal reason town and schools run parallel admin operations."
      - tag: "Data"
        href: "marblehead-voting-record.html"
        title: "How members voted"
        desc: "Voting record of current Select Board and School Committee."
      - tag: "Page"
        href: "topics/admin-housekeeping.html"
        title: "Town administration topics"
        desc: "Recent meeting transcripts touching admin and personnel."

  - num: "03"
    slug: "03-where-money-comes-from"
    title: "Where the money comes from"
    part: "Money"
    read_time: 4
    dek: "Most of what the town spends is paid by you, on the house you live in."
    objectives:
      - "Massachusetts towns get property tax, state aid, and local fees, almost nothing else"
      - "Proposition 2½ caps the property-tax pot at 2.5% annual growth plus new construction"
      - "State aid is small for wealthy towns; Marblehead included"
    dig_ins:
      - tag: "Chart"
        href: "cap-vs-cost.html"
        title: "Cap vs. cost over 20 years"
        desc: "Capped revenue against uncapped spending pressure."
      - tag: "Tool"
        href: "your-true-cost.html"
        title: "Your tax bill, line by line"
        desc: "Calculator for a specific home value, with override scenarios."
      - tag: "Chart"
        href: "charts/per_capita_levy.html"
        title: "Per-capita levy comparison"
        desc: "How Marblehead's tax burden compares across MA towns."

  - num: "04"
    slug: "04-where-money-goes"
    title: "Where the money goes"
    part: "Money"
    read_time: 4
    dek: "Schools, public safety, public works, benefits, debt, all sized to scale."
    objectives:
      - "Schools are the largest single bucket of town spending"
      - "Fixed costs (insurance, pensions, OPEB, debt) are a growing share of the rest"
      - "Capital is separate from operating; capital is one-time, often debt-funded"
    dig_ins:
      - tag: "Tool"
        href: "town-budget.html"
        title: "Town budget explorer"
        desc: "Every line item in the FY27 budget, filterable and sortable."
      - tag: "Chart"
        href: "where-has-the-money-gone.html"
        title: "Where the money has gone"
        desc: "Spending trends by category over the past decade."
      - tag: "Chart"
        href: "charts/budget_flow.html"
        title: "Budget flow diagram"
        desc: "Visual of revenue sources mapping to spending categories."

  - num: "05"
    slug: "05-budget-cycle"
    title: "The annual budget cycle"
    part: "Money"
    read_time: 3
    dek: "How August requests become a May vote, and where the public can speak."
    objectives:
      - "Department requests start in August; FinCom hearings run through winter; Town Meeting votes in May"
      - "The FinCom report (April) is the most consequential public document of the cycle"
      - "Town Meeting can cut but cannot reallocate within the school bottom line"
    dig_ins:
      - tag: "Page"
        href: "meetings.html"
        title: "Live and archived meetings"
        desc: "Watch FinCom and Select Board work the budget."
      - tag: "Page"
        href: "info-guides.html"
        title: "Resident guides"
        desc: "When and how to participate in the cycle."
      - tag: "Page"
        href: "topics/public-comment.html"
        title: "Public comment moments"
        desc: "Meeting transcripts where residents spoke."

  - num: "06"
    slug: "06-structural-deficit"
    title: "Why structural deficits happen"
    part: "Money"
    read_time: 3
    dek: "2.5% capped revenue meets 5-9% uncapped costs. The gap compounds."
    objectives:
      - "Capped revenue grows 2.5% per year; uncapped costs grow 5-9%"
      - "The gap compounds; reserves close it for a while, then run out"
      - "'Structural' means the gap is built into the math, not caused by mismanagement"
    dig_ins:
      - tag: "Page"
        href: "how-we-got-here.html"
        title: "How we got here"
        desc: "20 years of revenue-vs-cost trends in narrative form."
      - tag: "Chart"
        href: "charts/sustainability.html"
        title: "Sustainability chart"
        desc: "Visualization of structural pressure on the budget."
      - tag: "Chart"
        href: "charts/deficit_model.html"
        title: "Deficit model"
        desc: "Interactive multi-year projection of the gap."

  - num: "07"
    slug: "07-overrides"
    title: "Overrides and debt exclusions"
    part: "Participation"
    read_time: 4
    dek: "The tools, the difference, and what your ballot vote actually changes."
    objectives:
      - "An override permanently raises the property-tax pot"
      - "A debt exclusion temporarily raises the levy for one specific bond"
      - "Both require a separate ballot vote; Town Meeting cannot pass either"
    dig_ins:
      - tag: "Page"
        href: "what-is-the-override.html"
        title: "What an override actually is"
        desc: "The legal mechanism in plain English."
      - tag: "Chart"
        href: "charts/override_history.html"
        title: "Marblehead override history"
        desc: "Every override vote since Proposition 2½ took effect."
      - tag: "Chart"
        href: "charts/override_landscape.html"
        title: "Statewide override landscape"
        desc: "How Marblehead's override pattern compares to other MA towns."

  - num: "08"
    slug: "08-participate"
    title: "How a resident participates"
    part: "Participation"
    read_time: 3
    dek: "Town Meeting floor, public comment, FinCom hearings, where to find the docs."
    objectives:
      - "Show up to Town Meeting in May; bring an ID; you can speak and vote on every article"
      - "Watch or attend FinCom and Select Board meetings; MHTV streams everything"
      - "Run for office: no party affiliation, nomination papers in early spring"
    dig_ins:
      - tag: "Page"
        href: "what-you-can-do.html"
        title: "What you can do"
        desc: "Concrete actions a resident can take this month."
      - tag: "Page"
        href: "info-guides.html"
        title: "Resident guides"
        desc: "How to file an article, contact a body, read the FinCom report."
      - tag: "Page"
        href: "meetings.html"
        title: "All public meetings"
        desc: "Calendar and archive of every public meeting."
```

- [ ] **Step 1.2: Verify the YAML parses**

Run:
```bash
ruby -ryaml -e 'puts YAML.load_file("_data/marblehead_101.yml").keys.inspect'
```
Expected output: `["parts", "chapters"]`

- [ ] **Step 1.3: Commit**

```bash
git add _data/marblehead_101.yml
git commit -m "Marblehead 101: add chapter data file"
```

---

## Task 2: Add course stylesheet

All course-specific styles in one file. Imported by the layout and the landing page.

**Files:**
- Create: `assets/m101.css`

- [ ] **Step 2.1: Write the stylesheet**

Create `assets/m101.css`:

```css
/* ============================================================
   Marblehead 101 — course stylesheet
   Locked design: matches identity-mockups/b2-course.html and
   identity-mockups/landing.html (mockups removed at merge).
   Inherits CSS custom properties from assets/site.css.
   ============================================================ */

/* ---- Sticky course bar (chapter pages only) ---- */
.m101-stickybar {
  position: sticky; top: 0; z-index: 20;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.m101-stickybar .row {
  padding: 10px 16px;
  display: flex; align-items: center; gap: 12px;
  max-width: 1180px; margin: 0 auto;
}
.m101-stickybar .brand {
  font-size: 13px; font-weight: 700; color: var(--text);
  text-decoration: none; white-space: nowrap;
}
.m101-stickybar .brand .scope { color: var(--text-muted); font-weight: 600; }
.m101-stickybar .brand .sep { color: var(--text-subtle); margin: 0 6px; font-weight: 400; }
.m101-stickybar .where {
  flex: 1;
  font-size: 12px;
  color: var(--text-subtle);
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.m101-stickybar .toc-btn {
  background: var(--c-navy); color: #fff;
  border: 0;
  padding: 7px 12px 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  display: inline-flex; align-items: center; gap: 6px;
  cursor: pointer;
}
.m101-stickybar .toc-btn::before {
  content: ""; width: 14px; height: 10px;
  background:
    linear-gradient(currentColor, currentColor) 0 0 / 100% 2px no-repeat,
    linear-gradient(currentColor, currentColor) 0 50% / 100% 2px no-repeat,
    linear-gradient(currentColor, currentColor) 0 100% / 100% 2px no-repeat;
}
.m101-stickybar .track { height: 3px; background: var(--divider); }
.m101-stickybar .fill { height: 100%; background: var(--c-buoy); }

/* ---- Layout: sidebar + main ---- */
.m101-layout {
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px 16px 80px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
}
.m101-syllabus { display: none; }
@media (min-width: 980px) {
  .m101-stickybar .toc-btn { display: none; }
  .m101-layout {
    grid-template-columns: 240px 1fr;
    gap: 56px;
    padding: 32px 24px 80px;
  }
  .m101-syllabus {
    display: block;
    position: sticky; top: 80px;
    align-self: start;
    font-size: 14px;
  }
}
.m101-syllabus .label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-subtle);
  font-weight: 700;
  margin: 0 0 12px;
}
.m101-syllabus ol {
  list-style: none; padding: 0; margin: 0;
  counter-reset: m101lec;
}
.m101-syllabus li { counter-increment: m101lec; margin: 0; }
.m101-syllabus a {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 9px 10px;
  text-decoration: none;
  color: var(--text-muted);
  border-radius: 6px;
  line-height: 1.35;
}
.m101-syllabus a::before {
  content: counter(m101lec, decimal-leading-zero);
  font-variant-numeric: tabular-nums;
  color: var(--text-subtle);
  font-weight: 700;
  font-size: 12px;
  padding-top: 2px;
  min-width: 22px;
}
.m101-syllabus li.done a::before { content: "✓"; color: var(--c-sage); }
.m101-syllabus li.cur a {
  background: var(--c-navy);
  color: #fff;
  font-weight: 600;
}
.m101-syllabus li.cur a::before { color: rgba(255,255,255,0.7); }
.m101-syllabus a:hover:not([class*=cur]) { background: var(--divider); color: var(--text); }

/* ---- Chapter body ---- */
.m101-main { min-width: 0; }
.m101-chiprow {
  display: flex; align-items: center; gap: 12px; margin: 0 0 18px;
  flex-wrap: wrap;
}
.m101-chip {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--c-navy);
  color: #fff;
  padding: 6px 14px 6px 8px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}
.m101-chip .num {
  background: #fff;
  color: var(--c-navy);
  width: 20px; height: 20px;
  border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
  font-weight: 800;
}
.m101-chiprow .meta { font-size: 13px; color: var(--text-subtle); }
.m101-main h1 {
  font-size: 34px;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-weight: 800;
  margin: 0 0 14px;
}
@media (min-width: 700px) { .m101-main h1 { font-size: 42px; } }
.m101-dek {
  font-size: 19px;
  color: var(--text-muted);
  margin: 0 0 28px;
  line-height: 1.5;
  max-width: 640px;
}
@media (min-width: 700px) { .m101-dek { font-size: 20px; } }
.m101-objectives {
  background: var(--surface);
  border-left: 3px solid var(--c-teal);
  padding: 16px 20px;
  margin: 0 0 32px;
  border-radius: 0 8px 8px 0;
}
.m101-objectives .label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--c-teal); font-weight: 700; margin: 0 0 10px;
}
.m101-objectives ul { margin: 0; padding-left: 18px; color: var(--text-muted); font-size: 15px; }
.m101-objectives li { margin: 4px 0; }
.m101-main p { margin: 0 0 18px; max-width: 660px; }
.m101-main h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 36px 0 14px;
  letter-spacing: -0.01em;
}
.m101-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  margin: 24px 0 32px;
  max-width: 660px;
}
.m101-stats .s {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
}
.m101-stats .v { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--c-navy); line-height: 1; }
@media (min-width: 700px) { .m101-stats .v { font-size: 30px; } }
.m101-stats .l { font-size: 11px; color: var(--text-subtle); margin-top: 6px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
.m101-main a.inline { color: var(--c-teal); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }

/* ---- Go deeper ---- */
.m101-digin {
  margin: 40px 0 0;
  padding: 24px 22px;
  background: var(--surface);
  border-radius: 14px;
  border: 1px solid var(--border);
}
.m101-digin-label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--text-subtle); font-weight: 700; margin: 0 0 14px;
}
.m101-digin-grid {
  display: grid; grid-template-columns: 1fr; gap: 10px;
}
@media (min-width: 700px) {
  .m101-digin-grid { grid-template-columns: repeat(3, 1fr); gap: 12px; }
}
.m101-digin-card {
  background: var(--bg);
  border-radius: 10px;
  padding: 16px 18px;
  text-decoration: none;
  color: var(--text);
  border: 1px solid transparent;
}
.m101-digin-card:hover { border-color: var(--c-navy); }
.m101-digin-card .tag {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--c-teal); font-weight: 700; margin: 0 0 6px;
}
.m101-digin-card .ttl { font-size: 15px; font-weight: 700; line-height: 1.3; margin: 0 0 4px; }
.m101-digin-card .desc { font-size: 13px; color: var(--text-muted); line-height: 1.4; margin: 0; }

/* ---- Pager ---- */
.m101-pager {
  margin-top: 40px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 700px) {
  .m101-pager { grid-template-columns: 1fr 1fr; gap: 12px; }
}
.m101-pager a {
  text-decoration: none;
  padding: 14px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
}
.m101-pager a:hover { border-color: var(--c-navy); }
.m101-pager .dir { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-subtle); font-weight: 700; margin-bottom: 4px; }
.m101-pager .ttl { font-size: 15px; font-weight: 700; }
@media (min-width: 700px) { .m101-pager .next { text-align: right; } }
.m101-pager .next.primary { background: var(--c-navy); color: #fff; border-color: var(--c-navy); }
.m101-pager .next.primary .dir { color: rgba(255,255,255,0.7); }

/* ---- Mobile drawer ---- */
.m101-drawer-scrim {
  position: fixed; inset: 0;
  background: rgba(15,42,61,0.4);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.18s, visibility 0.18s;
  z-index: 50;
}
.m101-drawer {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: var(--surface);
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -10px 30px rgba(15,42,61,0.18);
  padding: 12px 0 24px;
  transform: translateY(100%);
  transition: transform 0.22s;
  z-index: 60;
  max-height: 80vh; overflow: auto;
}
.m101-drawer::before {
  content: ""; width: 38px; height: 4px;
  background: var(--border);
  border-radius: 2px;
  display: block;
  margin: 0 auto 14px;
}
.m101-drawer .dlabel {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--text-subtle); font-weight: 700;
  padding: 0 24px 12px;
  margin: 0;
}
.m101-drawer ol {
  list-style: none; padding: 0; margin: 0; counter-reset: m101drw;
}
.m101-drawer li { counter-increment: m101drw; margin: 0; }
.m101-drawer a {
  display: flex; gap: 14px; align-items: flex-start;
  padding: 14px 24px;
  text-decoration: none;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1.3;
  border-top: 1px solid var(--divider);
}
.m101-drawer a::before {
  content: counter(m101drw, decimal-leading-zero);
  font-variant-numeric: tabular-nums;
  color: var(--text-subtle);
  font-weight: 700;
  font-size: 13px;
  padding-top: 2px;
  min-width: 24px;
}
.m101-drawer li.done a::before { content: "✓"; color: var(--c-sage); }
.m101-drawer li.cur a {
  background: var(--bg);
  color: var(--text);
  font-weight: 700;
}
body.m101-drawer-open .m101-drawer-scrim { opacity: 1; visibility: visible; }
body.m101-drawer-open .m101-drawer { transform: translateY(0); }

/* ============================================================
   Landing page styles (marblehead-101/index.html)
   ============================================================ */
.m101-hero {
  padding: 64px 24px 48px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.m101-hero-inner { max-width: 760px; margin: 0 auto; }
.m101-hero .eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--c-buoy);
  font-weight: 700;
  margin: 0 0 14px;
}
.m101-hero h1 {
  font-size: 64px;
  line-height: 1.02;
  letter-spacing: -0.025em;
  font-weight: 900;
  margin: 0 0 18px;
  color: var(--text);
}
@media (max-width: 700px) { .m101-hero h1 { font-size: 44px; } .m101-hero { padding: 40px 20px 36px; } }
.m101-hero .lede {
  font-size: 22px;
  line-height: 1.4;
  color: var(--text-muted);
  margin: 0 0 28px;
  max-width: 640px;
}
@media (max-width: 700px) { .m101-hero .lede { font-size: 18px; } }
.m101-hero .meta {
  display: flex; gap: 22px; flex-wrap: wrap;
  font-size: 13px; color: var(--text-subtle);
  margin: 0 0 32px;
}
.m101-hero .meta span { display: inline-flex; align-items: center; gap: 8px; }
.m101-hero .meta .num { font-weight: 800; color: var(--text); font-size: 18px; line-height: 1; }
.m101-hero .actions { display: flex; gap: 12px; flex-wrap: wrap; }
.m101-btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 13px 22px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 700;
  font-size: 15px;
  border: 1px solid transparent;
}
.m101-btn.primary { background: var(--c-navy); color: #fff; border-color: var(--c-navy); }
.m101-btn.primary:hover { background: #102842; }
.m101-btn.secondary { background: var(--surface); color: var(--text); border-color: var(--border); }
.m101-btn.secondary:hover { border-color: var(--c-navy); }

.m101-syllabus-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 64px 24px 96px;
}
@media (max-width: 700px) { .m101-syllabus-page { padding: 40px 16px 64px; } }
.m101-group { margin: 0 0 56px; }
.m101-group:last-child { margin-bottom: 0; }
.m101-group-head {
  display: flex; align-items: baseline; gap: 16px;
  margin: 0 0 20px;
}
.m101-group-head .roman {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--c-buoy);
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
}
.m101-group-head h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--text);
}
.m101-group-head .desc {
  color: var(--text-subtle);
  font-size: 14px;
  margin: 0;
  flex: 1;
  text-align: right;
}
@media (max-width: 700px) {
  .m101-group-head { flex-wrap: wrap; gap: 6px 14px; }
  .m101-group-head h2 { font-size: 22px; }
  .m101-group-head .desc { text-align: left; flex-basis: 100%; font-size: 13px; margin-top: 4px; }
}
.m101-group-rule { height: 1px; background: var(--border); margin: 0 0 22px; }

.m101-chapters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 760px) { .m101-chapters { grid-template-columns: 1fr; } }
.m101-ch {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 22px 24px;
  text-decoration: none;
  color: var(--text);
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: 18px;
  align-items: start;
  transition: border-color 0.12s, transform 0.12s;
}
.m101-ch:hover { border-color: var(--c-navy); transform: translateY(-1px); }
.m101-ch.done .num::after { content: " ✓"; color: var(--c-sage); font-size: 18px; }
.m101-ch .num {
  font-size: 26px;
  font-weight: 900;
  color: var(--c-buoy);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  padding-top: 2px;
}
.m101-ch .body { min-width: 0; }
.m101-ch .ttl {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 6px;
  letter-spacing: -0.005em;
}
.m101-ch .desc {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.45;
}
.m101-ch .read {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-subtle);
  font-weight: 700;
  white-space: nowrap;
  padding-top: 5px;
}
@media (max-width: 700px) {
  .m101-ch { padding: 18px 20px; gap: 14px; grid-template-columns: 32px 1fr; grid-template-rows: auto auto; }
  .m101-ch .num { font-size: 22px; padding-top: 1px; }
  .m101-ch .read { grid-column: 1 / -1; padding-top: 4px; }
}
```

- [ ] **Step 2.2: Commit**

```bash
git add assets/m101.css
git commit -m "Marblehead 101: add course stylesheet"
```

---

## Task 3: Add course JavaScript

Drawer toggle + localStorage progress. Vanilla JS, no framework. ~80 lines. Defensive: degrades to a fully-functional course if JS is disabled (drawer just doesn't open, no checkmarks display).

**Files:**
- Create: `assets/m101.js`

- [ ] **Step 3.1: Write the script**

Create `assets/m101.js`:

```javascript
/*
 * Marblehead 101 — drawer + progress
 *
 * Drawer: toggles `body.m101-drawer-open` for the mobile chapter list.
 * Progress: tracks per-chapter "viewed" state in localStorage under the
 * key "marblehead-101-progress" as a JSON map { "01": true, "02": true, ... }.
 *
 * A chapter is marked viewed once the user scrolls past 50% of the .m101-main
 * height OR stays on the page for 30 seconds, whichever comes first.
 *
 * Checkmarks are rendered into the desktop sidebar (.m101-syllabus li),
 * the mobile drawer (.m101-drawer li), and the landing-page chapter cards
 * (.m101-ch). The HTML ships without `.done` class; this script adds it
 * on load by reading localStorage.
 *
 * If localStorage is unavailable (private browsing, disabled), the course
 * is fully functional without checkmarks — nothing breaks.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'marblehead-101-progress';

  // ---- Storage helpers (safe in private browsing) ----
  function readProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function writeProgress(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function markViewed(num) {
    var p = readProgress();
    if (p[num]) return;
    p[num] = true;
    writeProgress(p);
    paintCheckmarks();
  }

  // ---- Drawer ----
  function bindDrawer() {
    var btn = document.querySelector('.m101-stickybar .toc-btn');
    var scrim = document.querySelector('.m101-drawer-scrim');
    if (!btn || !scrim) return;
    btn.addEventListener('click', function () {
      document.body.classList.toggle('m101-drawer-open');
    });
    scrim.addEventListener('click', function () {
      document.body.classList.remove('m101-drawer-open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.body.classList.remove('m101-drawer-open');
    });
  }

  // ---- Checkmark painting (works on chapter pages AND landing) ----
  function paintCheckmarks() {
    var p = readProgress();
    // Sidebar + drawer use data-chapter on the <li>
    document.querySelectorAll('[data-chapter]').forEach(function (el) {
      var num = el.getAttribute('data-chapter');
      if (p[num] && !el.classList.contains('cur')) {
        el.classList.add('done');
      }
    });
  }

  // ---- Mark-viewed observer (chapter pages only) ----
  function bindViewTracking() {
    var main = document.querySelector('.m101-main');
    var chapterNum = document.body.getAttribute('data-current-chapter');
    if (!main || !chapterNum) return;

    var marked = false;
    function trigger() { if (marked) return; marked = true; markViewed(chapterNum); }

    // Scroll-past-50% trigger
    function onScroll() {
      if (marked) return;
      var rect = main.getBoundingClientRect();
      var totalScrollable = main.offsetHeight + rect.top;
      var scrolled = -rect.top;
      if (scrolled / main.offsetHeight >= 0.5) trigger();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // catch short pages where 50% is already visible

    // 30-second fallback
    setTimeout(trigger, 30000);
  }

  function init() {
    bindDrawer();
    paintCheckmarks();
    bindViewTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 3.2: Commit**

```bash
git add assets/m101.js
git commit -m "Marblehead 101: add drawer + progress JS"
```

---

## Task 4: Add chapter layout

The Jekyll layout that wraps every chapter page. Renders site nav (so users can escape to other site sections), then the sticky course bar, then the sidebar + drawer + content + pager.

**Files:**
- Create: `_layouts/m101.html`

- [ ] **Step 4.1: Write the layout**

Create `_layouts/m101.html`:

```html
---
layout: default
---
{% include nav.html %}

{%- assign current = page.chapter -%}
{%- assign chapters = site.data.marblehead_101.chapters -%}
{%- assign total = chapters | size -%}

{%- comment -%} Find the current chapter's index and metadata {%- endcomment -%}
{%- assign idx = 0 -%}
{%- for ch in chapters -%}
  {%- if ch.num == current -%}
    {%- assign current_ch = ch -%}
    {%- assign current_idx = forloop.index0 -%}
  {%- endif -%}
{%- endfor -%}

{%- assign position = current_idx | plus: 1 -%}
{%- assign progress_pct = position | times: 100 | divided_by: total -%}

{%- comment -%} Prev/next neighbors {%- endcomment -%}
{%- if current_idx > 0 -%}
  {%- assign prev_idx = current_idx | minus: 1 -%}
  {%- assign prev_ch = chapters[prev_idx] -%}
{%- endif -%}
{%- assign next_idx = current_idx | plus: 1 -%}
{%- if next_idx < total -%}
  {%- assign next_ch = chapters[next_idx] -%}
{%- endif -%}

<link rel="stylesheet" href="{{ '/' | relative_url }}assets/m101.css">

<div class="m101-stickybar">
  <div class="row">
    <a class="brand" href="{{ '/' | relative_url }}marblehead-101/"><span class="scope">Marblehead 101</span></a>
    <div class="where">Chapter {{ position }} of {{ total }} &middot; {{ progress_pct }}%</div>
    <button class="toc-btn" type="button" aria-label="Show chapters">Chapters</button>
  </div>
  <div class="track"><div class="fill" style="width: {{ progress_pct }}%;"></div></div>
</div>

<div class="m101-layout">
  <aside class="m101-syllabus" aria-label="Course chapters">
    <div class="label">Chapters</div>
    <ol>
      {%- for ch in chapters -%}
        {%- assign li_class = "" -%}
        {%- if ch.num == current -%}{%- assign li_class = "cur" -%}{%- endif -%}
        <li class="{{ li_class }}" data-chapter="{{ ch.num }}">
          <a href="{{ '/' | relative_url }}marblehead-101/{{ ch.slug }}.html">{{ ch.title }}</a>
        </li>
      {%- endfor -%}
    </ol>
  </aside>

  <main class="m101-main">
    <div class="m101-chiprow">
      <span class="m101-chip"><span class="num">{{ position }}</span> {{ current_ch.part }}</span>
      <span class="meta">{{ current_ch.read_time }} min read</span>
    </div>
    <h1>{{ current_ch.title }}</h1>
    <p class="m101-dek">{{ current_ch.dek }}</p>

    {%- if current_ch.objectives -%}
    <div class="m101-objectives">
      <div class="label">What you'll know after this</div>
      <ul>
        {%- for obj in current_ch.objectives -%}
        <li>{{ obj }}</li>
        {%- endfor -%}
      </ul>
    </div>
    {%- endif -%}

    {{ content }}

    {%- if current_ch.dig_ins -%}
    <section class="m101-digin">
      <div class="m101-digin-label">Go deeper on this chapter</div>
      <div class="m101-digin-grid">
        {%- for d in current_ch.dig_ins -%}
        <a class="m101-digin-card" href="{{ '/' | relative_url }}{{ d.href }}">
          <div class="tag">{{ d.tag }}</div>
          <div class="ttl">{{ d.title }}</div>
          <p class="desc">{{ d.desc }}</p>
        </a>
        {%- endfor -%}
      </div>
    </section>
    {%- endif -%}

    <nav class="m101-pager" aria-label="Chapter navigation">
      {%- if prev_ch -%}
      <a class="prev" href="{{ '/' | relative_url }}marblehead-101/{{ prev_ch.slug }}.html">
        <div class="dir">&larr; Previous</div>
        <div class="ttl">{{ prev_ch.title }}</div>
      </a>
      {%- else -%}
      <a class="prev" href="{{ '/' | relative_url }}marblehead-101/">
        <div class="dir">&larr; Back to</div>
        <div class="ttl">Syllabus</div>
      </a>
      {%- endif -%}
      {%- if next_ch -%}
      <a class="next primary" href="{{ '/' | relative_url }}marblehead-101/{{ next_ch.slug }}.html">
        <div class="dir">Next chapter &rarr;</div>
        <div class="ttl">{{ next_ch.title }}</div>
      </a>
      {%- else -%}
      <a class="next primary" href="{{ '/' | relative_url }}marblehead-101/">
        <div class="dir">Done &rarr;</div>
        <div class="ttl">Back to the syllabus</div>
      </a>
      {%- endif -%}
    </nav>
  </main>
</div>

<div class="m101-drawer-scrim" aria-hidden="true"></div>
<nav class="m101-drawer" aria-label="All chapters">
  <p class="dlabel">All {{ total }} chapters</p>
  <ol>
    {%- for ch in chapters -%}
      {%- assign li_class = "" -%}
      {%- if ch.num == current -%}{%- assign li_class = "cur" -%}{%- endif -%}
      <li class="{{ li_class }}" data-chapter="{{ ch.num }}">
        <a href="{{ '/' | relative_url }}marblehead-101/{{ ch.slug }}.html">{{ ch.title }}</a>
      </li>
    {%- endfor -%}
  </ol>
</nav>

<script src="{{ '/' | relative_url }}assets/m101.js" defer></script>
```

- [ ] **Step 4.2: Commit**

```bash
git add _layouts/m101.html
git commit -m "Marblehead 101: add chapter layout"
```

---

## Task 5: Build the landing page

The course front door. Uses the standard site `layout: page` (gets the regular site nav, back-to-home link, footer). Custom body content via inline HTML iterating the parts + chapter data.

**Files:**
- Create: `marblehead-101/index.html`

- [ ] **Step 5.1: Write the landing page**

Create `marblehead-101/index.html`:

```html
---
title: "Marblehead 101"
body_class: m101-landing
scripts: [m101]
og_title: "Marblehead 101"
og_description: "How the town works, where the money goes, and how a resident takes part. 8 short chapters, ~25 min total."
og_url: https://marbleheaddata.org/marblehead-101/
---

<link rel="stylesheet" href="{{ '/' | relative_url }}assets/m101.css">

<header class="m101-hero">
  <div class="m101-hero-inner">
    <p class="eyebrow">A primer</p>
    <h1>Marblehead 101</h1>
    <p class="lede">How the town works, where the money goes, and how a resident takes part, in 8 short chapters.</p>
    <div class="meta">
      <span><span class="num">8</span> chapters</span>
      <span><span class="num">~25</span> min total</span>
    </div>
    <div class="actions">
      {%- assign first = site.data.marblehead_101.chapters | first -%}
      <a class="m101-btn primary" href="{{ first.slug }}.html">Start with Chapter 1 &rarr;</a>
      <a class="m101-btn secondary" href="#why">Why this exists</a>
    </div>
  </div>
</header>

<section class="m101-syllabus-page">
  {%- for part in site.data.marblehead_101.parts -%}
  <div class="m101-group">
    <div class="m101-group-head">
      <span class="roman">{{ part.roman }}</span>
      <h2>{{ part.title }}</h2>
      <p class="desc">{{ part.desc }}</p>
    </div>
    <div class="m101-group-rule"></div>
    <div class="m101-chapters">
      {%- for slug in part.chapters -%}
        {%- for ch in site.data.marblehead_101.chapters -%}
          {%- if ch.num == slug -%}
          <a class="m101-ch" href="{{ ch.slug }}.html" data-chapter="{{ ch.num }}">
            <span class="num">{{ ch.num }}</span>
            <div class="body">
              <h3 class="ttl">{{ ch.title }}</h3>
              <p class="desc">{{ ch.dek }}</p>
            </div>
            <span class="read">{{ ch.read_time }} min</span>
          </a>
          {%- endif -%}
        {%- endfor -%}
      {%- endfor -%}
    </div>
  </div>
  {%- endfor -%}

  <section id="why" style="margin-top: 64px; padding: 24px; background: var(--surface); border-radius: 14px; border: 1px solid var(--border); max-width: 760px;">
    <h2 style="margin: 0 0 12px; font-size: 22px;">Why this exists</h2>
    <p style="margin: 0; color: var(--text-muted); line-height: 1.6;">marbleheaddata.org publishes deep pages on each piece of town government and the FY27 override debate. A first-time resident has no single starting path through them. Marblehead 101 is that path: a guided ~25-minute read with exit ramps to the detailed pages. The site does not take a position on the override; this primer does not either.</p>
  </section>
</section>

<script src="{{ '/' | relative_url }}assets/m101.js" defer></script>
```

- [ ] **Step 5.2: Commit**

```bash
git add marblehead-101/index.html
git commit -m "Marblehead 101: add landing page"
```

---

## Task 6: Create eight chapter page skeletons

Each chapter file is a thin frontmatter + lorem body. Real content comes in Phase 2 (separate plan, one chapter per commit). The layout wires up everything else (sidebar, drawer, sticky bar, prev/next, dig-ins) from the chapter data.

**Files:**
- Create: 8 chapter HTML files under `marblehead-101/`

- [ ] **Step 6.1: Write Chapter 01**

Create `marblehead-101/01-what-a-ma-town-is.html`:

```html
---
layout: m101
chapter: "01"
title: "What a Massachusetts town is"
og_title: "What a Massachusetts town is — Marblehead 101"
og_description: "Chapter 1 of Marblehead 101. Town Meeting, no mayor, and the form of government most Marbleheaders never learned."
og_url: https://marbleheaddata.org/marblehead-101/01-what-a-ma-town-is.html
body_class: m101-chapter
---

<p><em>Chapter content to be written. This placeholder ensures the chapter page renders with all layout chrome wired up correctly.</em></p>

<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>

<h2>A sample section</h2>

<p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
```

Save the file. (`body_class: m101-chapter` sets a class on `<body>` so JS can detect chapter pages; combined with `data-current-chapter` attribute below.)

- [ ] **Step 6.2: Add `data-current-chapter` attribute to body via the default layout**

The default Jekyll layout (`_layouts/default.html`) renders the `<body>` tag. We need to also expose `page.chapter` to the JS via `data-current-chapter`. Current line 6 of `_layouts/default.html`:

```html
<body{% if page.body_class %} class="{{ page.body_class }}"{% elsif layout.body_class %} class="{{ layout.body_class }}"{% endif %}{% if page.community_pulse == "off-sections" %} data-community-pulse="off-sections"{% endif %}>
```

Replace with (one new conditional appended before the closing `>`):

```html
<body{% if page.body_class %} class="{{ page.body_class }}"{% elsif layout.body_class %} class="{{ layout.body_class }}"{% endif %}{% if page.community_pulse == "off-sections" %} data-community-pulse="off-sections"{% endif %}{% if page.chapter %} data-current-chapter="{{ page.chapter }}"{% endif %}>
```

Verify by building locally (`bundle exec jekyll build`) and confirming `_site/marblehead-101/03-where-money-comes-from.html` has `data-current-chapter="03"` on the body tag, and `_site/index.html` does not have the attribute.

- [ ] **Step 6.3: Write Chapter 02**

Create `marblehead-101/02-branches.html`:

```html
---
layout: m101
chapter: "02"
title: "The branches and who decides what"
og_title: "The branches and who decides what — Marblehead 101"
og_description: "Chapter 2 of Marblehead 101. Select Board, School Committee, Town Meeting, Town Admin, and how they actually interact."
og_url: https://marbleheaddata.org/marblehead-101/02-branches.html
body_class: m101-chapter
---

<p><em>Chapter content to be written.</em></p>

<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
```

- [ ] **Step 6.4: Write Chapter 03**

Create `marblehead-101/03-where-money-comes-from.html`:

```html
---
layout: m101
chapter: "03"
title: "Where the money comes from"
og_title: "Where the money comes from — Marblehead 101"
og_description: "Chapter 3 of Marblehead 101. Most of what the town spends is paid by you, on the house you live in."
og_url: https://marbleheaddata.org/marblehead-101/03-where-money-comes-from.html
body_class: m101-chapter
---

<p><em>Chapter content to be written.</em></p>

<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
```

- [ ] **Step 6.5: Write Chapter 04**

Create `marblehead-101/04-where-money-goes.html`:

```html
---
layout: m101
chapter: "04"
title: "Where the money goes"
og_title: "Where the money goes — Marblehead 101"
og_description: "Chapter 4 of Marblehead 101. Schools, public safety, public works, benefits, debt, all sized to scale."
og_url: https://marbleheaddata.org/marblehead-101/04-where-money-goes.html
body_class: m101-chapter
---

<p><em>Chapter content to be written.</em></p>

<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
```

- [ ] **Step 6.6: Write Chapter 05**

Create `marblehead-101/05-budget-cycle.html`:

```html
---
layout: m101
chapter: "05"
title: "The annual budget cycle"
og_title: "The annual budget cycle — Marblehead 101"
og_description: "Chapter 5 of Marblehead 101. How August requests become a May vote, and where the public can speak."
og_url: https://marbleheaddata.org/marblehead-101/05-budget-cycle.html
body_class: m101-chapter
---

<p><em>Chapter content to be written.</em></p>

<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
```

- [ ] **Step 6.7: Write Chapter 06**

Create `marblehead-101/06-structural-deficit.html`:

```html
---
layout: m101
chapter: "06"
title: "Why structural deficits happen"
og_title: "Why structural deficits happen — Marblehead 101"
og_description: "Chapter 6 of Marblehead 101. 2.5% capped revenue meets 5-9% uncapped costs. The gap compounds."
og_url: https://marbleheaddata.org/marblehead-101/06-structural-deficit.html
body_class: m101-chapter
---

<p><em>Chapter content to be written.</em></p>

<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
```

- [ ] **Step 6.8: Write Chapter 07**

Create `marblehead-101/07-overrides.html`:

```html
---
layout: m101
chapter: "07"
title: "Overrides and debt exclusions"
og_title: "Overrides and debt exclusions — Marblehead 101"
og_description: "Chapter 7 of Marblehead 101. The tools, the difference, and what your ballot vote actually changes."
og_url: https://marbleheaddata.org/marblehead-101/07-overrides.html
body_class: m101-chapter
---

<p><em>Chapter content to be written.</em></p>

<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
```

- [ ] **Step 6.9: Write Chapter 08**

Create `marblehead-101/08-participate.html`:

```html
---
layout: m101
chapter: "08"
title: "How a resident participates"
og_title: "How a resident participates — Marblehead 101"
og_description: "Chapter 8 of Marblehead 101. Town Meeting floor, public comment, FinCom hearings, where to find the docs."
og_url: https://marbleheaddata.org/marblehead-101/08-participate.html
body_class: m101-chapter
---

<p><em>Chapter content to be written.</em></p>

<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
```

- [ ] **Step 6.10: Commit all 8 chapter stubs**

```bash
git add marblehead-101/*.html
git commit -m "Marblehead 101: add 8 chapter page skeletons"
```

---

## Task 7: Add nav link

Insert "Primer" as the first nav link in `_includes/nav.html`. Position it before "Ballot" so it reads as the front door.

**Files:**
- Modify: `_includes/nav.html`

- [ ] **Step 7.1: Read the existing nav**

Run:
```bash
grep -n "nav-link" _includes/nav.html
```

Confirm: the first `<a class="nav-link">` is the Ballot link.

- [ ] **Step 7.2: Insert the Primer link**

Find the line:
```html
    <a class="nav-link" href="{{ '/' | relative_url }}whats-on-the-ballot.html"{% if page.url == '/whats-on-the-ballot.html' %} aria-current="page"{% endif %}>Ballot</a>
```

Insert a new line directly above it:
```html
    <a class="nav-link" href="{{ '/' | relative_url }}marblehead-101/"{% if page.url contains '/marblehead-101/' %} aria-current="page"{% endif %}>Primer</a>
```

(The `page.url contains '/marblehead-101/'` check matches both the landing and all chapter sub-pages.)

- [ ] **Step 7.3: Check the 375px-width fit**

Open the local site in a 375px Chromium viewport (Playwright headless). The nav now has 5 nav links (Primer, Ballot, Candidates, Questions, Browse) plus 2 icon buttons plus the brand. Verify nothing wraps or truncates.

Build + serve locally:
```bash
bundle exec jekyll build
npx serve _site -p 4001 &
sleep 2
node -e '
import("/home/claude/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs").then(async ({chromium}) => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4001/");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "proof/nav-375.png" });
  await browser.close();
});
'
```

Open `proof/nav-375.png`. If the nav wraps, the brand wordmark (" MHD Data" next to the favicon) is the first thing to hide via media query. Add to `assets/site.css`:

```css
@media (max-width: 400px) {
  .nav-brand { font-size: 0; }
  .nav-brand .nav-logo { font-size: 14px; }
}
```

(Setting font-size: 0 hides the text but the inner img keeps its own size.)

- [ ] **Step 7.4: Commit**

```bash
git add _includes/nav.html
# also add assets/site.css if 7.3 required the brand-hide rule
git status
git commit -m "Marblehead 101: add Primer nav link"
```

---

## Task 8: Add homepage featured card

A new `.featured-card` on the homepage pointing to Marblehead 101. The component exists in `assets/site.css` (lines 3705-3752) but no element currently uses it on `index.html`. Insert it directly between the `.home-hero` and the first scroll-stop so it sits above-fold for first-time visitors without disrupting the existing scroll-stop sequence.

**Files:**
- Modify: `index.html`

- [ ] **Step 8.1: Locate the insertion point**

Run:
```bash
grep -n 'class="home-hero"\|class="home-stop' index.html | head -5
```

Expected: `.home-hero` opens around line 543; first `.home-stop` opens around line 555. Insertion point is the blank/whitespace line between them. The exact insertion line may shift if the file has been edited; the rule is "after `</section>` of the home-hero, before `<section class="home-stop home-stop--tinted" id="deficit">`."

- [ ] **Step 8.2: Insert the featured card**

Insert the following markup at the insertion point (after the closing tag of `.home-hero`, before `<section class="home-stop home-stop--tinted" id="deficit">`). Class names must match the existing CSS in `assets/site.css` (`featured-card-eyebrow`, `featured-card-title`, `featured-card-desc`):

```html

<a href="marblehead-101/" class="featured-card">
  <div class="featured-card-eyebrow">New here?</div>
  <h2 class="featured-card-title">Marblehead 101</h2>
  <p class="featured-card-desc">A plain-English primer on how the town works, where the money goes, and how a resident takes part. 8 short chapters, ~25 min total.</p>
  <span style="font-size: 0.875rem; font-weight: 600; color: var(--c-teal);">Start the primer &rarr;</span>
</a>

```

(The inline-style "Start the primer" link mimics the existing pattern used elsewhere on the homepage for "deep dive" inline CTAs. If a `.featured-card-cta` class is added to `assets/site.css` later, swap this inline style for the class.)

- [ ] **Step 8.3: Verify the homepage renders**

Run:
```bash
bundle exec jekyll build
grep -c 'featured-card' _site/index.html
```

Expected: 4 (one for the `<a>`, plus three for the child class names).

- [ ] **Step 8.4: Commit**

```bash
git add index.html
git commit -m "Marblehead 101: add homepage featured card"
```

---

## Task 9: Add smoke tests

Add a Marblehead 101 section to `tests/smoke-test.mjs`. Tests that all 9 URLs return 200, the landing has 8 chapter cards, each chapter has the correct chip number, the sidebar marks the current chapter, and the nav link is present.

**Files:**
- Modify: `tests/smoke-test.mjs`

- [ ] **Step 9.1: Read the existing smoke test structure**

Run:
```bash
grep -n "^async function test\|^console.log\|^const " tests/smoke-test.mjs | head -30
```

Note the existing test-function naming pattern (`async function testXxx(page)`) and how they're called from the main runner.

- [ ] **Step 9.2: Add the test functions**

Add the following functions to `tests/smoke-test.mjs` near the other `async function testXxx(page)` blocks:

```javascript
// ── Marblehead 101 ──────────────────────────────────────────

async function testM101Landing(page) {
  console.log('\n── Marblehead 101 landing ──');
  const resp = await page.goto(SITE + '/marblehead-101/');
  resp.status() === 200
    ? ok('Landing returns 200')
    : fail('Landing', 'expected 200, got ' + resp.status());

  const h1 = await page.$eval('.m101-hero h1', el => el.textContent.trim());
  h1 === 'Marblehead 101'
    ? ok('Landing h1 reads "Marblehead 101"')
    : fail('Landing h1', `got "${h1}"`);

  const cards = await page.$$('.m101-ch');
  cards.length === 8
    ? ok('Landing has 8 chapter cards')
    : fail('Landing chapter cards', `expected 8, got ${cards.length}`);

  const parts = await page.$$('.m101-group');
  parts.length === 3
    ? ok('Landing has 3 thematic parts')
    : fail('Landing parts', `expected 3, got ${parts.length}`);
}

async function testM101ChapterPages(page) {
  console.log('\n── Marblehead 101 chapters ──');
  const slugs = [
    ['01', '01-what-a-ma-town-is'],
    ['02', '02-branches'],
    ['03', '03-where-money-comes-from'],
    ['04', '04-where-money-goes'],
    ['05', '05-budget-cycle'],
    ['06', '06-structural-deficit'],
    ['07', '07-overrides'],
    ['08', '08-participate'],
  ];
  for (const [num, slug] of slugs) {
    const resp = await page.goto(`${SITE}/marblehead-101/${slug}.html`);
    if (resp.status() !== 200) {
      fail(`Chapter ${num} loads`, `${resp.status()} on ${slug}.html`);
      continue;
    }
    ok(`Chapter ${num} returns 200`);
    const chipNum = await page.$eval('.m101-chip .num', el => el.textContent.trim());
    const expected = String(parseInt(num, 10));
    chipNum === expected
      ? ok(`Chapter ${num} chip shows "${expected}"`)
      : fail(`Chapter ${num} chip`, `expected "${expected}", got "${chipNum}"`);
    const cur = await page.$$eval('.m101-syllabus li.cur', els => els.map(e => e.dataset.chapter));
    cur.length === 1 && cur[0] === num
      ? ok(`Chapter ${num} sidebar marks correct current item`)
      : fail(`Chapter ${num} sidebar`, `cur items: ${JSON.stringify(cur)}`);
  }
}

async function testM101NavLink(page) {
  console.log('\n── Marblehead 101 nav link ──');
  await page.goto(SITE + '/');
  const link = await page.$('a.nav-link[href*="/marblehead-101/"]');
  link
    ? ok('Primer nav link present on homepage')
    : fail('Primer nav link', 'not found on homepage');
}
```

- [ ] **Step 9.3: Wire the test functions into the runner**

Find the main runner block in `tests/smoke-test.mjs` (the part that calls each `await testXxx(page)`). Add three new calls in order:

```javascript
await testM101Landing(page);
await testM101ChapterPages(page);
await testM101NavLink(page);
```

Place them near the end of the page-level tests, before the summary print.

- [ ] **Step 9.4: Run the test suite against local Jekyll build**

Run:
```bash
npm run test:local
```

Expected: all existing tests pass + the new Marblehead 101 tests pass. If any FAIL appears in the new section, debug before continuing.

- [ ] **Step 9.5: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "Marblehead 101: add smoke tests for landing, chapters, nav"
```

---

## Task 10: Visual verification with Playwright

Capture screenshots of the landing and a sample chapter page at desktop and mobile. Commit them as proof in `proof/`.

- [ ] **Step 10.1: Build the site and serve locally**

Run:
```bash
bundle exec jekyll build
npx serve _site -p 4001 > /tmp/serve.log 2>&1 &
sleep 2
curl -sI http://localhost:4001/marblehead-101/ | head -1
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 10.2: Capture screenshots**

Create `proof/m101-shoot.mjs`:

```javascript
import { chromium } from '/home/claude/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const targets = [
  ['marblehead-101', '/marblehead-101/'],
  ['chapter-03', '/marblehead-101/03-where-money-comes-from.html'],
];

for (const [label, path] of targets) {
  // Desktop above-fold
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4001' + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `proof/${label}-desktop.png` });
    await ctx.close();
  }
  // Mobile above-fold
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4001' + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `proof/${label}-mobile.png` });
    await ctx.close();
  }
  console.log(`captured ${label}`);
}

await browser.close();
```

Then run:
```bash
node proof/m101-shoot.mjs
ls -la proof/marblehead-101-* proof/chapter-03-*
```

Expected: 4 PNG files between ~80KB and ~400KB.

- [ ] **Step 10.3: Inspect the screenshots manually**

Open each PNG. Check:
- Landing desktop: hero + 3 thematic groups visible, 8 chapter cards
- Landing mobile: stacked, no overflow, "Start with Chapter 1" CTA tappable
- Chapter desktop: sticky bar at top with "Chapter 3 of 8 · 37%", sidebar visible with current chapter highlighted, body with chip + h1 + dek + objectives + lorem + dig-in cards + pager
- Chapter mobile: sticky bar with Chapters button, no sidebar, body wraps cleanly

If any rendering is off, fix and re-shoot.

- [ ] **Step 10.4: Commit the proof images**

```bash
git add proof/marblehead-101-desktop.png proof/marblehead-101-mobile.png proof/chapter-03-desktop.png proof/chapter-03-mobile.png proof/m101-shoot.mjs
git commit -m "Marblehead 101: proof screenshots (desktop + mobile)"
```

- [ ] **Step 10.5: Stop the local server**

```bash
pkill -f "serve _site"
```

---

## Task 11: Push and open PR

- [ ] **Step 11.1: Push the branch**

```bash
git push 2>&1 | tail -3
```

- [ ] **Step 11.2: Open the PR**

Run:
```bash
gh pr edit 798 --title "Marblehead 101: 8-chapter explainer course (skeleton)" --body-file - <<'EOF'
Ships the Phase 1 skeleton from `docs/superpowers/specs/2026-06-08-marblehead-101-design.md`: a landing page at `/marblehead-101/`, eight chapter pages with full layout chrome (sticky bar, desktop sidebar, mobile drawer, prev/next, "Go deeper" cards, localStorage progress), a "Primer" nav link, and a homepage featured card.

Chapter bodies are placeholder lorem. Phase 2 (separate PR) writes the actual chapters one commit at a time.

## What's new

- `_data/marblehead_101.yml` — single source of truth for the 8 chapters
- `_layouts/m101.html` — chapter page layout (sticky bar, sidebar, drawer, pager)
- `assets/m101.css` — course stylesheet
- `assets/m101.js` — drawer toggle + localStorage progress
- `marblehead-101/` — landing + 8 chapter pages
- `_includes/nav.html` — "Primer" link added as first nav item
- `index.html` — featured card pointing to the primer
- `tests/smoke-test.mjs` — 11 new assertions covering the course

## Test plan
- [ ] Visit `/marblehead-101/` on preview, see 8 cards in 3 thematic groups
- [ ] Click any chapter, see sticky bar + sidebar (desktop) / Chapters button (mobile)
- [ ] On a chapter page, scroll past 50% then return to syllabus, see green checkmark
- [ ] On mobile, tap the Chapters button, drawer slides up
- [ ] Tap a different chapter from the drawer, navigate cleanly
- [ ] At chapter 1, prev link goes to syllabus; at chapter 8, next link goes to syllabus
- [ ] Nav "Primer" highlights when on any /marblehead-101/* page

## Proof of Work

Screenshots in `proof/marblehead-101-{desktop,mobile}.png` and `proof/chapter-03-{desktop,mobile}.png`. Smoke tests pass locally (`npm run test:local`).

Preview URL: see sticky preview comment.
EOF
```

Expected: PR title and body updated.

- [ ] **Step 11.3: Verify the preview**

Wait for the Cloudflare preview to redeploy (~3-5 min). Test these URLs once live:

- `<preview>/marblehead-101/` (landing)
- `<preview>/marblehead-101/03-where-money-comes-from` (any chapter)
- `<preview>/` (homepage, with new featured card)

If anything looks broken on preview, fix and push.

---

## Self-Review Notes

Coverage check (spec → plan):

| Spec section | Implemented in |
|---|---|
| Editorial stance | Codified in chapter data file (descriptions are claim-first, no em-dashes); chapter bodies are lorem placeholders pending Phase 2 |
| URLs (`/marblehead-101/...`) | Task 5 (landing), Task 6 (chapter files) |
| Top nav link | Task 7 |
| Homepage entry point | Task 8 |
| B-revised visual identity | Task 2 (CSS) + Task 4 (layout) |
| Mobile drawer | Task 2 (CSS) + Task 3 (JS) + Task 4 (layout markup) |
| Desktop sidebar | Task 2 + Task 4 |
| LocalStorage progress | Task 3 |
| 8 chapters with dig-ins | Task 1 (data) + Task 6 (page files) |
| Reusable CSS components | Task 2 (assets/m101.css) |
| Smoke tests | Task 9 |
| Mockup cleanup | Pre-task |

Phase 2 (not in this plan): writing the chapter bodies one at a time, each commit replacing one chapter's lorem with sourced prose.
