# Finance-Story Chapter 1 + Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the finance-story design system (reused by Chapters 2-7) and Chapter 1 (The Four Buckets) end-to-end to production polish on marbleheaddata.org.

**Architecture:** Standalone scrollytelling chapter at `/finance-story/01-four-buckets`. New Jekyll layout loads serif font pair, shared finance-story CSS, and a shared engine for reveals + progress bar. Chapter follows v5 brand-report pattern: section-at-a-time, big Source-Serif italics, cream/navy/teal alternating sections, sticky bottom progress bar, scroll-triggered reveals. Animation: four buckets persist as an SVG diagram in each section; each section highlights its bucket while dimming the others and shows dollar dots flowing IN from that bucket's funding source. Vanilla JS + IntersectionObserver + requestAnimationFrame. Citations via existing `assets/citations.js`. Photography commissioned separately; ships with placeholder gradients that swap cleanly when real photos arrive.

**Tech Stack:** Jekyll 3.10, vanilla JS (no framework), SVG, Source Serif 4 + Source Sans 3 (Google Fonts), Playwright for tests, `assets/citations.js` for source attribution.

**Spec:** `docs/superpowers/specs/2026-06-11-finance-story-design.md`

---

## File structure

```
_layouts/finance-story.html           Jekyll layout for chapter pages
finance-story/index.html              Landing page (TOC, intro, 7-chapter overview)
finance-story/01-four-buckets.html    Chapter 1 page

assets/finance-story.css              Shared styles (~700 lines)
assets/finance-story.js               Shared engine: reveals + progress bar

tests/finance-story-chapter1.mjs      Playwright chapter test
scripts/capture-finance-chapter1.mjs  Playwright proof capture

_includes/head.html                   Modified: conditional font + asset load
tests/smoke-test.mjs                  Modified: add finance-story URLs
index.html                            Modified: homepage tile pointing to chapter
marblehead-101/04-where-money-goes.html  Modified: link out to Chapter 1
```

---

## Phase 1: Foundation (shared design system)

### Task 1: Scaffold layout and stub assets

**Files:**
- Create: `_layouts/finance-story.html`
- Create: `assets/finance-story.css`
- Create: `assets/finance-story.js`
- Create: `finance-story/index.html`

- [ ] **Step 1: Create stub finance-story layout that extends default**

`_layouts/finance-story.html`:

```html
---
layout: default
---
<link rel="stylesheet" href="{{ '/assets/finance-story.css' | relative_url }}">
{{ content }}
<script defer src="{{ '/assets/finance-story.js' | relative_url }}"></script>
```

- [ ] **Step 2: Create empty stub CSS**

`assets/finance-story.css`:

```css
/* Finance-story shared design system. Loaded only on finance-story pages
   via _layouts/finance-story.html. */
```

- [ ] **Step 3: Create empty stub JS**

`assets/finance-story.js`:

```js
/* Finance-story shared engine: reveal-on-view + sticky progress bar. */
(function () {
  // Filled in Task 5 and 6.
})();
```

- [ ] **Step 4: Create stub landing page**

`finance-story/index.html`:

```html
---
layout: finance-story
title: "Finance story"
sitemap: false
---
<h1>Finance story</h1>
<p>Landing page to be filled in Task 21.</p>
```

- [ ] **Step 5: Verify Jekyll builds without error**

Run: `bundle exec jekyll build --quiet 2>&1 | tail -5`
Expected: No output (success) and `_site/finance-story/index.html` exists.

- [ ] **Step 6: Commit**

```bash
git add _layouts/finance-story.html assets/finance-story.css assets/finance-story.js finance-story/index.html
git commit -m "finance-story: scaffold layout + landing-page stub"
```

---

### Task 2: Register Google Fonts and conditional asset gating

**Files:**
- Modify: `_includes/head.html` (add Source Serif + Sans preload; existing Libre Franklin preconnect already in place)

The serif font pair only loads on `/finance-story/*` pages. The existing site fonts stay loaded sitewide.

- [ ] **Step 1: Add conditional font preload in head.html**

Find the existing Libre Franklin link tag in `_includes/head.html` and add immediately after:

```liquid
{% if page.layout == "finance-story" or page.url contains '/finance-story/' %}
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,300;1,400&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
{% endif %}
```

- [ ] **Step 2: Verify Jekyll build**

Run: `bundle exec jekyll build --quiet 2>&1 | tail -5`
Then: `grep -c 'Source+Serif+4' _site/finance-story/index.html`
Expected: `1`

Then: `grep -c 'Source+Serif+4' _site/index.html`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add _includes/head.html
git commit -m "finance-story: conditional Source Serif/Sans font load on chapter pages"
```

---

### Task 3: Design tokens and base styles in finance-story.css

**Files:**
- Modify: `assets/finance-story.css`

These tokens are reused across all seven chapters. Locking them here in Task 3 means the rest of the build inherits them.

- [ ] **Step 1: Write the design tokens**

Replace the stub `assets/finance-story.css` with:

```css
/* Finance-story shared design system. */

.fs {
  --fs-cream: #FAF6EE;
  --fs-navy:  #0E2440;
  --fs-navy-deep: #0A1B30;
  --fs-teal:  #2F7D8E;
  --fs-teal-light: #94C3CF;
  --fs-buoy:  #C8553D;
  --fs-buoy-light: #E97056;
  --fs-ink:   #0F2A3D;
  --fs-mute:  #4A5C6A;
  --fs-faint: #93A4B0;

  --fs-radius: 14px;
  --fs-radius-sm: 8px;
  --fs-shadow-sm: 0 1px 2px rgba(15,42,61,0.06), 0 1px 3px rgba(15,42,61,0.05);
  --fs-shadow-md: 0 6px 14px rgba(15,42,61,0.08), 0 16px 36px rgba(15,42,61,0.12);

  --fs-serif: 'Source Serif 4', 'Source Serif Pro', Georgia, serif;
  --fs-sans:  'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif;

  background: var(--fs-cream);
  color: var(--fs-ink);
  font-family: var(--fs-sans);
}

@media (prefers-color-scheme: dark) {
  .fs {
    --fs-cream: #14202C;
    --fs-ink:   #E6ECF1;
    --fs-mute:  #B7D1E2;
    --fs-faint: #7A8A98;
  }
}
[data-theme="dark"] .fs {
  --fs-cream: #14202C;
  --fs-ink:   #E6ECF1;
  --fs-mute:  #B7D1E2;
  --fs-faint: #7A8A98;
}
[data-theme="light"] .fs {
  --fs-cream: #FAF6EE;
  --fs-ink:   #0F2A3D;
  --fs-mute:  #4A5C6A;
  --fs-faint: #93A4B0;
}

.fs * { box-sizing: border-box; }
.fs h1, .fs h2, .fs h3 { font-family: var(--fs-serif); font-weight: 400; }
.fs em { font-style: italic; }
```

- [ ] **Step 2: Verify build**

Run: `bundle exec jekyll build --quiet`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add assets/finance-story.css
git commit -m "finance-story: design tokens (palette, radius, fonts, dark-mode)"
```

---

### Task 4: Section primitives — hero, colored sections, big stat, quote card

**Files:**
- Modify: `assets/finance-story.css`

