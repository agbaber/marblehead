# OG cards for the 10 tool pages - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-06-16-og-cards-for-tools-design.md](../specs/2026-06-16-og-cards-for-tools-design.md)

**Goal:** Ship 10 bespoke 1200x630 OG cards plus punchier social rewrites for the 10 site tool pages, with a one-command regeneration pipeline.

**Architecture:** Each card is a standalone HTML file under `og-cards/` (excluded from Jekyll build), styled by a shared `_shared.css` so the cards look like a family. A `scripts/og-build.mjs` Playwright script renders each to a 1200x630 PNG into `assets/og/`. Each tool page's frontmatter wires `og_title`/`og_description`/`og_image`. A Node test asserts every targeted page is fully wired and its PNG exists; this is the TDD spine of the wiring stage.

**Tech Stack:** Jekyll 3.10, Playwright (already on box), Node's built-in `node --test` runner, vanilla HTML/CSS, no new dependencies.

---

## File structure

**Created:**

```
og-cards/
  _shared.css                                       shared shell styles
  checkbook.html                                    one HTML card per tool page
  town-budget.html
  town-debt.html
  where-has-the-money-gone.html
  senior-tax-relief.html
  inside-school-staffing.html
  school-building-maintenance.html
  org-chart.html
  branches.html
  meetings.html
scripts/og-build.mjs                                Playwright renderer
tests/og-cards.test.mjs                             wiring-completeness test
assets/og/                                          generated PNGs (10 files)
```

**Modified:**

- `_config.yml` - add `og-cards/` to `exclude:`
- `package.json` - add `og:build` script
- Each of 10 tool HTMLs - add or update `og_title`, `og_description`, `og_image` in frontmatter

---

## Task 1: Scaffold infrastructure

**Files:**
- Create: `og-cards/_shared.css`
- Create: `scripts/og-build.mjs`
- Modify: `package.json` (add npm script)
- Modify: `_config.yml` (exclude `og-cards/`)
- Create: `assets/og/.gitkeep`

- [ ] **Step 1: Create the shared card stylesheet**

Create `og-cards/_shared.css`. Mirror the site palette and load Libre Franklin (same family the site loads). The body is fixed at 1200x630 px with no scroll.

```css
/* og-cards/_shared.css
   Shared shell for OG cards. Each card HTML imports this, then sets
   only the bespoke visual block. Card body is fixed 1200x630.
*/

@import url('https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;600;700;800&display=swap');

:root {
  --c-fog:     #F4F7FA;
  --c-surface: #FFFFFF;
  --c-border:  #D8E1E8;
  --c-text:    #0F2A3D;
  --c-mid:     #4A5C6A;
  --c-sub:     #7A8A98;
  --c-navy:    #1B3A57;
  --c-buoy:    #C8553D;
  --c-teal:    #2F7D8E;
  --c-brass:   #B8860B;
  --c-sage:    #5B7553;
  --c-plum:    #6C4A6E;
}

*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  width: 1200px;
  height: 630px;
  overflow: hidden;
  background: var(--c-fog);
  font-family: 'Libre Franklin', system-ui, -apple-system, sans-serif;
  color: var(--c-text);
  -webkit-font-smoothing: antialiased;
}

.card {
  width: 1200px;
  height: 630px;
  padding: 56px 64px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 28px;
}

.card-mark {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--c-navy);
}

.card-mark::before {
  content: "";
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-right: 10px;
  border-radius: 50%;
  background: var(--c-buoy);
  vertical-align: middle;
  transform: translateY(-2px);
}

.card-headline {
  font-size: 56px;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--c-text);
  max-width: 1000px;
}

.card-visual {
  align-self: end;
}

.card-foot {
  font-size: 18px;
  color: var(--c-sub);
  letter-spacing: 0.04em;
}
```

- [ ] **Step 2: Create the build script**

Create `scripts/og-build.mjs`. Uses Playwright (already a dep) to render each `og-cards/*.html` to a PNG at 1200x630.

```javascript
// scripts/og-build.mjs
// Render every og-cards/*.html to assets/og/<name>.png at 1200x630.
// Usage:
//   node scripts/og-build.mjs            # build all
//   node scripts/og-build.mjs checkbook  # build just checkbook.html

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARDS_DIR = path.join(ROOT, 'og-cards');
const OUT_DIR = path.join(ROOT, 'assets', 'og');

const target = process.argv[2];

const cards = (await fs.readdir(CARDS_DIR))
  .filter(f => f.endsWith('.html') && !f.startsWith('_'))
  .filter(f => !target || f === `${target}.html`);

if (cards.length === 0) {
  console.error(target
    ? `No card named ${target}.html in og-cards/`
    : 'No cards found in og-cards/');
  process.exit(1);
}

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
try {
  for (const file of cards) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const url = pathToFileURL(path.join(CARDS_DIR, file)).href;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const name = file.replace(/\.html$/, '');
    const out = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({
      path: out,
      type: 'png',
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    await context.close();
    console.log(`wrote ${path.relative(ROOT, out)}`);
  }
} finally {
  await browser.close();
}
```

- [ ] **Step 3: Wire the npm script**

Open `package.json`. Add `"og:build": "node scripts/og-build.mjs"` to the `scripts` object, in alphabetical position between `dev` and `preview:search`.

The resulting `scripts` block has this exact `og:build` line:

```json
"og:build": "node scripts/og-build.mjs",
```

- [ ] **Step 4: Exclude og-cards from Jekyll build**

Open `_config.yml`. In the existing `exclude:` list, add `- og-cards/` between `vendor/` and `Gemfile` (or in any position; Jekyll order does not matter):

```yaml
exclude:
  - README.md
  - STYLE_GUIDE.md
  - SOCIAL_MEDIA_PLAN.md
  - LICENSE
  - docs/
  - data/acfr/
  - data/budgets/
  - community-pulse/
  - node_modules/
  - vendor/
  - og-cards/
  - Gemfile
  - Gemfile.lock
  - proof/
```

