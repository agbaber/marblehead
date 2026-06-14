# Surface where-candidates-stand on homepage + top nav — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Candidates" link to the top nav and a new scroll-stop on the homepage that surfaces `where-candidates-stand.html` ahead of the June 9 election.

**Architecture:** Two file edits. `_includes/nav.html` gains one `<a class="nav-link">`. `index.html` gains a small `.race-list` CSS block plus one new `<section class="home-stop">` inserted between the existing `#ballot` and `#fails` stops. No JavaScript. Patterns reuse existing scroll-stop conventions (`.home-eye`, `.home-big`, `.home-cap`, `.home-deeper`) and the `.driver-list` two-column layout idea is adapted (lighter — no bars, just label + count).

**Tech Stack:** Jekyll 3.10 (matches GitHub Pages prod), Playwright (smoke tests + screenshot capture), `npm run test:local` for build+serve+test orchestration.

**Spec:** `docs/superpowers/specs/2026-06-06-candidates-homepage-nav-design.md`

**Branch:** `worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW` (already on it).

---

## Task 1: Add Candidates link to top nav

**Files:**
- Modify: `_includes/nav.html` (line 5–7, the existing nav-link block)

The current nav has three text links in this order between the brand and the search/theme icon buttons:

```
Ballot   →  whats-on-the-ballot.html
Questions → explore.html
Browse    → browse.html
```

We insert a fourth link, **Candidates**, between Ballot and Questions.

- [ ] **Step 1: Read the current nav-link block to confirm the pattern**

Run: `sed -n '5,7p' _includes/nav.html`

Expected output (the three existing lines):

```
    <a class="nav-link" href="{{ '/' | relative_url }}whats-on-the-ballot.html"{% if page.url == '/whats-on-the-ballot.html' %} aria-current="page"{% endif %}>Ballot</a>
    <a class="nav-link" href="{{ '/' | relative_url }}explore.html"{% if page.url == '/explore.html' or page.url == '/the-debate.html' %} aria-current="page"{% endif %}>Questions</a>
    <a class="nav-link" href="{{ '/' | relative_url }}browse.html"{% if page.url == '/browse.html' %} aria-current="page"{% endif %}>Browse</a>
```

- [ ] **Step 2: Insert the Candidates link between Ballot and Questions**

Use the Edit tool to replace this exact block in `_includes/nav.html`:

**old:**

```html
    <a class="nav-link" href="{{ '/' | relative_url }}whats-on-the-ballot.html"{% if page.url == '/whats-on-the-ballot.html' %} aria-current="page"{% endif %}>Ballot</a>
    <a class="nav-link" href="{{ '/' | relative_url }}explore.html"{% if page.url == '/explore.html' or page.url == '/the-debate.html' %} aria-current="page"{% endif %}>Questions</a>
```

**new:**

```html
    <a class="nav-link" href="{{ '/' | relative_url }}whats-on-the-ballot.html"{% if page.url == '/whats-on-the-ballot.html' %} aria-current="page"{% endif %}>Ballot</a>
    <a class="nav-link" href="{{ '/' | relative_url }}where-candidates-stand.html"{% if page.url == '/where-candidates-stand.html' %} aria-current="page"{% endif %}>Candidates</a>
    <a class="nav-link" href="{{ '/' | relative_url }}explore.html"{% if page.url == '/explore.html' or page.url == '/the-debate.html' %} aria-current="page"{% endif %}>Questions</a>
```

- [ ] **Step 3: Verify the file change**

Run: `git diff _includes/nav.html`

Expected: a single `+` line for the new Candidates `<a>` between the Ballot and Questions lines, no other changes.

- [ ] **Step 4: Commit**

```bash
git add _includes/nav.html
git commit -m "nav: add Candidates link between Ballot and Questions

Surfaces where-candidates-stand.html ahead of the June 9 election."
```

---

## Task 2: Add the .race-list CSS block to index.html

**Files:**
- Modify: `index.html` (insert CSS block after `.driver-gloss` at line 215, before the `/* === Cost slider === */` comment at line 217)

