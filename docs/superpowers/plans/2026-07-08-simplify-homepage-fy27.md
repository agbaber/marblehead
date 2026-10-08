# Simplify homepage for FY27 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stale-KPI hero and 10-tile flat grid on `/` with a plain identity block plus two labelled tile rows (7 site-section tiles + 3 notable-piece tiles, separated by a subtle divider).

**Architecture:** Single-file HTML/CSS change to `index.html`. No new pages, no data changes, no JS. The redesign is structural: a new `.home-intro` block replaces `.home-hero`; a new `.home-divider` element sits between two `.home-tiles` grids inside the existing `.home-stop--tinted` band.

**Tech Stack:** Jekyll 3.10 (via Gemfile), plain HTML + scoped CSS in the page's `<style>` block, Playwright for visual verification.

**Spec:** `docs/superpowers/specs/2026-07-08-simplify-homepage-fy27-design.md`

---

## File structure

- **Modify:** `index.html` — rewrite the hero → identity block, reorder tiles into two rows with divider, add `.home-divider` CSS, delete dead `.home-hero` / `.home-big` / `.home-cap` / `.home-deeper` CSS.
- **Create:** `proof/simplify-homepage-fy27.png` (above-fold, 1440×900) and `proof/simplify-homepage-fy27-full.png` (full-page) — committed as PR proof.

No new files. No script changes. `_includes/nav.html`, `_includes/footer.html`, `assets/site.css`, `_data/checkbook.json`, and every other file stay untouched.

---

## Task 1: Set up a fresh worktree off origin/main

**Files:** none (branch/worktree setup only)

The current session is running in the `fresh-bridge` worktree, which is on the `fresh-bridge` branch — several commits behind `origin/main` and with unrelated old `wip` commits. Cutting a fresh branch off `origin/main` avoids conflict risk and matches the CLAUDE.md worktree hygiene rule.

- [ ] **Step 1: Fetch latest main**

```bash
git fetch origin main
```

Expected: fetches without error. `origin/main` HEAD should be commit `5b93f40` or later.

- [ ] **Step 2: Create a fresh worktree off origin/main**

```bash
cd /home/claude/marblehead
git worktree add -b simplify-homepage-fy27 .dev/worktree/simplify-homepage-fy27 origin/main
cd .dev/worktree/simplify-homepage-fy27
```

Expected: `git status` shows a clean tree on branch `simplify-homepage-fy27`.

- [ ] **Step 3: Install dependencies if needed**

```bash
ls node_modules 2>/dev/null | head -1 || npm install
bundle check 2>/dev/null || bundle install
```

Expected: both toolchains resolve. `npm install` may take ~30s on a fresh worktree; `bundle install` should be near-instant if the system Ruby has the gems cached.

- [ ] **Step 4: Confirm the current homepage is the 10-tile version**

```bash
grep -c '<a class="home-tile"' index.html
```

Expected output: `10`. If not 10, stop — the spec was written against the 10-tile version and something has changed on main; re-brainstorm.

---

## Task 2: Rewrite `index.html`

**Files:**
- Modify: `index.html` (the whole file)

Full replacement content follows. Every character in this block goes into `index.html`. The tile copy is preserved verbatim from `origin/main:index.html` (verified). The hero block is removed; a new `.home-intro` block replaces it. Tiles are split into two `.home-tiles` grids with a `.home-divider` between them. Dead hero CSS is stripped from the `<style>` block. New `.home-intro` and `.home-divider` CSS is added.

- [ ] **Step 1: Overwrite `index.html`**

