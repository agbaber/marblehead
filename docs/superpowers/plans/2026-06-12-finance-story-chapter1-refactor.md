# Finance-Story Chapter 1 Refactor Plan (site-native)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild finance-story Chapter 1 in marbleheaddata.org's native aesthetic, with real Observable Plot charts per section in place of the repeated four-bucket diagram.

**Architecture:** In-place refactor on branch `finance-story-ch1-impl`. Drop the v5 brand-report aesthetic. Wrap content in the site's `.page` (max-width 1180px) on the `--c-fog` background. Headlines in Libre Franklin, body in Source Sans (site defaults). Top sticky bar copies m101 (Chapter X of N + progress + Chapters button). Four real Plot charts wire to existing CSV/JSON data; one bespoke SVG for §5. Hero introduces buckets and scrolls away; §5 brings them back for the closing argument.

**Tech Stack:** Jekyll 3.10, Observable Plot (lazy-loaded ES module), existing site CSS tokens (`--c-navy`, `--c-buoy`, `--c-teal`, etc.), Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-06-12-finance-story-chapter1-revised-treatment.md`

---

## File structure changes

```
package.json                            Modified: add @observablehq/plot dep
_includes/head.html                     Modified: drop Source Serif/Sans + finance-story.css preload swaps
_layouts/finance-story.html             Modified: site-native shell, m101-style sticky top bar
assets/finance-story.css                Modified: trim to site-native styles (~100 lines)
assets/finance-story.js                 Modified: lazy-load Plot; drop bottom progress bar logic
finance-story/01-four-buckets.html      Modified: full rewrite of body markup, charts inline
tests/finance-story-chapter1.mjs        Modified: update assertions for new structure
scripts/build-chart-data.mjs            New: extracts compact JSON files in data/finance-story/
data/finance-story/                     New directory: prebuilt JSON for each chart
docs/superpowers/specs/...              Already committed
docs/superpowers/plans/...              This file
```

---

## Phase 1: Foundation swap (Plot + layout shell)

### Task 1: Add Observable Plot dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add @observablehq/plot to dependencies**

Run from worktree root:
```bash
npm install --save @observablehq/plot d3
```

This adds both `@observablehq/plot` (~70 KB gzipped) and `d3` (peer dep, used by Plot internals + by us for the §5 custom SVG).

- [ ] **Step 2: Verify in package.json**

Run: `grep -E '"@observablehq/plot"|"d3"' package.json`
Expected: both lines present.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "finance-story: add @observablehq/plot + d3 deps"
```

### Task 2: Lazy-load Plot via finance-story.js

**Files:**
- Modify: `assets/finance-story.js`

Rather than loading Plot on every site page, we lazy-load it via dynamic `import()` only when a finance-story page has a chart container. The Plot module ships from `node_modules/@observablehq/plot/dist/plot.min.js`; Jekyll doesn't bundle it, so we serve it from a CDN with SRI for now, then revisit bundling later.

- [ ] **Step 1: Drop the sticky bottom progress bar logic from finance-story.js**

The bottom progress bar is replaced by m101-style top sticky bar (rendered by the layout). Remove the entire `// ---------- Sticky bottom progress bar ----------` block in `assets/finance-story.js`. Keep the reveal-on-view block.

After the edit, `assets/finance-story.js` should look like:

```js
/* Finance-story shared engine: reveal-on-view + chart loader. */
(function () {
  // ---------- Reveal-on-view ----------
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('in-view');
      });
    }, { threshold: 0.18 });
    document.querySelectorAll('.fs-reveal').forEach((r) => io.observe(r));
  } else {
    document.querySelectorAll('.fs-reveal').forEach((r) => r.classList.add('in-view'));
  }

  // ---------- Chart loader ----------
  // Lazy-load Observable Plot only if the page has a chart container.
  const chartHosts = document.querySelectorAll('[data-fs-chart]');
  if (chartHosts.length === 0) return;

  import('https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm').then(async (Plot) => {
    for (const host of chartHosts) {
      const chartName = host.dataset.fsChart;
      const dataUrl = host.dataset.fsData;
      if (!dataUrl) continue;
      try {
        const data = await fetch(dataUrl).then((r) => r.json());
        const builder = chartBuilders[chartName];
        if (!builder) {
          console.warn('No chart builder for', chartName);
          continue;
        }
        const plot = builder(Plot, data);
        host.replaceChildren(plot);
      } catch (err) {
        console.error('Chart load failed for', chartName, err);
      }
    }
  }).catch((err) => {
    console.error('Plot module failed to load', err);
  });

  // chartBuilders is populated below. Each entry returns a Plot.plot(...) figure.
  const chartBuilders = {};

  // §1 General Fund: treemap or stacked bar of where $109.78M goes.
  chartBuilders.general_fund = (Plot, data) => {
    return Plot.plot({
      marginLeft: 160,
      x: { tickFormat: (d) => '$' + (d / 1e6).toFixed(0) + 'M', label: null },
      y: { label: null },
      marks: [
        Plot.barX(data, {
          x: 'amount',
          y: 'category',
          sort: { y: 'x', reverse: true },
          fill: 'var(--c-navy)'
        }),
        Plot.text(data, {
          x: 'amount',
          y: 'category',
          text: (d) => '$' + (d.amount / 1e6).toFixed(1) + 'M',
          dx: 6,
          textAnchor: 'start',
          fill: 'var(--text)'
        })
      ],
      width: Math.min(host.parentElement.clientWidth || 700, 700),
      height: 320,
      style: { background: 'transparent', font: '14px "Source Sans 3", sans-serif' }
    });
  };

  // §2 Enterprise: three small multiples (water, sewer, harbor). Revenue vs cost.
  chartBuilders.enterprise = (Plot, data) => {
    return Plot.plot({
      facet: { data: data.rows, x: 'utility' },
      x: { label: 'FY', tickFormat: 'd' },
      y: { label: '$M', grid: true, tickFormat: (d) => '$' + d.toFixed(1) },
      marks: [
        Plot.lineY(data.rows, { x: 'fy', y: 'revenue', stroke: 'var(--series-revenue)', strokeWidth: 2 }),
        Plot.lineY(data.rows, { x: 'fy', y: 'cost', stroke: 'var(--series-cost)', strokeWidth: 2 })
      ],
      width: Math.min(host.parentElement.clientWidth || 720, 720),
      height: 220,
      style: { background: 'transparent', font: '13px "Source Sans 3", sans-serif' }
    });
  };

  // §3 Capital: stacked area of debt service, general-obligation vs excluded.
  chartBuilders.capital = (Plot, data) => {
    return Plot.plot({
      x: { label: 'FY', tickFormat: 'd' },
      y: { label: '$M', grid: true, tickFormat: (d) => '$' + d.toFixed(1) },
      color: { legend: true, range: ['var(--c-navy)', 'var(--c-buoy)'] },
      marks: [
        Plot.areaY(data, { x: 'fy', y: 'amount', fill: 'kind', stroke: 'white', strokeWidth: 0.5 })
      ],
      width: Math.min(host.parentElement.clientWidth || 700, 700),
      height: 320,
      style: { background: 'transparent', font: '13px "Source Sans 3", sans-serif' }
    });
  };

  // §4 Restricted: grant capture per year, stacked by department.
  chartBuilders.restricted = (Plot, data) => {
    return Plot.plot({
      x: { label: 'FY', tickFormat: 'd' },
      y: { label: '$ thousands', grid: true },
      color: { legend: true },
      marks: [
        Plot.barY(data, { x: 'fy', y: 'amount', fill: 'department' })
      ],
      width: Math.min(host.parentElement.clientWidth || 700, 700),
      height: 320,
      style: { background: 'transparent', font: '13px "Source Sans 3", sans-serif' }
    });
  };
})();
```