- [ ] **Step 5: Create the assets/og directory**

```bash
mkdir -p assets/og
touch assets/og/.gitkeep
```

- [ ] **Step 6: Sanity check the build script with no cards**

```bash
node scripts/og-build.mjs
```

Expected: `No cards found in og-cards/` and exit code 1. This confirms the script runs and the error path works.

- [ ] **Step 7: Commit**

```bash
git add og-cards/_shared.css scripts/og-build.mjs package.json _config.yml assets/og/.gitkeep
git commit -m "Scaffold OG card build pipeline"
```

---

## Task 2: Write the wiring-completeness test

**Files:**
- Create: `tests/og-cards.test.mjs`

This test enforces that every targeted page has `og_title`, `og_description`, `og_image`, and that the PNG referenced exists. It will fail for all 10 pages until subsequent tasks ship their cards.

- [ ] **Step 1: Write the failing test**

Create `tests/og-cards.test.mjs`:

```javascript
// tests/og-cards.test.mjs
// Asserts every tool page in the list has og_title, og_description,
// og_image set in frontmatter, and that the referenced og_image PNG
// exists in the repo. Runs under `node --test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  'checkbook.html',
  'town-budget.html',
  'town-debt.html',
  'where-has-the-money-gone.html',
  'senior-tax-relief.html',
  'inside-school-staffing.html',
  'school-building-maintenance.html',
  'org-chart.html',
  'branches.html',
  'meetings.html',
];

