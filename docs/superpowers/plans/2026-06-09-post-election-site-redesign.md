# Post-election site redesign implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip override-season scaffolding from marbleheaddata.org and consolidate around five pillars (Primer / Checkbook / Data / Meetings / Act), reducing ~50 pages to ~25.

**Architecture:** Jekyll 3.10 static site, Cloudflare Pages deploys. Redirects use the existing `_layouts/redirect.html` pattern (meta-refresh, soft redirect). Each task is one PR off `main`, executed in its own git worktree, with smoke test (`npm run test:local`) and a Playwright screenshot at `proof/<branch>.png` per the box-wide Proof-of-Work rule.

**Tech Stack:** Jekyll 3.10, Liquid templates, vanilla JS/CSS, Playwright (Chromium), Cloudflare Pages, `_layouts/redirect.html` for soft redirects.

**Spec:** `docs/superpowers/specs/2026-06-09-post-election-site-redesign-design.md`

**Sequencing rule:** Build new front doors **before** deleting / redirecting old pages, so the site never has dangling links. Phases run in order; tasks within a phase can be parallelized.

---

## Conventions for every task

Each task is one PR. Standard task flow:

1. **Create a worktree from main:**
   ```bash
   cd ~/marblehead
   git fetch origin main
   git worktree add .claude/worktrees/<task-slug> -b post-election/<task-slug> origin/main
   cd .claude/worktrees/<task-slug>
   bundle install   # if first time in this worktree
   npm install      # if first time in this worktree
   ```

2. **Make the change.** Exact file edits listed per task.

3. **Build + smoke test:**
   ```bash
   npm run test:local
   ```
   Expected: `52 pass / 0 fail` (or the new count after smoke-test edits, noted per task).

4. **Capture proof screenshot.** Start dev server, capture above-fold, kill server:
   ```bash
   bundle exec jekyll serve --port 4000 &
   sleep 3
   mkdir -p proof
   npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
     "http://localhost:4000/<page>" "proof/$(git branch --show-current).png"
   kill %1
   ```

