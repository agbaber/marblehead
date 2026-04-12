# Clickable sample ballots overhaul — design

**Status:** brainstormed, pending user review
**Date:** 2026-04-12
**Author:** Claude Code (brainstorming session with Andrew)
**Supersedes:** [2026-04-11-clickable-sample-ballots-design.md](2026-04-11-clickable-sample-ballots-design.md)

## Problem

The site shipped a "click to practice marking the ballot" feature on 2026-04-11
(PR #124, merged as f2ecaaa). The interaction renders an **X stroke-drawn into
a square box on the left of each Yes/No label**. This is wrong in three
dimensions relative to the real ballot voters will receive at the polls on
June 9, 2026:

1. **Shape.** Real Massachusetts optical-scan ballots use ovals, not squares.
2. **Position.** Real ballots put the mark area to the **right** of each choice
   label. The site puts it on the left.
3. **Mark gesture.** Real ballots require the voter to **completely fill in
   the oval**. "TO VOTE, completely fill in the OVAL to the RIGHT of your
   choice(s) like this: ●" is the verbatim instruction printed on every MA
   town sample ballot. An X is specifically what poll workers tell voters NOT
   to make — optical scanners are calibrated for filled-oval detection and an
   X may fail to register or may be kicked out for adjudication.

Issues 1 and 2 predate the 2026-04-11 feature. Issue 3 was introduced by
the feature itself. All three together mean the "try it out" civic-literacy
affordance currently teaches readers the **wrong muscle memory**: the exact
opposite of what an unfamiliar first-time voter needs. A voter who rehearses
with an X-on-square and then walks into a polling place expecting the same
gesture may mark their real ballot incorrectly.

The scope of this fix is therefore broader than "replace my X animation."
The whole sample-ballot rendering on `what-is-the-override.html` and
`question-2-trash.html` must be rebuilt to reproduce the real ballot at the
element level: ovals on the right of each label, with a fill-in animation,
and with the gesture instruction text shown prominently on each ballot.

## Research

Confirmed from primary sources (2026-04-12):

1. **Sandwich, MA sample ballot** for the May 7, 2026 annual town election
   (peer MA town on the same Secretary of the Commonwealth optical-scan
   framework Marblehead uses): renders as a multi-column grid of contests
   with small **empty ovals to the right** of each candidate name. The
   yellow header block at the top of the ballot contains the verbatim
   instructions: *"A. TO VOTE, completely fill in the OVAL to the RIGHT of
   your choice(s) like this: ●"* followed by a filled-oval example.

2. **950 CMR 54** (MA Secretary of the Commonwealth regulation on voting
   and counting procedures for electronic voting systems) codifies the
   optical-scan fill-in-oval mechanic statewide. Marblehead is not an
   exception.

3. **Marblehead Elections & Registration Office** confirms use of the same
   state-standard optical scanners at polling places (Abbot Hall precincts
   1–2, Marblehead High School fieldhouse precincts 3–6).

The gesture the site should model is therefore: **fill in an oval, not
draw an X**.

## Goals

1. Replace the square-with-X rendering with an oval-on-the-right rendering
   that matches the visual grammar of the real ballot.
2. Replace the stroke-draw-X animation with a fill-in animation that models
   the real "completely fill in the oval" gesture.
3. Place the gesture instruction text ("To vote, completely fill in the
   oval…") on every sample ballot on the site, immediately below the
   ballot header so the reader sees it before the first row.
4. Keep the Q1-specific strategy instruction ("You may vote YES on more
   than one") — it remains relevant because Q1's three-tier structure is
   the unfamiliar part for most voters.
5. Add a subtle diagonal "SAMPLE" watermark on each ballot block so no
   reasonable reader could mistake the visual for a real mark-and-submit
   form.
6. Preserve the "try it out" editorial framing: no tally, no persistence,
   no content reveal in response to clicks. Marks are ephemeral.
7. Preserve all existing accessibility properties: keyboard operable,
   `aria-pressed` state, focus ring, `prefers-reduced-motion` support,
   graceful degradation with JS disabled.

## Non-goals

- No yellow "INSTRUCTIONS TO VOTERS" header block, no multi-column contest
  grid, no replica content for the other races on the June 9 ballot
  (Select Board, School Committee, etc.). The page is about the override
  questions; adding non-override races would inflate the ballot block
  without civic-literacy payoff for the override topic.
- No counting, tallying, or aggregation of any kind (unchanged from
  2026-04-11 design).
- No persistence of marks across page loads (unchanged).
- No changes to the prose surrounding the ballots, to per-page explainer
  content, or to the ballot language verbatim quoted from the Town
  Administrator's April 8, 2026 override presentation.
- Not deleting the 2026-04-11 spec or plan documents — they remain as
  historical record of the initial implementation that this overhaul
  replaces.
- No per-row "vote for not more than one" subline. That instruction is a
  real-ballot convention for multi-candidate contests, not yes/no
  questions, and on Q1 specifically it would contradict the "you may vote
  YES on more than one" guidance.

## Scope

Five `.ballot-row` instances across two files, ten mark buttons total. Same
scope as the 2026-04-11 implementation, because this overhaul replaces
rather than extends it.

| File                          | Ballot              | Rows | Ovals |
|-------------------------------|---------------------|------|-------|
| `what-is-the-override.html`   | Q1 (Invest / Stabilize / Restore) | 3 | 6 |
| `what-is-the-override.html`   | Q2 (Trash)          | 1    | 2     |
| `question-2-trash.html`       | Q2 (Trash)          | 1    | 2     |

## Design

### Markup change

Every `<span class="ballot-choice">` in the current HTML is rewritten to
flip the child order (label text first, mark button second) and to use a
new `.ballot-oval` button with an SVG `<ellipse>` inside. The old
`.ballot-box` class is removed from HTML entirely.

Before (shipped in PR #124):

```html
<span class="ballot-choice"><button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark Yes"><svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true"><line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/><line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/></svg></button>Yes</span>
```

After:

```html
<span class="ballot-choice"><span class="ballot-choice-label">Yes</span><button type="button" class="ballot-oval" aria-pressed="false" aria-label="Mark Yes"><svg class="ballot-oval-fill" viewBox="0 0 24 16" aria-hidden="true"><ellipse cx="12" cy="8" rx="10" ry="6"/></svg></button></span>
```

Changes:

- Label text is now inside `<span class="ballot-choice-label">` so it can
  be styled and targeted independently.
- Label span comes **before** the button in source order, so the oval
  renders to the right of the label visually.
- `<button class="ballot-box">` → `<button class="ballot-oval">` (class
  rename — same semantic role, clearer naming for the new shape).
- Inner SVG uses a single `<ellipse>` instead of two `<line>` strokes.
  viewBox 24×16 gives a wider-than-tall oval matching the real ballot's
  proportions (roughly 1.5:1).
- `rx="10" ry="6"` is inset 2 units from each edge of the viewBox, leaving
  room for the border stroke to render without clipping.
- `aria-pressed="false"` and `aria-label="Mark Yes"|"Mark No"` are
  unchanged.

### New ballot-level instruction block

Each `.ballot` gains a `.ballot-instructions` block between the header and
the first row. Q1's ballot has two `<p>` children; Q2's ballots have one.

Q1 on `what-is-the-override.html`:

```html
<div class="ballot-instructions">
  <p class="ballot-instructions-gesture">To vote, completely fill in the oval to the right of your choice like this: <span class="ballot-instructions-example" aria-hidden="true"></span></p>
  <p class="ballot-instructions-strategy">Vote YES or NO on each question. You may vote YES on more than one.</p>
</div>
```

Q2 on both files:

```html
<div class="ballot-instructions">
  <p class="ballot-instructions-gesture">To vote, completely fill in the oval to the right of your choice like this: <span class="ballot-instructions-example" aria-hidden="true"></span></p>
</div>
```

The `.ballot-instructions-example` span renders as a small inline filled
oval via CSS (a 14×9 pixel pseudo-element with the same ellipse border
and a solid fill), matching the "like this: ●" visual on the real ballot.

The existing `.ballot-instructions` class on Q1 in the current HTML is
currently just a `<div class="ballot-instructions">Vote YES or NO on each
question…</div>` with flat text. That text moves into a `<p
class="ballot-instructions-strategy">` child, and the new gesture `<p>`
gets added above it.

### CSS changes (`assets/site.css`)

Near the existing `.ballot` rule set (lines ~1249–1390):

1. **Delete** the following rules shipped in PR #124 (they become dead
   code when the markup uses `.ballot-oval` instead of `.ballot-box`):
   - `button.ballot-box { ... }`
   - `button.ballot-box:focus-visible { ... }`
   - `.ballot-box-x { ... }`
   - `.ballot-box-x-stroke { ... }`
   - `button.ballot-box[aria-pressed="true"] .ballot-box-x-stroke { ... }`
   - `button.ballot-box[aria-pressed="true"] .ballot-box-x-stroke:nth-child(2) { ... }`
   - `@media (prefers-reduced-motion: reduce) { .ballot-box-x-stroke { ... } }`

2. **Rename and reshape** the base `.ballot-box` rule (the static span
   version from before PR #124) to `.ballot-oval`:
   ```css
   .ballot-oval {
     display: inline-flex;
     align-items: center;
     justify-content: center;
     width: 22px;
     height: 14px;
     border: 1.5px solid var(--text);
     border-radius: 50%;
     background: var(--surface);
     padding: 0;
     cursor: pointer;
     flex-shrink: 0;
     font: inherit;
     color: inherit;
   }
   .ballot-oval:focus-visible {
     outline: 2px solid var(--c-buoy);
     outline-offset: 2px;
   }
   ```
   The width:height ratio of 22:14 gives a pill-ish oval when combined
   with `border-radius: 50%` (which on a non-square element produces an
   ellipse).

3. **Add** the SVG fill animation:
   ```css
   .ballot-oval-fill {
     width: 100%;
     height: 100%;
     pointer-events: none;
   }
   .ballot-oval-fill ellipse {
     fill: var(--text);
     fill-opacity: 0;
     transition: fill-opacity 200ms ease-out;
   }
   button.ballot-oval[aria-pressed="true"] .ballot-oval-fill ellipse {
     fill-opacity: 1;
   }
   @media (prefers-reduced-motion: reduce) {
     .ballot-oval-fill ellipse {
       transition: none;
     }
   }
   ```

4. **Add** the new ballot-level instruction styling. The existing
   `.ballot-instructions` rule (lines 1276–1283 in the current file)
   currently styles a flat-text block. Update it to work with nested
   `<p>` children, add the gesture-specific and strategy-specific
   variants, and add the inline example-oval:
   ```css
   .ballot-instructions {
     padding: 12px 18px 14px;
     background: color-mix(in srgb, var(--c-buoy) 6%, var(--surface));
     border-bottom: 1px solid var(--border);
   }
   .ballot-instructions p {
     margin: 0;
     font-size: 12px;
     line-height: 1.5;
     color: var(--text-muted);
   }
   .ballot-instructions p + p {
     margin-top: 6px;
   }
   .ballot-instructions-gesture {
     font-weight: 500;
   }
   .ballot-instructions-example {
     display: inline-block;
     width: 14px;
     height: 9px;
     border: 1.5px solid var(--text);
     border-radius: 50%;
     background: var(--text);
     vertical-align: middle;
     margin-left: 2px;
   }
   ```

5. **Add** the `.ballot-choice-label` rule (mostly inherits, but ensures
   the label stays on the same visual line as the oval and has the right
   spacing):
   ```css
   .ballot-choice-label {
     font-size: 14px;
     color: var(--text);
     line-height: 1;
   }
   .ballot-choice {
     display: inline-flex;
     align-items: center;
     gap: 8px;
   }
   ```
   (The existing `.ballot-choice` rule already has `display: inline-flex`
   and some margin; the `gap: 8px` replaces the previous box-label spacing
   while matching the new source order.)

6. **Add** the diagonal SAMPLE watermark:
   ```css
   .ballot {
     position: relative;
     overflow: hidden;
   }
   .ballot::after {
     content: "SAMPLE";
     position: absolute;
     inset: 0;
     display: grid;
     place-items: center;
     font-size: 72px;
     font-weight: 900;
     letter-spacing: 10px;
     color: rgba(11, 22, 32, 0.05);
     transform: rotate(-18deg);
     pointer-events: none;
     z-index: 0;
   }
   .ballot > * {
     position: relative;
     z-index: 1;
   }
   ```
   The `rgba(11, 22, 32, 0.05)` uses a hard-coded hex-to-rgb of the site's
   `--c-navy` at 5% opacity. This avoids needing a new `--text-rgb`
   custom-property and is invisible enough not to compete with ballot
   content but visible enough to read as "SAMPLE" on close inspection.

### JS changes (`assets/ballot.js`)

Minimal rename. The handler still delegates clicks on `.ballot-choice`,
walks up to `.ballot-row`, and toggles `aria-pressed` with per-row "at
most one marked" semantics. Two selector literals change:

- `choice.querySelector('.ballot-box')` → `choice.querySelector('.ballot-oval')`
- `row.querySelectorAll('.ballot-box[aria-pressed="true"]')` →
  `row.querySelectorAll('.ballot-oval[aria-pressed="true"]')`

The top-of-file comment block is rewritten to describe ovals + fill-in
instead of boxes + X.

The click delegation target (`.ballot-choice`) is unchanged, so both the
label text click and the button click still mark the adjacent oval. The
click-on-label path is what gives the `.ballot-choice` an effective
tap-target much larger than the oval itself (important on mobile where
the oval is 22×14px, below the 44px WCAG recommendation).

### Accessibility

Unchanged from the 2026-04-11 design:

- `<button>` gives Enter/Space keyboard activation.
- `aria-pressed` is announced as "toggle button, pressed / not pressed."
- `aria-label="Mark Yes"` / `"Mark No"` is unchanged.
- `:focus-visible` outline uses `var(--c-buoy)`.
- `prefers-reduced-motion: reduce` disables the fill transition; marks
  toggle instantly.
- The SVG `<ellipse>` and `.ballot-instructions-example` span are both
  `aria-hidden="true"`.
- The `.ballot::after` watermark is a CSS pseudo-element and is invisible
  to assistive tech by pseudo-element semantics.
- Graceful degradation with JS disabled: the static ovals still render
  (via the base `.ballot-oval` CSS rule, which draws the border), the
  focus ring still works, and the button is inherently focusable.

### Mobile / tap targets

Unchanged approach: click delegation from `.ballot-choice` means the
entire label+oval pair is the effective tap area. The label text alone is
usually wider than 44px, so a user tapping "Yes" marks the adjacent oval.
No media-query-specific oval resize needed.

## Verification plan

Same static-verification approach as PR #124 because this repo has no
local Jekyll dev server setup (see `project_no_local_dev_server.md`).

1. `node --check assets/ballot.js` after the rename.
2. `grep` confirms zero `class="ballot-box"`, `.ballot-box-x`, or `.ballot-box-x-stroke` occurrences remain in any HTML or CSS file.
3. `grep` confirms exactly 10 new `class="ballot-oval"` button occurrences across the two HTML files.
4. `grep` confirms exactly 3 `.ballot-instructions-gesture` `<p>` blocks total (one per `.ballot` instance: Q1 on `what-is-the-override.html`, Q2 on `what-is-the-override.html`, Q2 on `question-2-trash.html`), and exactly 1 `.ballot-instructions-strategy` `<p>` block (only on Q1, because only Q1 has the nested-tier semantics).
5. Cross-reference: every `.ballot-oval` button has `aria-pressed="false"` by default; every row has exactly one Yes button and one No button; source order inside each `.ballot-choice` is `.ballot-choice-label` first, `.ballot-oval` button second.
6. Ask Andrew to click through the rendered PR preview (or the merged live site) to confirm:
   - Ovals render on the right of each "Yes"/"No" label, not the left.
   - Clicking an oval smoothly fades the fill in over ~200ms.
   - Clicking an already-filled oval fades it back out.
   - Clicking the sibling switches (sibling fades out while this one fades in).
   - Tab + Enter/Space work as expected.
   - Reduced Motion disables the fade; marks snap in and out.
   - Dark mode still renders the fill visibly against the background.
   - The SAMPLE watermark is visible but subtle — does not compete with ballot content.
   - JS disabled: ballot renders as static empty ovals on the right of each label.

## Risks and open questions

- **Watermark visibility tuning.** 5% opacity on navy may be too subtle on
  light mode or too washed out on dark mode. First-run Andrew feedback
  will tell. Easy one-number tweak.
- **Oval proportions.** 22×14 is my guess for a compact ballot layout;
  real ballots use slightly different proportions. Compact rendering
  matters more than exact mimicry. Andrew can push back if it looks off.
- **Dark mode fill.** `fill: var(--text)` should adapt, but SVG fill with
  CSS variables can behave subtly differently from `color:` in some
  rendering engines. Verify on first run.
- **Instruction background color.** `color-mix(in srgb, var(--c-buoy) 6%,
  var(--surface))` gives a subtle blue-tinted strip. If it clashes with
  the existing dark `.ballot-header` above it, may need to drop the tint.
- **Print styles.** Not a design priority; the site has minimal print CSS
  already.

## Author

Designed in the 2026-04-12 brainstorming session between Andrew Baber and
Claude Code, after the 2026-04-11 X-on-square implementation (PR #124)
was flagged as modeling the wrong ballot-marking gesture. Andrew approved
the "element-level accuracy, replace in one shot" direction in chat; this
document records the corrected design for implementation.