function readFrontmatter(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const match = src.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.+?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

for (const page of PAGES) {
  test(`${page} has complete OG frontmatter and image asset`, () => {
    const fm = readFrontmatter(path.join(ROOT, page));
    assert.ok(fm.og_title, `${page}: missing og_title`);
    assert.ok(fm.og_description, `${page}: missing og_description`);
    assert.ok(fm.og_image, `${page}: missing og_image`);

    const imgRel = fm.og_image.replace(/^\//, '');
    const imgAbs = path.join(ROOT, imgRel);
    assert.ok(
      fs.existsSync(imgAbs),
      `${page}: og_image points to ${fm.og_image} which does not exist`,
    );
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
node --test tests/og-cards.test.mjs
```

Expected: 10 failing tests. (Some pages already have og_title and og_description, but `og_image` is unset on all 10, or the PNG does not yet exist. Either way, all 10 cases fail today.)

- [ ] **Step 3: Commit**

```bash
git add tests/og-cards.test.mjs
git commit -m "Add OG card wiring-completeness test"
```

---

## Per-card task template (Tasks 3-12)

Each of the next 10 tasks follows the same shape:

1. Re-read the live page to verify exact numbers and claim.
2. Create `og-cards/<page>.html` using the worked example from Task 3 as the template; only the headline string and the `.card-visual` block change between cards.
3. Run `node scripts/og-build.mjs <page>` to render the PNG.
4. Update the page's frontmatter with `og_title`, `og_description`, `og_image`.
5. Run `node --test tests/og-cards.test.mjs` and verify that page's case now passes.
6. Spot-check the PNG by opening it in the file viewer (or via `npx playwright screenshot` against the dev server to confirm FB-side rendering at 1200x630).
7. Commit (one commit per card so a problem with one card never blocks reviewing the others).

**Cardinal rule reminder:** Re-read the live page at write time. Do not author numbers from memory of an earlier session.

---

## Task 3: Card 1 - checkbook.html

**Files:**
- Modify: nothing in step 1 (read only)
- Create: `og-cards/checkbook.html`
- Create: `assets/og/checkbook.png` (generated)
- Modify: `checkbook.html` (frontmatter)

- [ ] **Step 1: Re-read the page to verify key numbers**

```bash
grep -E 'class="[^"]*lede|class="[^"]*hero|class="[^"]*summary|adopted|vendor checks|\$[0-9]+\.[0-9]+M' checkbook.html | head -20
```

Confirm or update the description-loading numbers (vendor-check total YTD; adopted total across all funds).

- [ ] **Step 2: Create the card HTML**

Create `og-cards/checkbook.html`. This is also the worked example for Tasks 4-12 - the shell structure here is what subsequent cards copy.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    .ledger {
      width: 100%;
      max-width: 1060px;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    .ledger td {
      padding: 14px 20px;
      border-top: 1px solid var(--c-border);
      font-size: 26px;
      color: var(--c-mid);
    }
    .ledger td.amt { text-align: right; font-weight: 700; color: var(--c-text); }
    .ledger tr.total td {
      border-top: 3px solid var(--c-navy);
      color: var(--c-navy);
      font-weight: 800;
      font-size: 30px;
    }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">Every check the town wrote.</h1>
    <div class="card-visual">
      <table class="ledger">
        <tr><td>School Department</td><td class="amt">$41.2M</td></tr>
        <tr><td>Public Works</td><td class="amt">$8.7M</td></tr>
        <tr><td>Public Safety</td><td class="amt">$11.4M</td></tr>
        <tr><td>Health insurance</td><td class="amt">$15.1M</td></tr>
        <tr class="total"><td>FY26 vendor checks, YTD</td><td class="amt">$99.9M</td></tr>
      </table>
    </div>
    <footer class="card-foot">/checkbook</footer>
  </main>
</body>
</html>
```

(The four sample rows above are illustrative line items. Adjust to whichever four categories the live checkbook page emphasizes. Total must match the page's current YTD figure.)

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs checkbook
```

Expected output: `wrote assets/og/checkbook.png`.

- [ ] **Step 4: Verify the PNG is the correct size**

```bash
file assets/og/checkbook.png
```

Expected: `PNG image data, 1200 x 630, 8-bit/color RGB[A], non-interlaced`.

- [ ] **Step 5: Wire the frontmatter**

Open `checkbook.html`. Replace the existing `og_title` and `og_description` lines and add `og_image`:

```yaml
og_title: "Every check the town wrote"
og_description: "FY26 spending and pacing for Marblehead. $99.9M in vendor checks through Jun 9, against a $206.1M adopted budget across all funds."
og_image: /assets/og/checkbook.png
```

(Verify both dollar figures against the page before saving.)

- [ ] **Step 6: Run the wiring test for this page only**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'checkbook|^# pass|^# fail'
```

Expected: `checkbook.html has complete OG frontmatter and image asset` passes.

- [ ] **Step 7: Commit**

```bash
git add og-cards/checkbook.html assets/og/checkbook.png checkbook.html
git commit -m "Add OG card and share rewrite for checkbook"
```

---

## Task 4: Card 2 - town-budget.html

**Files:**
- Create: `og-cards/town-budget.html`
- Create: `assets/og/town-budget.png`
- Modify: `town-budget.html` (frontmatter)

- [ ] **Step 1: Re-read the page to verify the $122.76M total and department breakdown**

```bash
grep -E '\$[0-9]+\.[0-9]+M|class="[^"]*lede|Schools|FY27' town-budget.html | head -20
```

- [ ] **Step 2: Create the card HTML**

Follow the shell from Task 3. The visual is a stacked horizontal bar of top departments with schools highlighted (use `--c-buoy` for the schools segment, neutral grey for the rest).

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    .bar {
      width: 100%;
      max-width: 1060px;
      height: 88px;
      display: flex;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(15,42,61,.10);
    }
    .seg {
      display: flex;
      align-items: center;
      padding: 0 18px;
      color: white;
      font-weight: 700;
      font-size: 22px;
    }
    .seg.schools { background: var(--c-buoy); }
    .seg.town    { background: var(--c-navy); }
    .seg.benefits{ background: var(--c-teal); }
    .seg.debt    { background: var(--c-sage); }
    .seg.other   { background: #93A4B0; }

    .legend {
      margin-top: 22px;
      display: flex;
      gap: 28px;
      font-size: 22px;
      color: var(--c-mid);
    }
    .legend span::before {
      content: "";
      display: inline-block;
      width: 14px;
      height: 14px;
      margin-right: 8px;
      border-radius: 3px;
      vertical-align: -2px;
    }
    .legend .schools::before  { background: var(--c-buoy); }
    .legend .town::before     { background: var(--c-navy); }
    .legend .benefits::before { background: var(--c-teal); }
    .legend .debt::before     { background: var(--c-sage); }
    .legend .other::before    { background: #93A4B0; }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">$122.76M, line by line.</h1>
    <div class="card-visual">
      <div class="bar">
        <div class="seg schools" style="flex: 47.6">Schools $47.6M</div>
        <div class="seg town" style="flex: 28">Town departments</div>
        <div class="seg benefits" style="flex: 18">Benefits</div>
        <div class="seg debt" style="flex: 10">Debt</div>
        <div class="seg other" style="flex: 19">Other</div>
      </div>
      <div class="legend">
        <span class="schools">Schools</span>
        <span class="town">Town</span>
        <span class="benefits">Benefits</span>
        <span class="debt">Debt</span>
        <span class="other">Other</span>
      </div>
    </div>
    <footer class="card-foot">/town-budget</footer>
  </main>
</body>
</html>
```

(Segment widths are placeholders. Adjust `flex:` values so they reflect the page's actual department proportions. The whole row must read as one $122.76M.)

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs town-budget
```

- [ ] **Step 4: Verify size**

```bash
file assets/og/town-budget.png
```

Expected: `PNG image data, 1200 x 630, ...`.

- [ ] **Step 5: Wire frontmatter**

In `town-budget.html`:

```yaml
og_title: "$122.76M, line by line"
og_description: "Every line item in Marblehead's FY27 Proposed Budget (No Override). Filter, sort, drill into any department."
og_image: /assets/og/town-budget.png
```

- [ ] **Step 6: Test**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'town-budget|^# pass|^# fail'
```

- [ ] **Step 7: Commit**

```bash
git add og-cards/town-budget.html assets/og/town-budget.png town-budget.html
git commit -m "Add OG card and share rewrite for town-budget"
```

---

## Task 5: Card 3 - town-debt.html

**Files:**
- Create: `og-cards/town-debt.html`
- Create: `assets/og/town-debt.png`
- Modify: `town-debt.html` (frontmatter)

- [ ] **Step 1: Re-read the page**

```bash
grep -E '\$11[0-9]|51 |since 1988|Tucker' town-debt.html | head -10
```

Verify: $116M total, 51 ballot questions since 1988, 50 yes, 1 no.

- [ ] **Step 2: Create the card HTML**

Headline-driven; the visual is a big tally.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    .tally {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      width: 100%;
      max-width: 980px;
      align-items: end;
    }
    .tally-num {
      font-size: 140px;
      font-weight: 800;
      line-height: 1;
      color: var(--c-navy);
      font-variant-numeric: tabular-nums;
    }
    .tally-num .sub {
      display: block;
      font-size: 26px;
      font-weight: 700;
      color: var(--c-mid);
      letter-spacing: 0.04em;
      margin-top: 10px;
      text-transform: uppercase;
    }
    .tally .no .tally-num { color: var(--c-buoy); }
    .tally .label-row { display: flex; align-items: baseline; gap: 14px; }
    .check { font-size: 56px; color: var(--c-sage); }
    .x     { font-size: 56px; color: var(--c-buoy); }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">$116M of debt. Voters approved every dollar.</h1>
    <div class="card-visual">
      <div class="tally">
        <div class="yes">
          <div class="label-row"><span class="check">✓</span><span class="tally-num">50<span class="sub">yes votes</span></span></div>
        </div>
        <div class="no">
          <div class="label-row"><span class="x">✗</span><span class="tally-num">1<span class="sub">no vote (Tucker's Wharf, 2002)</span></span></div>
        </div>
      </div>
    </div>
    <footer class="card-foot">/town-debt &middot; 51 ballot questions since 1988</footer>
  </main>
</body>
</html>
```

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs town-debt
```

- [ ] **Step 4: Verify size**

```bash
file assets/og/town-debt.png
```

- [ ] **Step 5: Wire frontmatter**

```yaml
og_title: "$116M of debt. Voters approved every dollar."
og_description: "51 debt-exclusion ballot questions in Marblehead since 1988. Voters said yes 50 times. The lone no was Tucker's Wharf, 2002."
og_image: /assets/og/town-debt.png
```

- [ ] **Step 6: Test**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'town-debt|^# pass|^# fail'
```

- [ ] **Step 7: Commit**

```bash
git add og-cards/town-debt.html assets/og/town-debt.png town-debt.html
git commit -m "Add OG card and share rewrite for town-debt"
```

---

## Task 6: Card 4 - where-has-the-money-gone.html

**Files:**
- Create: `og-cards/where-has-the-money-gone.html`
- Create: `assets/og/where-has-the-money-gone.png`
- Modify: `where-has-the-money-gone.html` (frontmatter)

- [ ] **Step 1: Re-read the page**

```bash
grep -E 'general fund|grew|\$70|\$106|\$35\.7|FY15|FY26|six categories' where-has-the-money-gone.html | head -15
```

Verify: $70.5M -> $106.2M, six categories explain growth.

- [ ] **Step 2: Create the card HTML**

Visual: a side-by-side comparison FY15 vs FY26 with the six growth callouts.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    .compare {
      display: grid;
      grid-template-columns: auto auto 1fr;
      gap: 28px;
      align-items: center;
      width: 100%;
    }
    .stack {
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .stack .num { font-size: 72px; font-weight: 800; color: var(--c-navy); line-height: 1; }
    .stack .lbl { font-size: 22px; color: var(--c-mid); margin-top: 6px; letter-spacing: 0.03em; }
    .arrow {
      font-size: 56px;
      color: var(--c-buoy);
      font-weight: 700;
    }
    .deltas {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 24px;
      font-size: 22px;
      color: var(--c-mid);
      max-width: 580px;
    }
    .deltas b { color: var(--c-text); font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">Marblehead's GF grew $35.7M in a decade.</h1>
    <div class="card-visual">
      <div class="compare">
        <div class="stack">
          <div class="num">$70.5M</div>
          <div class="lbl">FY15</div>
        </div>
        <div class="arrow">&rarr;</div>
        <div class="stack" style="text-align:left">
          <div class="num">$106.2M</div>
          <div class="lbl">FY26</div>
        </div>
      </div>
      <div class="deltas" style="margin-top: 36px">
        <div><b>Schools</b> nearly half of growth</div>
        <div><b>Health insurance</b></div>
        <div><b>Public safety</b></div>
        <div><b>Debt service</b></div>
        <div><b>Pensions</b></div>
        <div><b>Everything else</b></div>
      </div>
    </div>
    <footer class="card-foot">/where-has-the-money-gone</footer>
  </main>
</body>
</html>
```

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs where-has-the-money-gone
```

- [ ] **Step 4: Verify size**

```bash
file assets/og/where-has-the-money-gone.png
```

- [ ] **Step 5: Wire frontmatter**

```yaml
og_title: "Marblehead's general fund grew $35.7M in a decade"
og_description: "$70.5M to $106.2M from FY15 to FY26. Six categories account for nearly all of it. Schools alone are nearly half."
og_image: /assets/og/where-has-the-money-gone.png
```

- [ ] **Step 6: Test**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'where-has-the-money-gone|^# pass|^# fail'
```

- [ ] **Step 7: Commit**

```bash
git add og-cards/where-has-the-money-gone.html assets/og/where-has-the-money-gone.png where-has-the-money-gone.html
git commit -m "Add OG card and share rewrite for where-has-the-money-gone"
```

---

## Task 7: Card 5 - senior-tax-relief.html

**Files:**
- Create: `og-cards/senior-tax-relief.html`
- Create: `assets/og/senior-tax-relief.png`
- Modify: `senior-tax-relief.html` (frontmatter)

- [ ] **Step 1: Re-read the page**

```bash
grep -E 'Circuit Breaker|\$2,820|Article 28|H\.4225|Chapter 67' senior-tax-relief.html | head -15
```

- [ ] **Step 2: Create the card HTML**

Visual: a stylized calculator-form mockup with two input fields and a credit output.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    .calc {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 32px;
      align-items: center;
      width: 100%;
      max-width: 1060px;
    }
    .inputs {
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: 14px;
      padding: 22px 26px;
      box-shadow: 0 1px 3px rgba(15,42,61,.10);
    }
    .field { margin-bottom: 18px; }
    .field:last-child { margin-bottom: 0; }
    .field .l { font-size: 18px; color: var(--c-sub); text-transform: uppercase; letter-spacing: 0.05em; }
    .field .v { font-size: 36px; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .credit {
      text-align: center;
      padding: 22px 24px;
      border-radius: 14px;
      background: var(--c-navy);
      color: white;
    }
    .credit .amt {
      font-size: 76px;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .credit .lbl {
      margin-top: 10px;
      font-size: 20px;
      letter-spacing: 0.04em;
    }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">Two senior tax breaks worth claiming.</h1>
    <div class="card-visual">
      <div class="calc">
        <div class="inputs">
          <div class="field">
            <div class="l">Home assessed value</div>
            <div class="v">$725,000</div>
          </div>
          <div class="field">
            <div class="l">Household income</div>
            <div class="v">$48,000</div>
          </div>
        </div>
        <div class="credit">
          <div class="amt">$2,820</div>
          <div class="lbl">Circuit Breaker max</div>
        </div>
      </div>
    </div>
    <footer class="card-foot">/senior-tax-relief &middot; plus Article 28 (Chapter 67 of 2026), pending implementation</footer>
  </main>
</body>
</html>
```

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs senior-tax-relief
```

- [ ] **Step 4: Verify size**

```bash
file assets/og/senior-tax-relief.png
```

- [ ] **Step 5: Wire frontmatter**

```yaml
og_title: "Two senior tax breaks worth claiming"
og_description: "Marblehead's Circuit Breaker refunds up to $2,820 per year for eligible seniors. Article 28 stacks on top once the Select Board adopts implementation regulations."
og_image: /assets/og/senior-tax-relief.png
```

- [ ] **Step 6: Test**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'senior-tax-relief|^# pass|^# fail'
```

- [ ] **Step 7: Commit**

```bash
git add og-cards/senior-tax-relief.html assets/og/senior-tax-relief.png senior-tax-relief.html
git commit -m "Add OG card and share rewrite for senior-tax-relief"
```

---

## Task 8: Card 6 - inside-school-staffing.html

**Files:**
- Create: `og-cards/inside-school-staffing.html`
- Create: `assets/og/inside-school-staffing.png`
- Modify: `inside-school-staffing.html` (frontmatter)

- [ ] **Step 1: Re-read the page**

```bash
grep -E '430|5\.6|7\.8|Melrose|FTE|2,400' inside-school-staffing.html | head -15
```

- [ ] **Step 2: Create the card HTML**

Visual: a pictograph block of 430 dots arranged in a 30-wide grid, sub-grouped by role color, with a callout for the student-to-staff ratio.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    .dots {
      display: grid;
      grid-template-columns: repeat(30, 1fr);
      gap: 6px;
      width: 100%;
      max-width: 720px;
    }
    .dot {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 50%;
      background: var(--c-navy);
    }
    .dot.teacher  { background: var(--c-navy); }
    .dot.paratut  { background: var(--c-teal); }
    .dot.sped     { background: var(--c-brass); }
    .dot.admin    { background: var(--c-plum); }
    .dot.support  { background: #93A4B0; }
    .ratio {
      display: inline-block;
      margin-left: 40px;
      vertical-align: middle;
      font-variant-numeric: tabular-nums;
    }
    .ratio .big { font-size: 96px; font-weight: 800; color: var(--c-buoy); line-height: 1; }
    .ratio .lbl { font-size: 22px; color: var(--c-mid); margin-top: 8px; max-width: 240px; }
    .row { display: flex; align-items: center; }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">What 430 school positions actually do.</h1>
    <div class="card-visual">
      <div class="row">
        <div class="dots" id="dots"></div>
        <div class="ratio">
          <div class="big">5.6</div>
          <div class="lbl">Marblehead students per staff member. Melrose: 7.8.</div>
        </div>
      </div>
      <script>
        // Render 430 dots, colored by role bucket (approximate proportions).
        const dots = document.getElementById('dots');
        const buckets = [
          ['teacher', 180],
          ['paratut',  88],
          ['sped',     60],
          ['support',  62],
          ['admin',    40],
        ];
        for (const [cls, n] of buckets) {
          for (let i = 0; i < n; i++) {
            const d = document.createElement('div');
            d.className = 'dot ' + cls;
            dots.appendChild(d);
          }
        }
      </script>
    </div>
    <footer class="card-foot">/inside-school-staffing &middot; DESE 2025-26</footer>
  </main>
</body>
</html>
```

(Bucket sizes are illustrative; pick proportions that match the page's actual breakdown so the colored bands read truthfully.)

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs inside-school-staffing
```

- [ ] **Step 4: Verify size**

```bash
file assets/og/inside-school-staffing.png
```

- [ ] **Step 5: Wire frontmatter**

```yaml
og_title: "What 430 school positions actually do"
og_description: "5.6 Marblehead students per school staff member, versus 7.8 in Melrose. The DESE role breakdown, with the tutor-vs-para classification quirk explained."
og_image: /assets/og/inside-school-staffing.png
```

- [ ] **Step 6: Test**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'inside-school-staffing|^# pass|^# fail'
```

- [ ] **Step 7: Commit**

```bash
git add og-cards/inside-school-staffing.html assets/og/inside-school-staffing.png inside-school-staffing.html
git commit -m "Add OG card and share rewrite for inside-school-staffing"
```

---

## Task 9: Card 7 - school-building-maintenance.html

**Files:**
- Create: `og-cards/school-building-maintenance.html`
- Create: `assets/og/school-building-maintenance.png`
- Modify: `school-building-maintenance.html` (frontmatter)

- [ ] **Step 1: Re-read the page**

```bash
grep -E 'High School|Veterans|Village|Glover|Brown|\$8\.9|Built |years old' school-building-maintenance.html | head -20
```

Verify the five-school list and the Glover roof/HVAC dollar figure.

- [ ] **Step 2: Create the card HTML**

Visual: five labeled cards in a row, one per school, each with year built. Glover is highlighted (current project).

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    .schools {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      width: 100%;
      max-width: 1060px;
    }
    .sch {
      border: 1px solid var(--c-border);
      border-radius: 12px;
      padding: 18px 16px;
      background: var(--c-surface);
      text-align: center;
    }
    .sch .name { font-weight: 700; font-size: 22px; color: var(--c-text); }
    .sch .yr   { margin-top: 8px; font-size: 18px; color: var(--c-sub); }
    .sch.active { border-color: var(--c-buoy); border-width: 2px; }
    .sch.active .name { color: var(--c-buoy); }
    .sch.active .yr   { color: var(--c-buoy); font-weight: 600; }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">5 schools, by condition.</h1>
    <div class="card-visual">
      <div class="schools">
        <div class="sch"><div class="name">High School</div><div class="yr">Built 2002</div></div>
        <div class="sch"><div class="name">Veterans Middle</div><div class="yr">Built 1972</div></div>
        <div class="sch"><div class="name">Village</div><div class="yr">Built 1995</div></div>
        <div class="sch active"><div class="name">Glover</div><div class="yr">$8.97M roof &amp; HVAC underway</div></div>
        <div class="sch"><div class="name">Brown</div><div class="yr">Built 1960s</div></div>
      </div>
    </div>
    <footer class="card-foot">/school-building-maintenance</footer>
  </main>
</body>
</html>
```

(Verify each school's year built against the live page before committing. Adjust strings to match what the page currently states.)

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs school-building-maintenance
```

- [ ] **Step 4: Verify size**

```bash
file assets/og/school-building-maintenance.png
```

- [ ] **Step 5: Wire frontmatter**

```yaml
og_title: "5 schools, by condition"
og_description: "Marblehead's only comprehensive condition assessment for its school buildings. Glover roof and HVAC underway at $8.97M, under the GC budget."
og_image: /assets/og/school-building-maintenance.png
```

- [ ] **Step 6: Test**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'school-building-maintenance|^# pass|^# fail'
```

- [ ] **Step 7: Commit**

```bash
git add og-cards/school-building-maintenance.html assets/og/school-building-maintenance.png school-building-maintenance.html
git commit -m "Add OG card and share rewrite for school-building-maintenance"
```

---

## Task 10: Card 8 - org-chart.html

**Files:**
- Create: `og-cards/org-chart.html`
- Create: `assets/og/org-chart.png`
- Modify: `org-chart.html` (frontmatter)

- [ ] **Step 1: Re-read the page**

```bash
grep -E 'two parallel|town side|school side|cluster|Select Board|School Committee' org-chart.html | head -15
```

- [ ] **Step 2: Create the card HTML**

Visual: a simplified two-column tree, voters at top branching into Select Board (town) and School Committee (schools), each with a small cluster of leaves.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    .tree { width: 100%; max-width: 1060px; }
    .row { display: flex; justify-content: center; gap: 80px; margin-bottom: 18px; }
    .pill {
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: 10px;
      padding: 12px 20px;
      font-weight: 700;
      font-size: 22px;
      color: var(--c-text);
      box-shadow: 0 1px 2px rgba(15,42,61,.06);
    }
    .pill.voters { background: var(--c-navy); color: white; border-color: var(--c-navy); }
    .pill.board  { background: var(--c-teal); color: white; border-color: var(--c-teal); }
    .branches { display: flex; gap: 12px; flex-wrap: wrap; max-width: 480px; justify-content: center; }
    .leaf {
      background: var(--c-fog);
      border: 1px solid var(--c-border);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 18px;
      color: var(--c-mid);
    }
    .col { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .label { font-size: 18px; color: var(--c-sub); letter-spacing: 0.05em; text-transform: uppercase; }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">Two parallel governments run Marblehead.</h1>
    <div class="card-visual">
      <div class="tree">
        <div class="row"><div class="pill voters">Registered voters</div></div>
        <div class="row">
          <div class="col">
            <div class="label">Town side</div>
            <div class="pill board">Select Board</div>
            <div class="branches">
              <div class="leaf">Finance</div>
              <div class="leaf">Public Safety</div>
              <div class="leaf">Public Works</div>
              <div class="leaf">Community</div>
              <div class="leaf">Admin</div>
            </div>
          </div>
          <div class="col">
            <div class="label">School side</div>
            <div class="pill board">School Committee</div>
            <div class="branches">
              <div class="leaf">Central Office</div>
              <div class="leaf">Buildings</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <footer class="card-foot">/org-chart</footer>
  </main>
</body>
</html>
```

(Cluster labels should match the page's own grouping. The page calls them "functional clusters"; lift the exact names.)

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs org-chart
```

- [ ] **Step 4: Verify size**

```bash
file assets/og/org-chart.png
```

- [ ] **Step 5: Wire frontmatter**

```yaml
og_title: "Two parallel governments run Marblehead"
og_description: "Town side and school side, each with its own elected board, each with its own administrative cluster. State law keeps them separate."
og_image: /assets/og/org-chart.png
```

- [ ] **Step 6: Test**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'org-chart|^# pass|^# fail'
```

- [ ] **Step 7: Commit**

```bash
git add og-cards/org-chart.html assets/og/org-chart.png org-chart.html
git commit -m "Add OG card and share rewrite for org-chart"
```

---

## Task 11: Card 9 - branches.html

**Files:**
- Create: `og-cards/branches.html`
- Create: `assets/og/branches.png`
- Modify: `branches.html` (frontmatter)

- [ ] **Step 1: Re-read the page**

```bash
grep -E 'verification|branch|Revolutionary|residents|invite' branches.html | head -15
```

- [ ] **Step 2: Create the card HTML**

Visual: an inline SVG network graph: a few labeled nodes (branch names), some edges, all in the site palette.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    svg { width: 100%; max-width: 1060px; height: 360px; }
    .node circle { fill: var(--c-teal); stroke: var(--c-navy); stroke-width: 2; }
    .node text { fill: var(--c-text); font-weight: 700; font-size: 18px; text-anchor: middle; dominant-baseline: middle; }
    .edge { stroke: var(--c-border); stroke-width: 2; }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">How Marblehead residents verify each other.</h1>
    <div class="card-visual">
      <svg viewBox="0 0 1000 360">
        <line class="edge" x1="200" y1="120" x2="400" y2="80"/>
        <line class="edge" x1="200" y1="120" x2="380" y2="240"/>
        <line class="edge" x1="400" y1="80"  x2="600" y2="140"/>
        <line class="edge" x1="380" y1="240" x2="600" y2="140"/>
        <line class="edge" x1="600" y1="140" x2="800" y2="80"/>
        <line class="edge" x1="600" y1="140" x2="780" y2="260"/>

        <g class="node"><circle cx="200" cy="120" r="56"/><text x="200" y="120">Glover</text></g>
        <g class="node"><circle cx="400" cy="80"  r="56"/><text x="400" y="80">Mugford</text></g>
        <g class="node"><circle cx="380" cy="240" r="56"/><text x="380" y="240">Russell</text></g>
        <g class="node"><circle cx="600" cy="140" r="64"/><text x="600" y="140">Lee</text></g>
        <g class="node"><circle cx="800" cy="80"  r="56"/><text x="800" y="80">Devereux</text></g>
        <g class="node"><circle cx="780" cy="260" r="56"/><text x="780" y="260">Orne</text></g>
      </svg>
    </div>
    <footer class="card-foot">/branches &middot; named for Marblehead Revolutionary War figures</footer>
  </main>
</body>
</html>
```

(Branch labels are illustrative. Pick six from the page's actual current branch list.)

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs branches
```

- [ ] **Step 4: Verify size**

```bash
file assets/og/branches.png
```

- [ ] **Step 5: Wire frontmatter**

```yaml
og_title: "How Marblehead residents verify each other"
og_description: "Verified residents cluster into neighborhood branches through the neighbor invitation network. Each branch is named for a Marblehead Revolutionary War figure."
og_image: /assets/og/branches.png
```

- [ ] **Step 6: Test**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'branches|^# pass|^# fail'
```

- [ ] **Step 7: Commit**

```bash
git add og-cards/branches.html assets/og/branches.png branches.html
git commit -m "Add OG card and share rewrite for branches"
```

---

## Task 12: Card 10 - meetings.html

**Files:**
- Create: `og-cards/meetings.html`
- Create: `assets/og/meetings.png`
- Modify: `meetings.html` (frontmatter)

Note: `meetings.html` ships today with no `og_title` or `og_description`, so this is a from-scratch frontmatter write.

- [ ] **Step 1: Re-read the page**

```bash
grep -E 'MHTV|transcript|summary|board|committee' meetings.html | head -10
```

- [ ] **Step 2: Create the card HTML**

Visual: a stack of three meeting cards, the front one expanded showing title + a snippet.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="_shared.css">
  <style>
    .stack {
      position: relative;
      width: 100%;
      max-width: 920px;
      height: 280px;
    }
    .meeting {
      position: absolute;
      width: 720px;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: 14px;
      padding: 22px 26px;
      box-shadow: 0 6px 22px rgba(15,42,61,.10);
    }
    .meeting.back  { top: 0;   left: 100px; opacity: 0.45; }
    .meeting.mid   { top: 30px; left: 70px; opacity: 0.7; }
    .meeting.front { top: 70px; left: 30px; }
    .title { font-size: 24px; font-weight: 700; color: var(--c-text); margin-bottom: 8px; }
    .meta  { font-size: 16px; color: var(--c-sub); letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 12px; }
    .snip  { font-size: 18px; color: var(--c-mid); line-height: 1.35; }
  </style>
</head>
<body>
  <main class="card">
    <header class="card-mark">marbleheaddata.org</header>
    <h1 class="card-headline">Every public meeting, transcribed.</h1>
    <div class="card-visual">
      <div class="stack">
        <div class="meeting back"><div class="title">School Committee</div></div>
        <div class="meeting mid"><div class="title">Finance Committee</div></div>
        <div class="meeting front">
          <div class="meta">Select Board &middot; Jun 4, 2026</div>
          <div class="title">Override implementation, FY27 hiring plan, dock revenue</div>
          <div class="snip">AI summary above; full transcript with timestamps below. Search across every meeting on the site.</div>
        </div>
      </div>
    </div>
    <footer class="card-foot">/meetings</footer>
  </main>
</body>
</html>
```

(Meeting titles/dates are illustrative; use whichever recent meeting reads compellingly as the worked example.)

- [ ] **Step 3: Build the PNG**

```bash
node scripts/og-build.mjs meetings
```

- [ ] **Step 4: Verify size**

```bash
file assets/og/meetings.png
```

- [ ] **Step 5: Wire frontmatter**

```yaml
og_title: "Every public meeting, transcribed"
og_description: "AI summaries plus full timestamped transcripts of every Marblehead board and committee meeting, sourced from MHTV. Searchable across the archive."
og_image: /assets/og/meetings.png
```

- [ ] **Step 6: Test**

```bash
node --test tests/og-cards.test.mjs 2>&1 | grep -E 'meetings|^# pass|^# fail'
```

- [ ] **Step 7: Commit**

```bash
git add og-cards/meetings.html assets/og/meetings.png meetings.html
git commit -m "Add OG card and share rewrite for meetings"
```

---

## Task 13: Full verification

**Files:**
- No source changes; verification only.

- [ ] **Step 1: Run the full wiring suite**

```bash
node --test tests/og-cards.test.mjs
```

Expected: all 10 tests pass.

- [ ] **Step 2: Run the existing smoke suite to catch regressions**

```bash
npm run test:local
```

Expected: 52 pass / 0 fail (or whatever the current baseline is; no new failures).

- [ ] **Step 3: Rebuild all cards from scratch as a one-command sanity check**

```bash
rm -rf assets/og/*.png
node scripts/og-build.mjs
ls assets/og/*.png | wc -l
```

Expected: 10. Confirms `npm run og:build` is idempotent and produces exactly the 10 cards.

- [ ] **Step 4: Eyeball every card**

Open `assets/og/checkbook.png`, `town-budget.png`, `town-debt.png`, `where-has-the-money-gone.png`, `senior-tax-relief.png`, `inside-school-staffing.png`, `school-building-maintenance.png`, `org-chart.png`, `branches.png`, `meetings.png`. For each, check:

- Card looks like a member of the family (palette, font, mark in corner)
- Headline is legible at thumbnail scale (squint test)
- No text overflow, no broken layout
- The bespoke visual reads correctly

If any card needs revision, edit its `og-cards/<name>.html`, run `node scripts/og-build.mjs <name>`, re-commit.

- [ ] **Step 5: Capture proof grid for the PR body**

Use Playwright to capture a 2-column grid of all 10 PNGs into `proof/og-cards-grid.png`. Script:

```javascript
// One-off; do not commit. Save to /tmp/grid.mjs and run.
import { chromium } from 'playwright';
import path from 'node:path';

const cards = [
  'checkbook','town-budget','town-debt','where-has-the-money-gone',
  'senior-tax-relief','inside-school-staffing','school-building-maintenance',
  'org-chart','branches','meetings',
];
const html = `
<style>
  body{background:#0F2A3D;margin:0;padding:24px;font-family:sans-serif}
  .g{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .g img{width:100%;border-radius:8px}
  .g div{color:#fff;text-align:center;font-size:14px;margin-top:4px}
</style>
<div class="g">
${cards.map(c => `<div><img src="file://${path.resolve('assets/og/' + c + '.png')}"/><div>${c}</div></div>`).join('')}
</div>
`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 3300 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'proof/og-cards-grid.png', fullPage: true });
await browser.close();
```

```bash
mkdir -p proof
node /tmp/grid.mjs
git add proof/og-cards-grid.png
git commit -m "Add proof grid of all 10 OG cards"
```

---

## Task 14: Push and open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin "$(git branch --show-current)"
```

- [ ] **Step 2: Open the PR**

Use `gh pr create` with this body. Fill in `<PREVIEW_URL>` after the Cloudflare workflow posts its sticky comment.

```bash
gh pr create --title "Custom OG cards and share text for the 10 tool pages" --body "$(cat <<'EOF'
## What

10 bespoke 1200x630 OG cards plus punchier social rewrites for the
tool pages on the site: checkbook, town-budget, town-debt,
where-has-the-money-gone, senior-tax-relief, inside-school-staffing,
school-building-maintenance, org-chart, branches, meetings.

Spec: docs/superpowers/specs/2026-06-16-og-cards-for-tools-design.md
Plan: docs/superpowers/plans/2026-06-18-og-cards-for-tools.md

## How

- Each card is a standalone HTML at og-cards/<page>.html.
- A shared shell (og-cards/_shared.css) gives the cards a consistent
  wordmark, font, and palette so they look like a family.
- scripts/og-build.mjs uses Playwright to render each to a PNG into
  assets/og/. Wired as npm run og:build.
- tests/og-cards.test.mjs asserts every targeted page has all three
  og_* fields and that the PNG it references exists.

## Preview URL

<PREVIEW_URL>

## What to look at

- Open the preview URL for any of the 10 tool pages.
- View page source and confirm the og:image meta points to the new
  PNG, with the new og:title and og:description loaded.
- Paste the preview URL of one page into Facebook Sharing Debugger
  (developers.facebook.com/tools/debug) and confirm the new card
  renders correctly in the preview tile.

## Proof of work

Grid of all 10 cards committed at proof/og-cards-grid.png.
Test output (10/10 pass):

\`\`\`
$ node --test tests/og-cards.test.mjs
# pass 10
# fail 0
\`\`\`

Smoke suite regression check:

\`\`\`
$ npm run test:local
# pass 52
# fail 0
\`\`\`

EOF
)"
```

- [ ] **Step 3: Wait for the Cloudflare preview deploy to post its sticky comment**

```bash
gh pr view --comments | grep -A2 "preview-url"
```

- [ ] **Step 4: Edit the PR body to fill in the preview URL**

```bash
PREVIEW_URL="$(gh pr view --json comments --jq '.comments[] | select(.body | startswith("### Preview")) | .body' | grep -oE 'https://[^ ]+' | head -1)"
gh pr edit --body "$(gh pr view --json body --jq .body | sed "s#<PREVIEW_URL>#$PREVIEW_URL#")"
```

- [ ] **Step 5: Run FB Sharing Debugger against the preview URL of one page**

Open https://developers.facebook.com/tools/debug/ and paste the preview URL of `/town-debt.html` (or any of the 10). Screenshot the result tile. Save to `proof/og-fb-debugger.png`, commit, and reference in the PR body.

- [ ] **Step 6: Report PR URL back to the user**

```bash
gh pr view --json url --jq .url
```

---

## Self-review

**Spec coverage:**

- Problem and goal sections: addressed by tasks 3-12 wiring og_* on each page.
- Scope (10 pages, exclusions): every task names the exact page, and exclusions are not implemented as designed.
- Voice rules (claim-leading, no rhetoric, no em-dashes, verifiable numbers): the per-task og_title and og_description drafts respect them; the "re-read at write time" step is the gate.
- Image spec (1200x630, Libre Franklin, site palette, common shell): Task 1 ships `_shared.css` enforcing all four.
- Per-page brief (title angle, description load, image concept): each of tasks 3-12 implements one row of the spec's table.
- Production mechanism (`og-cards/` dir excluded, build script, `og:build` npm, PNGs in `assets/og/`, commit source + PNGs): Task 1.
- Wiring (three frontmatter additions per page): per-card task step 5.
- Verification (PNG cards committed, PR shows them, FB debugger evidence): Task 13 + Task 14.

**Placeholder scan:** Each per-card task includes complete HTML, complete frontmatter, complete commands. The "(adjust to match the live page)" notes are not placeholders; they are the cardinal-rule guard that comes from re-reading the page, and they apply at the level of text strings inside otherwise-complete blocks.

**Type consistency:** `og:build` script name is consistent everywhere. `assets/og/<page>.png` path matches the test's frontmatter check. `og-cards/<page>.html` naming matches the script's discovery glob. Test file path `tests/og-cards.test.mjs` matches the path in Task 2 and Task 13.

No issues found.

---

## Notes for the executor

- Run all commands from the repo root.
- The cards are small standalone HTML files. Iterate visually: edit, re-build that one card, open the PNG, refine. Don't try to get a card right in one pass.
- If a card's headline or numbers no longer match the live page after a future page edit, that's a content drift, not a bug in this plan. The fix is to update both the card HTML and the page frontmatter together; the test suite will flag the wiring side but not visual drift.
- Per box CLAUDE.md, do not say "done" without the proof grid and the FB debugger screenshot referenced in the PR body.