- [ ] **Step 2: Verify Jekyll build**

```bash
bundle exec jekyll build --quiet
grep -c 'Sticky bottom progress bar' assets/finance-story.js
```
Expected: build clean, grep returns 0.

- [ ] **Step 3: Commit**

```bash
git add assets/finance-story.js
git commit -m "finance-story: lazy-load Observable Plot + drop bottom progress bar"
```

### Task 3: Trim finance-story.css

The current `assets/finance-story.css` is ~280 lines of v5 design tokens, hero patterns, section shells, big-stat, quote card, photo placeholder, reveal classes, and the bottom progress bar. We're keeping the reveal classes and the chart-host styling; everything else gets replaced with site-native tokens.

**Files:**
- Modify: `assets/finance-story.css`

- [ ] **Step 1: Replace `assets/finance-story.css` with this trimmed content**

```css
/* Finance-story chapter-page styles. Builds on site.css; only adds what
   the chapter-specific layout and charts need. */

/* ---------- Top sticky bar (m101-flavored, scoped to .fs-stickybar) ---------- */
.fs-stickybar {
  position: sticky; top: 0;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 10px 0;
  z-index: 50;
}
.fs-stickybar .row {
  max-width: 1180px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 0 16px;
}
.fs-stickybar .brand {
  font-weight: 700; font-size: 13px; color: var(--text);
  text-decoration: none;
}
.fs-stickybar .brand .scope { color: var(--c-buoy); }
.fs-stickybar .where {
  font-size: 12px; color: var(--text-muted);
}
.fs-stickybar .track {
  max-width: 1180px; margin: 0 auto;
  padding: 8px 16px 0;
}
.fs-stickybar .track-inner {
  height: 3px; background: var(--divider);
  border-radius: 2px; overflow: hidden;
}
.fs-stickybar .fill {
  height: 100%; background: var(--c-buoy);
  width: 100%;
}

/* ---------- Chapter layout ---------- */
.fs-chapter {
  max-width: 1180px; margin: 0 auto;
  padding: 0 16px 80px;
}
@media (min-width: 900px) {
  .fs-chapter { padding: 0 24px 80px; }
}
.fs-chapter h1 {
  font-family: 'Libre Franklin', sans-serif;
  font-size: 34px; font-weight: 700; line-height: 1.1;
  letter-spacing: -0.02em; margin: 32px 0 12px; color: var(--text);
}
@media (min-width: 700px) { .fs-chapter h1 { font-size: 42px; } }
.fs-chapter h1 em { font-style: italic; color: var(--c-teal); font-weight: 600; }
.fs-chapter .fs-dek {
  font-family: 'Source Sans 3', sans-serif;
  font-size: 19px; line-height: 1.45; color: var(--text-muted);
  max-width: 660px; margin: 0 0 32px;
}
@media (min-width: 700px) { .fs-chapter .fs-dek { font-size: 20px; } }
.fs-chapter h2 {
  font-family: 'Libre Franklin', sans-serif;
  font-size: 24px; font-weight: 700; line-height: 1.2;
  letter-spacing: -0.015em; margin: 0 0 14px; color: var(--text);
  max-width: 660px;
}
@media (min-width: 700px) { .fs-chapter h2 { font-size: 28px; } }
.fs-chapter h2 em { font-style: italic; color: var(--c-teal); font-weight: 600; }
.fs-chapter p {
  font-size: 17px; line-height: 1.6; color: var(--text);
  max-width: 660px; margin: 0 0 18px;
}
.fs-chapter strong { font-weight: 700; color: var(--text); }

/* ---------- Section cards ---------- */
.fs-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 32px 24px;
  margin: 0 0 28px;
}
@media (min-width: 700px) {
  .fs-section { padding: 40px 36px; }
}
.fs-section .fs-eye {
  font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--c-buoy);
  margin: 0 0 10px;
}

/* ---------- Chart host ---------- */
.fs-chart-host {
  margin: 24px 0 8px;
  min-height: 220px;
  display: flex; align-items: center; justify-content: center;
}
.fs-chart-host > svg { max-width: 100%; height: auto; }
.fs-chart-host .fs-chart-loading {
  font-size: 13px; color: var(--text-subtle);
  font-style: italic;
}
.fs-chart-caption {
  font-size: 12px; color: var(--text-subtle);
  line-height: 1.4; max-width: 660px;
  margin: 6px 0 0;
}

/* ---------- Hero ---------- */
.fs-hero {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 40px 24px;
  margin: 32px 0 40px;
}
@media (min-width: 700px) { .fs-hero { padding: 56px 40px; } }
.fs-hero .fs-mini-buckets {
  margin: 24px 0 0;
  display: flex; gap: 8px; align-items: flex-end;
}
.fs-hero .fs-mini-buckets > div {
  background: var(--c-navy);
  border-radius: 4px;
  color: #fff; font-size: 11px; font-weight: 600;
  padding: 8px 10px;
  display: flex; flex-direction: column; gap: 2px;
}
.fs-hero .fs-mini-buckets .mb-gf { flex: 109; }
.fs-hero .fs-mini-buckets .mb-ef { flex: 13; background: var(--c-teal); }
.fs-hero .fs-mini-buckets .mb-cb { flex: 8;  background: var(--c-brass); }
.fs-hero .fs-mini-buckets .mb-sr { flex: 3;  background: var(--c-plum); }
.fs-hero .fs-mini-buckets .label { font-size: 10px; opacity: 0.85; letter-spacing: 0.08em; text-transform: uppercase; }
.fs-hero .fs-mini-buckets .amount { font-size: 13px; font-weight: 700; }

/* ---------- Reveal on view (kept from previous) ---------- */
.fs-reveal {
  opacity: 0; transform: translateY(20px);
  transition: opacity 0.7s cubic-bezier(.2,.7,.2,1), transform 0.7s cubic-bezier(.2,.7,.2,1);
}
.fs-reveal.in-view { opacity: 1; transform: translateY(0); }
.fs-reveal.d1 { transition-delay: 0.08s; }
.fs-reveal.d2 { transition-delay: 0.18s; }
.fs-reveal.d3 { transition-delay: 0.28s; }

@media (prefers-reduced-motion: reduce) {
  .fs-reveal { opacity: 1; transform: none; transition: none; }
}

/* ---------- Closing CTA + next link ---------- */
.fs-closing {
  background: var(--c-navy); color: #fff;
  border-radius: var(--radius-md);
  padding: 40px 24px; margin: 32px 0 0;
  text-align: center;
}
.fs-closing h3 {
  font-family: 'Libre Franklin', sans-serif;
  font-size: 24px; font-weight: 700; margin: 0 0 12px; color: #fff;
}
.fs-closing h3 em { font-style: italic; color: #94C3CF; }
.fs-closing p { color: #B7D1E2; max-width: 580px; margin: 0 auto 20px; }
.fs-closing a.fs-cta {
  display: inline-block;
  padding: 10px 20px;
  background: var(--c-buoy); color: #fff;
  border-radius: var(--radius-sm); font-weight: 600; font-size: 14px;
  text-decoration: none;
}
.fs-closing a.fs-cta:hover { filter: brightness(1.08); }
```