```html
---
title: "Marblehead Budget Data"
scripts: [citations]
og_title: "Marblehead Budget Data"
og_description: "Open data on Marblehead's town and school finances. Spending, debt, meetings, and how to take part."
og_url: https://marbleheaddata.org/
---
<style>
  /* Identity block */
  .home-intro {
    box-sizing: border-box;
    padding: 48px 0 32px;
  }
  @media (min-width: 700px) {
    .home-intro { padding: 64px 0 48px; }
  }
  .home-intro h1 {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: clamp(40px, 6vw, 64px);
    line-height: 1.05;
    font-weight: 800;
    letter-spacing: -0.025em;
    margin: 0 0 16px;
    color: var(--text);
  }
  .home-intro p {
    font-size: clamp(16px, 1.9vw, 20px);
    color: var(--text-muted);
    line-height: 1.45;
    margin: 0;
    max-width: 620px;
  }

  /* Tile band */
  .home-stop {
    box-sizing: border-box;
    padding: 40px 0;
  }
  .home-stop--tinted {
    background: color-mix(in srgb, var(--c-navy) 4%, var(--surface));
    border-top: 1px solid color-mix(in srgb, var(--c-navy) 10%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--c-navy) 10%, transparent);
    margin-left: calc(50% - 50vw);
    margin-right: calc(50% - 50vw);
    padding-left: calc(50vw - 50%);
    padding-right: calc(50vw - 50%);
  }
  .home-tiles {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }
  @media (min-width: 600px) {
    .home-tiles { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 1000px) {
    .home-tiles { grid-template-columns: repeat(3, 1fr); }
  }

  .home-tile {
    display: flex;
    flex-direction: column;
    padding: 22px 24px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: var(--text);
    transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
    min-height: 180px;
  }
  .home-tile:hover {
    border-color: var(--c-teal);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
  .home-tile .tile-eye {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.9px;
    text-transform: uppercase;
    color: var(--c-teal);
    margin: 0 0 8px;
  }
  .home-tile h3 {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-weight: 700;
    font-size: 21px;
    line-height: 1.2;
    margin: 0 0 10px;
    color: var(--text);
  }
  .home-tile p {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 0;
  }

  /* Divider between the section row and the notable-pieces row */
  .home-divider {
    margin: 40px 0 18px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .home-divider h2 {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--text-subtle);
    margin: 0;
  }
  .home-divider .rule {
    flex: 1;
    height: 1px;
    background: color-mix(in srgb, var(--c-navy) 12%, transparent);
  }
</style>

<section class="home-intro">
  <h1>Marblehead Budget Data</h1>
  <p>Open data on the town's and schools' finances. Spending, debt, meetings, and how to take part.</p>
</section>

<section class="home-stop home-stop--tinted">
  <div class="home-tiles" data-home-row="sections">
    <a class="home-tile" href="/marblehead-101/">
      <div class="tile-eye">PRIMER</div>
      <h3>How Marblehead's budget works</h3>
      <p>Eight short chapters: how the town is run, where money comes from, where it goes, how the gap keeps reappearing.</p>
    </a>
    <a class="home-tile" href="/checkbook/">
      <div class="tile-eye">CHECKBOOK</div>
      <h3>What the town is spending</h3>
      <p>{{ site.data.checkbook.fiscal_year }} vendor checks and budget pacing, drill-down by department.</p>
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
    <a class="home-tile" href="/2026-override/">
      <div class="tile-eye">2026 OVERRIDE</div>
      <h3>What passed on June 9</h3>
      <p>All four ballot questions passed; the $15M operating tier governs FY27. The full record of the campaign, the candidates, and the result.</p>
    </a>
    <a class="home-tile" href="/org-chart">
      <div class="tile-eye">STRUCTURE</div>
      <h3>Who runs Marblehead?</h3>
      <p>The two parallel administrations, the 18 elected and appointed boards above them, and the levers residents actually have. Click any department to see FY27 staffing and salary lines.</p>
    </a>
  </div>

  <div class="home-divider">
    <h2>Notable pieces</h2>
    <span class="rule"></span>
  </div>

  <div class="home-tiles" data-home-row="notable">
    <a class="home-tile" href="/override-tracker.html">
      <div class="tile-eye">TRACKER</div>
      <h3>Is the override delivering?</h3>
      <p>Twenty-eight commitments the boards made on the way to the June 9 vote: dollar allocations, staffing restorations, and process promises, each with a status and a source. Updates after each quarterly review.</p>
    </a>
    <a class="home-tile" href="/school-building-maintenance.html">
      <div class="tile-eye">SCHOOL BUILDINGS</div>
      <h3>What's getting fixed at the schools?</h3>
      <p>The 2021 EBI condition report is the only district-wide baseline. What's been done since, what's still on the list, and what the override added.</p>
    </a>
    <a class="home-tile" href="/the-insurance-surplus.html">
      <div class="tile-eye">GROUP INSURANCE</div>
      <h3>11 years, $28M, one budget line</h3>
      <p>Group Insurance came in 19% under budget every year for eleven years running. Peer towns book 0&ndash;5%. The unspent money has a destination.</p>
    </a>
  </div>
</section>
```