The new `.race-list` block styles a vertical list of contested races: each row is a two-column grid (body name on the left, "N for M seats" on the right, tabular numerals), divided by a hairline rule. No bars, no glosses — lighter than `.driver-list`.

- [ ] **Step 1: Confirm the insertion point**

Run: `sed -n '209,217p' index.html`

Expected output:

```css
  .driver-gloss {
    grid-area: gloss;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 2px 0 0;
  }

  /* === Cost slider === */
```

- [ ] **Step 2: Insert the .race-list CSS block**

Use the Edit tool to replace this exact block in `index.html`:

**old:**

```css
  .driver-gloss {
    grid-area: gloss;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 2px 0 0;
  }

  /* === Cost slider === */
```

**new:**

```css
  .driver-gloss {
    grid-area: gloss;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 2px 0 0;
  }

  /* === Contested-races list (homepage candidates stop) === */
  .race-list {
    list-style: none;
    margin: 8px 0 16px;
    padding: 0;
    max-width: 640px;
    width: 100%;
  }
  .race-list li {
    display: grid;
    grid-template-columns: 1fr auto;
    column-gap: 14px;
    align-items: baseline;
    padding: 14px 0 14px;
    border-bottom: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  }
  .race-list li:last-child { border-bottom: none; }
  .race-list-label {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.3;
  }
  .race-list-count {
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* === Cost slider === */
```

- [ ] **Step 3: Verify the diff is CSS-only**

Run: `git diff --stat index.html`

Expected: roughly `1 file changed, ~32 insertions(+)`. No deletions yet.

---

## Task 3: Insert the candidates scroll-stop into index.html

**Files:**
- Modify: `index.html` (insert a new `<section>` between line 628 `</section>` of `#ballot` and line 630 `<section class="home-stop" id="fails">`)

Tint: **not tinted** (per spec). Sits between tinted `#ballot` and non-tinted `#fails`, creating a deliberate 2-non-tinted run. Do not add the `home-stop--tinted` class.

- [ ] **Step 1: Confirm the insertion point**

Run: `sed -n '627,632p' index.html`

Expected output:

```html
  <a class="home-deeper" href="whats-on-the-ballot.html">Sample ballot, candidates, and the 24 other races</a>
</section>

<section class="home-stop" id="fails">
  <p class="home-eye">If the override fails</p>
  <div class="home-big home-big--cost" style="font-size: clamp(48px, 9vw, 96px);">balanced by cuts</div>
```

- [ ] **Step 2: Insert the new section**

Use the Edit tool to replace this exact block in `index.html`:

**old:**

```html
  <a class="home-deeper" href="whats-on-the-ballot.html">Sample ballot, candidates, and the 24 other races</a>
</section>

<section class="home-stop" id="fails">
```

**new:**

```html
  <a class="home-deeper" href="whats-on-the-ballot.html">Sample ballot, candidates, and the 24 other races</a>
</section>

<section class="home-stop" id="candidates">
  <p class="home-eye">June 9 ballot &bull; who's running</p>
  <div class="home-big">6 contested races <span style="color:var(--text-muted); font-weight:500;">/</span> 18 candidates</div>
  <p class="home-cap">Select Board, School Committee, Moderator, Recreation &amp; Park, Cemetery, and Housing Authority all have more candidates than seats this year.</p>

  <ul class="race-list">
    <li><span class="race-list-label">Select Board</span><span class="race-list-count">3 for 2 seats</span></li>
    <li><span class="race-list-label">School Committee</span><span class="race-list-count">3 for 2 seats</span></li>
    <li><span class="race-list-label">Moderator</span><span class="race-list-count">2 for 1 seat</span></li>
    <li><span class="race-list-label">Recreation &amp; Park Commission</span><span class="race-list-count">6 for 5 seats</span></li>
    <li><span class="race-list-label">Cemetery Commission</span><span class="race-list-count">2 for 1 seat</span></li>
    <li><span class="race-list-label">Housing Authority</span><span class="race-list-count">2 for 1 seat</span></li>
  </ul>

  <a class="home-deeper" href="where-candidates-stand.html">Candidate positions and sample-ballot picker</a>
</section>

<section class="home-stop" id="fails">
```