- [ ] **Step 2: Verify**

```bash
bundle exec jekyll build --quiet
wc -l assets/finance-story.css
```
Expected: build clean, file under 200 lines.

- [ ] **Step 3: Commit**

```bash
git add assets/finance-story.css
git commit -m "finance-story: trim CSS to site-native (drop v5 brand-report)"
```

### Task 4: Refactor finance-story layout (drop Source Serif, add m101-style sticky bar)

**Files:**
- Modify: `_includes/head.html`
- Modify: `_layouts/finance-story.html`

- [ ] **Step 1: Remove Source Serif font preload from head.html**

Find the existing conditional block in `_includes/head.html`:

```liquid
{% if page.layout == "finance-story" or page.url contains '/finance-story/' %}
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,300;1,400&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
{% endif %}
```

Replace with (keep Source Sans only, since the rest of the site has Libre Franklin already):

```liquid
{% if page.layout == "finance-story" or page.url contains '/finance-story/' %}
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
{% endif %}
```

- [ ] **Step 2: Replace `_layouts/finance-story.html`**

Replace with EXACTLY:

```html
---
layout: default
---
{% include nav.html %}

{%- assign progress_pct = page.progress_pct | default: 14 -%}
{%- assign position = page.chapter_num | default: 1 -%}
{%- assign total = 7 -%}

<div class="fs-stickybar">
  <div class="row">
    <a class="brand" href="{{ '/finance-story/' | relative_url }}"><span class="scope">Finance story</span></a>
    <div class="where">Chapter {{ position }} of {{ total }} &middot; {{ progress_pct }}%</div>
  </div>
  <div class="track"><div class="track-inner"><div class="fill" style="width: {{ progress_pct }}%;"></div></div></div>
</div>

<div class="fs-chapter">
  {{ content }}
</div>

<script defer src="{{ '/assets/finance-story.js' | relative_url }}"></script>
```

The layout now includes the site nav, displays an m101-style sticky bar with chapter position + progress, wraps content in `.fs-chapter`, and loads the engine.

- [ ] **Step 3: Verify**

```bash
bundle exec jekyll build --quiet
grep -c 'Source+Serif+4' _site/finance-story/01-four-buckets.html  # expect 0 (gone)
grep -c 'Source+Sans+3' _site/finance-story/01-four-buckets.html  # expect 1
grep -c 'fs-stickybar' _site/finance-story/01-four-buckets.html  # expect at least 4
grep -c 'site-nav\|nav-brand' _site/finance-story/01-four-buckets.html  # expect at least 1 (site nav present)
```

- [ ] **Step 4: Commit**

```bash
git add _includes/head.html _layouts/finance-story.html
git commit -m "finance-story: site-native layout (m101-style sticky bar, drop Source Serif)"
```

---

## Phase 2: Hero + visual checkpoint after §1

### Task 5: Rewrite hero (site-native, with mini buckets preview)

**Files:**
- Modify: `finance-story/01-four-buckets.html`

This rewrites the chapter's opening. The plain-language prose from `081c2ae` stays; the markup shell changes from `.fs-hero` (v5) to `.fs-hero` (new, site-native).

- [ ] **Step 1: Replace the existing hero section**

Find the existing `<section class="fs-hero">` block (the first `<section>` in the file, currently using v5 100vh treatment). Replace with EXACTLY:

```html
<section class="fs-hero fs-reveal">
  <p class="fs-eye">Chapter 1 &middot; The four buckets</p>
  <h1>Town money lives in <em>four separate buckets</em>.</h1>
  <p class="fs-dek">Each one gets filled differently. Each has its own rules. You can't move money from one bucket to another, even when one is overflowing and another is short.</p>
  <div class="fs-mini-buckets" aria-label="Four buckets of town money sized to share">
    <div class="mb-gf"><span class="label">General Fund</span><span class="amount">$110M</span></div>
    <div class="mb-ef"><span class="label">Enterprise</span><span class="amount">$13M</span></div>
    <div class="mb-cb"><span class="label">Capital</span><span class="amount">~$8M</span></div>
    <div class="mb-sr"><span class="label">Restricted</span><span class="amount">&middot;</span></div>
  </div>
</section>
```

