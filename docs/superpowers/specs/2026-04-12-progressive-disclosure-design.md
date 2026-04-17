# Progressive Disclosure: Collapsible Deep-Dive Sections

**Date:** 2026-04-12
**Status:** Approved
**Scope:** question-2-trash.html, what-is-the-override.html

## Problem

The site's densest pages (question-2-trash at 901 lines, what-is-the-override at 663 lines) serve two audiences on the same page: skimmers who want a headline takeaway and researchers who want the full derivation. Currently all content is fully expanded with no way to get the short version without scrolling past the long version.

## Design Decisions

These were established through brainstorming and are not open for re-evaluation during implementation.

### Audience model

Both skimmers and researchers must be served on the same page. The page should tell a complete short story at first glance, with deep-dive material available but not in the way.

### What stays visible vs. what collapses

- **Always visible:** Key stats grid, TL;DR box, core argument sections, calculators
- **Collapses:** Supporting analysis (peer comparisons, distributional walkthroughs, historical context, long-term alternatives)
- Calculators are always visible because "what does this cost me?" is the #1 question. The detailed walkthroughs beneath them collapse.

### Two collapsible patterns, used with intention

1. **Pattern 1 ("bordered")** -- `.deep-dive` -- for self-contained data blocks (tables, charts, walkthroughs). Lightweight border, circular caret icon, heading + teaser sentence visible when collapsed.
2. **Pattern 3 ("fade")** -- `.deep-dive--prose` -- for narrative prose sections. No border. First ~2-3 lines of content visible through a gradient fade, with a "Continue reading" link. Most editorial-feeling treatment.

Pattern 2 (teal-accent card) was rejected because the teal left-border is already used for `.tldr`, `blockquote.quote`, and `.already-decided` callouts. Reusing it would muddy the visual language.

### Implementation approach

Native `<details>/<summary>` elements with CSS styling and a lightweight JS enhancement (~40 lines). Same progressive-enhancement philosophy as ballot.js and citations.js: works without JS, better with it.

## Section Collapse Map

### question-2-trash.html

| Section | Treatment |
|---------|-----------|
| Key stats grid | Always visible |
| Intro paragraphs + page-covers list | Always visible |
| TL;DR box ("The short version") | Always visible |
| Already-decided callout | Always visible |
| Page TOC nav | Always visible |
| What is on the ballot (ballot mockup) | Always visible |
| How trash has been funded | Always visible |
| Why this changed for FY27 (budget diagram + takeaway) | Always visible |
| Cost by home value: calculator + cards + delta sentence | Always visible |
| **Cost by home value: scrollytelling walkthrough + trailing prose** | **Pattern 1 (bordered)**. Teaser: "Walk through how the levy and flat fee land at five home values, from $500K to $3M" |
| **Peer towns** | **Pattern 1 (bordered)**. Teaser: "3 of Marblehead's closest comparison towns illustrate the range" |
| **Long-term alternatives** | **Pattern 3 (fade)**. First ~2-3 lines visible, then fades |
| **Trickiness concern** | **Pattern 3 (fade)**. First ~2-3 lines visible, then fades |
| What this page does not cover | Always visible |
| Sources and methodology | Already collapsed (existing `<details class="notes">`) |

### what-is-the-override.html

| Section | Treatment |
|---------|-----------|
| Hero + key stats + intro | Always visible |
| The Three Tiers (tier cards) | Always visible |
| **How You'll Vote (scrollytelling + ballot sim)** | **Pattern 1 (bordered)**. Teaser: "Practice filling out the ballot and see how nested questions interact" |
| What It Costs: calculator | Always visible |
| **What It Costs: detailed pricing table** | **Pattern 1 (bordered)**. Teaser: "Full tax impact at 8 home values across all three tiers" |
| **History** | **Pattern 3 (fade)**. First ~2-3 lines visible, then fades |
| **Key Terms** | **Pattern 1 (bordered)**. Teaser: "Definitions for Proposition 2 1/2, levy ceiling, excess levy capacity, and more" |

## Component Design

### HTML markup

Both patterns use native `<details>/<summary>`. The `<h2>` moves inside `<summary>` so it is always visible whether collapsed or expanded. Existing `id` and `data-stance-section` attributes stay on the `<h2>`.

**Pattern 1 (bordered):**

```html
<details class="deep-dive">
  <summary>
    <h2 id="peer-towns">How other Massachusetts towns fund curbside trash</h2>
    <p class="deep-dive-teaser">3 of Marblehead's closest comparison towns illustrate the range.</p>
  </summary>
  <!-- existing section content, unchanged -->
</details>
```

**Pattern 3 (fade):**

