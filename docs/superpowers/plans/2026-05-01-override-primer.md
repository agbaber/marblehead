# Override Primer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/override-primer.html`, a new ~5-minute Morpho-style narrative primer on the FY27 override with a tightly distilled both-sides recap, and add it to the site nav.

**Architecture:** Single self-contained HTML page using Jekyll's default `layout: page`. All CSS lives in a page-scoped `<style>` block under a `.primer` wrapper class — no edits to `assets/site.css`. Six numbered chapters in a question-chain, then a two-column for/against distillation card, then a TL;DR definition list, then a 5-card "go deeper" footer linking to the existing reference pages. Every fact reuses an existing `<sup class="cite">` citation marker copied verbatim from `what-is-the-override.html`, `the-debate.html`, `where-has-the-money-gone.html`, or `super-summary.html` — no new sources, no new derivations.

**Tech Stack:** Jekyll 3.10 (GitHub Pages), vanilla HTML/CSS, no JS additions. `assets/citations.js` auto-injects `<h2>Sources</h2>` at runtime.

**Spec:** [`docs/superpowers/specs/2026-05-01-override-primer-design.md`](../specs/2026-05-01-override-primer-design.md)

**Worktree:** `.worktrees/override-primer-spec/` (branch `override-primer-spec`)

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `override-primer.html` | Create | The new page. Frontmatter, page-scoped `<style>` block, hero, TOC, six chapter sections, both-sides block, TL;DR card, go-deeper footer. |
| `_includes/nav.html` | Modify | Insert one new `<a>` link as the first item in the "Vote" dropdown (line 8 area). |

No other files touched. No `assets/site.css` edits. No new images, no new JS, no new data files.

---

## Pre-implementation checks

Before starting Task 1, the implementer **must** run these greps from inside the worktree to gather verbatim source data. The plan tells you *which markers to copy*, not what numbers they contain — this prevents stale-number bugs between plan-writing and plan-execution.

```bash
cd /Users/agbaber/marblehead/.worktrees/override-primer-spec

# Pull every <sup class="cite"> marker on the source pages into one file
# for easy reference while filling chapters.
grep -h '<sup class="cite"' \
  what-is-the-override.html \
  the-debate.html \
  where-has-the-money-gone.html \
  super-summary.html \
  > /tmp/primer-citations.txt

wc -l /tmp/primer-citations.txt   # should be > 30
```

When a chapter step says "reuse the citation marker for X from Y", look it up in `/tmp/primer-citations.txt` (or directly in the source page) and **copy the entire `<sup>` tag verbatim** — same `data-href`, same `data-source`, same anchor id. Citations.js will deduplicate IDs across the page automatically.

---

## Task 1: Scaffold the page with frontmatter and wrapper

**Files:**
- Create: `override-primer.html`

- [ ] **Step 1: Create the file with frontmatter and an empty `.primer` wrapper**

```yaml
---
title: "The override, in 5 minutes"
scripts: [citations]
og_title: "The override, in 5 minutes"
og_description: "A short narrative primer on the FY27 Marblehead override and a distilled recap of the both-sides debate. Built for someone who wants the gist before deciding whether to read more."
og_url: https://marbleheaddata.org/override-primer.html
---
<style>
  /* CSS goes here — added in Task 2 */
</style>

<div class="primer">
  <!-- HERO — added in Task 3 -->
  <!-- TOC — added in Task 4 -->
  <!-- CHAPTERS — added in Tasks 5-10 -->
  <!-- BOTH SIDES — added in Task 11 -->
  <!-- TL;DR — added in Task 12 -->
  <!-- GO DEEPER — added in Task 13 -->
</div>
```

- [ ] **Step 2: Verify the file is valid Jekyll**

```bash
ls -la override-primer.html
head -10 override-primer.html
```

Expected: file exists, frontmatter parses (no Jekyll errors). Since there's no local dev server (per `project_no_local_dev_server.md` memory), full Jekyll validation happens at the Cloudflare preview step (Task 15).