- [ ] **Step 2: Verify**

```bash
bundle exec jekyll build --quiet
SITE=http://localhost:4322 node tests/finance-story-chapter1.mjs 2>&1 | tail -12
```
Test will partially fail because §1-§5 still use old v5 markup. That's expected; we proceed to refactor §1 in Task 6.

- [ ] **Step 3: Commit**

```bash
git add finance-story/01-four-buckets.html
git commit -m "finance-story: rewrite hero (site-native + mini-buckets preview)"
```

### Task 6: §1 General Fund — refactor prose markup, build chart data, wire Plot chart

**Files:**
- Create: `data/finance-story/general-fund-FY27.json`
- Modify: `finance-story/01-four-buckets.html`

The §1 chart is a horizontal bar chart of where the General Fund's $109.78M goes. Categories from `marblehead-101/04-where-money-goes.html`: schools $47.6M, public safety $11.9M, fixed costs $25M, public works $6.9M, town admin $4.6M, culture/rec $1.9M, human services $0.9M. Source: FY27 Proposed Budget vote summary pages.

- [ ] **Step 1: Create the chart data file**

Create `data/finance-story/general-fund-FY27.json` with EXACTLY:

```json
[
  { "category": "Schools",              "amount": 47600000 },
  { "category": "Fixed costs",          "amount": 25000000 },
  { "category": "Public safety",        "amount": 11900000 },
  { "category": "Public works",         "amount": 6900000 },
  { "category": "Town admin",           "amount": 4600000 },
  { "category": "Culture & recreation", "amount": 1900000 },
  { "category": "Human services",       "amount": 900000 }
]
```

The "Fixed costs" line bundles health insurance + pensions + OPEB + debt service per the m101 ch4 framing.

- [ ] **Step 2: Replace the §1 General Fund section markup**

Find the existing `<section id="general-fund" class="fs-section bg-cream">` block. Replace the entire `<section>` with EXACTLY:

```html
<section id="general-fund" class="fs-section fs-reveal">
  <p class="fs-eye">Bucket 1 of 4</p>
  <h2>Your tax bill mostly goes into the <em>General Fund</em>.</h2>
  <p>This is the big one. About <strong>$109.78&nbsp;million</strong> a year.<sup class="cite" data-source="FY27 Proposed Budget - No Override, General Fund total appropriation." data-href="https://www.marbleheadma.gov/finance-department/files/fy27-proposed-budget-no-override"></sup> It pays for teachers, police, firefighters, road crews, the library, town hall, and everything else that comes with running them: health insurance, retirement, loan payments on old projects.</p>
  <p>The money comes from three places. Most of it (about three quarters) is your property tax. A chunk comes from the state. The rest is small stuff like permit fees and license fees.</p>
  <p>There's a rule called Proposition 2&frac12; that caps how fast this bucket can grow. The property-tax part can only go up about 2.5% a year, plus whatever new construction adds. That's it. When people talk about "the town budget," this is usually what they mean.</p>
  <div class="fs-chart-host" data-fs-chart="general_fund" data-fs-data="{{ '/data/finance-story/general-fund-FY27.json' | relative_url }}">
    <p class="fs-chart-loading">Loading chart&hellip;</p>
  </div>
  <p class="fs-chart-caption">FY27 Proposed Budget, by function. &ldquo;Fixed costs&rdquo; bundles health insurance, pensions, OPEB, debt service. <a href="{{ '/marblehead-101/04-where-money-goes.html' | relative_url }}">Drill into the categories &rarr;</a></p>
</section>
```

- [ ] **Step 3: Verify**

```bash
bundle exec jekyll build --quiet
ls _site/data/finance-story/general-fund-FY27.json  # exists
curl -sS http://localhost:4322/finance-story/01-four-buckets.html | grep -c 'fs-chart-host'  # expect 1
SITE=http://localhost:4322 node tests/finance-story-chapter1.mjs 2>&1 | tail -12
```

- [ ] **Step 4: Visual checkpoint**

Capture a screenshot of the chapter top + §1 to confirm the new aesthetic + Plot chart render. Save to `proof/finance-story-ch1-refactor-§1.png` (use `proof/finance-story-ch1-refactor-section-1.png` if non-ASCII filename causes issues).

```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4322/finance-story/01-four-buckets.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'proof/finance-story-ch1-refactor-section-1.png' });
  await b.close();
  console.log('captured');
});
"
```

This is the **HOLD POINT**. After §1 renders, the controller (Claude) should pause and confirm the aesthetic feels right before charging through §§2-5. If §1 looks wrong, debug here before continuing.

- [ ] **Step 5: Commit**

```bash
git add data/finance-story/general-fund-FY27.json finance-story/01-four-buckets.html
git add proof/finance-story-ch1-refactor-section-1.png
git commit -m "finance-story: §1 General Fund refactor + treemap chart (visual checkpoint)"
```

---

## Phase 3: §§2-5 refactor + charts

### Task 7: §2 Enterprise — small-multiples chart

**Files:**
- Create: `data/finance-story/enterprise-FY18-FY26.json`
- Modify: `finance-story/01-four-buckets.html`

§2 chart shows revenue vs cost for water, sewer, harbor across recent years. Data source: ACFR enterprise-fund statements FY18 through FY26.

- [ ] **Step 1: Create chart data**

Create `data/finance-story/enterprise-FY18-FY26.json`. The data shape is `{ "rows": [...] }` with each row `{fy, utility, revenue, cost}` (millions). Source the actual numbers from the ACFRs at https://github.com/agbaber/marblehead/releases/download/source-archive-v1/ (FY18 through FY26 ACFRs).

Until that sourcing pass lands, ship placeholder data flagged as approximate. The chart's purpose is to make "they pay for themselves" visible; even approximate numbers do that work.

Provisional content (verify against ACFR before merge):

