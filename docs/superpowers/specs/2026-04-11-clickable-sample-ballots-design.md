# Clickable sample ballots — design

**Status:** brainstormed, pending user review
**Date:** 2026-04-11
**Author:** Claude Code (brainstorming session with Andrew)

## Problem

The site renders sample ballots for both June 9, 2026 override questions:
`what-is-the-override.html` shows a three-row Q1 ballot (tiers 1A, 1B, 1C)
and a one-row Q2 ballot; `question-2-trash.html` shows the same Q2 ballot.
Today these are static visual mock-ups. Andrew asked whether the boxes
should accept clicks and record votes.

Recording votes was rejected. A running tally on a contested-question page
would become a de facto for/against poll and undermine the site's "not an
advocacy project" editorial stance, which the user has explicitly codified
in memory (`feedback_no_reactions_on_contested.md`).

The alternative framing: make the ballots clickable as a pure
civic-literacy affordance. A reader can practice marking the ballot. The
site delivers no content in response to the click, aggregates nothing, and
stores nothing. The reader is the actor; the page is the medium.

This solves a real problem for first-time, elderly, or anxious voters who
have not filled out a multi-question town override ballot before and are
unsure what the marking mechanic even looks like. Q1's three-tier
structure is particularly unfamiliar; few voters have seen a "vote yes on
more than one" ballot question.

## Goals

1. Let a reader click Yes or No on any sample ballot row on the site and
   see an "X" draw into the clicked box with a short pen-stroke animation.
2. Enforce real-ballot mechanics per row: at most one of Yes/No is marked.
   Clicking the opposite switches the mark; clicking an already-marked
   box clears it.
3. Deliver no content and record no state in response to clicks. No
   reveal, no tally, no persistence across page loads, no network call.
4. Be keyboard operable and screen-reader intelligible without extra
   scaffolding. Respect `prefers-reduced-motion`.
5. Degrade gracefully: with JS disabled, the ballot renders identically
   to today (static boxes, readable label text).
6. Match existing site-JS house style (vanilla IIFE, `var`, `function
   ready(fn)` DOMContentLoaded guard, early-return on empty match set,
   no build step).

## Non-goals

- No counting, tallying, or aggregation of any kind.
- No persistence of marks across page loads or across pages.
- No content reveal, explainer panel, scroll-to-section, or highlight
  behavior triggered by marks.
- No reveal of "what your choice means" messaging. Marking is the whole
  feature.
- No changes to the ballot's visible prose, ballot language, or the
  static distribution table beneath the ballot.
- Not applied to any element that is not already styled as a
  `.ballot-box` inside a `.ballot-row`.

## Scope

Five `.ballot-row` instances across two files, ten `.ballot-box`
instances total:

| File                          | Ballot              | Rows | Boxes |
|-------------------------------|---------------------|------|-------|
| `what-is-the-override.html`   | Q1 (Invest / Stabilize / Restore) | 3 | 6 |
| `what-is-the-override.html`   | Q2 (Trash)          | 1    | 2     |
| `question-2-trash.html`       | Q2 (Trash)          | 1    | 2     |

All three ballot blocks use the same `.ballot` / `.ballot-row` /
`.ballot-box` classes, so one CSS + JS mechanism covers all of them.

## Design

### Markup change

Every occurrence of `<span class="ballot-box"></span>` becomes:

```html
<button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark Yes">
  <svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true">
    <line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/>
    <line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/>
  </svg>
</button>
```

`aria-label` is "Mark Yes" on the Yes box and "Mark No" on the No box in
every row. The surrounding `.ballot-choice` wrapper and the visible
"Yes"/"No" text are unchanged.

### CSS additions (in `assets/site.css`)

New rules are added adjacent to the existing `.ballot-box` rule near line
1338. The existing border, size, and border-radius values are preserved;
only interactive styling is added:

```css
.ballot-box {
  /* existing visual styles preserved */
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ballot-box:focus-visible {
  outline: 2px solid var(--c-buoy);
  outline-offset: 2px;
}
.ballot-box-x {
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.ballot-box-x-stroke {
  stroke: var(--text);
  stroke-width: 2.4;
  stroke-linecap: round;
  fill: none;
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  transition: stroke-dashoffset 150ms ease-out;
}
.ballot-box[aria-pressed="true"] .ballot-box-x-stroke {
  stroke-dashoffset: 0;
}
.ballot-box[aria-pressed="true"] .ballot-box-x-stroke:nth-child(2) {
  transition-delay: 150ms;
}
@media (prefers-reduced-motion: reduce) {
  .ballot-box-x-stroke {
    transition: none;
  }
}
```

The stroke-dasharray trick: each X-stroke is a 12x12 diagonal whose length
is sqrt(288) ≈ 17; rounded up to 20 for safety. With `stroke-dasharray:
20` and `stroke-dashoffset: 20`, the stroke is fully hidden by default.
Setting `aria-pressed="true"` animates `stroke-dashoffset` to 0, which
"draws" the stroke along its path. Sequential delays on the second line
produce a two-stage pen stroke (~150ms per stroke, ~300ms total). The
unmarked state animates back the same way, so clearing a mark is symmetric
to setting one.

`prefers-reduced-motion: reduce` disables the transition entirely; the
stroke snaps in and out without animation.

### JS behavior (new file `assets/ballot.js`)