These primitives are the reusable parts. Every chapter composes from these.

- [ ] **Step 1: Append section primitives to finance-story.css**

Append to `assets/finance-story.css`:

```css
/* ---------- Hero ---------- */
.fs-hero {
  position: relative;
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, var(--fs-navy) 0%, #1C3B5C 60%, #224768 100%);
  overflow: hidden;
  padding: 80px 24px;
}
.fs-hero::before {
  content: '';
  position: absolute; inset: 0;
  background-image:
    linear-gradient(0deg, transparent 49%, rgba(255,255,255,0.04) 50%, transparent 51%),
    linear-gradient(90deg, transparent 49%, rgba(255,255,255,0.04) 50%, transparent 51%);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 90% 60% at 30% 50%, #000 40%, transparent 80%);
}
.fs-hero-inner { position: relative; z-index: 1; text-align: center; max-width: 900px; }
.fs-hero h1 {
  font-size: clamp(48px, 8vw, 110px);
  line-height: 1.02; letter-spacing: -0.02em;
  margin: 0 0 22px; color: #fff;
}
.fs-hero h1 em {
  font-weight: 300;
  color: var(--fs-teal-light);
}
.fs-hero p {
  font-size: clamp(15px, 1.8vw, 18px);
  line-height: 1.55; color: var(--fs-teal-light);
  max-width: 540px; margin: 0 auto 28px;
}
.fs-scroll-pill {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 12px 22px; border-radius: 999px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.22);
  color: var(--fs-teal-light); text-decoration: none; font-size: 13px;
  font-weight: 600; letter-spacing: 0.4px;
  backdrop-filter: blur(8px);
  transition: background 0.2s;
}
.fs-scroll-pill:hover, .fs-scroll-pill:focus-visible { background: rgba(255,255,255,0.16); color: #fff; outline: 2px solid var(--fs-teal-light); outline-offset: 4px; }
.fs-scroll-pill::after { content: '\2193'; font-size: 16px; }

/* ---------- Section shells ---------- */
.fs-section {
  position: relative;
  min-height: 90vh;
  display: flex; align-items: center;
  padding: 80px 0;
}
.fs-section.bg-cream { background: var(--fs-cream); }
.fs-section.bg-navy  { background: var(--fs-navy); color: #DDE6EE; }
.fs-section.bg-teal  { background: var(--fs-teal); color: #fff; }
.fs-section.bg-navy h2 { color: #fff; }
.fs-section.bg-navy h2 em { color: var(--fs-teal-light); }
.fs-section.bg-teal h2 { color: #fff; }
.fs-section.bg-teal h2 em { color: #CFE9EE; }

.fs-wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; width: 100%; }
.fs-grid { display: grid; gap: 48px; grid-template-columns: 1fr; }
@media (min-width: 900px) { .fs-grid { grid-template-columns: 1fr 1fr; align-items: center; } .fs-grid.flip > :first-child { order: 2; } }

.fs-eye {
  font-size: 11px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase;
  color: var(--fs-mute); margin: 0 0 16px;
}
.fs-section.bg-navy .fs-eye { color: var(--fs-teal-light); }
.fs-section.bg-teal .fs-eye { color: rgba(255,255,255,0.7); }

.fs-h2 {
  font-size: clamp(34px, 4.4vw, 60px);
  line-height: 1.05; letter-spacing: -0.018em;
  margin: 0 0 24px;
}
.fs-h2 em { color: var(--fs-teal); }
.fs-section.bg-navy .fs-h2 em { color: var(--fs-teal-light); }

.fs-body {
  font-size: 17px; line-height: 1.65;
  color: var(--fs-mute);
  max-width: 540px; margin: 0 0 16px;
}
.fs-section.bg-navy .fs-body { color: #B7D1E2; }
.fs-section.bg-teal .fs-body { color: rgba(255,255,255,0.86); }

/* ---------- Big stat ---------- */
.fs-stat {
  font-family: var(--fs-serif);
  font-size: clamp(110px, 18vw, 220px);
  line-height: 0.95; letter-spacing: -0.04em;
  color: var(--fs-buoy);
}
.fs-stat sup { font-size: 0.42em; vertical-align: top; margin-left: 4px; }
.fs-section.bg-navy .fs-stat { color: var(--fs-buoy-light); }

/* ---------- Quote card ---------- */
.fs-quote {
  background: rgba(255,255,255,0.96);
  border-radius: 20px; padding: 36px 40px;
  max-width: 480px;
  box-shadow: var(--fs-shadow-md);
}
.fs-quote .open { color: var(--fs-buoy); font-size: 30px; font-weight: 700; }
.fs-quote h3 {
  font-size: clamp(26px, 3.2vw, 36px);
  line-height: 1.18; letter-spacing: -0.012em;
  color: var(--fs-ink); margin: 8px 0 12px;
}
.fs-quote h3 em { color: var(--fs-teal); }
.fs-quote .attr {
  font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase;
  color: var(--fs-mute); font-weight: 600;
}

/* ---------- Photo placeholder ---------- */
.fs-photo {
  position: relative; aspect-ratio: 4 / 5;
  border-radius: var(--fs-radius); overflow: hidden;
  box-shadow: var(--fs-shadow-md);
}
.fs-photo .fs-photo-tag {
  position: absolute; left: 16px; bottom: 16px;
  background: rgba(255,255,255,0.92);
  padding: 6px 12px; border-radius: 8px;
  font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
  color: var(--fs-ink);
}
.fs-photo.placeholder-abbot {
  background:
    radial-gradient(ellipse 40% 50% at 50% 30%, #5B7553 0%, transparent 60%),
    linear-gradient(180deg, #C8D4DC 0%, #93A4B0 50%, #5B7553 100%);
}
```

- [ ] **Step 2: Verify build**

Run: `bundle exec jekyll build --quiet`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add assets/finance-story.css
git commit -m "finance-story: section primitives (hero, colored sections, stat, quote, photo)"
```

---

### Task 5: Reveal-on-view engine

**Files:**
- Modify: `assets/finance-story.js`

- [ ] **Step 1: Replace the stub JS with the reveal engine and add CSS for reveal classes**

Append to `assets/finance-story.css`:

```css
/* ---------- Reveal on view ---------- */
.fs-reveal {
  opacity: 0; transform: translateY(28px);
  transition: opacity 0.9s cubic-bezier(.2,.7,.2,1), transform 0.9s cubic-bezier(.2,.7,.2,1);
}
.fs-reveal.in-view { opacity: 1; transform: translateY(0); }
.fs-reveal.d1 { transition-delay: 0.1s; }
.fs-reveal.d2 { transition-delay: 0.25s; }
.fs-reveal.d3 { transition-delay: 0.4s; }
.fs-reveal.d4 { transition-delay: 0.55s; }