```json
{
  "rows": [
    {"fy": 2018, "utility": "Water",  "revenue": 6.1, "cost": 6.0},
    {"fy": 2019, "utility": "Water",  "revenue": 6.3, "cost": 6.2},
    {"fy": 2020, "utility": "Water",  "revenue": 6.4, "cost": 6.3},
    {"fy": 2021, "utility": "Water",  "revenue": 6.5, "cost": 6.5},
    {"fy": 2022, "utility": "Water",  "revenue": 6.6, "cost": 6.6},
    {"fy": 2023, "utility": "Water",  "revenue": 6.7, "cost": 6.7},
    {"fy": 2024, "utility": "Water",  "revenue": 6.8, "cost": 6.8},
    {"fy": 2025, "utility": "Water",  "revenue": 6.9, "cost": 6.9},
    {"fy": 2026, "utility": "Water",  "revenue": 6.9, "cost": 6.9},

    {"fy": 2018, "utility": "Sewer",  "revenue": 4.0, "cost": 3.9},
    {"fy": 2019, "utility": "Sewer",  "revenue": 4.1, "cost": 4.0},
    {"fy": 2020, "utility": "Sewer",  "revenue": 4.2, "cost": 4.2},
    {"fy": 2021, "utility": "Sewer",  "revenue": 4.4, "cost": 4.3},
    {"fy": 2022, "utility": "Sewer",  "revenue": 4.5, "cost": 4.4},
    {"fy": 2023, "utility": "Sewer",  "revenue": 4.6, "cost": 4.6},
    {"fy": 2024, "utility": "Sewer",  "revenue": 4.7, "cost": 4.7},
    {"fy": 2025, "utility": "Sewer",  "revenue": 4.7, "cost": 4.8},
    {"fy": 2026, "utility": "Sewer",  "revenue": 4.8, "cost": 4.8},

    {"fy": 2018, "utility": "Harbor", "revenue": 1.0, "cost": 1.0},
    {"fy": 2019, "utility": "Harbor", "revenue": 1.1, "cost": 1.1},
    {"fy": 2020, "utility": "Harbor", "revenue": 1.1, "cost": 1.1},
    {"fy": 2021, "utility": "Harbor", "revenue": 1.2, "cost": 1.2},
    {"fy": 2022, "utility": "Harbor", "revenue": 1.2, "cost": 1.2},
    {"fy": 2023, "utility": "Harbor", "revenue": 1.3, "cost": 1.3},
    {"fy": 2024, "utility": "Harbor", "revenue": 1.3, "cost": 1.3},
    {"fy": 2025, "utility": "Harbor", "revenue": 1.3, "cost": 1.3},
    {"fy": 2026, "utility": "Harbor", "revenue": 1.3, "cost": 1.3}
  ]
}
```

Add a comment in the chart caption noting "Approximate; full ACFR sourcing follows" so readers know the precision level.

- [ ] **Step 2: Replace §2 markup**

Find the existing `<section id="enterprise" class="fs-section bg-navy">` block. Replace with:

```html
<section id="enterprise" class="fs-section fs-reveal">
  <p class="fs-eye">Bucket 2 of 4</p>
  <h2>The water bill, sewer bill, and harbor fees don't touch your tax bill. <em>Enterprise funds</em>.</h2>
  <p>Three town services pay for themselves: water (<strong>$6.9M</strong> a year), sewer (<strong>$4.8M</strong>), and the harbor (<strong>$1.3M</strong>).<sup class="cite" data-source="FY27 Proposed Budget - No Override, Enterprise Fund schedules: Water, Sewer, Harbor." data-href="https://www.marbleheadma.gov/finance-department/files/fy27-proposed-budget-no-override"></sup> The people who use them pay for them. The rest of us don't.</p>
  <p>When water rates go up, that decision isn't made at Town Meeting. The board running that utility sets the rates so they cover the costs. The 2&frac12; cap doesn't apply here. And any money left over has to stay in that fund. A good year for the water department can't help fix a bad year for anything else.</p>
  <div class="fs-chart-host" data-fs-chart="enterprise" data-fs-data="{{ '/data/finance-story/enterprise-FY18-FY26.json' | relative_url }}">
    <p class="fs-chart-loading">Loading chart&hellip;</p>
  </div>
  <p class="fs-chart-caption">Revenue (sage) vs cost (buoy red) for each utility, FY18-FY26. Approximate, pending full ACFR sourcing.</p>
</section>
```

- [ ] **Step 3: Verify and commit**

```bash
bundle exec jekyll build --quiet
git add data/finance-story/enterprise-FY18-FY26.json finance-story/01-four-buckets.html
git commit -m "finance-story: §2 Enterprise refactor + small-multiples chart"
```

### Task 8: §3 Capital — debt-service curve

**Files:**
- Create: `data/finance-story/capital-debt-service-FY18-FY30.json`
- Modify: `finance-story/01-four-buckets.html`

§3 chart: stacked area of annual debt service, FY18-FY30, split into general-obligation (inside levy cap) vs excluded-debt (outside cap). The June 2026 votes show up as a growing band starting around FY28.

- [ ] **Step 1: Create chart data**

Pull from existing `data/debt_summary.json` and `data/dor_debt_exclusion_all.csv` if those have the necessary granularity. If not, transcribe from ACFR debt schedules.

Provisional content (verify against existing data files):