5. **Commit + push + open PR.** Match the existing commit style (lower-case prefix, scope, one-line summary):
   ```bash
   git add <files> proof/*.png
   git commit -m "<scope>: <summary>"
   git push -u origin HEAD
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   ## Summary
   <bullets>

   ## Proof of Work
   ![preview](proof/<branch>.png)

   ## Test plan
   - [ ] smoke test green
   - [ ] preview URL renders

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

6. **Hand off to user with preview URL.** Wait for the `preview-url` sticky comment from `.github/workflows/preview.yml`, fetch its **Branch URL**, post it back with a one-line "ready for review."

---

## Phase 1 — Build the new front doors

These tasks add new URLs without touching anything that's currently visible in the nav. Live site keeps working. Run in parallel.

---

### Task 1: Promote Checkbook to `/checkbook/`

**Files:**
- Modify: `charts/checkbook.html` (replace with redirect stub)
- Create: `checkbook.html` (new top-level page with `permalink: /checkbook/`)
- Modify: `tests/smoke-test.mjs` (add a check that `/checkbook/` loads; optional)

**Worktree slug:** `post-election/checkbook-permalink`

- [ ] **Step 1: Read the existing `/charts/checkbook.html`.**
  Capture the full file content; you'll move all of it to the new location.

  ```bash
  cp charts/checkbook.html /tmp/checkbook-source.html
  ```

- [ ] **Step 2: Create `checkbook.html` at the repo root.**
  Take the full file contents from `/tmp/checkbook-source.html` and write them to `checkbook.html`. In the frontmatter, add `permalink: /checkbook/` so the URL is the folder form.

  Frontmatter block to use at the top of the new file:

  ```yaml
  ---
  title: "Town checkbook"
  permalink: /checkbook/
  scripts: [citations]
  og_title: "Marblehead FY26 Checkbook & Budget Explorer"
  og_description: "FY26 spending, budget, and pacing for Marblehead. $206.1M adopted across all funds, $127.3M annual operating, $98.1M in vendor checks through May 29. Budget vs actual by Fund, Department, Category, Division, and Object."
  og_url: https://marbleheaddata.org/checkbook/
  ---
  ```

  Keep everything below the frontmatter identical to the source.

- [ ] **Step 3: Replace `charts/checkbook.html` with a redirect stub.**

  ```yaml
  ---
  layout: redirect
  title: "Redirecting to /checkbook/"
  redirect_to: /checkbook/
  sitemap: false
  ---
  ```

- [ ] **Step 4: Audit internal links to the old URL.**

  ```bash
  grep -rn "charts/checkbook" --include="*.html" --include="*.md" | grep -v "_site/" | grep -v "proof/"
  ```
  Update each in-repo link to `/checkbook/`. Common locations: `browse.html`, `_includes/nav.html` (none currently), any homepage tile. Do not edit `proof/` files.

- [ ] **Step 5: Build + smoke test + screenshot.**

  ```bash
  npm run test:local
  # Expected: smoke test green (no checkbook test currently)
  bundle exec jekyll serve --port 4000 &
  sleep 3
  mkdir -p proof
  npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
    "http://localhost:4000/checkbook/" "proof/post-election-checkbook-permalink.png"
  # Also verify the old URL redirects:
  curl -sI http://localhost:4000/charts/checkbook.html | head -5
  # Expected: 200 with meta-refresh in body (it's a soft redirect)
  kill %1
  ```

- [ ] **Step 6: Commit, push, open PR.**

  ```bash
  git add checkbook.html charts/checkbook.html proof/post-election-checkbook-permalink.png
  git commit -m "checkbook: promote to /checkbook/ permalink, redirect from /charts/"
  git push -u origin HEAD
  gh pr create --title "checkbook: promote to /checkbook/ permalink" --body "$(cat <<'EOF'
  ## Summary
  - Move /charts/checkbook.html to /checkbook/ permalink (top-level flagship URL)
  - Soft redirect from old /charts/checkbook.html via the existing redirect layout
  - Update internal links to point at the new URL

  ## Proof of Work
  ![preview](proof/post-election-checkbook-permalink.png)

  ## Test plan
  - [ ] /checkbook/ renders identically to the old /charts/checkbook.html
  - [ ] /charts/checkbook.html shows the redirect stub and navigates to /checkbook/

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```

---

### Task 2: Convert `browse.html` into the `/data/` hub

**Files:**
- Create: `data/index.html` (new hub page with `permalink: /data/`)
- Modify: `browse.html` (replace with redirect stub)

**Worktree slug:** `post-election/data-hub`

- [ ] **Step 1: Read current `browse.html`.**

  ```bash
  cp browse.html /tmp/browse-source.html
  ```

- [ ] **Step 2: Create `data/index.html`.**
  Copy content from `/tmp/browse-source.html`. Rewrite the frontmatter and the page heading. Reorganize the page cards into two banded sections at the top: a "Featured" row with Checkbook + Debt as two large tiles, and a "Charts" row below with the 5 surviving charts. Keep the existing "All topics" list below as the long index.

  Frontmatter:

  ```yaml
  ---
  layout: home
  title: "Data"
  permalink: /data/
  community_pulse: off-sections
  og_title: "Marblehead Budget Data - data hub"
  og_description: "Every chart, calculator, and source document on marbleheaddata.org, organized by topic."
  og_type: website
  og_url: https://marbleheaddata.org/data/
  ---
  ```

  Body: keep the existing topic groupings. Add at the top, above any existing content:

  ```html
  <section class="data-featured">
    <h2>Featured</h2>
    <div class="data-featured-grid">
      <a class="data-featured-tile" href="/checkbook/">
        <div class="tile-eye">SPENDING</div>
        <h3>Town Checkbook</h3>
        <p>FY26 spending, budget, and pacing. Drill into every department.</p>
      </a>
      <a class="data-featured-tile" href="/town-debt.html">
        <div class="tile-eye">DEBT</div>
        <h3>Town Debt</h3>
        <p>How Marblehead's debt was incurred, managed, and compared to peers.</p>
      </a>
    </div>
  </section>
  ```

  Add CSS for `.data-featured` / `.data-featured-tile` to `assets/site.css` (scoped to `body.data-page` or via a `<style>` block in the file head). Match the existing tile-card design idiom — see `marblehead-101/index.html` for an example of the eyebrow + h3 + p tile pattern.

- [ ] **Step 3: Replace `browse.html` with a redirect stub.**

  ```yaml
  ---
  layout: redirect
  title: "Redirecting to /data/"
  redirect_to: /data/
  sitemap: false
  ---
  ```

- [ ] **Step 4: Update in-repo links from `/browse.html` to `/data/`.**

  ```bash
  grep -rn "browse\.html\|/browse" --include="*.html" --include="*.md" | grep -v "_site/" | grep -v "proof/"
  ```
  Update each. Notable: `_includes/nav.html` (the current "Browse" link will be replaced in Phase 3 / Task 8; for now point it at `/data/`).

- [ ] **Step 5: Build + smoke test + screenshot.**

  ```bash
  npm run test:local
  bundle exec jekyll serve --port 4000 &
  sleep 3
  mkdir -p proof
  npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
    "http://localhost:4000/data/" "proof/post-election-data-hub.png"
  kill %1
  ```

- [ ] **Step 6: Commit, push, open PR.** Title: `data: rename browse → /data/, add Featured row (Checkbook + Debt)`. PR body should call out the Featured row addition and link the screenshot.

---

### Task 3: Build the `/2026-override/` archive (skeleton)

**Files:**
- Create: `2026-override/index.html`

**Worktree slug:** `post-election/override-archive`

This task creates the archive structure and pulls salvaged content from the dying pages. Six sections per the spec. Results section stays empty for Task 14 (post-vote fill-in).

- [ ] **Step 1: Read all source pages that feed the archive.**

  ```bash
  for f in whats-on-the-ballot.html where-candidates-stand.html what-is-the-override.html two-votes.html cap-vs-cost.html your-true-cost.html the-debate.html no-override-budget.html after-the-no-vote.html marblehead-voting-record.html info-guides.html; do
    echo "=== $f ==="
    head -8 $f
  done
  ```

- [ ] **Step 2: Create `2026-override/index.html`.**
  Frontmatter:

  ```yaml
  ---
  title: "The 2026 Marblehead override: archive"
  permalink: /2026-override/
  scripts: [citations]
  og_title: "Marblehead 2026 override archive"
  og_description: "The FY27 override cycle in one place: the two ballot questions, the candidates, both sides of the debate, the result, and what came after."
  og_url: https://marbleheaddata.org/2026-override/
  ---
  ```

  Page body has six `<section>` blocks with these h2s in this order:

  1. `<h2>The ballot</h2>` — pull from `whats-on-the-ballot.html` and `what-is-the-override.html`. Two ballot questions, the tier structure, $X per household at $Y assessed value.
  2. `<h2>The candidates</h2>` — pull from `where-candidates-stand.html`. Candidate list + position summaries.
  3. `<h2>The debate</h2>` — pull from `the-debate.html`. The six dividing lines compressed to a scannable list. Both sides on each.
  4. `<h2>Marblehead's override history</h2>` — pull from `marblehead-voting-record.html` and `after-the-no-vote.html`. Timeline: 2022, 2023, 2026, with consequences after each no-vote.
  5. `<h2>The result</h2>` — leave as `<p>(Filled in after the vote — Task 14.)</p>`. Skeleton only.
  6. `<h2>What happened next</h2>` — leave as `<p>(Filled in over the weeks after the vote — Task 14.)</p>`. Skeleton only.

  Compression rule per section: 50% of the source length. The archive is for civic memory, not for re-running the argument. Cut redundancy, keep the facts.