- [ ] **Step 3: Verify the diff is contained**

Run: `git diff --stat index.html`

Expected: roughly `1 file changed, ~50 insertions(+)` total (CSS from Task 2 + this section). No deletions.

Sanity check: `grep -c '<section class="home-stop"' index.html`. Expected: **6** (was 5: deficit, cost, ballot, fails, debate; now also candidates). If you get 5 or 7, the section was placed wrong.

- [ ] **Step 4: Commit Tasks 2 + 3 together**

```bash
git add index.html
git commit -m "homepage: add candidates scroll-stop after the ballot stop

6 contested races / 18 candidates, list of bodies with seat counts,
deep-link to where-candidates-stand.html. Not tinted; sits between
the tinted #ballot stop and non-tinted #fails stop. Counts pulled
from race-meta lines on the candidates page."
```

---

## Task 4: Build the site and run smoke tests

**Files:** none — verification only.

`npm run test:local` runs `bundle exec jekyll build` → `npx serve _site -p 4000` → `node tests/smoke-test.mjs` against `localhost:4000` → teardown. The smoke test's homepage block already checks `nav.site-nav a[href]` count and `.home-stop` count (expects ≥ 5; we now have 6).

- [ ] **Step 1: Run the full local test orchestration**

Run: `npm run test:local`

Expected output ends with: `52 PASS, 0 FAIL` (or a higher PASS number if smoke tests have grown since this plan was written; the key thing is **0 FAIL**).

If a smoke test fails on nav-link count or scroll-stop count, fix the markup before continuing — likely a missing closing tag or wrong placement.

- [ ] **Step 2: If Jekyll build fails, read the error**

A common failure mode is unbalanced Liquid tags or unescaped `&` in markup. The error will name the file + line. Fix and re-run Step 1.

- [ ] **Step 3: No commit required if all green**

Tests are read-only; nothing to add.

---

## Task 5: Capture Playwright screenshot proof

**Files:**
- Create: `proof/worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW.png`

Per project Definition of Done, UI changes require a Playwright screenshot committed to `proof/<branch-name>.png`. Capture the above-the-fold homepage (nav + hero/countdown is OK as long as the new candidates scroll-stop is also visible after a short scroll — but the inline preview only needs to show the change exists, not be exhaustive).

We use the actual change view: scroll the page to the new `#candidates` section and capture from there, OR capture full-page and rely on the reviewer scrolling. The simpler and more reviewable choice is a 1440×900 above-the-fold of the homepage (shows the new nav) PLUS a second screenshot anchored at `#candidates` to show the new scroll-stop.

- [ ] **Step 1: Start the dev server in the background**

```bash
npm run dev > /tmp/jekyll-dev.log 2>&1 &
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/
```

Expected: `200`. If not 200, check `/tmp/jekyll-dev.log` for the Jekyll error.

- [ ] **Step 2: Capture above-the-fold (shows the new nav link)**

```bash
mkdir -p proof
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/" \
  "proof/worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW.png"
```

Expected: file written, ~2880×1800 px, ~300–800 KB. Verify with:

```bash
file proof/worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW.png
```

Expected output mentions `2880 x 1800` (or close). If wider than ~3500 px, something forced a bigger viewport — re-run.

- [ ] **Step 3: Capture the new scroll-stop in context**

```bash
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/#candidates" \
  "proof/worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW-candidates.png"
```

Expected: file shows the new scroll-stop ("JUNE 9 BALLOT · WHO'S RUNNING", "6 contested races / 18 candidates", the six-row list, and the deep-link). If the screenshot lands on the wrong section, the `id="candidates"` is missing from the new section — fix in `index.html` and re-run.

- [ ] **Step 4: Kill the dev server**

```bash
pkill -f 'jekyll serve' || true
```

- [ ] **Step 5: Commit the proof images**

```bash
git add proof/worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW.png proof/worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW-candidates.png
git commit -m "proof: homepage candidates scroll-stop + nav addition"
```

---

## Task 6: Push and open the PR