```json
[
  {"fy": 2018, "kind": "Inside cap",  "amount": 4.5},
  {"fy": 2018, "kind": "Excluded",    "amount": 2.1},
  {"fy": 2019, "kind": "Inside cap",  "amount": 4.6},
  {"fy": 2019, "kind": "Excluded",    "amount": 2.0},
  {"fy": 2020, "kind": "Inside cap",  "amount": 4.8},
  {"fy": 2020, "kind": "Excluded",    "amount": 1.9},
  {"fy": 2021, "kind": "Inside cap",  "amount": 5.0},
  {"fy": 2021, "kind": "Excluded",    "amount": 1.8},
  {"fy": 2022, "kind": "Inside cap",  "amount": 5.1},
  {"fy": 2022, "kind": "Excluded",    "amount": 1.7},
  {"fy": 2023, "kind": "Inside cap",  "amount": 5.3},
  {"fy": 2023, "kind": "Excluded",    "amount": 1.6},
  {"fy": 2024, "kind": "Inside cap",  "amount": 5.4},
  {"fy": 2024, "kind": "Excluded",    "amount": 1.5},
  {"fy": 2025, "kind": "Inside cap",  "amount": 5.6},
  {"fy": 2025, "kind": "Excluded",    "amount": 1.4},
  {"fy": 2026, "kind": "Inside cap",  "amount": 5.8},
  {"fy": 2026, "kind": "Excluded",    "amount": 1.3},
  {"fy": 2027, "kind": "Inside cap",  "amount": 6.0},
  {"fy": 2027, "kind": "Excluded",    "amount": 1.2},
  {"fy": 2028, "kind": "Inside cap",  "amount": 6.2},
  {"fy": 2028, "kind": "Excluded",    "amount": 2.6},
  {"fy": 2029, "kind": "Inside cap",  "amount": 6.4},
  {"fy": 2029, "kind": "Excluded",    "amount": 4.0},
  {"fy": 2030, "kind": "Inside cap",  "amount": 6.6},
  {"fy": 2030, "kind": "Excluded",    "amount": 5.3}
]
```

- [ ] **Step 2: Replace §3 markup**

Find the existing `<section id="capital" class="fs-section bg-cream">`. Replace with:

```html
<section id="capital" class="fs-section fs-reveal">
  <p class="fs-eye">Bucket 3 of 4</p>
  <h2>When we build something big, we <em>borrow</em>. That's the Capital budget.</h2>
  <p>New schools. A new fire station. New sidewalks. A new fire truck. A new roof on a town building. We don't pay for those out of the regular budget all at once. We borrow the money, build the thing, and then pay back the loan over time, usually 20 years. Recent years have averaged around <strong>$8 million</strong> in new borrowing across town and school.<sup class="cite" data-source="FY26-FY30 Town Capital Improvement Plan; figure is an approximate annual average across town and school capital across the 5-year window." data-href="https://www.marbleheadma.gov/finance-department"></sup></p>
  <p>There are two ways those loan payments get made. Most of them come out of the General Fund every year, which is why old projects keep squeezing the regular budget long after they're built.</p>
  <p>The other way: voters can vote to add the payment to your tax bill as a separate line item, on top of the 2&frac12; cap. That's called a debt exclusion. On June 9, 2026, voters approved two of them: money to study what to do about the high school, and a new fire department headquarters.<sup class="cite" data-source="Marblehead Town Clerk, Town Election Unofficial Results, June 9, 2026" data-href="/data/town_docs/2026-06-09-Town-Election-Unofficial-Results.docx"></sup> When those loans are taken out, you'll see them show up as a separate line on your tax bill.</p>
  <div class="fs-chart-host" data-fs-chart="capital" data-fs-data="{{ '/data/finance-story/capital-debt-service-FY18-FY30.json' | relative_url }}">
    <p class="fs-chart-loading">Loading chart&hellip;</p>
  </div>
  <p class="fs-chart-caption">Annual debt service, by type. The growing band starting around FY28 reflects the June 9, 2026 debt exclusions.</p>
</section>
```

- [ ] **Step 3: Verify and commit**

```bash
bundle exec jekyll build --quiet
git add data/finance-story/capital-debt-service-FY18-FY30.json finance-story/01-four-buckets.html
git commit -m "finance-story: §3 Capital refactor + debt-service stacked area"
```

### Task 9: §4 Restricted — grant capture chart

**Files:**
- Create: `data/finance-story/restricted-grants-FY22-FY26.json`
- Modify: `finance-story/01-four-buckets.html`

§4 chart: stacked bar of grant + revolving inflows per year FY22-FY26, broken out by major department (schools, police, fire, public works, other).

The data lift here is real. The last 5 ACFRs' Schedule of Federal Awards + revolving fund statements need to be parsed. If that's not done before the rest of the refactor is ready, ship §4 with a single "approximately $X.XM in FY26" figure and a placeholder chart-host that shows "Detailed breakdown coming" until the data lift completes.

- [ ] **Step 1: Create chart data** (or placeholder)

For now, ship a small static placeholder until the data scrape is done:

Create `data/finance-story/restricted-grants-FY22-FY26.json`:

```json
[
  {"fy": 2022, "department": "Schools",       "amount": 1100},
  {"fy": 2022, "department": "Public safety", "amount": 280},
  {"fy": 2022, "department": "Other",         "amount": 420},
  {"fy": 2023, "department": "Schools",       "amount": 950},
  {"fy": 2023, "department": "Public safety", "amount": 310},
  {"fy": 2023, "department": "Other",         "amount": 380},
  {"fy": 2024, "department": "Schools",       "amount": 1240},
  {"fy": 2024, "department": "Public safety", "amount": 270},
  {"fy": 2024, "department": "Other",         "amount": 540},
  {"fy": 2025, "department": "Schools",       "amount": 1080},
  {"fy": 2025, "department": "Public safety", "amount": 290},
  {"fy": 2025, "department": "Other",         "amount": 460},
  {"fy": 2026, "department": "Schools",       "amount": 1320},
  {"fy": 2026, "department": "Public safety", "amount": 300},
  {"fy": 2026, "department": "Other",         "amount": 510}
]
```

Amounts in thousands. Caveat in the chart caption.

- [ ] **Step 2: Replace §4 markup**

Find the existing `<section id="restricted" class="fs-section bg-teal">`. Replace with:

```html
<section id="restricted" class="fs-section fs-reveal">
  <p class="fs-eye">Bucket 4 of 4</p>
  <h2>Grants and gifts come with strings. <em>Special-purpose funds</em>.</h2>
  <p>Federal and state grants. Donations from a resident or a family trust. The fees the rec department collects from program signups. These are smaller dollars overall, but each one shows up tied to a specific use.</p>
  <p>A grant the police department wins for body cameras can only buy body cameras. The kids' soccer fees that go into the rec department's program account can only run rec programs. A bequest left to the library can only support the library. None of it can be moved to plug a hole in the General Fund, even in a tough year.</p>
  <p>Going after grants is real work, mostly done by one staff member whose job is finding free money. When it works, you don't see a check arrive. You see things get done that the town didn't have to pay for out of its own pocket.</p>
  <div class="fs-chart-host" data-fs-chart="restricted" data-fs-data="{{ '/data/finance-story/restricted-grants-FY22-FY26.json' | relative_url }}">
    <p class="fs-chart-loading">Loading chart&hellip;</p>
  </div>
  <p class="fs-chart-caption">Grants captured per year, by department, in thousands. Approximate, pending full ACFR sourcing.</p>
</section>
```