- [ ] **Step 3: Embed the override history chart in section 4.**
  Add an iframe or link to `/charts/override_history.html` inside section 4.

- [ ] **Step 4: Build + smoke test + screenshot full-page.**

  ```bash
  npm run test:local
  bundle exec jekyll serve --port 4000 &
  sleep 3
  mkdir -p proof
  npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
    --full-page "http://localhost:4000/2026-override/" "proof/post-election-archive-full.png"
  npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
    "http://localhost:4000/2026-override/" "proof/post-election-archive.png"
  kill %1
  ```

- [ ] **Step 5: Commit, push, open PR.** Title: `archive: build /2026-override/ FY27 cycle archive (skeleton)`. Note in the PR body that sections 5 and 6 are stubs to be filled in Task 14.

---

## Phase 2 — Content folds

These tasks move content into surviving pages. They do **not** delete the source pages (Phase 4 handles that). They preserve all content; nothing is lost.

Run after Phase 1 is merged.

---

### Task 4: Fold `fiscal-goals` into primer chapter 06

**Files:**
- Modify: `marblehead-101/06-why-the-gap-keeps-coming-back.html` (add sidebar)
- Leave: `fiscal-goals.html` unchanged (Phase 4 will stub it)

**Worktree slug:** `post-election/fold-fiscal-goals`

- [ ] **Step 1: Read `fiscal-goals.html`.** Identify the three measurable milestones (identify savings, shift the crossover, get to parallel).

- [ ] **Step 2: Add a sidebar in `marblehead-101/06-why-the-gap-keeps-coming-back.html`.**
  Look for the chapter's existing structure (likely an `.m101-body` or similar wrapper). Add a `<aside class="m101-sidebar">` block at a logical break in the chapter with the three milestones. Match the styling already used in primer sidebars; consult `_layouts/m101.html` for the available classes.

- [ ] **Step 3: Build + smoke test + screenshot.** Match the `/marblehead-101/06-why-the-gap-keeps-coming-back/` URL.

- [ ] **Step 4: Commit, push, open PR.** Title: `primer-06: absorb fiscal-goals milestones sidebar`.

---

### Task 5: Fold `prop25-story` into primer chapter 07

**Files:**
- Modify: `marblehead-101/07-overrides.html` (add Prop 2.5 statewide context to lead-in)

**Worktree slug:** `post-election/fold-prop25`

- [ ] **Step 1: Read `prop25-story.html` and identify the 3-4 key statewide-history beats** (1980 ballot, 2.5% cap mechanics, override mechanism added, statewide adoption pattern).

- [ ] **Step 2: Add a "Where Prop 2.5 came from" subsection** to `marblehead-101/07-overrides.html`, near the top of the chapter, before the Marblehead-specific override mechanics. Three to five short paragraphs.

- [ ] **Step 3: Build + smoke test + screenshot.**

- [ ] **Step 4: Commit, push, open PR.** Title: `primer-07: absorb Prop 2.5 statewide history`.

---

### Task 6: Fold `what-has-the-town-done` + `why-not-elsewhere` into `how-we-got-here`

**Files:**
- Modify: `how-we-got-here.html` (add two new sections)

**Worktree slug:** `post-election/expand-how-we-got-here`

- [ ] **Step 1: Read source pages.**

  ```bash
  head -100 what-has-the-town-done.html
  head -100 why-not-elsewhere.html
  ```

- [ ] **Step 2: Read `how-we-got-here.html`** to see the existing section structure and where two new sections fit thematically.

- [ ] **Step 3: Add section "What the town has already done to save"** — cost-control inventory from `what-has-the-town-done.html`, compressed by ~30%.