- [ ] **Step 2: Sanity-check the file structurally**

```bash
grep -c '<a class="home-tile"' index.html
grep -c 'data-home-row="sections"' index.html
grep -c 'data-home-row="notable"' index.html
grep -c 'class="home-hero"' index.html
grep -c 'class="home-intro"' index.html
grep -c 'class="home-divider"' index.html
```

Expected:
```
10   # 7 sections + 3 notable = 10 tiles total
1    # one sections row
1    # one notable row
0    # dead hero class is gone from markup
1    # one identity block
1    # one divider
```

- [ ] **Step 3: Commit the rewrite**

```bash
git add index.html
git commit -m "Simplify homepage: identity block + section vs. notable tile rows"
```

Expected: single commit with a ~200-line diff. Verify with `git show --stat HEAD` — only `index.html` changed.

---

## Task 3: Local dev verification

**Files:** none (verification only)

- [ ] **Step 1: Start Jekyll dev server in the background**

```bash
npm run dev > /tmp/jekyll.log 2>&1 &
echo $! > /tmp/jekyll.pid
```

Wait ~5 seconds for initial build, then check the log:

```bash
sleep 5 && grep -E "Server running|error" /tmp/jekyll.log | tail -5
```

Expected: `Server running... http://localhost:4000/`. If any `error` line appears, read `/tmp/jekyll.log` and stop.

- [ ] **Step 2: Confirm `/` renders and contains the expected structure**

```bash
curl -s http://localhost:4000/ | grep -c '<a class="home-tile"'
curl -s http://localhost:4000/ | grep -c 'data-home-row='
curl -s http://localhost:4000/ | grep -c 'Marblehead Budget Data'
curl -s http://localhost:4000/ | grep -c 'Notable pieces'
```

Expected: `10`, `2`, `≥1`, `1`.

- [ ] **Step 3: Confirm the tiles' destinations still resolve**

```bash
for path in /marblehead-101/ /checkbook/ /data/ /meetings/ /what-can-we-do.html /2026-override/ /org-chart /override-tracker.html /school-building-maintenance.html /the-insurance-surplus.html; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:4000${path}")
  echo "$code $path"
done
```

Expected: every line begins with `200`. If any 404, stop and investigate — that tile links to something that doesn't exist in the build.

---

## Task 4: Playwright screenshot proof

**Files:**
- Create: `proof/simplify-homepage-fy27.png`
- Create: `proof/simplify-homepage-fy27-full.png`

- [ ] **Step 1: Write a scratch Node script for retina-quality screenshots**

The Playwright CLI does not accept `--device-scale-factor`, so we use a small Node script that sets `deviceScaleFactor: 2` on the browser context. This file is scratch — do not commit it.

```bash
mkdir -p proof
cat > /tmp/screenshot_home.mjs <<'EOF'
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto('http://localhost:4000/', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'proof/simplify-homepage-fy27.png', fullPage: false });
await page.screenshot({ path: 'proof/simplify-homepage-fy27-full.png', fullPage: true });
await b.close();
console.log('wrote screenshots');
EOF
```

- [ ] **Step 2: Run it**

```bash
node /tmp/screenshot_home.mjs
```

Expected: prints `wrote screenshots`. Verify with `file proof/simplify-homepage-fy27.png` — should report a PNG about 2880 pixels wide (1440 × 2 for retina).

- [ ] **Step 3: Clean up the scratch script**

```bash
rm /tmp/screenshot_home.mjs
```