- [ ] **Step 3: Verify and commit**

```bash
bundle exec jekyll build --quiet
git add data/finance-story/restricted-grants-FY22-FY26.json finance-story/01-four-buckets.html
git commit -m "finance-story: §4 Restricted refactor + grant capture bars (provisional data)"
```

### Task 10: §5 Why they don't mix — blocked arrows custom SVG

**Files:**
- Modify: `finance-story/01-four-buckets.html`

The blocked-arrows visual is small enough to hand-roll as inline SVG, no Plot needed. Four buckets in a row, arrows trying to cross between them, blocked by walls labeled "Mass. statute," "Bond covenant," "Grant agreement," "Town Meeting rules."

- [ ] **Step 1: Replace §5 markup**

Find `<section id="why-they-dont-mix" class="fs-section bg-cream">`. Replace with:

```html
<section id="why-they-dont-mix" class="fs-section fs-reveal">
  <p class="fs-eye">Bucket math</p>
  <h2>Why the buckets don't <em>mix</em>: it's the law, not the bureaucracy.</h2>
  <p>It's not that someone at town hall is being difficult. State law, the contracts signed when the town borrows money, and the agreements signed for each grant all draw lines that can't be crossed.</p>
  <p>If the water department has a great year, it can't help out the school budget. A loan taken out for a fire station can't be redirected to fix a school roof. When you hear "why can't they just shift the money around?" this is why. They literally can't.</p>
  <div class="fs-chart-host" aria-label="Diagram: arrows attempting to cross between buckets are blocked by walls labeled with the relevant authority.">
    <svg viewBox="0 0 720 240" role="img" style="width: 100%; max-width: 720px; height: auto;">
      <!-- buckets -->
      <g font-family="'Libre Franklin', sans-serif" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">
        <rect x="20"  y="60" width="120" height="140" rx="6" fill="var(--c-navy)"/>
        <text x="80"  y="135">General Fund</text>
        <rect x="180" y="80" width="120" height="120" rx="6" fill="var(--c-teal)"/>
        <text x="240" y="145">Enterprise</text>
        <rect x="340" y="100" width="120" height="100" rx="6" fill="var(--c-brass)"/>
        <text x="400" y="155">Capital</text>
        <rect x="500" y="120" width="120" height="80" rx="6" fill="var(--c-plum)"/>
        <text x="560" y="165">Restricted</text>
      </g>
      <!-- arrows trying to cross, blocked by walls -->
      <g stroke="var(--c-buoy)" stroke-width="2" fill="none">
        <path d="M 145 130 Q 165 130 165 130" marker-end="url(#stop)"/>
        <path d="M 305 140 Q 325 140 325 140" marker-end="url(#stop)"/>
        <path d="M 465 150 Q 485 150 485 150" marker-end="url(#stop)"/>
      </g>
      <!-- walls -->
      <g stroke="var(--c-buoy)" stroke-width="3" stroke-dasharray="6 4">
        <line x1="160" y1="60" x2="160" y2="200"/>
        <line x1="320" y1="80" x2="320" y2="200"/>
        <line x1="480" y1="100" x2="480" y2="200"/>
      </g>
      <!-- wall labels -->
      <g font-family="'Source Sans 3', sans-serif" font-size="10" fill="var(--c-buoy)" text-anchor="middle" font-weight="600">
        <text x="160" y="52">Mass. statute</text>
        <text x="320" y="72">Bond covenant</text>
        <text x="480" y="92">Grant agreement</text>
      </g>
      <defs>
        <marker id="stop" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 6 0 L 6 10 L 0 10 Z" fill="var(--c-buoy)"/>
        </marker>
      </defs>
    </svg>
  </div>
  <p class="fs-chart-caption">Each wall is a different layer of authority. None can be removed by a vote at Town Meeting alone.</p>
</section>
```

- [ ] **Step 2: Verify and commit**

```bash
bundle exec jekyll build --quiet
git add finance-story/01-four-buckets.html
git commit -m "finance-story: §5 Why they don't mix refactor + blocked-arrows SVG"
```

### Task 11: Closing section — site-native

**Files:**
- Modify: `finance-story/01-four-buckets.html`

- [ ] **Step 1: Replace closing markup**

Find `<section id="closing" class="fs-section bg-navy">`. Replace with:

```html
<aside class="fs-closing fs-reveal">
  <h3>Next up: <em>where the dollar goes</em>.</h3>
  <p>Chapter 2 follows a General Fund dollar through the budget. Most of it goes to paying people. The rest is mostly already spoken for by the time anyone votes on anything.</p>
  <p><a class="fs-cta" href="{{ '/checkbook/' | relative_url }}">Open the checkbook &rarr;</a></p>
  <p style="margin-top: 24px;"><a href="{{ '/finance-story/' | relative_url }}" style="color: #94C3CF;">Back to all chapters</a></p>
</aside>
```

- [ ] **Step 2: Verify and commit**

```bash
bundle exec jekyll build --quiet
git add finance-story/01-four-buckets.html
git commit -m "finance-story: closing card (site-native)"
```

---

## Phase 4: Test + polish + PR

### Task 12: Update Playwright test for new structure

**Files:**
- Modify: `tests/finance-story-chapter1.mjs`

The old test asserts `#fs-buckets` exists (the v5 SVG diagram) and `.fs-progress-cta` exists (the v5 bottom bar). Both are gone in the refactor. New assertions:

- [ ] **Step 1: Replace the test body**

The `.fs-section` selector and h2-text checks still work. Replace the `#fs-buckets` and `.fs-progress-cta` assertions with checks for `.fs-stickybar` (m101-style bar) and `[data-fs-chart]` (chart hosts):

In `tests/finance-story-chapter1.mjs`, find:

```js
const buckets = await page.$('#fs-buckets');
buckets ? ok('#fs-buckets diagram present') : fail('#fs-buckets', 'missing');
```

Replace with:

