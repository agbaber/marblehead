# Progressive Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collapsible deep-dive sections to question-2-trash.html and what-is-the-override.html so skimmers see a complete short story and researchers can expand supporting analysis.

**Architecture:** Native `<details>/<summary>` elements styled with two CSS patterns (bordered for data blocks, fade for prose), enhanced by a small vanilla JS file for smooth animation, scroll-to-open, and expand-all. Same progressive-enhancement philosophy as the existing ballot.js and citations.js.

**Tech Stack:** HTML5 `<details>`, CSS custom properties, vanilla JavaScript (~40 lines)

**Spec:** `docs/superpowers/specs/2026-04-12-progressive-disclosure-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `assets/site.css` | Modify (append ~60 lines) | `.deep-dive` and `.deep-dive--prose` styles |
| `assets/deep-dive.js` | Create (~50 lines) | Smooth animation, scroll-to-open, expand-all toggle |
| `_includes/head.html` | Modify (add 1 line) | `<script defer>` tag for deep-dive.js |
| `question-2-trash.html` | Modify | Wrap 4 sections in `<details>` elements |
| `what-is-the-override.html` | Modify | Wrap 4 sections in `<details>` elements |

---

### Task 1: Add CSS for both deep-dive patterns

**Files:**
- Modify: `assets/site.css` (append after line 3054)

- [ ] **Step 1: Add Pattern 1 (bordered) styles**

Append to the end of `assets/site.css`:

```css
/* ==========================================================================
   Deep-dive collapsible sections (progressive disclosure)
   Pattern 1 ("bordered"): self-contained data blocks (tables, charts)
   Pattern 2 ("prose"): narrative sections with fade preview
   ========================================================================== */

.deep-dive {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin: 28px 0;
  transition: box-shadow 0.2s ease;
}
.deep-dive:hover {
  box-shadow: var(--shadow-sm);
}
.deep-dive > summary {
  cursor: pointer;
  list-style: none;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  user-select: none;
}
.deep-dive > summary::-webkit-details-marker { display: none; }

/* Circular caret icon */
.deep-dive > summary::before {
  content: "\25B8";
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: 2px solid var(--c-teal);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--c-teal);
  transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
  margin-bottom: 6px;
}
.deep-dive[open] > summary::before {
  transform: rotate(90deg);
  background: var(--c-teal);
  color: #fff;
}

/* Heading inside summary */
.deep-dive > summary h2 {
  margin: 0;
}

/* Teaser line */
.deep-dive-teaser {
  font-size: 14px;
  color: var(--text-subtle);
  line-height: 1.5;
  margin: 0;
}
.deep-dive[open] .deep-dive-teaser {
  display: none;
}

/* Content area */
.deep-dive > .deep-dive-body {
  padding: 0 20px 20px;
  border-top: 1px solid var(--border);
}
```

- [ ] **Step 2: Add Pattern 2 (prose/fade) styles**

Continue appending to `assets/site.css`:

```css
/* --- Pattern 2: prose with fade --- */

.deep-dive--prose {
  border: none;
  border-radius: 0;
  margin: 28px 0;
  border-bottom: 1px solid var(--divider);
  padding-bottom: 8px;
}
.deep-dive--prose:hover {
  box-shadow: none;
}
.deep-dive--prose > summary {
  padding: 0 0 12px;
}
.deep-dive--prose > summary::before {
  display: none;
}

/* Fade preview: show first ~3 lines of content */
.deep-dive--prose .deep-dive-preview {
  font-size: 17px;
  color: var(--text-muted);
  line-height: 1.65;
  max-height: 4.8em;
  overflow: hidden;
  position: relative;
  margin: 4px 0 0;
}
.deep-dive--prose:not([open]) .deep-dive-preview::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2.5em;
  background: linear-gradient(transparent, var(--surface));
}
.deep-dive--prose[open] .deep-dive-preview {
  display: none;
}

/* "Continue reading" link */
.deep-dive-more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--link);
  font-weight: 600;
  margin-top: 4px;
}
.deep-dive-more .arrow {
  transition: transform 0.2s ease;
  font-size: 12px;
}
.deep-dive--prose[open] .deep-dive-more {
  display: none;
}