**Files:** none — git/gh only.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW
```

- [ ] **Step 2: Open the PR**

The project's `CLAUDE.md` says "Always open a PR after pushing." Use `gh pr create` with a PR body that includes:

- Summary (2–3 bullets)
- Preview deploy URL placeholder (Cloudflare Pages PR preview from `.github/workflows/preview.yml` — fill in after the workflow posts the sticky `### Preview` comment)
- Specific paths/screens to visit: `/` (homepage) and `/where-candidates-stand.html`
- Expected behavior: new "Candidates" link in top nav between Ballot and Questions; new scroll-stop between the existing #ballot and #fails stops on the homepage; deep-link to candidates page works
- Edge cases worth poking: 375px mobile width (does nav still fit?), light/dark mode (race-list row dividers use `var(--text)` with alpha, should adapt)
- Proof images inline (use `proof/...png` paths)

Run:

```bash
gh pr create \
  --title "Homepage candidates scroll-stop + nav 'Candidates' link" \
  --body "$(cat <<'EOF'
## Summary

- New top-nav link **Candidates** between Ballot and Questions, pointing to `where-candidates-stand.html`.
- New homepage scroll-stop inserted between the existing #ballot and #fails stops: "6 contested races / 18 candidates" + six-row list of bodies with seat counts + deep-link to the candidates page.
- No tint on the new stop; accepted as a 2-non-tinted run with #fails so the post-election revert stays trivial.

## Preview URL

Will appear at the Cloudflare Pages PR preview link once the `.github/workflows/preview.yml` sticky comment posts (~2–3 min after this PR opens). Edit this body with the Branch URL when it lands.

## Test plan

- [ ] Visit `/` — confirm nav reads `Ballot · Candidates · Questions · Browse` and the new scroll-stop appears between the Ballot questions stop and the "If the override fails" stop.
- [ ] Click **Candidates** in the nav — lands on `where-candidates-stand.html` with `aria-current="page"` on the nav link.
- [ ] Click the deep-link "Candidate positions and sample-ballot picker" — lands on the same page.
- [ ] Mobile: viewport ~375px, confirm nav row still fits (brand + 4 links + 2 icons) without horizontal scroll.
- [ ] Light + dark mode: row dividers in the race-list should adapt (uses `color-mix(in srgb, var(--text) 12%, transparent)`).
- [ ] Smoke tests pass: `npm run test:local` → 0 FAIL.

## Proof of Work

Above-the-fold (nav with new Candidates link):

![Homepage above-the-fold](proof/worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW.png)

New scroll-stop in context:

![Candidates scroll-stop](proof/worktree-bridge-cse_01Tfj6uQk5wpQf529C8pgdmW-candidates.png)

Spec: `docs/superpowers/specs/2026-06-06-candidates-homepage-nav-design.md`
Plan: `docs/superpowers/plans/2026-06-06-candidates-homepage-nav.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user**

`gh pr create` prints the URL on success. Surface it in the chat reply so the user can open it directly.

---

## Self-review checklist (run after writing this plan)

- **Spec coverage:**
  - Nav addition (Change 1 of spec) → Task 1 ✓
  - Mobile spot-check (Change 1 mobile guardrail) → PR test-plan item ✓
  - Race-list CSS (Change 2, CSS section of spec) → Task 2 ✓
  - Scroll-stop markup, no tint, 6 rows with exact counts (Change 2 main) → Task 3 ✓
  - Editorial guardrail (factual logistics in caption) → Task 3 markup uses factual caption ✓
  - Verification: build + smoke + Playwright screenshot → Tasks 4 + 5 ✓
  - Revert path: noted in commit messages, single-section delete is trivial ✓
- **Placeholder scan:** no TBD/TODO; every code block contains real code; commit messages are concrete.
- **Type/name consistency:**
  - Class names match between CSS (Task 2) and markup (Task 3): `.race-list`, `.race-list-label`, `.race-list-count` ✓
  - Section `id="candidates"` matches the Playwright URL anchor in Task 5 ✓
  - Counts (3+3+2+6+2+2 = 18) consistent between caption + list ✓
- **Scope:** single-session, single-PR plan; no decomposition needed.