- [ ] **Step 4: Visual review**

Read both PNGs with the Read tool. Confirm:
- Identity block is at top: "Marblehead Budget Data" H1 + tagline paragraph
- No `$X.XM` KPI, no "Open the Checkbook" button
- First tile row = 7 section tiles laying out as 3 + 3 + 1 (Structure alone on the third row)
- "NOTABLE PIECES" divider is visible with a horizontal rule
- Second tile row = 3 notable-piece tiles as one clean row
- Watermark lighthouse SVG still visible in background

If any of those are off, stop and diagnose.

- [ ] **Step 5: Commit the proof**

```bash
git add proof/simplify-homepage-fy27.png proof/simplify-homepage-fy27-full.png
git commit -m "Add homepage screenshot proof"
```

---

## Task 5: Smoke test

**Files:** none (existing test suite)

- [ ] **Step 1: Stop the background Jekyll server**

```bash
kill "$(cat /tmp/jekyll.pid)" 2>/dev/null; rm -f /tmp/jekyll.pid /tmp/jekyll.log
```

Expected: server exits. `curl -s http://localhost:4000/ -o /dev/null -w "%{http_code}"` should return `000` (connection refused) after a second.

- [ ] **Step 2: Run the full local test suite**

```bash
npm run test:local
```

Expected: builds the site, serves `_site/`, runs `tests/smoke-test.mjs`, tears down. Success line reads `52 pass / 0 fail` (or whatever the current suite baseline is). Any failure — stop, read the failing assertion, and diagnose before proceeding.

- [ ] **Step 3: Verify responsive widths via headless screenshots**

The box has no display server, so this is a headless Playwright capture at three widths + a Read pass over each PNG to confirm the layout reflows correctly.

```bash
npm run dev > /tmp/jekyll.log 2>&1 &
echo $! > /tmp/jekyll.pid
sleep 5

cat > /tmp/screenshot_widths.mjs <<'EOF'
import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [1440, 768, 400]) {
  const ctx = await b.newContext({
    viewport: { width: w, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `proof/simplify-homepage-fy27-w${w}.png`, fullPage: true });
  await ctx.close();
}
await b.close();
console.log('wrote width screenshots');
EOF
node /tmp/screenshot_widths.mjs
rm /tmp/screenshot_widths.mjs
```

Read each PNG (`proof/simplify-homepage-fy27-w1440.png`, `-w768.png`, `-w400.png`) with the Read tool and confirm:

- **1440px:** section tiles as 3 + 3 + 1 (Structure alone on row 3). Notable tiles as one clean 3-col row.
- **768px:** both grids at 2-col. Sections = 2 + 2 + 2 + 1. Notable = 2 + 1.
- **400px:** both grids at 1-col. All 10 tiles stack. Divider heading + rule still legible.

If any width breaks layout, add a fix commit before pushing. Do not commit the width-sweep PNGs — they're scratch. Remove them:

```bash
rm proof/simplify-homepage-fy27-w1440.png proof/simplify-homepage-fy27-w768.png proof/simplify-homepage-fy27-w400.png
```

- [ ] **Step 4: Verify dark mode headlessly**

The box has no display, so use Playwright to force `data-theme="dark"` on `<html>` and screenshot.

```bash
cat > /tmp/screenshot_dark.mjs <<'EOF'
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto('http://localhost:4000/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await page.waitForTimeout(400);
await page.screenshot({ path: 'proof/simplify-homepage-fy27-dark.png', fullPage: false });
await b.close();
console.log('wrote dark screenshot');
EOF
node /tmp/screenshot_dark.mjs
rm /tmp/screenshot_dark.mjs
```

Read `proof/simplify-homepage-fy27-dark.png`. Confirm:
- Identity block H1 stays legible against dark background
- Divider rule is visible against the dark tinted band
- Tile borders and text still have adequate contrast

If dark mode has a contrast or visibility problem, add a fix commit before pushing. Do not commit the dark screenshot — it's scratch:

```bash
rm proof/simplify-homepage-fy27-dark.png
```

- [ ] **Step 5: Stop the background Jekyll server**