/* Prose content area */
.deep-dive--prose > .deep-dive-body {
  padding: 0 0 12px;
  border-top: none;
}
```

- [ ] **Step 3: Add shared responsive and accessibility styles**

Continue appending to `assets/site.css`:

```css
/* --- Shared: mobile, dark mode, reduced motion, expand-all --- */

@media (max-width: 600px) {
  .deep-dive > summary { padding: 14px 16px; }
  .deep-dive > .deep-dive-body { padding: 0 16px 16px; }
  .deep-dive--prose .deep-dive-preview { font-size: 15px; }
}

@media (prefers-reduced-motion: reduce) {
  .deep-dive,
  .deep-dive > summary::before,
  .deep-dive-more .arrow {
    transition: none;
  }
}

/* Expand-all toggle link injected by deep-dive.js */
.deep-dive-expand-all {
  font-size: 13px;
  font-weight: 600;
  color: var(--link);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  margin: 0 0 16px;
  font-family: inherit;
}
.deep-dive-expand-all:hover {
  text-decoration: underline;
}
```

- [ ] **Step 4: Commit CSS**

```bash
git add assets/site.css
git commit -m "Add deep-dive collapsible section styles (bordered + prose/fade patterns)"
```

---

### Task 2: Create deep-dive.js enhancement script

**Files:**
- Create: `assets/deep-dive.js`

- [ ] **Step 1: Write deep-dive.js**

Create `assets/deep-dive.js` with the following content:

```javascript
// Deep-dive collapsible sections: smooth animation, scroll-to-open, expand-all.
// Works with <details class="deep-dive"> elements. Progressive enhancement:
// everything works without this script via native <details> behavior.
(function () {
  var dives = document.querySelectorAll('details.deep-dive');
  if (!dives.length) return;

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Smooth animation ---
  if (!prefersReduced) {
    dives.forEach(function (el) {
      var body = el.querySelector('.deep-dive-body');
      if (!body) return;

      el.addEventListener('click', function (e) {
        // Only intercept clicks on the summary
        if (!e.target.closest('summary')) return;

        // If closing, animate shut
        if (el.open) {
          e.preventDefault();
          body.style.overflow = 'hidden';
          var startH = body.scrollHeight;
          body.style.maxHeight = startH + 'px';
          requestAnimationFrame(function () {
            body.style.transition = 'max-height 0.25s ease';
            body.style.maxHeight = '0px';
          });
          body.addEventListener('transitionend', function handler() {
            body.removeEventListener('transitionend', handler);
            el.open = false;
            body.style.maxHeight = '';
            body.style.overflow = '';
            body.style.transition = '';
          });
        }
        // If opening, native open happens first, then animate from 0
        // We let the default happen (el.open becomes true), then animate
      });

      // After the element opens natively, animate the body in
      el.addEventListener('toggle', function () {
        if (!el.open || !body) return;
        var targetH = body.scrollHeight;
        body.style.overflow = 'hidden';
        body.style.maxHeight = '0px';
        body.style.transition = 'max-height 0.3s ease';
        requestAnimationFrame(function () {
          body.style.maxHeight = targetH + 'px';
        });
        body.addEventListener('transitionend', function handler() {
          body.removeEventListener('transitionend', handler);
          body.style.maxHeight = '';
          body.style.overflow = '';
          body.style.transition = '';
        });
      });
    });
  }

  // --- Scroll-to-open ---
  // If the URL hash points to an element inside a collapsed <details>,
  // open it and scroll to the target.
  function openForHash() {
    var hash = window.location.hash;
    if (!hash) return;
    var target = document.querySelector(hash);
    if (!target) return;
    var parent = target.closest('details.deep-dive');
    if (parent && !parent.open) {
      parent.open = true;
      // Wait a frame for the DOM to update before scrolling
      requestAnimationFrame(function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }
  openForHash();
  window.addEventListener('hashchange', openForHash);

  // Also handle clicks on in-page TOC links
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var hash = link.getAttribute('href');
    var target = document.querySelector(hash);
    if (!target) return;
    var parent = target.closest('details.deep-dive');
    if (parent && !parent.open) {
      e.preventDefault();
      parent.open = true;
      requestAnimationFrame(function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      history.pushState(null, '', hash);
    }
  });

  // --- Expand all / Collapse all ---
  if (dives.length >= 3) {
    var btn = document.createElement('button');
    btn.className = 'deep-dive-expand-all';
    btn.type = 'button';

    function updateLabel() {
      var allOpen = Array.from(dives).every(function (d) { return d.open; });
      btn.textContent = allOpen ? 'Collapse all sections' : 'Expand all sections';
    }

    btn.addEventListener('click', function () {
      var allOpen = Array.from(dives).every(function (d) { return d.open; });
      dives.forEach(function (d) { d.open = !allOpen; });
      updateLabel();
    });

    // Listen for individual toggles to keep the label in sync
    dives.forEach(function (d) {
      d.addEventListener('toggle', updateLabel);
    });

    updateLabel();

    // Insert after the page TOC if present, otherwise before the first deep-dive
    var toc = document.querySelector('.page-toc');
    if (toc) {
      toc.parentNode.insertBefore(btn, toc.nextSibling);
    } else {
      dives[0].parentNode.insertBefore(btn, dives[0]);
    }
  }
})();
```

- [ ] **Step 2: Commit deep-dive.js**

```bash
git add assets/deep-dive.js
git commit -m "Add deep-dive.js: smooth animation, scroll-to-open, expand-all"
```

---

### Task 3: Add script tag to head.html

**Files:**
- Modify: `_includes/head.html:19` (add line after ballot.js)

- [ ] **Step 1: Add the script tag**

In `_includes/head.html`, after line 19 (`<script defer src="{{ '/' | relative_url }}assets/ballot.js"></script>`), add:

```html
<script defer src="{{ '/' | relative_url }}assets/deep-dive.js"></script>
```

- [ ] **Step 2: Commit**

```bash
git add _includes/head.html
git commit -m "Load deep-dive.js on all pages (deferred, no-op if no .deep-dive elements)"
```

---

### Task 4: Wrap collapsible sections in question-2-trash.html

**Files:**
- Modify: `question-2-trash.html`

This task wraps four sections. The content inside each section is unchanged -- only the wrapping `<details>` and `<summary>` elements are added.

**Important context:** The page has a `<style>` block (lines 7-331), key stats (lines 333-352), intro + TL;DR + core narrative sections (lines 353-517 including the calculator), and then the sections to wrap begin at line 519.

- [ ] **Step 1: Wrap the scrollytelling walkthrough (Pattern 1, bordered)**

The scrollytelling section starts at line 519 (`<section class="scrolly-trash"...>`) and the trailing prose paragraphs end at line 592. This is the walkthrough *below* the calculator, which stays always-visible.

Replace lines 519-592 (the `<section class="scrolly-trash">` through the two trailing `<p>` paragraphs ending at line 592) by wrapping them:

```html
<details class="deep-dive">
  <summary>
    <h2>Levy vs. fee at different home values</h2>
    <p class="deep-dive-teaser">Walk through how the levy and flat fee land at five home values, from $500K to $3M.</p>
  </summary>
  <div class="deep-dive-body">

<section class="scrolly-trash" aria-label="How the two funding options cost different home values">
  <!-- ... existing scrolly-trash content unchanged (lines 520-588) ... -->
</section>

<p>The break-even point, where the two options cost the same, is at roughly $1,210,000 in assessed value. Below that, the levy is cheaper; above it, the flat fee is cheaper. The median single-family home in Marblehead is assessed at $1,010,000, so the typical homeowner pays slightly less under the levy. The average single-family assessment of $1,291,000 is skewed upward by a smaller number of high-value properties, so the average homeowner pays slightly less under the fee.</p>

<p>A note on the shape of the choice: the flat fee is regressive compared to the levy. A household in a $500,000 home pays the same $281 as a household in a $3 million home. Under the levy, the $3 million home pays $698 (about 2.5 times the flat fee) while the $500,000 home pays $116 (less than half the flat fee). Whether that progressive distribution is better or worse depends on who you think should bear the cost.</p>

  </div>
</details>
```

Note: This section gets a new `<h2>` inside the summary ("Levy vs. fee at different home values") since the original content didn't have its own heading -- it was a continuation of the "Cost by home value" section. The original `<h2 id="cost-by-home-value">` stays above the calculator, always visible.

- [ ] **Step 2: Wrap peer towns section (Pattern 1, bordered)**

The peer towns section runs from line 594 (`<h2 id="peer-towns">`) through line 635 (the statewide PAYT paragraph). Wrap it:

```html
<details class="deep-dive">
  <summary>
    <h2 id="peer-towns">How other Massachusetts towns fund curbside trash</h2>
    <p class="deep-dive-teaser">3 of Marblehead's closest comparison towns illustrate the range.</p>
  </summary>
  <div class="deep-dive-body">

<p>There is no single Massachusetts approach to funding curbside residential trash. Towns use a mix of property tax, flat fees, pay-as-you-throw (PAYT) systems, and hybrids. Three of Marblehead's closest comparison towns illustrate the range:</p>

<table class="peer-trash">
  <!-- ... existing table content unchanged ... -->
</table>

<p>Statewide, the Massachusetts Department of Environmental Protection reports that 162 of 351 municipalities (46%) use some form of pay-as-you-throw or SMART (Save Money and Reduce Trash) program. Of those, 48 use PAYT for curbside trash, 102 use it for drop-off, and 11 use both. MassDEP recommends hybrid rate systems that combine a flat base fee with unit-based charges for additional trash. The rationale: a flat fee covers fixed costs of collection while a unit fee encourages waste reduction.</p>

  </div>
</details>
```

The `<h2>` moves inside `<summary>`, keeping its `id="peer-towns"`. The opening `<p>` stays inside `.deep-dive-body`, not in the teaser.

- [ ] **Step 3: Wrap long-term alternatives (Pattern 2, prose/fade)**

The long-term alternatives section runs from line 637 (`<h2 id="long-term-alternatives">`) through line 655 (end of consolidation subsection). Wrap it:

```html
<details class="deep-dive deep-dive--prose">
  <summary>
    <h2 id="long-term-alternatives">Long-term alternatives not on the ballot</h2>
    <div class="deep-dive-preview">
      <p>Question 2 asks about the FY27 funding mechanism. Several longer-term alternatives are legally available to Marblehead but are not on the ballot. They would require Select Board decisions, Town Meeting articles, or contract negotiations outside the override process.</p>
    </div>
    <span class="deep-dive-more">Continue reading <span class="arrow">&#x25B8;</span></span>
  </summary>
  <div class="deep-dive-body">

<p>Question 2 asks about the FY27 funding mechanism. Several longer-term alternatives are legally available to Marblehead but are not on the ballot. They would require Select Board decisions, Town Meeting articles, or contract negotiations outside the override process.</p>

<h3>Regional shared services and intermunicipal agreements</h3>
<!-- ... existing content unchanged through end of "Consolidation or elimination" subsection ... -->

  </div>
</details>
```

Note: The first paragraph appears twice -- once in `.deep-dive-preview` (shown when collapsed, hidden when open) and once in `.deep-dive-body` (hidden when collapsed, shown when open). This avoids the preview text appearing twice when expanded.

- [ ] **Step 4: Wrap trickiness concern (Pattern 2, prose/fade)**

The trickiness concern section runs from line 657 (`<h2 id="trickiness-concern">`) through line 667 (end of the counter-argument paragraph). Wrap it:

```html
<details class="deep-dive deep-dive--prose">
  <summary>
    <h2 id="trickiness-concern">What the trickiness concern is actually about</h2>
    <div class="deep-dive-preview">
      <p>A concern raised in local discussion is that the $2.3 million override is being described as funding curbside trash service, when residents were already paying for that same service through existing property taxes via the Waste Collection department. The concern is that the framing implies residents face a choice about whether to fund trash, when really the choice is about how.</p>
    </div>
    <span class="deep-dive-more">Continue reading <span class="arrow">&#x25B8;</span></span>
  </summary>
  <div class="deep-dive-body">

<p>A concern raised in local discussion is that the $2.3 million override is being described as funding curbside trash service, when residents were already paying for that same service through existing property taxes via the Waste Collection department. The concern is that the framing implies residents face a choice about whether to fund trash, when really the choice is about how.</p>

<!-- ... remaining paragraphs and pull-quote unchanged through line 667 ... -->

  </div>
</details>
```

- [ ] **Step 5: Update the page TOC links**

The page TOC at line 378-388 references sections by `#id`. The scrollytelling section needs a new anchor since it got a new `<h2>`. Add a TOC entry. Current TOC:

```html
<nav class="page-toc" aria-label="On this page">
  <span class="page-toc-label">On this page</span>
  <a href="#on-the-ballot">What is on the ballot</a>
  <a href="#how-funded">How trash has been funded</a>
  <a href="#why-changed">Why this changed</a>
  <a href="#cost-by-home-value">Cost by home value</a>
  <a href="#peer-towns">How other towns do it</a>
  <a href="#long-term-alternatives">Long-term alternatives</a>
  <a href="#trickiness-concern">The trickiness concern</a>
  <a href="#not-covered">What this page does not cover</a>
</nav>
```

Add a new entry for the scrolly deep-dive after `#cost-by-home-value`. Also add an `id` to the new scrolly `<h2>` (use `id="levy-vs-fee"`):

```html
<nav class="page-toc" aria-label="On this page">
  <span class="page-toc-label">On this page</span>
  <a href="#on-the-ballot">What is on the ballot</a>
  <a href="#how-funded">How trash has been funded</a>
  <a href="#why-changed">Why this changed</a>
  <a href="#cost-by-home-value">Cost by home value</a>
  <a href="#levy-vs-fee">Levy vs. fee walkthrough</a>
  <a href="#peer-towns">How other towns do it</a>
  <a href="#long-term-alternatives">Long-term alternatives</a>
  <a href="#trickiness-concern">The trickiness concern</a>
  <a href="#not-covered">What this page does not cover</a>
</nav>
```

And update the scrolly `<h2>` to include the id:

```html
<h2 id="levy-vs-fee">Levy vs. fee at different home values</h2>
```

- [ ] **Step 6: Commit**

```bash
git add question-2-trash.html
git commit -m "Wrap 4 supporting sections in collapsible deep-dives on trash page"
```

---

### Task 5: Wrap collapsible sections in what-is-the-override.html

**Files:**
- Modify: `what-is-the-override.html`

This task wraps four sections. The page has no `<style>` block and no page TOC.

**Important context:** The always-visible content runs from the top through the "Three Tiers" section (line 1-210 including the scrolly-nesting for tier explanation, which stays visible since it's core to understanding the ballot). The collapsible sections begin at line 212.

- [ ] **Step 1: Wrap "How You'll Vote" (Pattern 1, bordered)**

The "How You'll Vote" section runs from line 212 (`<h2 data-stance-section="how-youll-vote">`) through line 277 (the "Trash: levy or fee?" link). This contains two ballot mockups and prose. Wrap it:

```html
<details class="deep-dive">
  <summary>
    <h2 data-stance-section="how-youll-vote" id="how-youll-vote">How You'll Vote</h2>
    <p class="deep-dive-teaser">Practice filling out the ballot and see how the two questions work together.</p>
  </summary>
  <div class="deep-dive-body">

  <p>Two ballot questions at the Annual Town Election on June 9, 2026.</p>
  <!-- ... existing ballot mockups and prose unchanged through line 277 ... -->

  </div>
</details>
```

Add `id="how-youll-vote"` to the `<h2>` so it's linkable (it currently only has `data-stance-section`).

- [ ] **Step 2: Split "What It Costs" -- keep calculator visible, wrap detail**

The "What It Costs" section starts at line 279. The phase-in chart (lines 282-331) and takeaway (lines 333-335) are the core calculator content that stays always-visible. The link to the override calculator (line 337) also stays visible.

The **History** section starts at line 339. So "What It Costs" has no detail portion to collapse separately -- the phase chart + takeaway + calculator link IS the whole section, and it stays visible.

Looking at the spec again: "What It Costs: detailed pricing table" was listed as collapsible. But reviewing the actual page, the pricing detail lives in `charts/override_calculator.html` (linked from line 337), not inline on this page. The phase chart IS the calculator for this page. So we keep the entire "What It Costs" section visible and move on.

This means the override page gets 3 collapsible sections, not 4. The "expand all" threshold is 3+, so the expand-all toggle will still appear.

- [ ] **Step 3: Wrap "History" (Pattern 2, prose/fade)**

The History section runs from line 339 (`<h2 data-stance-section="history">`) through line 543 (the Moses Grader quote and its attribution). This is a long, narrative section. Wrap it:

```html
<details class="deep-dive deep-dive--prose">
  <summary>
    <h2 data-stance-section="history" id="history">History</h2>
    <div class="deep-dive-preview">
      <p>Marblehead's last successful operating override was the June 2005 vote that authorized a $2.73M supplemental override for the FY2006 budget, 21 years ago. Every operating override attempt since has failed. In the full Massachusetts Department of Revenue ballot record, Marblehead voters have approved 4 of 13 operating override attempts since 1990, but 28 of 29 debt exclusion attempts since 1982.</p>
    </div>
    <span class="deep-dive-more">Continue reading <span class="arrow">&#x25B8;</span></span>
  </summary>
  <div class="deep-dive-body">

  <p>Marblehead's last successful operating override was the June 2005 vote that authorized a $2.73M supplemental override for the FY2006 budget, 21 years ago.<sup class="cite" data-href="https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.overrideunderride" data-source="MA DOR, Proposition 2½ Override & Underride Votes (Marblehead record)"></sup> Every operating override attempt since has failed. <!-- ... rest of History section unchanged through line 543 ... -->

  </div>
</details>
```

Note: The preview paragraph is a clean version (no `<sup class="cite">` tags) for readability in the collapsed state. The full version with citations is in `.deep-dive-body`.

The `<div class="read-next">` block (lines 545-559) stays OUTSIDE the details element, always visible, since it's site navigation.

- [ ] **Step 4: Wrap "Key Terms" (Pattern 1, bordered)**

The Key Terms section runs from line 561 (`<h2 data-stance-section="off">Key Terms</h2>`) through line 583 (the last `.term` div). Wrap it:

```html
<details class="deep-dive">
  <summary>
    <h2 data-stance-section="off" id="key-terms">Key Terms</h2>
    <p class="deep-dive-teaser">Definitions for Proposition 2.5, GIC, free cash, OPEB, PERAC, and more.</p>
  </summary>
  <div class="deep-dive-body">

  <div class="term">
    <p><strong>Prop 2.5</strong> -- State law capping annual property tax growth at 2.5%. Overrides are the only way to exceed this cap permanently.</p>
  </div>
  <!-- ... remaining .term divs unchanged ... -->

  </div>
</details>
```

Add `id="key-terms"` so it's linkable.

- [ ] **Step 5: Commit**

```bash
git add what-is-the-override.html
git commit -m "Wrap 3 supporting sections in collapsible deep-dives on override page"
```

---

### Task 6: Verify everything works

**Files:** None modified -- verification only.

- [ ] **Step 1: Check that the site builds**

Push the branch and verify the GitHub Pages build succeeds, or check locally if a preview is available. The site has no local dev server (GitHub Pages builds server-side), so verification is either via GitHub Pages preview or by opening the HTML files directly.

- [ ] **Step 2: Verify page TOC scroll-to-open on trash page**

Open `question-2-trash.html`. Click each TOC link that points to a collapsible section (`#levy-vs-fee`, `#peer-towns`, `#long-term-alternatives`, `#trickiness-concern`). Each should auto-open the section and scroll to it.

- [ ] **Step 3: Verify hash links work**

Navigate directly to `question-2-trash.html#peer-towns`. The peer towns section should auto-open on page load.

- [ ] **Step 4: Verify expand-all toggle**

Both pages should show an "Expand all sections" button. Clicking it should open all deep-dive sections. The label should change to "Collapse all sections". Clicking again should close them all.

- [ ] **Step 5: Verify calculator stays visible**

On the trash page, the Q2 calculator (input + two cards + delta sentence) must be visible without expanding anything. On the override page, the phase chart and takeaway must be visible.

- [ ] **Step 6: Verify interactive elements work when expanded**

Expand the scrollytelling section on the trash page. Scroll through the sticky walkthrough -- it should animate correctly. Expand "How You'll Vote" on the override page. The ballot mockup ovals should be clickable.

- [ ] **Step 7: Verify citations.js still works**

On both pages, check that the auto-generated "Sources" section at the bottom includes all citations, including those inside collapsed sections.

- [ ] **Step 8: Test mobile viewport**

Resize browser to ~375px width. Verify:
- Collapsible sections are tappable (touch target large enough)
- Teaser text is readable and doesn't overflow
- Fade gradient on prose sections blends correctly
- No horizontal scroll

- [ ] **Step 9: Test dark mode**

Toggle to dark mode (via system preference or `data-theme="dark"` on `<html>`). Verify borders, fade gradients, caret icon, and text colors use CSS variables correctly.

- [ ] **Step 10: Commit any fixes, then final commit**

If any issues were found and fixed in prior steps, commit the fixes:

```bash
git add -A
git commit -m "Fix issues found during progressive disclosure verification"
```