- [ ] **Step 4: Add section "Why some MA towns run overrides and others don't"** — revenue-alternatives walkthrough from `why-not-elsewhere.html`, compressed by ~30%.

- [ ] **Step 5: Build + smoke test + screenshot.**

- [ ] **Step 6: Commit, push, open PR.** Title: `how-we-got-here: absorb what-has-the-town-done + why-not-elsewhere`.

---

### Task 7: (Conditional) Merge `town-budget` + `where-has-the-money-gone` into `town-finances`

**Spec note:** the implementer should reconsider this merge. `town-budget.html` is an interactive FY27 line-item explorer; `where-has-the-money-gone.html` is a long-form FY15-FY26 historical narrative. If the merged page would be a Frankenstein, **skip this task** and update the spec to mark both pages as kept-as-is.

**Decision step:**

- [ ] **Step 0: Decide.** Read both pages end-to-end:

  ```bash
  wc -l town-budget.html where-has-the-money-gone.html
  ```

  Read each. If they are essentially "interactive tool" vs. "narrative" and the merge produces a worse reader experience, skip this task. Edit the spec (`docs/superpowers/specs/2026-06-09-post-election-site-redesign-design.md`) to remove the merge from the "Fold" matrix and add both pages to the "11 content pages" table. Commit the spec edit, skip remaining steps in this task.

If proceeding:

**Files:**
- Create: `town-finances.html`
- Modify: `town-budget.html`, `where-has-the-money-gone.html` (turn into redirect stubs in Phase 4)

**Worktree slug:** `post-election/town-finances-merge`

- [ ] **Step 1: Plan the merged page structure.** Top half: "This year" — the line-item explorer from town-budget. Bottom half: "How we got here" — the FY15-FY26 historical narrative from where-has-the-money-gone. Add a clear divider between the two halves.

- [ ] **Step 2: Create `town-finances.html`** with frontmatter:

  ```yaml
  ---
  title: "Marblehead town finances"
  scripts: [citations]
  og_title: "Marblehead town finances"
  og_description: "FY27 proposed budget line-by-line, plus a decade of historical spending."
  og_url: https://marbleheaddata.org/town-finances.html
  ---
  ```

- [ ] **Step 3: Embed the interactive line-item explorer** from town-budget.html (move all `<script>` and `<style>` and table-rendering markup over). Carry forward all JS file references in `scripts:`.

- [ ] **Step 4: Append the historical narrative** from where-has-the-money-gone.html below a horizontal rule + h2 "How we got here."

- [ ] **Step 5: Build + smoke test + screenshot (full-page).**

- [ ] **Step 6: Commit, push, open PR.** Title: `town-finances: merge town-budget + where-has-the-money-gone`.

---

## Phase 3 — Visible cutover

After this phase, the site **looks** redesigned, even though many old pages still exist (Phase 4 cleans them up). The nav and homepage are the visible changes.

---

### Task 8: Rewrite nav to five pillars

**Files:**
- Modify: `_includes/nav.html`

**Worktree slug:** `post-election/nav-rewrite`

- [ ] **Step 1: Read current `_includes/nav.html`** to understand the existing link structure and active-page logic.

- [ ] **Step 2: Replace the nav-link block.** Current:

  ```html
  <a class="nav-link" href="{{ '/' | relative_url }}marblehead-101/"...>Primer</a>
  <a class="nav-link" href="{{ '/' | relative_url }}whats-on-the-ballot.html"...>Ballot</a>
  <a class="nav-link" href="{{ '/' | relative_url }}where-candidates-stand.html"...>Candidates</a>
  <a class="nav-link" href="{{ '/' | relative_url }}explore.html"...>Questions</a>
  <a class="nav-link" href="{{ '/' | relative_url }}browse.html"...>Browse</a>
  <a class="nav-link" href="{{ '/' | relative_url }}subscribe/"...>Subscribe</a>
  ```

  Replace with:

  ```html
  <a class="nav-link" href="{{ '/' | relative_url }}marblehead-101/"{% if page.url contains '/marblehead-101/' %} aria-current="page"{% endif %}>Primer</a>
  <a class="nav-link" href="{{ '/' | relative_url }}checkbook/"{% if page.url == '/checkbook/' %} aria-current="page"{% endif %}>Checkbook</a>
  <a class="nav-link" href="{{ '/' | relative_url }}data/"{% if page.url == '/data/' %} aria-current="page"{% endif %}>Data</a>
  <a class="nav-link" href="{{ '/' | relative_url }}meetings/"{% if page.url contains '/meetings/' %} aria-current="page"{% endif %}>Meetings</a>
  <a class="nav-link" href="{{ '/' | relative_url }}what-can-we-do.html"{% if page.url == '/what-can-we-do.html' %} aria-current="page"{% endif %}>Act</a>
  ```

  Subscribe is removed from the nav (will be CTA on `/meetings/`).

- [ ] **Step 3: Browser-test in headless Chromium + WebKit.** The Marblehead CLAUDE.md flags that nav CSS changes get a Playwright nav-test pass.

  ```bash
  npm run test:local
  # If tests/nav-test.mjs exists, also run:
  ls tests/nav-test.mjs && node tests/nav-test.mjs
  ```