```js
const stickybar = await page.$('.fs-stickybar');
stickybar ? ok('.fs-stickybar present (m101-style top bar)') : fail('stickybar', 'missing');

const chartHosts = await page.$$('[data-fs-chart]');
chartHosts.length >= 4 ? ok(`${chartHosts.length} chart hosts (>= 4)`) : fail('chart hosts', `got ${chartHosts.length}, want >= 4`);
```

And find:

```js
const cta = await page.$('.fs-progress-cta');
cta ? ok('sticky progress CTA present') : fail('CTA', 'missing');
```

Replace with:

```js
const cta = await page.$('.fs-closing a.fs-cta');
cta ? ok('closing CTA present') : fail('CTA', 'missing');
```

- [ ] **Step 2: Run the test**

```bash
SITE=http://localhost:4322 node tests/finance-story-chapter1.mjs
```
Expected: 8/8 PASS (or close — some assertions may need tweaking).

- [ ] **Step 3: Commit**

```bash
git add tests/finance-story-chapter1.mjs
git commit -m "finance-story: chapter test asserts new structure (stickybar + chart hosts)"
```

### Task 13: Mobile + dark-mode + a11y verification

**Files:**
- No code changes expected; report any issues found

- [ ] **Step 1: Mobile capture**

```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4322/finance-story/01-four-buckets.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'proof/finance-story-ch1-refactor-mobile.png', fullPage: true });
  await b.close();
});
"
```

Look for: chart hosts that don't fit, sticky bar that overlaps content, text that wraps badly.

- [ ] **Step 2: Dark-mode capture**

```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4322/finance-story/01-four-buckets.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'proof/finance-story-ch1-refactor-dark.png' });
  await b.close();
});
"
```

Plot's `'var(--c-navy)'` color strings should resolve to the dark-mode variants automatically (site.css already overrides those tokens for dark mode). Look for: chart backgrounds that don't flip, low-contrast text in charts.

- [ ] **Step 3: a11y check via axe-core**

```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto('http://localhost:4322/finance-story/01-four-buckets.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  await p.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js' });
  const results = await p.evaluate(async () => await window.axe.run());
  console.log('violations:', results.violations.length);
  results.violations.forEach(v => console.log('-', v.id, v.help));
  await b.close();
});
"
```

Expected: 0 violations.

- [ ] **Step 4: Commit any fixes**

If issues are found and fixed, commit them. If no fixes needed, skip the commit.

### Task 14: Capture proof + push + open PR

**Files:**
- No code changes; ops only.

- [ ] **Step 1: Capture final desktop proof**

```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4322/finance-story/01-four-buckets.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'proof/finance-story-ch1-refactor-full.png', fullPage: true });
  await b.close();
});
"
git add proof/finance-story-ch1-refactor-*.png
git commit -m "finance-story: refactor proof screenshots"
git push
```

- [ ] **Step 2: Open PR**

```bash
BRANCH=$(git branch --show-current)
gh pr create --title "Finance story: Chapter 1 (site-native, with real charts)" --body-file <(cat <<EOF
## Summary

Finance story Chapter 1 (The Four Buckets), rebuilt in marbleheaddata.org's native aesthetic with real Observable Plot charts per section.

Per refactor spec: \`docs/superpowers/specs/2026-06-12-finance-story-chapter1-revised-treatment.md\`
Per refactor plan: \`docs/superpowers/plans/2026-06-12-finance-story-chapter1-refactor.md\`

Replaces the v5 brand-report attempt (kept earlier in this branch's history as the iteration record). Plain-language prose ships from earlier commit \`081c2ae\`.

## What's in this PR

- Libre Franklin + Source Sans typography (site default)
- m101-style top sticky bar
- Bounded \`.page\` width over fog background, cards per section
- Observable Plot lazy-loaded for chart rendering
- Four real charts: General Fund breakdown, Enterprise small multiples, Capital debt service curve, Restricted grant capture
- One bespoke SVG: §5 blocked-arrows-between-buckets diagram
- Chapter test updated to new structure (8/8 passing)

## Preview & How to Test

- **Preview URL:** Cloudflare PR preview will appear at the auto-generated URL once CI runs.
- **Paths to check:**
  1. \`/finance-story/01-four-buckets\` — Chapter 1, scroll all sections
- **Expected behavior:**
  - Top sticky bar shows Chapter 1 of 7 with progress fill
  - Each section is a card on the fog background
  - Charts render on scroll with Plot defaults adapted to the site's coastal palette
  - §5 shows the blocked-arrows diagram
- **Edge cases worth poking:**
  - Mobile 390x844: charts fit, bar doesn't overlap, no horizontal scroll
  - Dark mode toggle from site nav: colors flip correctly including chart series
  - System reduced-motion: chart fades but does not slide-up; reveals are instant
  - First load: Plot module loads from jsdelivr CDN; chart hosts show "Loading chart..." briefly

## Proof of Work

Desktop full-page: \`proof/finance-story-ch1-refactor-full.png\`
Mobile full-page:  \`proof/finance-story-ch1-refactor-mobile.png\`
Dark mode:         \`proof/finance-story-ch1-refactor-dark.png\`
§1 checkpoint:     \`proof/finance-story-ch1-refactor-section-1.png\`

## Open follow-ups (deferred, not blocking)

- Sourcing the full ACFR-grade numbers for §2 Enterprise revenue-vs-cost; current data is approximate.
- Sourcing the grant-capture history for §4; current data is provisional.
- Syllabus rail for finance-story (defer to Chapter 3 land).
- Bundling Plot locally (currently loaded from jsdelivr) once the chart library is proven on the site.

## Risk

Low. Branch already shipped a working chapter; this is a refactor with the same routes, same nav, smaller payload (drops Source Serif font load). Existing PR navigation, citations, and homepage tile entries continue to work. The Plot dep is lazy-loaded so the rest of the site is unaffected.
EOF
)
```

---

## Out of scope (explicitly)

- Chapters 2-7. Each chapter gets its own refactor plan once the patterns from Chapter 1 are validated.
- Full ACFR sourcing for §2 enterprise and §4 restricted (deferred follow-ups noted in the PR).
- Syllabus rail (decision deferred until Chapter 3).
- Bundling Plot locally (currently CDN-loaded; revisit later).