@media (prefers-reduced-motion: reduce) {
  .fs-reveal { opacity: 1; transform: none; transition: none; }
}
```

Replace `assets/finance-story.js` with:

```js
/* Finance-story shared engine: reveal-on-view + sticky progress bar. */
(function () {
  // ---------- Reveal-on-view ----------
  if ('IntersectionObserver' in window) {
    const reveals = document.querySelectorAll('.fs-reveal');
    if (reveals.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('in-view');
      });
    }, { threshold: 0.18 });
    reveals.forEach((r) => io.observe(r));
  } else {
    document.querySelectorAll('.fs-reveal').forEach((r) => r.classList.add('in-view'));
  }
})();
```

- [ ] **Step 2: Verify build**

Run: `bundle exec jekyll build --quiet`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add assets/finance-story.css assets/finance-story.js
git commit -m "finance-story: reveal-on-view engine with reduced-motion support"
```

---

### Task 6: Sticky bottom progress bar

**Files:**
- Modify: `assets/finance-story.css` (append styles)
- Modify: `assets/finance-story.js` (append progress logic)
- Modify: `_layouts/finance-story.html` (render bar)

- [ ] **Step 1: Append progress-bar styles**

Append to `assets/finance-story.css`:

```css
/* ---------- Sticky bottom progress bar ---------- */
.fs-progress {
  position: fixed; left: 0; right: 0; bottom: 0;
  z-index: 90;
  padding: 12px 20px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(15,42,61,0.08);
  display: flex; align-items: center; gap: 20px;
}
@media (prefers-color-scheme: dark) {
  .fs-progress { background: rgba(20,32,44,0.92); border-top-color: rgba(255,255,255,0.08); }
}
.fs-progress-bar {
  flex: 1; height: 4px; background: #E7DFCF;
  border-radius: 999px; overflow: hidden;
  position: relative;
}
@media (prefers-color-scheme: dark) {
  .fs-progress-bar { background: #2E3F4D; }
}
.fs-progress-fill {
  height: 100%; background: var(--fs-buoy);
  width: 0%; border-radius: 999px;
  transition: width 0.18s linear;
}
.fs-progress-cta {
  background: var(--fs-navy); color: #fff;
  padding: 8px 16px; border-radius: 999px; font-size: 13px;
  font-weight: 600; text-decoration: none; letter-spacing: 0.3px;
  display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap;
}
.fs-progress-cta:hover, .fs-progress-cta:focus-visible {
  filter: brightness(1.15);
  outline: 2px solid var(--fs-teal-light);
  outline-offset: 2px;
}
.fs-progress-cta::after { content: '\2192'; }
```

- [ ] **Step 2: Update layout to render bar with CTA from frontmatter**

Replace `_layouts/finance-story.html` with:

```html
---
layout: default
---
<link rel="stylesheet" href="{{ '/assets/finance-story.css' | relative_url }}">
<div class="fs">
  {{ content }}
  {%- if page.progress_cta_url and page.progress_cta_label -%}
  <div class="fs-progress" aria-hidden="true">
    <div class="fs-progress-bar"><div class="fs-progress-fill" id="fs-progress-fill"></div></div>
    <a class="fs-progress-cta" href="{{ page.progress_cta_url | relative_url }}">{{ page.progress_cta_label }}</a>
  </div>
  {%- endif -%}
</div>
<script defer src="{{ '/assets/finance-story.js' | relative_url }}"></script>
```

- [ ] **Step 3: Append progress-bar JS**

Append to `assets/finance-story.js` before the closing `})();`:

```js
  // ---------- Sticky bottom progress bar ----------
  const fill = document.getElementById('fs-progress-fill');
  if (fill) {
    let queued = false;
    function tickProgress() {
      const max = document.body.scrollHeight - window.innerHeight;
      const t = max > 0 ? window.scrollY / max : 0;
      fill.style.width = (t * 100).toFixed(2) + '%';
      queued = false;
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(tickProgress);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', tickProgress);
    tickProgress();
  }
```

- [ ] **Step 4: Verify build**