- [ ] **Step 4: Build + smoke test + screenshot homepage.**

  ```bash
  bundle exec jekyll serve --port 4000 &
  sleep 3
  mkdir -p proof
  npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
    "http://localhost:4000/" "proof/post-election-nav-rewrite.png"
  kill %1
  ```

- [ ] **Step 5: Commit, push, open PR.** Title: `nav: five-pillar layout (Primer · Checkbook · Data · Meetings · Act)`.

---

### Task 9: Rewrite homepage — Checkbook hero + 5 pillar tiles

**Files:**
- Modify: `index.html`

**Worktree slug:** `post-election/homepage-rewrite`

This is the biggest single page rewrite in the plan. Treat as a fresh build.

- [ ] **Step 1: Snapshot the current index.html** for reference but plan a full rewrite. Do not try to incrementally edit.

  ```bash
  cp index.html /tmp/old-index.html
  wc -l /tmp/old-index.html
  ```

- [ ] **Step 2: Frontmatter:**

  ```yaml
  ---
  title: "Marblehead Budget Data"
  community_pulse: off-sections
  scripts: [citations]
  og_title: "Marblehead Budget Data"
  og_description: "Open data on Marblehead's town and school finances. Spending, debt, meetings, and how to take part."
  og_url: https://marbleheaddata.org/
  ---
  ```

- [ ] **Step 3: Build the hero block.** Use the existing `.home-hero`, `.home-big`, `.home-cap` classes from the old homepage (they survive). Hero content:

  ```html
  <section class="home-hero">
    <p class="home-eye">FY26 spending so far <span class="dot">•</span> as of May 29</p>
    <p class="home-big home-big--cost">$98.1M</p>
    <p class="home-cap">paid out across departments, vendors, and capital projects this fiscal year.</p>
    <p class="home-cap-sub">$127.3M annual operating budget. Drill into every line, by fund, department, category, division, or object.</p>
    <a class="home-deeper" href="/checkbook/">Open the Checkbook</a>
  </section>
  ```

  Note: the $98.1M number must match what's currently shown on `/checkbook/`. Pull the live value at build time if possible, or hardcode and add a comment with the source date.

- [ ] **Step 4: Build the five-tile block** below the hero.

  ```html
  <section class="home-stop home-stop--tinted">
    <div class="home-tiles">
      <a class="home-tile" href="/marblehead-101/">
        <div class="tile-eye">PRIMER</div>
        <h3>How Marblehead's budget works</h3>
        <p>Eight short chapters: how the town is run, where money comes from, where it goes, how the gap keeps reappearing.</p>
      </a>
      <a class="home-tile" href="/checkbook/">
        <div class="tile-eye">CHECKBOOK</div>
        <h3>What the town is spending</h3>
        <p>FY26 vendor checks and budget pacing, drill-down by department.</p>
      </a>
      <a class="home-tile" href="/data/">
        <div class="tile-eye">DATA</div>
        <h3>Charts, tables, and source documents</h3>
        <p>The full catalog: debt, taxes, peer towns, school staffing, voting history.</p>
      </a>
      <a class="home-tile" href="/meetings/">
        <div class="tile-eye">MEETINGS</div>
        <h3>What the boards are actually talking about</h3>
        <p>AI-generated summaries of every Select Board, School Committee, and Finance Committee meeting.</p>
      </a>
      <a class="home-tile" href="/what-can-we-do.html">
        <div class="tile-eye">ACT</div>
        <h3>Questions worth asking</h3>
        <p>A working list of suggestions and questions for the town's finance staff and boards.</p>
      </a>
    </div>
  </section>
  ```

  Add CSS for `.home-tiles` / `.home-tile` (grid, equal heights, hover) inline in the `<style>` block at the top of the page; reuse the existing eyebrow + h3 + p typography tokens.

- [ ] **Step 5: Delete all override-specific homepage sections** from the old file: the override math waterfall, the "two ballot questions" block, the tier carousel, the candidate strip, etc. Anything that mentions "ballot," "override," "tier," "Question 1," "Question 2," "candidate" is out.

- [ ] **Step 6: Build + smoke test.**

  The smoke test currently checks for `.answer-card[data-question="override"]` on the homepage. **This will fail** after the rewrite. Update `tests/smoke-test.mjs`:

  - Remove or rewrite the `testHomepageLoads` block's override-card assertions (lines ~115-145, search for `data-question="override"`).
  - Add new assertions: `.home-hero` exists, five `.home-tile` elements exist, hero number is visible.

  ```bash
  npm run test:local
  ```

- [ ] **Step 7: Screenshot above-fold and full-page.**

  ```bash
  bundle exec jekyll serve --port 4000 &
  sleep 3
  npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
    "http://localhost:4000/" "proof/post-election-homepage.png"
  npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
    --full-page "http://localhost:4000/" "proof/post-election-homepage-full.png"
  kill %1
  ```

- [ ] **Step 8: Commit, push, open PR.** Title: `homepage: Checkbook hero + five-pillar tiles`. PR body should include the above-fold screenshot inline.