- [ ] **Step 3: Em-dash scan**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html
```

Expected: no matches (or only matches inside `var(--c-*)` CSS tokens — confirm none are in prose).

- [ ] **Step 4: Commit**

```bash
git add override-primer.html
git commit -m "Scaffold override-primer.html with frontmatter and wrapper"
```

---

## Task 2: Add page-scoped CSS for hero, TOC, chapters, callouts

**Files:**
- Modify: `override-primer.html` (replace the `<style>` block)

All selectors scoped under `.primer`. Every color via `var(--c-*)` tokens from `assets/site.css`. Dark mode just works.

- [ ] **Step 1: Replace the `<style>` block with the full page CSS**

Replace the empty `<style></style>` with:

```html
<style>
  /* ============================================================
     OVERRIDE PRIMER — page-scoped styles
     All selectors prefixed with .primer to prevent leakage.
     All colors via var(--c-*) so dark mode works.
     ============================================================ */

  .primer {
    --primer-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --primer-rule: var(--divider);
    --primer-rule-strong: var(--border);
  }

  /* ---------- HERO ---------- */
  .primer-hero {
    padding: 48px 0 36px;
    border-bottom: 1px solid var(--primer-rule);
    margin-bottom: 0;
  }
  .primer-hero-eyebrow {
    font-family: var(--primer-mono);
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--c-buoy);
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .primer-hero-eyebrow::after {
    content: '';
    height: 1px;
    flex: 1;
    background: var(--c-buoy);
    opacity: 0.4;
  }
  .primer-hero h1 {
    font-size: clamp(32px, 5.5vw, 52px);
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: var(--text);
    margin: 0 0 18px;
  }
  .primer-hero-lead {
    font-size: 19px;
    line-height: 1.5;
    color: var(--text-muted);
    max-width: 620px;
    margin: 0 0 32px;
  }
  .primer-hero-meta {
    display: flex;
    gap: 36px;
    padding-top: 20px;
    border-top: 1px solid var(--primer-rule);
    flex-wrap: wrap;
  }
  .primer-hero-meta-item { display: flex; flex-direction: column; gap: 4px; }
  .primer-hero-meta-label {
    font-family: var(--primer-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .primer-hero-meta-value {
    font-family: var(--primer-mono);
    font-size: 13px;
    color: var(--text);
  }

  /* ---------- TOC ---------- */
  .primer-toc {
    padding: 36px 0 12px;
    border-bottom: 1px solid var(--primer-rule);
  }
  .primer-toc-label {
    font-family: var(--primer-mono);
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--c-buoy);
    margin-bottom: 18px;
  }
  .primer-toc-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .primer-toc-list li {
    border-top: 1px solid var(--primer-rule);
  }
  .primer-toc-list li:last-child {
    border-bottom: 1px solid var(--primer-rule);
  }
  .primer-toc-list a {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 20px;
    padding: 16px 0;
    color: var(--text);
    text-decoration: none;
    align-items: baseline;
    font-size: 17px;
    transition: color 0.15s ease, padding-left 0.15s ease;
  }
  .primer-toc-list a:hover {
    color: var(--c-buoy);
    padding-left: 8px;
  }
  .primer-toc-num {
    font-family: var(--primer-mono);
    font-size: 13px;
    color: var(--c-navy);
    letter-spacing: 0.04em;
  }

  /* ---------- CHAPTERS ---------- */
  .primer-chapter {
    padding: 56px 0;
    border-bottom: 1px solid var(--primer-rule);
    scroll-margin-top: 80px;
  }
  .primer-chapter--alt {
    background: color-mix(in srgb, var(--c-navy) 2%, transparent);
  }
  .primer-chapter-header {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    margin-bottom: 28px;
  }
  .primer-chapter-marker { align-self: start; }
  .primer-chapter-num {
    font-family: var(--primer-mono);
    font-size: 36px;
    color: var(--c-navy);
    line-height: 1;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }
  .primer-chapter-tag {
    font-family: var(--primer-mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-faint);
    padding-top: 8px;
    border-top: 1px solid var(--primer-rule-strong);
    width: fit-content;
  }
  .primer-chapter-title {
    font-size: clamp(24px, 4vw, 36px);
    line-height: 1.1;
    color: var(--text);
    margin: 0 0 14px;
    letter-spacing: -0.01em;
  }
  .primer-chapter-lead {
    font-size: 18px;
    line-height: 1.45;
    color: var(--text-muted);
    max-width: 600px;
    margin: 0;
  }
  .primer-chapter-body p {
    margin-bottom: 16px;
    color: var(--text);
    max-width: 620px;
    line-height: 1.6;
    font-size: 16px;
  }
  .primer-chapter-body p strong { color: var(--text); font-weight: 600; }

  @media (min-width: 880px) {
    .primer-chapter-header {
      grid-template-columns: 180px 1fr;
      gap: 48px;
    }
    .primer-chapter-marker {
      position: sticky;
      top: 80px;
    }
    .primer-chapter-body { padding-left: calc(180px + 48px); }
  }

  /* ---------- CALLOUTS ---------- */
  .primer-question {
    font-family: var(--primer-mono);
    font-size: 13px;
    color: var(--c-buoy);
    margin: 0 0 24px;
    padding: 4px 0 4px 14px;
    border-left: 2px solid var(--c-buoy);
    max-width: 620px;
    line-height: 1.5;
    font-style: italic;
  }
  .primer-key {
    background: color-mix(in srgb, var(--c-navy) 4%, var(--surface));
    border-left: 3px solid var(--c-navy);
    padding: 18px 22px;
    margin: 24px 0;
    font-size: 16px;
    color: var(--text);
    line-height: 1.55;
    max-width: 620px;
    border-radius: 0 8px 8px 0;
  }
  .primer-key strong { color: var(--c-navy); }
  .primer-define {
    border-top: 2px solid var(--c-buoy);
    padding: 16px 0 18px;
    margin: 24px 0;
    max-width: 620px;
  }
  .primer-define-term {
    font-family: var(--primer-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-buoy);
    margin-bottom: 8px;
  }
  .primer-define-text {
    font-size: 17px;
    line-height: 1.45;
    color: var(--text);
    font-weight: 500;
  }
  .primer-big-stat {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 22px 0;
    margin: 22px 0;
    border-top: 1px solid var(--primer-rule);
    border-bottom: 1px solid var(--primer-rule);
    max-width: 620px;
  }
  .primer-big-stat-num {
    font-family: var(--primer-mono);
    font-size: 42px;
    line-height: 1;
    color: var(--c-navy);
    flex-shrink: 0;
  }
  .primer-big-stat-text {
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.45;
  }

  /* ---------- BOTH SIDES (mirrors the-debate.html .perspective) ---------- */
  .primer-bothsides {
    padding: 56px 0 32px;
    border-bottom: 1px solid var(--primer-rule);
  }
  .primer-bothsides h2 {
    font-size: clamp(22px, 3vw, 28px);
    margin: 0 0 8px;
    color: var(--text);
  }
  .primer-bothsides-framing {
    font-size: 14px;
    color: var(--text-muted);
    font-style: italic;
    max-width: 620px;
    margin: 0 0 24px;
  }
  .primer-bothsides-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    max-width: 860px;
  }
  @media (max-width: 720px) {
    .primer-bothsides-grid { grid-template-columns: 1fr; }
  }
  .primer .perspective {
    border-radius: 0 10px 10px 0;
    padding: 18px 22px 16px;
    margin: 0;
    background: var(--surface);
    border-left: 4px solid var(--border);
    box-shadow: var(--shadow-sm);
  }
  .primer .perspective--for {
    border-left-color: var(--c-teal);
    background: color-mix(in srgb, var(--c-teal) 5%, var(--surface));
  }
  .primer .perspective--against {
    border-left-color: var(--c-brass);
    background: color-mix(in srgb, var(--c-brass) 5%, var(--surface));
  }
  .primer .perspective-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    color: var(--text-subtle);
    margin-bottom: 10px;
  }
  .primer .perspective p {
    font-size: 15px;
    line-height: 1.65;
    color: var(--text);
    margin: 0 0 10px;
  }
  .primer .perspective p:last-child { margin-bottom: 0; }
  .primer-bothsides-cta {
    margin: 22px 0 0;
    text-align: center;
    font-family: var(--primer-mono);
    font-size: 13px;
    letter-spacing: 0.04em;
  }
  .primer-bothsides-cta a {
    color: var(--c-navy);
    text-decoration: none;
    border-bottom: 1px solid color-mix(in srgb, var(--c-navy) 35%, transparent);
    padding-bottom: 1px;
  }
  .primer-bothsides-cta a:hover {
    color: var(--c-buoy);
    border-bottom-color: var(--c-buoy);
  }

  /* ---------- TL;DR ---------- */
  .primer-tldr {
    padding: 48px 0;
    border-bottom: 1px solid var(--primer-rule);
  }
  .primer-tldr-card {
    background: color-mix(in srgb, var(--c-navy) 3%, var(--surface));
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 22px 26px 26px;
    max-width: 720px;
  }
  .primer-tldr-eyebrow {
    font-family: var(--primer-mono);
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--c-buoy);
    margin-bottom: 6px;
  }
  .primer-tldr h2 {
    font-size: 22px;
    margin: 0 0 16px;
    color: var(--text);
  }
  .primer-tldr dl { margin: 0; }
  .primer-tldr dt {
    font-family: var(--primer-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--c-navy);
    margin-top: 14px;
    margin-bottom: 4px;
  }
  .primer-tldr dt:first-of-type { margin-top: 0; }
  .primer-tldr dd {
    margin: 0;
    color: var(--text);
    font-size: 15px;
    line-height: 1.5;
  }

  /* ---------- GO DEEPER ---------- */
  .primer-godeeper {
    padding: 48px 0 64px;
  }
  .primer-godeeper-label {
    font-family: var(--primer-mono);
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--c-buoy);
    margin-bottom: 18px;
  }
  .primer-godeeper-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }
  .primer-godeeper-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 16px 18px 18px;
    text-decoration: none;
    color: var(--text);
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .primer-godeeper-card:hover {
    border-color: var(--c-buoy);
    transform: translateY(-1px);
  }
  .primer-godeeper-card-title {
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 4px;
  }
  .primer-godeeper-card-desc {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  /* ---------- MOBILE ---------- */
  @media (max-width: 880px) {
    .primer-hero { padding: 32px 0 24px; }
    .primer-chapter { padding: 40px 0; }
    .primer-chapter-num { font-size: 28px; }
    .primer-chapter-marker { position: relative; top: 0; margin-bottom: 4px; }
  }
</style>
```

- [ ] **Step 2: Em-dash scan**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' | grep -v '^\s*\*' || echo "clean"
```

Expected: only matches inside CSS `var(--...)` (filtered out by the grep above) — output should be `clean`.

- [ ] **Step 3: Commit**

```bash
git add override-primer.html
git commit -m "Add page-scoped CSS for primer (hero, TOC, chapters, callouts, both-sides, TL;DR, go-deeper)"
```

---

## Task 3: Add the hero section

**Files:**
- Modify: `override-primer.html`

- [ ] **Step 1: Replace `<!-- HERO -->` with the hero markup**

Use Edit to replace `<!-- HERO — added in Task 3 -->` with:

```html
  <section class="primer-hero">
    <div class="primer-hero-eyebrow">A 5-minute primer</div>
    <h1>The override, from the top.</h1>
    <p class="primer-hero-lead">Marblehead has a Prop 2&frac12; override on the ballot June 9. This page walks the whole question one step at a time, then ends with the strongest version of each side's case so you can decide where you stand.</p>
    <div class="primer-hero-meta">
      <div class="primer-hero-meta-item">
        <span class="primer-hero-meta-label">Reading time</span>
        <span class="primer-hero-meta-value">~ 5 minutes</span>
      </div>
      <div class="primer-hero-meta-item">
        <span class="primer-hero-meta-label">Vote date</span>
        <span class="primer-hero-meta-value">June 9, 2026</span>
      </div>
      <div class="primer-hero-meta-item">
        <span class="primer-hero-meta-label">Last updated</span>
        <span class="primer-hero-meta-value">May 1, 2026</span>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Em-dash scan and commit**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
git add override-primer.html
git commit -m "Add hero section to override-primer"
```

---

## Task 4: Add the numbered TOC

**Files:**
- Modify: `override-primer.html`

- [ ] **Step 1: Replace `<!-- TOC -->` with the TOC markup**

```html
  <section class="primer-toc">
    <div class="primer-toc-label">Contents</div>
    <ul class="primer-toc-list">
      <li><a href="#ch1"><span class="primer-toc-num">01</span><span>The vote</span></a></li>
      <li><a href="#ch2"><span class="primer-toc-num">02</span><span>The gap</span></a></li>
      <li><a href="#ch3"><span class="primer-toc-num">03</span><span>The cap</span></a></li>
      <li><a href="#ch4"><span class="primer-toc-num">04</span><span>The three tiers</span></a></li>
      <li><a href="#ch5"><span class="primer-toc-num">05</span><span>What it costs</span></a></li>
      <li><a href="#ch6"><span class="primer-toc-num">06</span><span>Either way</span></a></li>
    </ul>
  </section>
```

- [ ] **Step 2: Em-dash scan and commit**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
git add override-primer.html
git commit -m "Add numbered TOC to override-primer"
```

---

## Task 5: Chapter 01 — The vote

**Files:**
- Modify: `override-primer.html`

**Citation reuse:** The June 9 ballot date and the "first attempt since 2005" facts are both already cited on `what-is-the-override.html`. Open that file, find the existing `<sup class="cite">` markers for those two facts, and copy them verbatim into this chapter.

- [ ] **Step 1: Replace `<!-- CHAPTERS -->` with chapter 01 (and a placeholder comment for the rest)**

```html
  <section class="primer-chapter" id="ch1">
    <div class="primer-chapter-header">
      <div class="primer-chapter-marker">
        <div class="primer-chapter-num">01</div>
        <div class="primer-chapter-tag">The vote</div>
      </div>
      <div>
        <h2 class="primer-chapter-title">There's a vote on June 9.</h2>
        <p class="primer-chapter-lead">It's not on whether to fix the budget. It's on whether to permanently raise property taxes to do it.</p>
      </div>
    </div>
    <div class="primer-chapter-body">
      <p class="primer-question">What's actually on the ballot?</p>
      <p>At the Annual Town Election on <strong>June 9, 2026</strong>, Marblehead voters will be asked to approve a Proposition 2&frac12; <strong>operating override</strong>. A yes vote permanently raises the town's property tax levy. A no vote keeps it where it is.</p>
      <p>The last time Marblehead approved an operating override was <strong>2005</strong>. Several override votes since have failed.</p>
      <div class="primer-key">
        Most things on a town ballot are routine. This one isn't. It changes the tax baseline for every household in town, every year going forward.
      </div>
    </div>
  </section>

  <!-- CHAPTER 02 — added in Task 6 -->
  <!-- CHAPTER 03 — added in Task 7 -->
  <!-- CHAPTER 04 — added in Task 8 -->
  <!-- CHAPTER 05 — added in Task 9 -->
  <!-- CHAPTER 06 — added in Task 10 -->
```

- [ ] **Step 2: Add citation markers**

For both the "June 9, 2026" and "2005" mentions, look up the corresponding `<sup class="cite" data-href="..." data-source="...">` in `what-is-the-override.html` and paste them immediately after each fact (before the closing `</strong>` tag). Verbatim copy — don't edit the `data-href` or `data-source`.

- [ ] **Step 3: Em-dash scan and commit**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
git add override-primer.html
git commit -m "Add chapter 01 (the vote) to override-primer"
```

---

## Task 6: Chapter 02 — The gap

**Files:**
- Modify: `override-primer.html`

**Citation reuse:** The $8.47M FY27 deficit number and the FinCom transmittal-letter blockquote are both on `what-is-the-override.html`. Reuse the same `<sup>` marker for $8.47M; reuse the entire `<blockquote class="quote quote--mixed">` for the FinCom quote (verbatim, including its `<footer>`).

- [ ] **Step 1: Replace `<!-- CHAPTER 02 -->` with**

```html
  <section class="primer-chapter primer-chapter--alt" id="ch2">
    <div class="primer-chapter-header">
      <div class="primer-chapter-marker">
        <div class="primer-chapter-num">02</div>
        <div class="primer-chapter-tag">The gap</div>
      </div>
      <div>
        <h2 class="primer-chapter-title">The town is projected to spend about $8.47M more than it brings in next year.</h2>
        <p class="primer-chapter-lead">FinCom forecast it a year in advance. They told residents about it in writing. The State of the Town presentation said the same thing nine months later.</p>
      </div>
    </div>
    <div class="primer-chapter-body">
      <p class="primer-question">If the town can't cover its costs, can't it just spend more?</p>
      <p>Recurring expenses are growing faster than the revenue available to fund them. Healthcare, pensions, and personnel costs all step up annually. Property tax revenue, which funds most of the town, is capped.</p>
      <div class="primer-big-stat">
        <div class="primer-big-stat-num">$8.47M</div>
        <div class="primer-big-stat-text">Projected FY27 operating deficit. Forecast a year in advance by the Finance Committee.</div>
      </div>
      <p>The Finance Committee transmittal letter to the spring 2025 Annual Town Meeting put it directly:</p>
      <!-- Paste the existing <blockquote class="quote quote--mixed"> from what-is-the-override.html that contains the "highlighted projected deficits for each of the FY26, FY27, and FY28 periods" quote. Verbatim. -->
      <div class="primer-key">
        The deficit isn't a surprise. It was on paper a year before the vote. The override question exists because the gap can't be closed inside the cap.
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Paste the FinCom blockquote verbatim from what-is-the-override.html**

Open `what-is-the-override.html`. Find the `<blockquote class="quote quote--mixed">` that contains the phrase "highlighted projected deficits". Copy that entire blockquote (open tag through `</blockquote>`) and paste it where the comment placeholder is.

- [ ] **Step 3: Add $8.47M citation marker**

Find the `<sup class="cite">` immediately following an existing `$8.47M` mention in `what-is-the-override.html`. Paste it after the `$8.47M` in the `.primer-big-stat-num` (inside the div, after the dollar amount).

- [ ] **Step 4: Em-dash scan and commit**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
git add override-primer.html
git commit -m "Add chapter 02 (the gap) to override-primer"
```

---

## Task 7: Chapter 03 — The cap

**Files:**
- Modify: `override-primer.html`

**Citation reuse:** The Prop 2.5 / M.G.L. c. 59 § 21C link is on `what-is-the-override.html`. Reuse it.

- [ ] **Step 1: Replace `<!-- CHAPTER 03 -->` with**

```html
  <section class="primer-chapter" id="ch3">
    <div class="primer-chapter-header">
      <div class="primer-chapter-marker">
        <div class="primer-chapter-num">03</div>
        <div class="primer-chapter-tag">The cap</div>
      </div>
      <div>
        <h2 class="primer-chapter-title">Massachusetts caps property tax growth at 2.5% a year.</h2>
        <p class="primer-chapter-lead">That's the law that makes this a ballot question and not a budget decision.</p>
      </div>
    </div>
    <div class="primer-chapter-body">
      <p class="primer-question">How much over the cap is being asked?</p>
      <div class="primer-define">
        <div class="primer-define-term">Proposition 2&frac12;</div>
        <div class="primer-define-text">A 1980 state law that caps the total property tax a town can levy from growing more than 2.5% per year (plus revenue from new construction).</div>
      </div>
      <div class="primer-define">
        <div class="primer-define-term">Override</div>
        <div class="primer-define-text">A ballot question that, if a majority votes yes, permanently raises the cap by a specified amount. It's the only permanent way past the 2.5% limit.</div>
      </div>
      <p>Without an override, the town can't raise property taxes by more than 2.5% next year, no matter what costs do. With an override, voters set a new, higher baseline that compounds at 2.5% from then on.</p>
      <div class="primer-key">
        The vote isn't whether the town can spend more. It's whether the town's <strong>ceiling</strong> on what it can spend goes up.
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Add Prop 2.5 statute citation**

Add the existing `<sup class="cite">` for M.G.L. c. 59 § 21C from `what-is-the-override.html` to the end of the Proposition 2½ define-text (after the closing parenthesis).

- [ ] **Step 3: Em-dash scan and commit**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
git add override-primer.html
git commit -m "Add chapter 03 (the cap) to override-primer"
```

---

## Task 8: Chapter 04 — The three tiers

**Files:**
- Modify: `override-primer.html`

**Citation reuse:** Tier amounts ($9M / $12M / $15M) and the "highest tier with a majority" mechanic are on `what-is-the-override.html`. Reuse those `<sup>` markers.

- [ ] **Step 1: Replace `<!-- CHAPTER 04 -->` with**

```html
  <section class="primer-chapter primer-chapter--alt" id="ch4">
    <div class="primer-chapter-header">
      <div class="primer-chapter-marker">
        <div class="primer-chapter-num">04</div>
        <div class="primer-chapter-tag">The three tiers</div>
      </div>
      <div>
        <h2 class="primer-chapter-title">There are three nested options on the ballot, not one.</h2>
        <p class="primer-chapter-lead">Voters pick the highest tier they support. The highest tier with a majority sets the override amount.</p>
      </div>
    </div>
    <div class="primer-chapter-body">
      <p class="primer-question">And what does that mean for my tax bill?</p>
      <p>Voters won't see a single yes/no question. They'll see three nested override amounts:</p>
      <div class="primer-define">
        <div class="primer-define-term">Tier 1 &middot; $9M &middot; Restore</div>
        <div class="primer-define-text">The smallest option. Closes the gap and avoids the deepest service reductions in the no-override budget.</div>
      </div>
      <div class="primer-define">
        <div class="primer-define-term">Tier 2 &middot; $12M &middot; Build</div>
        <div class="primer-define-text">Tier 1 plus another $3M to add positions and capacity beyond just restoring services.</div>
      </div>
      <div class="primer-define">
        <div class="primer-define-term">Tier 3 &middot; $15M &middot; Invest</div>
        <div class="primer-define-text">Tier 2 plus another $3M for capital and longer-term investments.</div>
      </div>
      <p>Each tier <em>contains</em> the ones below it. If Tier 3 doesn't get a majority but Tier 2 does, the override is $12M. If only Tier 1 gets a majority, it's $9M. If none do, it's zero.</p>
      <div class="primer-key">
        Voters aren't picking yes or no. They're picking how much, with a built-in tiebreaker that defaults to the higher tier when more people support it.
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Add tier-amount citations**

For each of the three tier define-terms, add the corresponding `<sup class="cite">` that appears next to the same dollar amount in `what-is-the-override.html`. Paste each one immediately after the dollar amount inside the `.primer-define-term` div.

- [ ] **Step 3: Em-dash scan and commit**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
git add override-primer.html
git commit -m "Add chapter 04 (three tiers) to override-primer"
```

---

## Task 9: Chapter 05 — What it costs

**Files:**
- Modify: `override-primer.html`

**Citation reuse:** Per-household dollar impact for a $1M home (and median home if different) lives in `super-summary.html` or in `charts/override_calculator.html`. Open `super-summary.html`, find the existing per-tier cost table or summary numbers, and copy them in along with their citation markers.

- [ ] **Step 1: Look up the actual cost numbers**

```bash
grep -n '\$1M\|$1,000,000\|median home\|per year\|per tier' super-summary.html | head -20
```

Expected: rows showing per-tier dollar impact for representative home values. Note the values and their associated `<sup>` citation IDs.

- [ ] **Step 2: Replace `<!-- CHAPTER 05 -->` with**

```html
  <section class="primer-chapter" id="ch5">
    <div class="primer-chapter-header">
      <div class="primer-chapter-marker">
        <div class="primer-chapter-num">05</div>
        <div class="primer-chapter-tag">What it costs</div>
      </div>
      <div>
        <h2 class="primer-chapter-title">For a $1M home, the override adds roughly [TIER1]–[TIER3] per year.</h2>
        <p class="primer-chapter-lead">The exact number depends on which tier passes and on what your home is assessed at.</p>
      </div>
    </div>
    <div class="primer-chapter-body">
      <p class="primer-question">And if it fails?</p>
      <p>For a property assessed at $1,000,000, the per-year tax increase is approximately:</p>
      <div class="primer-define">
        <div class="primer-define-term">Tier 1 &middot; $9M</div>
        <div class="primer-define-text">~ $[TIER1] per year</div>
      </div>
      <div class="primer-define">
        <div class="primer-define-term">Tier 2 &middot; $12M</div>
        <div class="primer-define-text">~ $[TIER2] per year</div>
      </div>
      <div class="primer-define">
        <div class="primer-define-term">Tier 3 &middot; $15M</div>
        <div class="primer-define-text">~ $[TIER3] per year</div>
      </div>
      <p>The full per-home calculator (any home value, any tier) lives at <a href="charts/override_calculator.html">What does it cost me?</a>.</p>
    </div>
  </section>
```

- [ ] **Step 3: Replace the [TIER1] / [TIER2] / [TIER3] placeholders with actual numbers**

Use Edit to substitute the three placeholders with the values found in Step 1. Add citation markers from `super-summary.html` for each value.

- [ ] **Step 4: Em-dash scan**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
grep -n '\[TIER' override-primer.html && echo "FAIL: placeholder not replaced" || echo "placeholders replaced"
```

Both checks must pass.

- [ ] **Step 5: Commit**

```bash
git add override-primer.html
git commit -m "Add chapter 05 (what it costs) to override-primer"
```

---

## Task 10: Chapter 06 — Either way

**Files:**
- Modify: `override-primer.html`

**Citation reuse:** No-override budget contents live on `no-override-budget.html`. Reuse a 1-2 line summary of the headline reductions with the corresponding citation marker.

- [ ] **Step 1: Replace `<!-- CHAPTER 06 -->` with**

```html
  <section class="primer-chapter primer-chapter--alt" id="ch6">
    <div class="primer-chapter-header">
      <div class="primer-chapter-marker">
        <div class="primer-chapter-num">06</div>
        <div class="primer-chapter-tag">Either way</div>
      </div>
      <div>
        <h2 class="primer-chapter-title">Both outcomes are real, and both have already been mapped out.</h2>
        <p class="primer-chapter-lead">The override-passes scenario is the proposed FY27 budget. The override-fails scenario is the no-override budget that's already been published.</p>
      </div>
    </div>
    <div class="primer-chapter-body">
      <p class="primer-question">So what's the actual disagreement?</p>
      <p><strong>If the override passes:</strong> the new tax baseline takes effect with FY27 (bills change in fall 2026). The funded items follow the chosen tier's plan.</p>
      <p><strong>If the override fails:</strong> the town runs on the published no-override budget. That budget closes the gap through service reductions, position eliminations, and program cuts in both town and schools. The full list is on <a href="no-override-budget.html">the no-override budget page</a>.</p>
      <div class="primer-key">
        Neither outcome is a void. Both are concrete plans that exist on paper today. The vote is a choice between two budgets, not between a budget and uncertainty.
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Em-dash scan and commit**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
git add override-primer.html
git commit -m "Add chapter 06 (either way) to override-primer"
```

---

## Task 11: Both-sides distillation block

**Files:**
- Modify: `override-primer.html`

This is the most editorially loaded section on the page. The two paragraphs must be **equal length, equal tone**, and every claim in either must already be backed by citations on `the-debate.html`.

- [ ] **Step 1: Replace `<!-- BOTH SIDES -->` with the structural markup**

```html
  <section class="primer-bothsides" id="both-sides">
    <h2>Where the disagreement is.</h2>
    <p class="primer-bothsides-framing">Each side's strongest version, distilled. The full debate, with the six dividing lines residents argue over, lives on <a href="the-debate.html">the debate page</a>.</p>
    <div class="primer-bothsides-grid">
      <div class="perspective perspective--for">
        <div class="perspective-label">Strongest case for the override</div>
        <p>[FOR_PARAGRAPH — see Step 2]</p>
      </div>
      <div class="perspective perspective--against">
        <div class="perspective-label">Strongest case against the override</div>
        <p>[AGAINST_PARAGRAPH — see Step 3]</p>
      </div>
    </div>
    <p class="primer-bothsides-cta"><a href="the-debate.html">&rarr; See all six dividing lines on the debate page</a></p>
  </section>
```

- [ ] **Step 2: Draft the FOR paragraph (90-120 words)**

Open `the-debate.html` and read the six `.perspective--for` blocks (search for `perspective--for`). Distill their strongest threads into a single paragraph that:
- Acknowledges the structural deficit is real and forecast-driven
- Explains why "spend less" inside the cap leads to material service damage (not discipline)
- Notes the override is the only permanent mechanism inside Prop 2½ for matching revenue to recurring costs

Length target: 90-120 words. Replace `[FOR_PARAGRAPH — see Step 2]` with the drafted paragraph.

- [ ] **Step 3: Draft the AGAINST paragraph (90-120 words)**

Open `the-debate.html` and read the six `.perspective--against` blocks. Distill their strongest threads into a single paragraph that:
- Acknowledges costs are rising but argues the town has not exhausted alternatives or restraint
- Surfaces the "one-time reset vs. recurring ask" concern (today's override sets next year's higher baseline)
- Names the trust dimension (who's asking, what residents have been told, residents' right to scrutinize)

Length target: 90-120 words, **within ±10 words** of the FOR paragraph. Replace `[AGAINST_PARAGRAPH — see Step 3]` with the drafted paragraph.

- [ ] **Step 4: Equal-length and tone check**

```bash
# Word count for each paragraph (rough)
awk '/perspective--for/,/<\/div>/' override-primer.html | grep -oE '[A-Za-z]+' | wc -w
awk '/perspective--against/,/<\/div>/' override-primer.html | grep -oE '[A-Za-z]+' | wc -w
```

Expected: the two counts within ±15. If skewed, edit the longer one down or the shorter one up before committing.

- [ ] **Step 5: Em-dash scan and placeholder check**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
grep -n '\[FOR_PARAGRAPH\|\[AGAINST_PARAGRAPH' override-primer.html && echo "FAIL: placeholder not replaced" || echo "placeholders replaced"
```

Both must pass.

- [ ] **Step 6: Commit**

```bash
git add override-primer.html
git commit -m "Add both-sides distillation block to override-primer"
```

---

## Task 12: TL;DR card

**Files:**
- Modify: `override-primer.html`

The "disagreement" line in the TL;DR is the single most editorially loaded sentence on the page. Review carefully.

- [ ] **Step 1: Look up the cost range from Chapter 05**

The "$XXX-$XXX per year" line in the TL;DR uses the same per-$1M-home values you wrote in Chapter 05 (Task 9). The TL;DR's range goes from the Tier 1 value to the Tier 3 value.

- [ ] **Step 2: Replace `<!-- TL;DR -->` with**

```html
  <section class="primer-tldr">
    <div class="primer-tldr-card">
      <div class="primer-tldr-eyebrow">TL;DR &middot; screenshot this</div>
      <h2>The override, in five lines.</h2>
      <dl>
        <dt>The vote</dt>
        <dd>June 9, 2026. Annual Town Election. Yes/no on a Prop 2&frac12; operating override.</dd>

        <dt>The gap</dt>
        <dd>$8.47M projected deficit for FY27. Forecast a year in advance.</dd>

        <dt>The ask</dt>
        <dd>Three nested tiers: $9M / $12M / $15M. Highest tier with a majority sets the amount.</dd>

        <dt>The cost</dt>
        <dd>At a $1M home, roughly $[TIER1]–$[TIER3] per year depending on tier.</dd>

        <dt>The disagreement</dt>
        <dd>Both sides agree costs outpace revenue. They disagree on whether the answer is more revenue or fewer expenses.</dd>
      </dl>
    </div>
  </section>
```

- [ ] **Step 3: Replace [TIER1] and [TIER3] with the actual values from Chapter 05**

Use Edit to substitute both placeholders.

- [ ] **Step 4: Em-dash scan, placeholder check, commit**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
grep -n '\[TIER' override-primer.html && echo "FAIL" || echo "placeholders replaced"
git add override-primer.html
git commit -m "Add TL;DR card to override-primer"
```

---

## Task 13: Go-deeper footer

**Files:**
- Modify: `override-primer.html`

- [ ] **Step 1: Replace `<!-- GO DEEPER -->` with**

```html
  <section class="primer-godeeper">
    <div class="primer-godeeper-label">Go deeper</div>
    <div class="primer-godeeper-grid">
      <a class="primer-godeeper-card" href="what-is-the-override.html">
        <div class="primer-godeeper-card-title">What is the override?</div>
        <div class="primer-godeeper-card-desc">The full reference: tier mechanics, history back to 2005, key terms.</div>
      </a>
      <a class="primer-godeeper-card" href="where-has-the-money-gone.html">
        <div class="primer-godeeper-card-title">Where has the money gone?</div>
        <div class="primer-godeeper-card-desc">Where the deficit came from: healthcare, pensions, the CPI squeeze.</div>
      </a>
      <a class="primer-godeeper-card" href="no-override-budget.html">
        <div class="primer-godeeper-card-title">The no-override budget</div>
        <div class="primer-godeeper-card-desc">What the FY27 budget looks like if the override fails.</div>
      </a>
      <a class="primer-godeeper-card" href="the-debate.html">
        <div class="primer-godeeper-card-title">Both sides of the debate</div>
        <div class="primer-godeeper-card-desc">All six dividing lines residents argue over, with the strongest version of each side.</div>
      </a>
      <a class="primer-godeeper-card" href="super-summary.html">
        <div class="primer-godeeper-card-title">Per-household tax impact</div>
        <div class="primer-godeeper-card-desc">What each tier costs at every home value.</div>
      </a>
    </div>
  </section>
```

- [ ] **Step 2: Em-dash scan and commit**

```bash
grep -nE '\-\-|&mdash;|—' override-primer.html | grep -v 'var(--' || echo "clean"
git add override-primer.html
git commit -m "Add go-deeper footer to override-primer"
```

---

## Task 14: Add the nav link

**Files:**
- Modify: `_includes/nav.html` (insert one line in the "Vote" dropdown)

- [ ] **Step 1: Insert the new nav entry as the first item in the Vote dropdown**

Use Edit to find this block in `_includes/nav.html`:

```html
      <div class="nav-dropdown-menu">
        <a href="{{ '/' | relative_url }}what-is-the-override.html"{% if page.url == '/what-is-the-override.html' %} aria-current="page"{% endif %}>What is the override?</a>
```

And replace with:

```html
      <div class="nav-dropdown-menu">
        <a href="{{ '/' | relative_url }}override-primer.html"{% if page.url == '/override-primer.html' %} aria-current="page"{% endif %}>5-minute primer</a>
        <a href="{{ '/' | relative_url }}what-is-the-override.html"{% if page.url == '/what-is-the-override.html' %} aria-current="page"{% endif %}>What is the override?</a>
```

- [ ] **Step 2: Verify the change**

```bash
grep -n "override-primer\|what-is-the-override" _includes/nav.html | head -5
```

Expected: `override-primer.html` appears one line before `what-is-the-override.html` in the Vote dropdown.

- [ ] **Step 3: Em-dash scan and commit**

```bash
grep -nE '\-\-|&mdash;|—' _includes/nav.html | grep -v 'var(--' || echo "clean"
git add _includes/nav.html
git commit -m "Add 5-minute primer link to Vote nav dropdown"
```

---

## Task 15: Push, get Cloudflare preview URL, and eyeball

**Files:** none (deployment + visual verification)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin override-primer-spec
```

If push fails on auth, use the inline PAT URL form per `feedback_pat_first_push.md`:

```bash
PAT=$(grep GITHUB_TOKEN /Users/agbaber/marblehead/.env | cut -d= -f2)
git push -u "https://${PAT}@github.com/agbaber/marblehead.git" override-primer-spec
```

- [ ] **Step 2: Open a draft PR so the preview workflow fires**

```bash
gh pr create --draft --title "Add /override-primer.html (5-minute Morpho-style primer)" --body "$(cat <<'EOF'
## Summary
- Adds `/override-primer.html`, a short narrative primer on the FY27 override.
- Adds a "5-minute primer" entry to the Vote nav dropdown.
- Both-sides recap distills the six dividing lines from `the-debate.html` into a single two-column card.
- TL;DR card at the bottom is screenshot-shareable.
- No edits to `assets/site.css`. All CSS scoped under `.primer`. No new sources, no new images, no new JS.

Spec: `docs/superpowers/specs/2026-05-01-override-primer-design.md`
Plan: `docs/superpowers/plans/2026-05-01-override-primer.md`

## Test plan
- [ ] Cloudflare preview loads
- [ ] Hero / TOC / 6 chapters / both-sides / TL;DR / go-deeper all render
- [ ] Sticky chapter marker works ≥880px and inlines on mobile
- [ ] Both-sides cards stack on mobile (~720px breakpoint)
- [ ] Dark-mode toggle: every section legible, no hardcoded colors leaking
- [ ] TL;DR card screenshots cleanly on a phone
- [ ] Sources block auto-injects at the bottom
- [ ] Nav link works from another page

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for the preview comment, then post the URL back to the user**

After the `preview.yml` workflow finishes (~2-3 min), find the sticky preview comment:

```bash
PR_NUM=$(gh pr view --json number -q .number)
gh api "repos/agbaber/marblehead/issues/${PR_NUM}/comments" \
  --jq '.[] | select(.body | startswith("### Preview")) | .body' \
  | head -20
```

Pull the **Branch URL** out of that comment and report both the PR URL and the Branch preview URL to the user. Per CLAUDE.md, asking the user to eyeball requires posting the preview URL, not just the PR link.

---

## Task 16: Visual verification on preview (after Task 15 returns the URL)

**Files:** none

- [ ] **Step 1: Eyeball the preview URL on desktop**

Visit the Branch URL. Confirm:
- Hero renders with eyebrow / title / lead / meta row
- TOC links scroll smoothly to each chapter
- Each chapter has its sticky number marker on the left at ≥880px
- Alternating chapter backgrounds are visible
- Both-sides cards render side-by-side, equal heights
- TL;DR card has the bordered box with the 5-line dl
- Go-deeper grid is responsive
- Sources block auto-appears at the bottom (citations.js working)

- [ ] **Step 2: Eyeball on mobile (DevTools or actual phone)**

Resize to 375px width or use a phone:
- Sticky chapter marker collapses to inline above the title
- Both-sides cards stack vertically
- Go-deeper cards reflow to one or two columns
- TL;DR card is screenshot-shareable

- [ ] **Step 3: Toggle dark mode**

Use system dark mode or DevTools color-scheme emulation. Every section must be legible. No washed-out text, no contrast failures. If anything is broken, the cause is almost certainly a `var(--c-*)` token used in a context where the dark variant maps differently — adjust and recommit.

- [ ] **Step 4: Run the smoke test against the preview**

```bash
SITE="<branch-preview-URL>" npm run test:remote 2>/dev/null || \
  SITE="<branch-preview-URL>" node tests/smoke-test.mjs
```

Expected: 52 PASS / 0 FAIL (the existing smoke contract still holds; the new page doesn't break anything).

- [ ] **Step 5: If anything needs fixing**

Make the fix locally, commit with a focused message, push. The preview comment updates automatically. Re-eyeball.

---

## Task 17: Mark PR ready and request user review

**Files:** none

- [ ] **Step 1: Mark the PR ready for review (out of draft)**

```bash
gh pr ready
```

- [ ] **Step 2: Post the preview URL back to the user**

In the chat, give the user both:
1. The PR URL
2. The Branch preview URL (from the sticky preview comment)

Ask for a live eyeball before merge. Do not merge until the user explicitly approves. Per CLAUDE.md: default to manual merge, no `--auto`, only when the user explicitly says "merge it".

---

## Out of scope (do not do in this PR)

- Retargeting the homepage hero or "start here" CTAs at the new primer page.
- Any edits to `the-debate.html`, `what-is-the-override.html`, `super-summary.html`, `where-has-the-money-gone.html`, `no-override-budget.html`.
- Adding `override-primer.html` to `data/DATA_CATALOG.md` (not a data page).
- Reorganizing the Vote nav dropdown beyond inserting one new first item.
- Adding the page to other nav dropdowns or to the homepage explorer.
- Any new images, new JS, new CSS in `assets/site.css`, new data files.