Run: `bundle exec jekyll build --quiet`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add assets/finance-story.css assets/finance-story.js _layouts/finance-story.html
git commit -m "finance-story: sticky bottom progress bar (opt-in via frontmatter)"
```

---

## Phase 2: Chapter 1 content

### Task 7: Write the chapter-1 Playwright smoke test (fails first)

**Files:**
- Create: `tests/finance-story-chapter1.mjs`

This test defines what "Chapter 1 is done" means. Build the chapter (Tasks 8-13) until it passes.

- [ ] **Step 1: Create the failing test**

`tests/finance-story-chapter1.mjs`:

```js
/**
 * Smoke test for finance-story Chapter 1.
 * Run against a built site (local or preview URL).
 *   SITE=http://localhost:4322 node tests/finance-story-chapter1.mjs
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'http://localhost:4322';
const URL = `${SITE}/finance-story/01-four-buckets`;
let passed = 0, failed = 0;
function ok(n) { passed++; console.log(`  PASS: ${n}`); }
function fail(n, d) { failed++; console.log(`  FAIL: ${n} - ${d}`); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const resp = await page.goto(URL + '.html', { waitUntil: 'networkidle' });

resp && resp.status() === 200 ? ok('page returns 200') : fail('page status', `${resp ? resp.status() : 'no response'}`);

const h1 = await page.textContent('h1');
h1 && h1.includes('four') ? ok(`h1 has "four": "${h1}"`) : fail('h1', `got "${h1}"`);

const sections = await page.$$('.fs-section');
sections.length >= 5 ? ok(`${sections.length} .fs-section panels`) : fail('section count', `got ${sections.length}, want >= 5`);

const headings = await page.$$eval('.fs-section h2', els => els.map(e => e.textContent.trim()));
const expected = ['General Fund', 'Enterprise', 'Capital', 'Special', 'mix'];
const allFound = expected.every(t => headings.some(h => h.toLowerCase().includes(t.toLowerCase())));
allFound ? ok('all 5 section headings present') : fail('headings', `got ${JSON.stringify(headings)}, missing one of: ${JSON.stringify(expected)}`);

const buckets = await page.$('#fs-buckets');
buckets ? ok('#fs-buckets diagram present') : fail('#fs-buckets', 'missing');

const cites = await page.$$('sup.cite');
cites.length >= 4 ? ok(`${cites.length} citation markers (>= 4)`) : fail('citations', `got ${cites.length}, want >= 4`);

const cta = await page.$('.fs-progress-cta');
cta ? ok('sticky progress CTA present') : fail('CTA', 'missing');

// Mobile viewport: no horizontal scroll
await ctx.close();
const mobCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mobPage = await mobCtx.newPage();
await mobPage.goto(URL + '.html', { waitUntil: 'networkidle' });
const overflow = await mobPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
overflow ? fail('mobile horizontal scroll', `scrollWidth > innerWidth`) : ok('no horizontal scroll on mobile');

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run the test, verify FAIL**

Run: `cd _site && python3 -m http.server 4322 > /tmp/srv.log 2>&1 &`
Wait 1s.
Run: `SITE=http://localhost:4322 node tests/finance-story-chapter1.mjs`
Expected: page returns 404 (chapter doesn't exist yet). All assertions fail.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/finance-story-chapter1.mjs
git commit -m "finance-story: chapter 1 smoke test (currently failing)"
```

---

### Task 8: Build the chapter shell (frontmatter, hero)

**Files:**
- Create: `finance-story/01-four-buckets.html`

- [ ] **Step 1: Create the chapter file with hero**

`finance-story/01-four-buckets.html`:

```html
---
layout: finance-story
title: "Chapter 1: The four buckets - Marblehead finance story"
og_title: "The four buckets - Marblehead finance story"
og_description: "Town money lives in four separate buckets. Each one is funded differently and can't be redirected to the others. Chapter 1 of the Marblehead finance story."
og_url: https://marbleheaddata.org/finance-story/01-four-buckets
scripts: [citations]
progress_cta_url: /checkbook/
progress_cta_label: Open the checkbook
---

<section class="fs-hero">
  <div class="fs-hero-inner">
    <h1>Town money lives in <em>four separate buckets</em>.</h1>
    <p>Each bucket is funded differently and can't be redirected to the others. Knowing which is which is the first step in any honest budget conversation.</p>
    <a class="fs-scroll-pill" href="#general-fund">Scroll down</a>
  </div>
</section>
```

- [ ] **Step 2: Verify build**

Run: `bundle exec jekyll build --quiet`
Expected: `_site/finance-story/01-four-buckets.html` exists.

- [ ] **Step 3: Commit**

```bash
git add finance-story/01-four-buckets.html
git commit -m "finance-story: chapter 1 hero (Town money lives in four separate buckets)"
```

---

### Task 9: Build Section 1 (General Fund) with four-bucket SVG diagram

**Files:**
- Modify: `finance-story/01-four-buckets.html`

The SVG diagram `#fs-buckets` will persist across sections via copies in each section (the simplest model — each section has its own copy with a different bucket highlighted). All four bucket rectangles are visible in every copy; the "active" one is full color while the others are dimmed.

- [ ] **Step 1: Append Section 1 to the chapter**

Append to `finance-story/01-four-buckets.html`:

```html
<section id="general-fund" class="fs-section bg-cream">
  <div class="fs-wrap">
    <div class="fs-grid">
      <div class="fs-reveal">
        <p class="fs-eye">Bucket 1 of 4</p>
        <h2 class="fs-h2">The <em>General Fund</em>.</h2>
        <p class="fs-body">The main operating budget. About <strong>$109.78&nbsp;million</strong> in FY27.<sup class="cite" data-source="FY27 Proposed Budget - No Override, General Fund total appropriation." data-href="https://www.marbleheadma.gov/finance-department/files/fy27-proposed-budget-no-override"></sup> Funded by the property-tax levy, state aid, and local receipts. Spent on town and school salaries, benefits, supplies, services, debt service on previously issued bonds, and the town's contribution to retiree health benefits.</p>
        <p class="fs-body">This is the budget that lives inside the Proposition 2&frac12; cap. When residents talk about "the town budget," they usually mean this one.</p>
      </div>
      <div class="fs-reveal d2">
        <svg viewBox="0 0 460 360" class="fs-buckets" id="fs-buckets" role="img" aria-label="Four buckets of town money. General Fund highlighted.">
          <g class="bucket bucket-gf" data-active>
            <rect x="20" y="40" width="200" height="280" rx="10" fill="var(--fs-navy)"/>
            <text x="120" y="80" font-size="11" font-weight="700" letter-spacing="1.4" fill="rgba(255,255,255,0.7)" text-anchor="middle" style="text-transform:uppercase;">General Fund</text>
            <text x="120" y="180" font-size="36" font-weight="700" fill="#fff" text-anchor="middle">$109.78M</text>
            <text x="120" y="208" font-size="12" fill="rgba(255,255,255,0.78)" text-anchor="middle">levy &middot; state aid &middot; receipts</text>
          </g>
          <g class="bucket bucket-ef">
            <rect x="240" y="100" width="80" height="220" rx="8" fill="var(--fs-teal)" fill-opacity="0.35"/>
            <text x="280" y="130" font-size="9" font-weight="700" letter-spacing="1.2" fill="rgba(255,255,255,0.5)" text-anchor="middle" style="text-transform:uppercase;">Enterprise</text>
            <text x="280" y="215" font-size="18" font-weight="700" fill="rgba(255,255,255,0.4)" text-anchor="middle">$13M</text>
          </g>
          <g class="bucket bucket-cb">
            <rect x="330" y="160" width="60" height="160" rx="6" fill="var(--fs-brass, #B8860B)" fill-opacity="0.3"/>
            <text x="360" y="185" font-size="9" font-weight="700" letter-spacing="1.2" fill="rgba(184,134,11,0.55)" text-anchor="middle" style="text-transform:uppercase;">Capital</text>
            <text x="360" y="250" font-size="14" font-weight="700" fill="rgba(184,134,11,0.6)" text-anchor="middle">~$8M</text>
          </g>
          <g class="bucket bucket-sr">
            <rect x="400" y="220" width="40" height="100" rx="4" fill="var(--fs-plum, #6C4A6E)" fill-opacity="0.3"/>
            <text x="420" y="240" font-size="8" font-weight="700" letter-spacing="1" fill="rgba(108,74,110,0.6)" text-anchor="middle" style="text-transform:uppercase;">Restricted</text>
          </g>
        </svg>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Verify build and re-run test**

Run: `bundle exec jekyll build --quiet`
Then in another shell: `SITE=http://localhost:4322 node tests/finance-story-chapter1.mjs`
Expected: more PASS messages now (h1 present, hero present, #fs-buckets present, but section count still < 5).

- [ ] **Step 3: Commit**

```bash
git add finance-story/01-four-buckets.html
git commit -m "finance-story: chapter 1 section 1 (General Fund) with bucket diagram"
```

---

### Task 10: Section 2 (Enterprise Funds)

**Files:**
- Modify: `finance-story/01-four-buckets.html`

- [ ] **Step 1: Append Section 2**

```html
<section id="enterprise" class="fs-section bg-navy">
  <div class="fs-wrap">
    <div class="fs-grid flip">
      <div class="fs-reveal">
        <p class="fs-eye">Bucket 2 of 4</p>
        <h2 class="fs-h2"><em>Enterprise funds</em>. The side that doesn't touch your tax bill.</h2>
        <p class="fs-body">Three utilities pay for themselves. Water (<strong>$6.9M</strong>), sewer (<strong>$4.8M</strong>), harbor (<strong>$1.3M</strong>).<sup class="cite" data-source="FY27 Proposed Budget - No Override, Enterprise Fund schedules: Water, Sewer, Harbor." data-href="https://www.marbleheadma.gov/finance-department/files/fy27-proposed-budget-no-override"></sup> Each is funded by user fees and operates independently of the General Fund.</p>
        <p class="fs-body">A water-rate increase doesn't go through Town Meeting. Rates are set by the relevant board to cover the cost of providing the service. The cap doesn't apply. Reserves stay inside the fund and can't be redirected to general use.</p>
      </div>
      <div class="fs-reveal d2">
        <svg viewBox="0 0 460 360" class="fs-buckets" role="img" aria-label="Enterprise Funds bucket highlighted.">
          <g class="bucket bucket-gf">
            <rect x="20" y="40" width="200" height="280" rx="10" fill="var(--fs-navy)" fill-opacity="0.35"/>
            <text x="120" y="80" font-size="11" font-weight="700" letter-spacing="1.4" fill="rgba(255,255,255,0.4)" text-anchor="middle" style="text-transform:uppercase;">General Fund</text>
            <text x="120" y="180" font-size="28" font-weight="700" fill="rgba(255,255,255,0.42)" text-anchor="middle">$109.78M</text>
          </g>
          <g class="bucket bucket-ef" data-active>
            <rect x="240" y="100" width="80" height="220" rx="8" fill="var(--fs-teal)"/>
            <text x="280" y="130" font-size="11" font-weight="700" letter-spacing="1.2" fill="rgba(255,255,255,0.86)" text-anchor="middle" style="text-transform:uppercase;">Enterprise</text>
            <text x="280" y="200" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">$13M</text>
            <text x="280" y="222" font-size="10" fill="rgba(255,255,255,0.86)" text-anchor="middle">water + sewer + harbor</text>
          </g>
          <g class="bucket bucket-cb">
            <rect x="330" y="160" width="60" height="160" rx="6" fill="#B8860B" fill-opacity="0.25"/>
          </g>
          <g class="bucket bucket-sr">
            <rect x="400" y="220" width="40" height="100" rx="4" fill="#6C4A6E" fill-opacity="0.25"/>
          </g>
        </svg>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Verify build**

Run: `bundle exec jekyll build --quiet`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add finance-story/01-four-buckets.html
git commit -m "finance-story: chapter 1 section 2 (Enterprise funds)"
```

---

### Task 11: Section 3 (Capital Budget)

**Files:**
- Modify: `finance-story/01-four-buckets.html`

- [ ] **Step 1: Append Section 3**

```html
<section id="capital" class="fs-section bg-cream">
  <div class="fs-wrap">
    <div class="fs-grid">
      <div class="fs-reveal">
        <p class="fs-eye">Bucket 3 of 4</p>
        <h2 class="fs-h2">The <em>capital budget</em>. Bonded today; paid tomorrow.</h2>
        <p class="fs-body">The capital budget funds buildings, equipment, infrastructure, and major repairs. The annual size varies; recent town capital plans have averaged roughly <strong>$8 million per year</strong> across town and school sides.<sup class="cite" data-source="FY26-FY30 Town Capital Improvement Plan; figure is an approximate annual average across town and school capital across the 5-year window." data-href="https://www.marbleheadma.gov/finance-department"></sup></p>
        <p class="fs-body">Most capital is funded by general-obligation bonds. The bond proceeds pay the contractor today; the annual debt service goes into the General Fund as a fixed cost for the life of the bond, usually 20 years.</p>
        <p class="fs-body">Voters approved two debt-exclusion bonds on June 9, 2026: a school feasibility study and a new fire headquarters.<sup class="cite" data-source="Marblehead Town Clerk, Town Election Unofficial Results, June 9, 2026" data-href="/data/town_docs/2026-06-09-Town-Election-Unofficial-Results.docx"></sup> Those bonds will appear as excluded-debt service starting when they're issued.</p>
      </div>
      <div class="fs-reveal d2">
        <svg viewBox="0 0 460 360" class="fs-buckets" role="img" aria-label="Capital Budget bucket highlighted.">
          <g class="bucket bucket-gf"><rect x="20" y="40" width="200" height="280" rx="10" fill="var(--fs-navy)" fill-opacity="0.3"/><text x="120" y="180" font-size="26" font-weight="700" fill="rgba(15,42,61,0.4)" text-anchor="middle">$109.78M</text></g>
          <g class="bucket bucket-ef"><rect x="240" y="100" width="80" height="220" rx="8" fill="var(--fs-teal)" fill-opacity="0.3"/><text x="280" y="205" font-size="16" font-weight="700" fill="rgba(47,125,142,0.5)" text-anchor="middle">$13M</text></g>
          <g class="bucket bucket-cb" data-active>
            <rect x="330" y="160" width="60" height="160" rx="6" fill="#B8860B"/>
            <text x="360" y="185" font-size="9" font-weight="700" letter-spacing="1.2" fill="rgba(255,255,255,0.92)" text-anchor="middle" style="text-transform:uppercase;">Capital</text>
            <text x="360" y="235" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">~$8M</text>
            <text x="360" y="252" font-size="9" fill="rgba(255,255,255,0.86)" text-anchor="middle">bonded</text>
          </g>
          <g class="bucket bucket-sr"><rect x="400" y="220" width="40" height="100" rx="4" fill="#6C4A6E" fill-opacity="0.25"/></g>
        </svg>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Verify build**

Run: `bundle exec jekyll build --quiet`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add finance-story/01-four-buckets.html
git commit -m "finance-story: chapter 1 section 3 (Capital budget)"
```

---

### Task 12: Section 4 (Special / Restricted)

**Files:**
- Modify: `finance-story/01-four-buckets.html`

- [ ] **Step 1: Append Section 4**

```html
<section id="restricted" class="fs-section bg-teal">
  <div class="fs-wrap">
    <div class="fs-grid flip">
      <div class="fs-reveal">
        <p class="fs-eye">Bucket 4 of 4</p>
        <h2 class="fs-h2"><em>Restricted</em>. Earmarked the moment it arrives.</h2>
        <p class="fs-body">Federal and state grants, gifts, revolving funds, scholarship trusts. Smaller in dollar terms than the other three buckets but legally distinct: every dollar is tied to a specific purpose by the funding source.</p>
        <p class="fs-body">A grant won by the police department for body cameras can't pay for school books. A revolving fund from recreation program fees can't subsidize the library. The General Fund can't absorb these or be used to make up for shortfalls in them.</p>
        <p class="fs-body">Grant chasing is a real workload. Successful grant capture shows up as cost avoidance, not as direct revenue residents see on the levy.</p>
      </div>
      <div class="fs-reveal d2">
        <svg viewBox="0 0 460 360" class="fs-buckets" role="img" aria-label="Restricted funds bucket highlighted.">
          <g class="bucket bucket-gf"><rect x="20" y="40" width="200" height="280" rx="10" fill="var(--fs-navy)" fill-opacity="0.3"/></g>
          <g class="bucket bucket-ef"><rect x="240" y="100" width="80" height="220" rx="8" fill="var(--fs-teal)" fill-opacity="0.3"/></g>
          <g class="bucket bucket-cb"><rect x="330" y="160" width="60" height="160" rx="6" fill="#B8860B" fill-opacity="0.3"/></g>
          <g class="bucket bucket-sr" data-active>
            <rect x="400" y="220" width="40" height="100" rx="4" fill="#6C4A6E"/>
            <text x="420" y="270" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">restricted</text>
          </g>
        </svg>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Verify build**

Run: `bundle exec jekyll build --quiet`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add finance-story/01-four-buckets.html
git commit -m "finance-story: chapter 1 section 4 (Restricted funds)"
```

---

### Task 13: Section 5 (Why they don't mix) and closing CTA

**Files:**
- Modify: `finance-story/01-four-buckets.html`

- [ ] **Step 1: Append Section 5 + closing**

```html
<section id="why-they-dont-mix" class="fs-section bg-cream">
  <div class="fs-wrap" style="text-align:center;">
    <div class="fs-reveal" style="max-width: 760px; margin: 0 auto;">
      <p class="fs-eye" style="text-align:center;">Why the <em>buckets don't mix</em></p>
      <h2 class="fs-h2" style="text-align:center;">The walls between them are <em>legal</em>, not bureaucratic.</h2>
      <p class="fs-body" style="margin: 0 auto 14px; text-align: center;">Massachusetts statute, GASB accounting rules, bond covenants, and grant agreements each draw their own walls. A surplus in the Water Enterprise Fund can't paper over a deficit in the General Fund. A bond approved for a fire station can't be redirected to fix a school roof.</p>
      <p class="fs-body" style="margin: 0 auto; text-align: center;">When residents ask why the town can't just shift money around, this is the answer. Each bucket has its own revenue, its own rules, and its own ledger.</p>
    </div>
  </div>
</section>

<section id="closing" class="fs-section bg-navy" style="min-height: auto; padding: 80px 0;">
  <div class="fs-wrap" style="text-align:center;">
    <div class="fs-reveal" style="max-width: 720px; margin: 0 auto;">
      <h3 style="font-family: var(--fs-serif); font-size: clamp(26px, 3.2vw, 36px); color: #fff; margin: 0 0 16px;">Next up: <em>where the dollar goes</em>.</h3>
      <p class="fs-body" style="margin: 0 auto 24px; color: var(--fs-teal-light); text-align: center;">Chapter 2 follows the General-Fund dollar through the operating budget. Where 80&cent; pays a person and why the other 20&cent; is mostly already spoken for.</p>
      <a class="fs-scroll-pill" href="{{ '/finance-story/02-where-the-dollar-goes' | relative_url }}" aria-disabled="true" style="opacity:0.6; pointer-events:none;">Chapter 2 (coming)</a>
      <p style="margin-top: 32px;"><a href="{{ '/finance-story/' | relative_url }}" style="color: var(--fs-teal-light); text-decoration: underline;">Back to all chapters</a></p>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Run the chapter test**

In one shell: `bundle exec jekyll build --quiet`
In another: `cd _site && python3 -m http.server 4322 > /tmp/srv.log 2>&1 &` (if not running)
Run: `SITE=http://localhost:4322 node tests/finance-story-chapter1.mjs`
Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add finance-story/01-four-buckets.html
git commit -m "finance-story: chapter 1 section 5 (Why they don't mix) + closing CTA"
```

---

## Phase 3: Citations, polish, accessibility

### Task 14: Verify every dollar figure has a citation

**Files:**
- Audit: `finance-story/01-four-buckets.html`

- [ ] **Step 1: Run a regex check for un-cited dollar amounts**

Run:
```bash
grep -oE '\$[0-9]+(\.[0-9]+)?(M|m|&nbsp;million| million)?[^<]*' finance-story/01-four-buckets.html | head -40
```

For each dollar figure that appears in body text (not inside `<svg>`), there must be a `<sup class="cite" ...></sup>` within the same paragraph. Already covered in sections 1-3; double-check.

- [ ] **Step 2: Verify chapter renders the Sources section after citations.js runs**

Run: `SITE=http://localhost:4322 node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto('http://localhost:4322/finance-story/01-four-buckets.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const h2s = await p.\$\$eval('h2', els => els.map(e => e.textContent.trim()));
  console.log('headings:', h2s);
  const hasSources = h2s.some(h => h.toLowerCase() === 'sources');
  console.log('has Sources section?', hasSources);
  await b.close();
});
"`

Expected: `has Sources section? true`

- [ ] **Step 3: Commit any citation-source corrections**

If any citations were added or corrected in Step 1:

```bash
git add finance-story/01-four-buckets.html
git commit -m "finance-story: chapter 1 citation audit"
```

If no changes, skip the commit.

---

### Task 15: Dark mode and reduced-motion verification

**Files:**
- No changes expected; this task only verifies prior CSS.

- [ ] **Step 1: Test dark mode rendering via Playwright**

Run:
```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4322/finance-story/01-four-buckets.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'proof/finance-story-ch1-dark.png' });
  console.log('captured dark screenshot');
  await b.close();
});
"
```

Open `proof/finance-story-ch1-dark.png` and verify text is legible, no light-on-light or dark-on-dark.

- [ ] **Step 2: Test reduced-motion**

Run:
```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4322/finance-story/01-four-buckets.html', { waitUntil: 'networkidle' });
  const opacities = await p.\$\$eval('.fs-reveal', els => els.map(e => getComputedStyle(e).opacity));
  console.log('opacities under reduced-motion:', opacities);
  const allVisible = opacities.every(o => parseFloat(o) >= 0.99);
  console.log('all reveals immediately visible?', allVisible);
  await b.close();
});
"
```

Expected: all opacities = 1.

- [ ] **Step 3: If either fails, fix and commit**

Fix any styling issue in `assets/finance-story.css`, then:

```bash
git add assets/finance-story.css
git commit -m "finance-story: dark-mode / reduced-motion polish"
```

If both pass, skip the commit.

---

### Task 16: Accessibility audit

**Files:**
- Modify: `finance-story/01-four-buckets.html` if issues found

- [ ] **Step 1: Run axe-core via Playwright**

Run:
```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto('http://localhost:4322/finance-story/01-four-buckets.html', { waitUntil: 'networkidle' });
  await p.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js' });
  const results = await p.evaluate(async () => await window.axe.run());
  console.log('violations:', results.violations.length);
  results.violations.forEach(v => console.log('-', v.id, v.help, v.nodes.length, 'nodes'));
  await b.close();
});
"
```

Expected: 0 violations. Common issues to fix if any appear: missing `aria-label` on SVG, color-contrast on quote attributions, heading hierarchy skips.

- [ ] **Step 2: If violations, fix them**

For each violation, edit `finance-story/01-four-buckets.html` to address. Common fixes:
- Missing alt: add `aria-label` to `<svg>` (already done in Task 9-12; double-check).
- Heading order: ensure `<h2>` follows `<h1>`; no `<h2>` without intervening `<h1>`.
- Contrast: replace muted tokens with their darker counterparts.

- [ ] **Step 3: Re-run and commit fixes**

Re-run the audit. When violations = 0:

```bash
git add finance-story/01-four-buckets.html
git commit -m "finance-story: chapter 1 a11y fixes"
```

If no fixes needed, skip the commit.

---

## Phase 4: Landing page, integration, proof

### Task 17: Build the finance-story landing page

**Files:**
- Modify: `finance-story/index.html`

- [ ] **Step 1: Replace the stub landing page**

Replace `finance-story/index.html` with:

```html
---
layout: finance-story
title: "Marblehead finance story"
og_title: "Marblehead finance story"
og_description: "A visual primer on how Marblehead's town money actually works. Seven chapters. About 10-15 minutes."
og_url: https://marbleheaddata.org/finance-story/
sitemap: false
---

<section class="fs-hero">
  <div class="fs-hero-inner">
    <h1>How town money <em>actually works</em>.</h1>
    <p>A visual primer in seven chapters. About 10-15 minutes if you read them all. Each chapter teaches one structural concept that residents commonly conflate.</p>
    <a class="fs-scroll-pill" href="#toc">Browse chapters</a>
  </div>
</section>

<section id="toc" class="fs-section bg-cream" style="min-height: auto; padding: 80px 0;">
  <div class="fs-wrap">
    <p class="fs-eye">Table of contents</p>
    <h2 class="fs-h2">The <em>seven</em> chapters.</h2>
    <ol style="list-style: none; padding: 0; margin: 32px 0 0;">
      <li class="fs-reveal" style="margin: 0 0 12px;">
        <a href="{{ '/finance-story/01-four-buckets' | relative_url }}" style="display:block; padding: 22px 26px; background: #fff; border: 1px solid #E2DCC9; border-radius: 14px; color: var(--fs-ink); text-decoration: none;">
          <strong style="font-family: var(--fs-serif); font-size: 22px; display: block; margin-bottom: 6px;">Chapter 1 &middot; The four buckets</strong>
          <span style="color: var(--fs-mute); font-size: 14px;">Town money lives in four separate buckets that don't mix. General Fund, Enterprise, Capital, Restricted. ~3 minutes.</span>
        </a>
      </li>
      <li class="fs-reveal d1" style="margin: 0 0 12px; opacity: 0.55;">
        <div style="padding: 22px 26px; background: #fff; border: 1px solid #E2DCC9; border-radius: 14px;">
          <strong style="font-family: var(--fs-serif); font-size: 22px; display: block; margin-bottom: 6px;">Chapter 2 &middot; Where the dollar goes</strong>
          <span style="color: var(--fs-mute); font-size: 14px;">80&cent; pays a person. Coming next.</span>
        </div>
      </li>
      <li class="fs-reveal d2" style="margin: 0 0 12px; opacity: 0.5;">
        <div style="padding: 22px 26px; background: #fff; border: 1px solid #E2DCC9; border-radius: 14px;">
          <strong style="font-family: var(--fs-serif); font-size: 22px; display: block; margin-bottom: 6px;">Chapter 3 &middot; The 1,020 people</strong>
          <span style="color: var(--fs-mute); font-size: 14px;">Coming.</span>
        </div>
      </li>
      <li class="fs-reveal d3" style="margin: 0 0 12px; opacity: 0.45;">
        <div style="padding: 22px 26px; background: #fff; border: 1px solid #E2DCC9; border-radius: 14px;">
          <strong style="font-family: var(--fs-serif); font-size: 22px; display: block; margin-bottom: 6px;">Chapter 4 &middot; Two pillars, one tax base</strong>
          <span style="color: var(--fs-mute); font-size: 14px;">Coming.</span>
        </div>
      </li>
      <li class="fs-reveal d4" style="margin: 0 0 12px; opacity: 0.4;">
        <div style="padding: 22px 26px; background: #fff; border: 1px solid #E2DCC9; border-radius: 14px;">
          <strong style="font-family: var(--fs-serif); font-size: 22px; display: block; margin-bottom: 6px;">Chapter 5 &middot; How debt actually works</strong>
          <span style="color: var(--fs-mute); font-size: 14px;">Coming.</span>
        </div>
      </li>
      <li class="fs-reveal d4" style="margin: 0 0 12px; opacity: 0.35;">
        <div style="padding: 22px 26px; background: #fff; border: 1px solid #E2DCC9; border-radius: 14px;">
          <strong style="font-family: var(--fs-serif); font-size: 22px; display: block; margin-bottom: 6px;">Chapter 6 &middot; Enterprise funds</strong>
          <span style="color: var(--fs-mute); font-size: 14px;">Coming.</span>
        </div>
      </li>
      <li class="fs-reveal d4" style="margin: 0 0 12px; opacity: 0.3;">
        <div style="padding: 22px 26px; background: #fff; border: 1px solid #E2DCC9; border-radius: 14px;">
          <strong style="font-family: var(--fs-serif); font-size: 22px; display: block; margin-bottom: 6px;">Chapter 7 &middot; Twenty years</strong>
          <span style="color: var(--fs-mute); font-size: 14px;">Coming.</span>
        </div>
      </li>
    </ol>
  </div>
</section>
```

- [ ] **Step 2: Verify build**

Run: `bundle exec jekyll build --quiet`
Then visit `http://localhost:4322/finance-story/` and confirm the landing page renders.

- [ ] **Step 3: Commit**

```bash
git add finance-story/index.html
git commit -m "finance-story: landing page (TOC with chapter 1 active, 2-7 placeholders)"
```

---

### Task 18: Add chapter URLs to global smoke test

**Files:**
- Modify: `tests/smoke-test.mjs`

- [ ] **Step 1: Find the existing list of URLs/pages tested in smoke-test.mjs**

Run: `grep -n "site.goto\|page.goto\|URL\|nav-test" tests/smoke-test.mjs | head -20`

This locates where URLs are listed. Add two entries: `/finance-story/` and `/finance-story/01-four-buckets`.

- [ ] **Step 2: Add the new URLs to the existing list (find the right spot from Step 1)**

Open `tests/smoke-test.mjs` and add a new test function modeled on `testCheckbookPageLoads`:

```js
async function testFinanceStoryLoads(page) {
  console.log('\n── Finance story chapter 1 ──');
  const resp = await page.goto(`${SITE}/finance-story/01-four-buckets`, { waitUntil: 'domcontentloaded' });
  resp && resp.status() === 200
    ? ok('Finance story chapter 1 returns 200')
    : fail('Finance story', `status ${resp ? resp.status() : 'no response'}`);
  const h1 = await page.$('h1');
  h1 ? ok('Chapter 1 has h1') : fail('Chapter 1 h1', 'missing');
  const sections = await page.$$('.fs-section');
  sections.length >= 5 ? ok(`${sections.length} .fs-section panels`) : fail('section count', `got ${sections.length}, want >= 5`);
}
```

Wire it into the main runner alongside other `await testXxx(page)` calls.

- [ ] **Step 3: Run the smoke test**

Run: `SITE=http://localhost:4322 node tests/smoke-test.mjs`
Expected: All previous tests pass, plus the new finance-story tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "finance-story: add chapter 1 to site smoke test"
```

---

### Task 19: Add cross-link from Marblehead 101 Chapter 4

**Files:**
- Modify: `marblehead-101/04-where-money-goes.html`

- [ ] **Step 1: Find the last paragraph of 101 chapter 4**

Run: `tail -5 marblehead-101/04-where-money-goes.html`
The existing closing paragraph references `town-budget.html` and `where-has-the-money-gone.html`. Append a sentence linking to the new chapter.

- [ ] **Step 2: Add the link**

Use Edit tool to add (after the closing paragraph but before the final `---` or end):

```html
<p>For a shorter visual treatment of the four kinds of town money and how each is funded, see <a class="inline" href="{{ '/' | relative_url }}finance-story/01-four-buckets">Finance story: the four buckets</a>.</p>
```

- [ ] **Step 3: Verify build and commit**

Run: `bundle exec jekyll build --quiet`
Expected: success.

```bash
git add marblehead-101/04-where-money-goes.html
git commit -m "marblehead-101: link Chapter 4 out to finance-story Chapter 1"
```

---

### Task 20: Add a homepage entry point

**Files:**
- Modify: `index.html` (homepage)

- [ ] **Step 1: Find the homepage tile grid**

Run: `grep -n "home-tile" index.html | head -10`
This finds the 6 existing tiles. The seventh (or replacement) tile points to finance-story.

- [ ] **Step 2: Add a finance-story tile**

Decide with caution: the homepage currently has 6 tiles. Either add a 7th (becomes 3x3 on wide, awkward) or replace one (probably the "2026 Override" archive becomes the one to deprioritize). For this PR, **add as a 7th tile** so nothing existing gets cut without separate discussion.

Append a new tile after the existing `<a class="home-tile" href="/2026-override/">` tile:

```html
<a class="home-tile" href="/finance-story/">
  <div class="tile-eye">NEW</div>
  <h3>How town money actually works</h3>
  <p>A 7-chapter visual primer. Start with the four buckets. ~3 minutes for Chapter 1, ~15 for all of it.</p>
</a>
```

- [ ] **Step 3: Verify build**

Run: `bundle exec jekyll build --quiet`
Open `_site/index.html` in browser; confirm 7 tiles render.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "home: add finance-story entry tile (7 tiles total)"
```

---

### Task 21: Capture proof screenshots

**Files:**
- Create: `scripts/capture-finance-chapter1.mjs`
- Capture into: `proof/finance-story-chapter1-*.png`

- [ ] **Step 1: Write the capture script**

`scripts/capture-finance-chapter1.mjs`:

```js
import { chromium } from 'playwright';
const BASE = 'http://localhost:4322';
const browser = await chromium.launch();
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });

async function shoot(ctx, anchor, label) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/finance-story/01-four-buckets.html` + (anchor ? '#' + anchor : ''), { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `proof/finance-story-chapter1-${label}.png` });
  console.log('captured', label);
  await p.close();
}

for (const [a, n] of [[null,'hero'],['general-fund','gf'],['enterprise','ef'],['capital','cb'],['restricted','sr'],['why-they-dont-mix','why']]) {
  await shoot(desk, a, n);
}
for (const [a, n] of [[null,'mob-hero'],['general-fund','mob-gf'],['enterprise','mob-ef']]) {
  await shoot(mob, a, n);
}
await browser.close();
```

- [ ] **Step 2: Run capture**

Run: `node scripts/capture-finance-chapter1.mjs`
Expected: 9 PNG files in `proof/`.

- [ ] **Step 3: Commit**

```bash
git add scripts/capture-finance-chapter1.mjs proof/finance-story-chapter1-*.png
git commit -m "finance-story: chapter 1 proof screenshots (desktop + mobile)"
```

---

### Task 22: Push branch and open PR

**Files:**
- No file changes; git/GitHub operations only.

- [ ] **Step 1: Push the branch**

Run: `git push -u origin $(git branch --show-current)`
Expected: branch pushes; remote prints PR URL.

- [ ] **Step 2: Write the PR body to a temp file then create the PR**

Single-quoted heredoc avoids variable expansion (so `$110M` renders literally) but we need to substitute the branch name into the image URLs after.

```bash
BRANCH=$(git branch --show-current)
cat > /tmp/finance-story-pr-body.md <<'EOF'
## Summary

First chapter of the finance-story scrollytelling primer, plus the shared design system (CSS + JS engine + layout) that Chapters 2-7 will reuse.

Per spec: docs/superpowers/specs/2026-06-11-finance-story-design.md

Chapter 1 teaches the four kinds of town money: General Fund (~$110M), Enterprise ($13M), Capital (~$8M/yr), and Restricted. Why each is funded differently and can't be redirected to the others.

## Preview & How to Test

- **Preview URL**: Cloudflare PR preview will appear at https://marblehead-pr-NN.preview-deploy when CI completes. I'll edit this section with the real URL once green.
- **Paths to check**:
  1. `/finance-story/` — landing page with TOC
  2. `/finance-story/01-four-buckets` — Chapter 1, scroll all sections
- **Expected behavior**: Five colored sections + closing CTA. Sticky bottom progress bar fills as you scroll, "Open the checkbook" CTA on the right. Each section's bucket diagram highlights its bucket while dimming the others. Citations injected by `assets/citations.js` produce a Sources section at the bottom.
- **Edge cases worth poking**:
  - Mobile 390×844: no horizontal scroll, headings legible, bucket diagrams render
  - Dark mode toggle from site nav: colors flip correctly
  - System reduced-motion: reveals appear instantly, no fade-in
  - Homepage tile: 7th tile labeled "NEW" points to /finance-story/

## Proof of Work

- [x] Screenshots captured against the built site via Playwright
- [x] Committed to the branch under `proof/finance-story-chapter1-*.png`
- [x] Chapter-specific Playwright test `tests/finance-story-chapter1.mjs` passes against the built site
- [x] Site smoke test extended; passes locally

![Hero](../blob/__BRANCH__/proof/finance-story-chapter1-hero.png?raw=true)

![General Fund section](../blob/__BRANCH__/proof/finance-story-chapter1-gf.png?raw=true)

![Enterprise section](../blob/__BRANCH__/proof/finance-story-chapter1-ef.png?raw=true)

![Capital section](../blob/__BRANCH__/proof/finance-story-chapter1-cb.png?raw=true)

![Restricted section](../blob/__BRANCH__/proof/finance-story-chapter1-sr.png?raw=true)

![Why they don't mix](../blob/__BRANCH__/proof/finance-story-chapter1-why.png?raw=true)

Mobile (390×844):

![Mobile hero](../blob/__BRANCH__/proof/finance-story-chapter1-mob-hero.png?raw=true)

## Risk

Low. New isolated section under `/finance-story/` with its own layout. Scoped under `.fs` so CSS cannot leak into other site pages. JS gated to pages that include `#fs-progress-fill` or `.fs-reveal` (does nothing otherwise). One homepage tile added (7 total). One cross-link added in marblehead-101 chapter 4.

Photography: ships with placeholder gradient on Abbot Hall. Real photo swap is a follow-up PR once commissioned.
EOF

sed -i "s|__BRANCH__|$BRANCH|g" /tmp/finance-story-pr-body.md
gh pr create --title "Finance story: Chapter 1 - The Four Buckets" --body-file /tmp/finance-story-pr-body.md
```

- [ ] **Step 3: Wait for preview deploy, then update PR body with the real URL**

```bash
until gh pr view $(gh pr view --json number -q .number) --comments --json comments --jq '.comments[] | select(.body | contains("preview-url")) | .body' | grep -q 'Branch URL'; do sleep 20; done
# Copy the Branch URL into PR body via gh pr edit if not already auto-populated
```

- [ ] **Step 4: Run smoke test against the deployed preview URL**

Once the preview URL is known:

```bash
SITE=https://<preview-host>.pages.dev node tests/smoke-test.mjs
SITE=https://<preview-host>.pages.dev node tests/finance-story-chapter1.mjs
```

Expected: all green.

---

## Out of scope (explicitly)

- Chapters 2-7 (each gets its own plan after Chapter 1 ships and the design system is validated).
- Real photography commissioning. Placeholder gradients ship; real photos swap in a follow-up PR.
- Site-wide nav entry for finance-story (homepage tile is enough until the primer has multiple chapters; nav slot is a later decision).
- Sibling demographic primer ("Marblehead in numbers"). Mentioned by user as a future companion; separate brainstorm.