---

## Phase 4 — Removal

After this phase, the dead pages still respond to inbound links (via redirect stubs) but their content is gone. Run after Phase 3 is merged.

---

### Task 10: Redirect-stub all dying pages (campaign + folded sources)

**Files modified (each replaced with redirect stub):**

Campaign pages (content has no surviving home; redirect goes to archive or parent):

| File | redirect_to |
|---|---|
| `whats-on-the-ballot.html` | `/2026-override/` |
| `where-candidates-stand.html` | `/2026-override/` |
| `what-is-the-override.html` | `/2026-override/` |
| `two-votes.html` | `/2026-override/` |
| `cap-vs-cost.html` | `/2026-override/` |
| `your-true-cost.html` | `/2026-override/` |
| `no-override-budget.html` | `/2026-override/` |
| `the-debate.html` | `/2026-override/` |
| `explore.html` | `/2026-override/` |
| `super-summary.html` | `/` (already a redirect; verify) |
| `bias-audit.html` | `/about/` |
| `what-you-can-do.html` | `/what-can-we-do.html` |
| `info-guides.html` | `/2026-override/` |
| `question-2-trash.html` | `/2026-override/` |
| `prop25-story.html` | `/marblehead-101/07-overrides/` |
| `after-the-no-vote.html` | `/2026-override/` |

Folded source pages (content was moved in Phase 2 — redirect goes to the page that absorbed it):

| File | redirect_to | Folded by |
|---|---|---|
| `fiscal-goals.html` | `/marblehead-101/06-why-the-gap-keeps-coming-back/` | Task 4 |
| `what-has-the-town-done.html` | `/how-we-got-here.html` | Task 6 |
| `why-not-elsewhere.html` | `/how-we-got-here.html` | Task 6 |
| `marblehead-voting-record.html` | `/2026-override/` | Task 3 (history section) |
| `town-school-admin.html` | `/inside-school-staffing.html` | already folded prior; verify the file still exists |
| `town-budget.html` | `/town-finances.html` | Task 7 — **only stub if Task 7 merged** |
| `where-has-the-money-gone.html` | `/town-finances.html` | Task 7 — **only stub if Task 7 merged** |

**Preflight:** confirm the fold tasks merged before stubbing the sources. If Task 7 was skipped (the implementer decided the merge was a bad fit), do not stub `town-budget.html` or `where-has-the-money-gone.html`.

**Worktree slug:** `post-election/redirect-stub-pages`

- [ ] **Step 1: For each page, replace its full content with the redirect-layout stub.** Template:

  ```yaml
  ---
  layout: redirect
  title: "Redirecting"
  redirect_to: <target>
  sitemap: false
  ---
  ```

  Loop (campaign pages):

  ```bash
  declare -A redirects=(
    [whats-on-the-ballot.html]=/2026-override/
    [where-candidates-stand.html]=/2026-override/
    [what-is-the-override.html]=/2026-override/
    [two-votes.html]=/2026-override/
    [cap-vs-cost.html]=/2026-override/
    [your-true-cost.html]=/2026-override/
    [no-override-budget.html]=/2026-override/
    [the-debate.html]=/2026-override/
    [explore.html]=/2026-override/
    [bias-audit.html]=/about/
    [what-you-can-do.html]=/what-can-we-do.html
    [info-guides.html]=/2026-override/
    [question-2-trash.html]=/2026-override/
    [prop25-story.html]=/marblehead-101/07-overrides/
    [after-the-no-vote.html]=/2026-override/
    [fiscal-goals.html]=/marblehead-101/06-why-the-gap-keeps-coming-back/
    [what-has-the-town-done.html]=/how-we-got-here.html
    [why-not-elsewhere.html]=/how-we-got-here.html
    [marblehead-voting-record.html]=/2026-override/
  )

  # Conditionally add the town-finances merge sources if Task 7 merged
  if grep -q "town-finances" data/ 2>/dev/null || [ -f town-finances.html ]; then
    redirects[town-budget.html]=/town-finances.html
    redirects[where-has-the-money-gone.html]=/town-finances.html
  fi

  # Stub town-school-admin if it still exists
  if [ -f town-school-admin.html ]; then
    redirects[town-school-admin.html]=/inside-school-staffing.html
  fi

  for file in "${!redirects[@]}"; do
    target="${redirects[$file]}"
    if [ ! -f "$file" ]; then continue; fi
    cat > "$file" <<EOF
  ---
  layout: redirect
  title: "Redirecting to $target"
  redirect_to: $target
  sitemap: false
  ---
  EOF
  done
  ```

- [ ] **Step 2: Update `tests/smoke-test.mjs`.** The smoke test visits `/explore.html` (lines ~478, 565, 580). Remove these test blocks entirely (the explore tool is gone). Search for and remove any other tests targeting the stubbed pages.

  ```bash
  grep -n "explore\.html\|whats-on-the-ballot\|where-candidates-stand\|cap-vs-cost\|your-true-cost\|two-votes\|the-debate\|no-override-budget\|info-guides\|prop25-story\|after-the-no-vote\|question-2-trash\|what-you-can-do\|bias-audit\|what-is-the-override" tests/smoke-test.mjs
  ```

  Delete each block referencing a dead page. Update the test count log line at the bottom of the file.