```bash
kill "$(cat /tmp/jekyll.pid)" 2>/dev/null; rm -f /tmp/jekyll.pid /tmp/jekyll.log
```

---

## Task 6: Push and open PR

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push -u origin simplify-homepage-fy27
```

Expected: branch pushed, tracking set. No PAT prompts — plain `git push` should work per the auth memory.

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "Simplify homepage: identity block + section vs. notable tile rows" --body "$(cat <<'EOF'
## Summary

Rework the homepage for FY27. The stale-KPI hero (`$7.5M spending so far · as of Jul 1`) and 10 tiles at equal weight get replaced with:

- A plain identity block: site name + one-sentence tagline. No number, no CTA button.
- Two labelled tile rows inside the tinted band:
  - **7 section tiles** (the nav map: Primer, Checkbook, Data, Meetings, Act, 2026 Override, Structure)
  - **"Notable pieces"** divider heading
  - **3 investigation tiles** (Tracker, School Buildings, Group Insurance)

Same tile styling. Same tile copy. Same destinations. The change is structural: the homepage now visibly distinguishes "here's the site" from "here's what's notable this quarter."

Deletes dead `.home-hero` / `.home-big` / `.home-cap` / `.home-deeper` CSS from the page's inline style block. Adds `.home-intro` and `.home-divider`.

## Preview URL

Cloudflare Pages preview will appear at the branch URL — I'll edit this PR body with the link once the deploy completes.

## Test plan

- [ ] Load `/` on the preview URL. First screen shows: title, tagline, first row of section tiles. No `$X.XM` number.
- [ ] Scroll down: 7 section tiles arranged as 3 + 3 + 1 at desktop (Structure alone on the third row). Divider "NOTABLE PIECES" visible. 3 notable tiles as one clean row below.
- [ ] Click every tile — confirm each still lands on its expected page.
- [ ] Resize to mobile (~400px wide): tiles stack, divider heading still reads cleanly, tagline wraps.
- [ ] Toggle dark mode via the nav — verify identity block, divider rule, and tile borders all still legible.
- [ ] `npm run test:local` from a fresh clone of this branch — smoke suite still 52/0.

## Proof of Work

- `proof/simplify-homepage-fy27.png` — above-fold at 1440×900
- `proof/simplify-homepage-fy27-full.png` — full-page

Preview URL will be the ground-truth verification.

EOF
)"
```

Expected: `gh pr create` returns a PR URL. Post that URL back to the user.

- [ ] **Step 3: Wait for the Cloudflare Pages preview**

Watch for the preview deploy sticky comment:

```bash
sleep 60 && gh pr view --json comments --jq '.comments[] | select(.body | startswith("### Preview")) | .body' | head -20
```

If the preview comment isn't there yet, wait another 60s and retry. Once it appears, extract the **Branch URL** and edit the PR body to replace the placeholder Preview URL section.

```bash
# Once the preview URL is known:
PREVIEW_URL="<paste from comment>"
gh pr view --json body --jq .body > /tmp/pr-body.md
sed -i "s|Cloudflare Pages preview will appear at the branch URL — I'll edit this PR body with the link once the deploy completes.|Branch preview: ${PREVIEW_URL}|" /tmp/pr-body.md
gh pr edit --body-file /tmp/pr-body.md
```

- [ ] **Step 4: Post the preview URL to the user**

Send the user the PR URL *and* the Cloudflare Pages branch preview URL in one message so they can eyeball the change live per the CLAUDE.md rule ("Post the preview URL when asking for a live review").

---

## Post-implementation checklist

- [ ] PR opened, preview URL posted
- [ ] User confirms visual approval
- [ ] Merge with a plain squash-merge (per CLAUDE.md: no `--auto` unless explicitly asked)

```bash
gh pr merge <n> --squash --delete-branch
```

- [ ] After merge, offer to open https://marbleheaddata.org/ so the user can confirm production
- [ ] Clean up the worktree

```bash
cd /home/claude/marblehead
git worktree remove .dev/worktree/simplify-homepage-fy27
```