New file, vanilla JS, IIFE, matches the conventions in `assets/citations.js`
(block comment header, `'use strict'`, `function ready(fn)` DOMContentLoaded
guard, early return on empty match set).

State model:

- Per `.ballot-row`, at most one `.ballot-box` has `aria-pressed="true"`.
- Click on an unmarked box: if the row's other box is pressed, unpress it
  first; then press the clicked box.
- Click on an already-pressed box: unpress it.
- Clicks outside `.ballot-row` are ignored.

Event handling:

- Single click listener delegated on `document`.
- Filter: `event.target.closest('.ballot-box')` must return a node whose
  `closest('.ballot-row')` is non-null.
- Alternatively, clicks on the surrounding `.ballot-choice` label are
  routed to the `.ballot-box` inside it. This expands the tap target
  without duplicating handler logic.

No persistence: page reload clears all marks. No `localStorage`, no
`sessionStorage`, no query string, no cookies.

Approximate size: ~50 lines including the comment block, wrapper, and
body.

### How the JS loads

One new line in `_includes/head.html`, right after the existing
`citations.js` tag on line 24:

```html
<script defer src="{{ '/' | relative_url }}assets/ballot.js"></script>
```

Site-wide load is safe because `ballot.js` early-returns when
`document.querySelector('.ballot-box')` is null, matching the pattern in
`citations.js`.

### Accessibility

- `<button>` elements provide Enter/Space keyboard activation and focus
  management for free.
- `aria-pressed="true"|"false"` is announced by screen readers as "toggle
  button, pressed" / "not pressed".
- `aria-label="Mark Yes"` / `aria-label="Mark No"` clarifies the target,
  since the visible "Yes"/"No" text is in the sibling label span, not
  inside the button element.
- `:focus-visible` outline uses `--c-buoy` so keyboard users can see
  where focus is. Mouse click does not produce the outline.
- The SVG is `aria-hidden="true"` because its contents are purely
  decorative; screen readers read the button's `aria-label` and
  `aria-pressed` state instead.
- `prefers-reduced-motion: reduce` disables the draw animation. Marks
  still work; they just snap in.

### Mobile / tap targets

The current `.ballot-box` is 16×16px on mobile viewports (see the
`@media (max-width: 600px)` block near line 1356 in `assets/site.css`),
which is below the WCAG 2.5.5 recommended 44×44px tap target. The
surrounding `.ballot-choice` span already provides a larger hitbox
because it includes the "Yes"/"No" text. Routing clicks from
`.ballot-choice` to its inner `.ballot-box` in the JS handler expands
the effective tap area without changing the visual layout.

No mobile-specific CSS is required beyond that.

## Verification plan

1. Run the local Jekyll dev server (`bundle exec jekyll serve`) and open
   `http://localhost:4000/question-2-trash.html` and
   `http://localhost:4000/what-is-the-override.html` in a real browser.
2. For each ballot row, confirm:
   - Clicking Yes draws an X in ~300ms; No stays empty.
   - Clicking No unmarks Yes (with reverse animation) and marks No.
   - Clicking No again clears the row.
   - Rows are independent: marking Q1A does not affect Q1B or Q1C.
3. Tab through the ballot with the keyboard:
   - Focus ring is visible on each box.
   - Enter and Space both toggle the focused box.
   - Tab order follows visual order (Q1A Yes, Q1A No, Q1B Yes, ...).
4. Enable "Reduce motion" in the OS accessibility settings and reload:
   - Marks snap in and out without the draw animation.
5. Shrink to a ≤600px viewport:
   - Tapping the "Yes" / "No" label text marks the adjacent box.
   - Tap target feels comfortable, not fiddly.
6. Disable JS in the browser and reload:
   - Ballot renders identically to the current static version. Clicks
     do nothing, and nothing is visibly broken.
7. Check screen reader output in VoiceOver (macOS):
   - Each box is announced as "Mark Yes, toggle button, not pressed" /
     "Mark Yes, toggle button, pressed".
8. Visual regression spot check: the unmarked ballot should look
   identical to the current rendering at all viewport sizes.

## Risks and open questions

- **Dark mode.** The stroke color uses `var(--text)`, which should adapt
  to dark mode automatically. Verify on first run; if the stroke
  disappears into the background in either mode, consider a dedicated
  token or a hardcoded ink color.
- **Double-click rapid toggling.** If a user rapidly toggles a box
  mid-animation, the `transition` will re-interpolate from the current
  dashoffset value, which is fine visually but may produce a "pause" if
  the user clicks exactly at 50% progress. Acceptable.
- **Path length rounding.** Using 20 as the dasharray value for a 17-unit
  stroke means ~15% of the stroke is "blank" at the end of the draw,
  which is imperceptible at this size. If visible in practice, reduce
  dasharray/dashoffset to 17.
- **Print styles.** The site has minimal print CSS. The marked state
  should ideally print as a solid X rather than nothing. Low priority;
  the site is not designed around print.
- **Does anything else on the site ever become an interactive ballot?**
  If so, the `assets/ballot.js` file becomes a generic "render clickable
  sample ballots" module and the selector set-up in it should be
  considered reusable. For now, scoped to `.ballot-box` inside
  `.ballot-row` and nothing else.

## Author

Designed in the 2026-04-11 brainstorming session between Andrew Baber
and Claude Code. Approved by Andrew in chat; this document records the
design for implementation.