- [ ] **Step 3: Build + smoke test.**

  ```bash
  npm run test:local
  # Expected: new pass count (will be lower than 52 — note new number)
  ```

- [ ] **Step 4: Spot-check 4 redirects in the browser.**

  ```bash
  bundle exec jekyll serve --port 4000 &
  sleep 3
  for u in whats-on-the-ballot.html where-candidates-stand.html explore.html prop25-story.html; do
    echo "=== $u ==="
    curl -s "http://localhost:4000/$u" | grep -E "redirect_to|meta http-equiv"
  done
  kill %1
  ```

- [ ] **Step 5: Commit, push, open PR.** Title: `cleanup: redirect dying pages → archive / fold targets`. No screenshot needed; behavioral change.

---

### Task 11: Redirect-stub the 14 dead charts

**Files modified (each replaced with redirect stub, all redirect_to: `/data/`):**

`charts/override_calculator.html`, `charts/override_landscape.html`,
`charts/statewide_overrides.html`, `charts/deficit_model.html`,
`charts/sustainability.html`, `charts/peer_compensation.html`,
`charts/four_town_rates.html`, `charts/rate_value_schools.html`,
`charts/statewide_tax_burden.html`, `charts/tax_comparison.html`,
`charts/per_capita_levy.html`, `charts/levy_vs_bill.html`,
`charts/healthcare_costs.html`, `charts/your_tax_bill.html`.

**Worktree slug:** `post-election/redirect-stub-charts`

- [ ] **Step 1: Replace each file.**

  ```bash
  for file in charts/override_calculator.html charts/override_landscape.html charts/statewide_overrides.html charts/deficit_model.html charts/sustainability.html charts/peer_compensation.html charts/four_town_rates.html charts/rate_value_schools.html charts/statewide_tax_burden.html charts/tax_comparison.html charts/per_capita_levy.html charts/levy_vs_bill.html charts/healthcare_costs.html charts/your_tax_bill.html; do
    cat > "$file" <<EOF
  ---
  layout: redirect
  title: "Redirecting to /data/"
  redirect_to: /data/
  sitemap: false
  ---
  EOF
  done
  ```

- [ ] **Step 2: Update `tests/smoke-test.mjs`** for any chart-specific test blocks. Search:

  ```bash
  grep -n "charts/" tests/smoke-test.mjs
  ```

  Remove each test block for a stubbed chart. Keep tests for the 5 surviving charts (`town_explorer`, `enrollment_vs_staffing`, `general_government_over_time`, `budget_flow`, `override_history`) and `/checkbook/`.

- [ ] **Step 3: Audit in-repo links to dead charts.**

  ```bash
  for c in override_calculator override_landscape statewide_overrides deficit_model sustainability peer_compensation four_town_rates rate_value_schools statewide_tax_burden tax_comparison per_capita_levy levy_vs_bill healthcare_costs your_tax_bill; do
    grep -rn "$c" --include="*.html" --include="*.md" | grep -v "_site/" | grep -v "proof/" | grep -v "charts/$c.html"
  done
  ```

  Update each link to `/data/` (the hub) or remove the reference.

- [ ] **Step 4: Build + smoke test.** Note the new pass count.

- [ ] **Step 5: Commit, push, open PR.** Title: `cleanup: redirect 14 dead charts → /data/`.

---

### Task 12: Mothball community-pulse

**Files:**
- Modify: `_includes/head.html` (remove the loader)
- Modify: every surviving HTML page that has `community_pulse:` frontmatter (drop the key)

**Worktree slug:** `post-election/mothball-community-pulse`

- [ ] **Step 1: Remove the loader from `_includes/head.html`.**

  Delete lines 49-52 (the `{% unless page.community_pulse == "off-sections" %}` block and its three resource loads). Replace with nothing — the entire `{% unless %}` block goes.

- [ ] **Step 2: Strip `community_pulse:` frontmatter from every page.**

  ```bash
  grep -rln "^community_pulse:" --include="*.html" --include="*.md" | grep -v "_site/" | grep -v "proof/" > /tmp/cp-files.txt
  while read f; do
    sed -i '/^community_pulse:/d' "$f"
  done < /tmp/cp-files.txt
  ```

  Also remove the `data-community-pulse` attribute logic from `_layouts/default.html` line 6 (delete the `{% if page.community_pulse == "off-sections" %} data-community-pulse="off-sections"{% endif %}` block).

- [ ] **Step 3: Leave the worker and asset files in place.** Do NOT delete:
  - `/community-pulse/` directory
  - `assets/community-pulse/widget.css`
  - `assets/community-pulse/widget.js`
  - `assets/community-pulse/verified.js`

  These stay for future revival.

- [ ] **Step 4: Build + smoke test + screenshot.** Pick any page that previously had pulse reactions visible; verify no reactions widget appears in the screenshot.

- [ ] **Step 5: Commit, push, open PR.** Title: `community-pulse: mothball loader and frontmatter (keep code)`.

---