```html
<details class="deep-dive deep-dive--prose">
  <summary>
    <h2 id="trickiness-concern">What the trickiness concern is actually about</h2>
  </summary>
  <!-- existing section content, unchanged -->
</details>
```

The prose variant does not need an explicit teaser. The first few lines of content show through the fade gradient.

### CSS: new styles in assets/site.css (~60 lines)

**Pattern 1 (`.deep-dive`):**
- 1px border, `border-radius: var(--radius-md)`
- Custom circular caret icon (matching the mockup), rotates 90deg on open
- Summary shows heading + teaser; teaser hidden when `[open]`
- Hover: subtle `box-shadow` elevation
- Content area: top border separator, padded

**Pattern 3 (`.deep-dive--prose`):**
- No border or background
- Summary: heading visible, content preview clipped to ~3 lines with `max-height` and `linear-gradient` fade mask to `var(--surface)`
- "Continue reading" link in `var(--link)` color with arrow
- On `[open]`: fade, max-height, and "continue reading" link all removed; full content flows naturally
- Bottom border to separate from next section

**Both patterns:**
- Hide native `<summary>` marker (`list-style: none`, `::-webkit-details-marker`)
- `cursor: pointer` on summary
- Theme-aware via CSS custom properties (works in dark mode)
- Mobile (`max-width: 600px`): tighter padding, same behavior
- `prefers-reduced-motion`: disable transitions

### JavaScript: assets/deep-dive.js (~40 lines)

New file. Vanilla JS, no dependencies. Three features:

1. **Smooth animation:** On toggle, animate height via `requestAnimationFrame` using `scrollHeight`. Transition from 0 to full height on open, reverse on close. Skip if `prefers-reduced-motion`.

2. **"Expand all" toggle:** If a page has 3+ `.deep-dive` elements, inject a link ("Expand all sections" / "Collapse all") after the page TOC (or after the last always-visible content if no TOC). Updates label based on current state.

3. **Scroll-to-open:** If someone navigates via TOC link or arrives with a `#hash` pointing to a heading inside a collapsed `<details>`, auto-open that section and scroll to the heading. Prevents dead anchor links.

### Script loading

Add `<script src="{{ '/assets/deep-dive.js' | relative_url }}" defer></script>` in `_layouts/default.html` alongside existing script tags (citations.js, ballot.js). The `defer` attribute ensures it runs after DOM is ready.

## Compatibility Notes

- **citations.js:** Finds `<sup class="cite">` elements inside sections. These remain in the DOM whether collapsed or expanded. No conflict.
- **community-pulse widget.js:** Hydrates on `<h2>` elements. The `<h2>` is inside `<summary>`, always visible. No conflict.
- **ballot.js:** Operates on `.ballot-oval` elements inside sections. Works when section is expanded. No conflict.
- **Scrollytelling JS (trash page):** `IntersectionObserver` only fires when the scrolly section is visible. Naturally works when expanded, naturally dormant when collapsed. No conflict.
- **Page TOC:** Existing anchor links covered by the scroll-to-open feature in deep-dive.js.
- **Reading time calculation (page.html layout):** Currently counts all words in the page content. Collapsible sections are still in the DOM, so reading time stays accurate. No change needed.

## File Changes

| File | Change |
|------|--------|
| `assets/site.css` | Add `.deep-dive` and `.deep-dive--prose` styles (~60 lines) |
| `assets/deep-dive.js` | New file (~40 lines) |
| `_layouts/default.html` | Add `<script>` tag for deep-dive.js |
| `question-2-trash.html` | Wrap 4 sections in `<details>` elements |
| `what-is-the-override.html` | Wrap 4 sections in `<details>` elements |

## Out of Scope

- No changes to other pages (evaluate later based on results)
- No changes to existing `<details class="notes">` styling
- No localStorage persistence of open/closed state
- No reading progress indicator or scroll spy
- No analytics integration (can be added later via community-pulse or a simple event listener)

## Verification Checklist

- [ ] Page TOC links scroll to correct section and auto-open if collapsed
- [ ] External `#hash` links (from Facebook, etc.) land correctly
- [ ] Scrollytelling in trash page works when expanded
- [ ] Ballot simulator in override page works when expanded
- [ ] Calculators stay visible and functional (not wrapped in collapsible)
- [ ] community-pulse widget hydrates on `<h2>` inside collapsed sections
- [ ] citations.js generates Sources section correctly
- [ ] "Expand all" link appears on both pages (4 collapsible sections each)
- [ ] Mobile: tappable, readable teaser text, no horizontal overflow
- [ ] Dark mode: borders, fade gradient, caret use theme-aware CSS variables
- [ ] `prefers-reduced-motion`: animation disabled, native snap behavior
- [ ] JS disabled: sections still expandable via native `<details>` behavior