### Task 13: Footer cleanup + retire `/feedback`

**Files:**
- Modify: `_includes/footer.html` (or equivalent — locate the footer include) — add a "Report an error" GitHub issues link.
- Modify: `feedback.html` (replace with redirect stub to `/about/` or to GitHub issues).

**Worktree slug:** `post-election/footer-cleanup`

- [ ] **Step 1: Locate the footer include.**

  ```bash
  ls _includes/footer*.html
  grep -rn "include footer\|include foot" _layouts/ 2>/dev/null
  ```

- [ ] **Step 2: Add a footer link.**

  ```html
  <a href="https://github.com/agbaber/marblehead/issues/new" target="_blank" rel="noopener">Report an error</a>
  ```

  Match the existing footer link style.

- [ ] **Step 3: Replace `feedback.html`** with a redirect stub:

  ```yaml
  ---
  layout: redirect
  title: "Redirecting to GitHub issues"
  redirect_to: https://github.com/agbaber/marblehead/issues/new
  sitemap: false
  ---
  ```

  Note: the redirect layout's `<link rel="canonical">` line will produce a malformed URL for the external target. Either accept this (no SEO consequence — the page is gone) or write a one-off external-redirect layout. The simpler accept-it option is fine.

- [ ] **Step 4: Audit in-repo links to `/feedback.html`** and update or remove.

  ```bash
  grep -rn "feedback\.html\|/feedback" --include="*.html" --include="*.md" | grep -v "_site/" | grep -v "proof/" | grep -v "_transcripts/"
  ```

- [ ] **Step 5: Build + smoke test + screenshot footer.**

- [ ] **Step 6: Commit, push, open PR.** Title: `footer: add GitHub issues link, retire /feedback page`.

---

## Phase 5 — Post-vote content fill

Runs only after the official results are posted (likely 2026-06-09 ~10pm or 2026-06-10 morning).

---

### Task 14: Fill in `/2026-override/` result and what-happened-next sections

**Files:**
- Modify: `2026-override/index.html`

**Worktree slug:** `post-election/archive-result-fill`

- [ ] **Step 1: Wait for official results** to be posted by the Town Clerk on marbleheadma.gov. Capture: total turnout, yes/no on each ballot question, per-precinct breakdown, comparison to 2022 and 2023 turnout.

- [ ] **Step 2: Replace the section 5 stub.**

  ```html
  <section>
    <h2>The result</h2>
    <p>On 2026-06-09, voters considered two ballot questions...</p>
    <table class="result-table">
      <thead><tr><th>Question</th><th>Yes</th><th>No</th><th>Turnout</th></tr></thead>
      <tbody>
        <tr><td>Question 1 (override)</td><td>...</td><td>...</td><td>...</td></tr>
        <tr><td>Question 2 (trash)</td><td>...</td><td>...</td><td>...</td></tr>
      </tbody>
    </table>
    <p>By precinct:</p>
    <table>...</table>
    <p>Comparison to recent overrides: 2022 (failed), 2023 (failed), 2026 (...).</p>
  </section>
  ```

  Cite the Town Clerk's posted result as the primary source per `STYLE_GUIDE.md`.

- [ ] **Step 3: Plan section 6.** Don't fill in same-day. Leave a stub:

  ```html
  <section>
    <h2>What happened next</h2>
    <p>This section will be updated as decisions land. Watch <a href="/meetings/">/meetings/</a> for the Select Board and Finance Committee meetings that follow.</p>
  </section>
  ```

- [ ] **Step 4: Build + smoke test + screenshot.**

- [ ] **Step 5: Commit, push, open PR.** Title: `archive: 2026-06-09 result posted`. Match the editorial stance from CLAUDE.md — facts in the table, no win/loss editorial language.

---

## Out of scope (call out, do not implement)

- Rewriting individual surviving pages for tone or layout. Each page edit is a separate effort.
- Touching `/marblehead-101/` chapters 01-05 or 08, or the primer index. Those were just redesigned.
- Touching the `/meetings/` page, the meeting-digest worker, or `/subscribe/` infrastructure.
- Building any new functionality (e.g. a search rebuild, a calendar widget).
- Replacing the redirect layout with proper 301s via Cloudflare `_redirects`. The soft-redirect (meta-refresh) layout is acceptable for this scope.

## Verification checklist (run after Phase 4 merges)

- [ ] `find . -maxdepth 1 -name "*.html" | wc -l` returns approximately 25.
- [ ] `find charts -maxdepth 1 -name "*.html" | grep -v "layout: redirect" | wc -l` returns 5.
- [ ] `grep -rln "community_pulse:" --include="*.html" --include="*.md" | grep -v "_site/" | grep -v "proof/" | wc -l` returns 0.
- [ ] `npm run test:local` passes.
- [ ] Visiting `/`, `/checkbook/`, `/data/`, `/meetings/`, `/marblehead-101/`, `/what-can-we-do.html`, `/2026-override/` in a browser via the Cloudflare preview URL each renders correctly.
- [ ] Visiting `/whats-on-the-ballot.html`, `/the-debate.html`, `/charts/checkbook.html`, `/browse.html` each redirects to a sensible page.
