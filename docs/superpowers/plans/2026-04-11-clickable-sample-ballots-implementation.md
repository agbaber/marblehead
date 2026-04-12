# Clickable Sample Ballots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sample ballot checkboxes on `what-is-the-override.html` and `question-2-trash.html` clickable so readers can practice marking the ballot. Clicking a box draws an X in with a two-stroke pen animation and enforces real-ballot mechanics (at most one of Yes/No marked per row). Nothing is tallied, stored, or revealed in response to clicks.

**Architecture:** Three files touched: `assets/site.css` gets new rules for the interactive button version of `.ballot-box` and the SVG stroke-draw animation; `what-is-the-override.html` and `question-2-trash.html` have their static `<span class="ballot-box"></span>` markup swapped for `<button>` elements containing an inline SVG X; `assets/ballot.js` is a new vanilla-JS file containing the click delegate and per-row state logic. `_includes/head.html` gets one new `<script defer>` line to load the file site-wide.

**Tech Stack:** Jekyll static site, vanilla JavaScript (IIFE, ES5, matching `assets/citations.js` conventions), CSS custom properties from `assets/site.css`. No new dependencies, no build step. Preview via `bundle exec jekyll serve`.

**Reference:** [Design spec](../specs/2026-04-11-clickable-sample-ballots-design.md)

**Prerequisite for executing this plan:** Start `bundle exec jekyll serve` in a separate terminal before Task 1 and leave it running for the duration. All verification steps assume the dev server is live at `http://localhost:4000`.

---

## File Structure

This plan creates one new file and modifies four existing files.

- **`assets/site.css`** — new rules appended near the existing `.ballot-box` rule (~line 1338). The rules target `button.ballot-box` and the new `.ballot-box-x` / `.ballot-box-x-stroke` classes, so existing `.ballot-box` span markup is unaffected if any remains during the transition.
- **`what-is-the-override.html`** — the four `.ballot-box` span pairs (Q1A, Q1B, Q1C Yes/No, plus Q2 Yes/No) are replaced with button markup containing inline SVG.
- **`question-2-trash.html`** — the single `.ballot-box` span pair (Q2 Yes/No) is replaced with button markup.
- **`assets/ballot.js`** (new) — the click delegate, `ready()` guard, and per-row state logic. ~55 lines including the comment header.
- **`_includes/head.html`** — one new `<script defer>` line loading `ballot.js` site-wide, immediately after the existing `citations.js` line.

No changes to: `_config.yml`, `_includes/nav.html`, `_includes/footer.html`, any other HTML page, any existing JS file, the `community-pulse/` worker, any test file, any data file.

---

## Task 1: Add CSS for the button version of `.ballot-box` and the SVG stroke-draw animation

**Goal:** Land all the styling for clickable ballot boxes while the existing `<span class="ballot-box"></span>` markup is still in place. The new rules either target `button.ballot-box` (only matches future markup) or target the new `.ballot-box-x` / `.ballot-box-x-stroke` classes (don't exist yet). The page renders identically to before this task.

**Files:**
- Modify: `assets/site.css` (add new rules between the existing `.ballot-box` rule block ending around line 1347 and the `@media (max-width: 600px)` block starting at line 1348)

### Steps

- [ ] **Step 1.1: Locate the insertion point**

Open `assets/site.css` and find the existing `.ballot-box` rule at line 1338:

```css
.ballot-box {
  display: inline-block;
  ...
}
```

The rule ends at line 1347 (the closing `}`). The next block is `@media (max-width: 600px)` at line 1348. Insert the new rules **between** them: after line 1347, before line 1348.

- [ ] **Step 1.2: Append the new CSS rules**

Add this exact block after the existing `.ballot-box` rule, before the mobile media query:

```css

/* Interactive sample-ballot boxes: button version with draw-in X */
button.ballot-box {
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  color: inherit;
}
button.ballot-box:focus-visible {
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
button.ballot-box[aria-pressed="true"] .ballot-box-x-stroke {
  stroke-dashoffset: 0;
}
button.ballot-box[aria-pressed="true"] .ballot-box-x-stroke:nth-child(2) {
  transition-delay: 150ms;
}
@media (prefers-reduced-motion: reduce) {
  .ballot-box-x-stroke {
    transition: none;
  }
}
```

Why `button.ballot-box` rather than just `.ballot-box`: this scopes the background/padding/cursor rules to the future button markup only, so the existing `<span class="ballot-box"></span>` usages still render correctly until Task 2 converts them.

- [ ] **Step 1.3: Verify the page still renders identically**

In the browser, open:
- `http://localhost:4000/question-2-trash.html`
- `http://localhost:4000/what-is-the-override.html`

Confirm: the sample ballots look exactly as they did before. The new CSS rules should have no visible effect because none of the markup currently matches their selectors (no `button.ballot-box` exists yet, no `.ballot-box-x` elements exist yet). Scroll the pages fully and check that nothing else shifted.

- [ ] **Step 1.4: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/clickable-ballots
git add assets/site.css
git commit -m "$(cat <<'EOF'
Add CSS for clickable ballot boxes and SVG stroke animation

Rules are scoped to button.ballot-box and the new .ballot-box-x /
.ballot-box-x-stroke classes, so existing span-based ballot boxes
render identically until the markup conversion in the next task.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Convert `.ballot-box` spans to button markup in both HTML files

**Goal:** Replace every `<span class="ballot-box"></span>` on the site with a `<button>` element containing the inline SVG X. After this task, the ballots are visually identical to before (the new CSS from Task 1 now applies), the boxes are keyboard-focusable, but clicking them still does nothing because `ballot.js` doesn't exist yet. The X stays hidden because `aria-pressed="false"` keeps `stroke-dashoffset` at 20.

**Files:**
- Modify: `question-2-trash.html` (one `.ballot-row` with two boxes, lines 354-355 in the current file)
- Modify: `what-is-the-override.html` (four `.ballot-row`s with eight boxes total: Q1A, Q1B, Q1C, plus Q2)

### Steps

- [ ] **Step 2.1: Convert the Yes boxes in `question-2-trash.html`**

Open `question-2-trash.html` and find line 354:

```html
        <span class="ballot-choice"><span class="ballot-box"></span>Yes</span>
```

Replace with:

```html
        <span class="ballot-choice"><button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark Yes"><svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true"><line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/><line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/></svg></button>Yes</span>
```

This file has exactly one Yes ballot-box span, so a single Edit replacement is sufficient.

- [ ] **Step 2.2: Convert the No boxes in `question-2-trash.html`**

In the same file, find line 355:

```html
        <span class="ballot-choice"><span class="ballot-box"></span>No</span>
```

Replace with:

```html
        <span class="ballot-choice"><button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark No"><svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true"><line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/><line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/></svg></button>No</span>
```

- [ ] **Step 2.3: Convert the Yes boxes in `what-is-the-override.html` (all four)**

Open `what-is-the-override.html`. There are four identical `<span class="ballot-choice"><span class="ballot-box"></span>Yes</span>` lines: at lines 156, 166, 176, and 194 of the current file. Use a `replace_all` Edit operation to convert all four at once.

Find (all four occurrences):

```html
          <span class="ballot-choice"><span class="ballot-box"></span>Yes</span>
```

Replace all with:

```html
          <span class="ballot-choice"><button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark Yes"><svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true"><line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/><line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/></svg></button>Yes</span>
```

If the Edit tool reports that `replace_all` is needed because of multiple matches, confirm all four matches and proceed. After this step, there should be zero `<span class="ballot-box"></span>Yes` occurrences left in the file.

- [ ] **Step 2.4: Convert the No boxes in `what-is-the-override.html` (all four)**

In the same file, use another `replace_all`.

Find (all four occurrences):

```html
          <span class="ballot-choice"><span class="ballot-box"></span>No</span>
```

Replace all with:

```html
          <span class="ballot-choice"><button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark No"><svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true"><line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/><line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/></svg></button>No</span>
```

- [ ] **Step 2.5: Verify no `<span class="ballot-box">` spans remain**

Run a grep:

```bash
cd /Users/agbaber/marblehead/.worktrees/clickable-ballots
grep -n 'span class="ballot-box"' question-2-trash.html what-is-the-override.html
```

Expected output: no matches (grep exits with status 1 and prints nothing). If any matches are reported, the conversion missed a span — fix it before continuing.

- [ ] **Step 2.6: Verify visual parity in the browser**

In the browser, reload:
- `http://localhost:4000/question-2-trash.html`
- `http://localhost:4000/what-is-the-override.html`

Confirm:
- Every ballot box still renders as an empty square with the border and size it had before.
- The "Yes" and "No" labels still sit next to the boxes at the same spacing.
- No X is visible on any box (stroke-dashoffset keeps the SVG strokes hidden by default).
- Clicking a box: nothing happens (`ballot.js` doesn't exist yet) but the button highlights briefly on click.
- Tabbing with the keyboard: focus ring (navy outline) is visible as focus moves from box to box.

- [ ] **Step 2.7: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/clickable-ballots
git add question-2-trash.html what-is-the-override.html
git commit -m "$(cat <<'EOF'
Convert ballot-box spans to buttons with inline SVG X

Every .ballot-box in the sample-ballot blocks becomes a <button>
containing a two-line SVG X. The stroke-dashoffset keeps the X
hidden until aria-pressed="true" triggers the draw-in animation
defined in the previous commit. Clicks do nothing until ballot.js
lands in the next commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `assets/ballot.js` and register it in `_includes/head.html`

**Goal:** Write the vanilla-JS click handler that toggles `aria-pressed` on ballot boxes, enforces per-row "at most one marked" semantics, and early-returns on pages without sample ballots. Load it site-wide via a new `<script defer>` tag in `_includes/head.html`.

**Files:**
- Create: `assets/ballot.js`
- Modify: `_includes/head.html` (one new script tag after line 24)

### Steps

- [ ] **Step 3.1: Create `assets/ballot.js`**

Create a new file at `assets/ballot.js` with this exact content:

```javascript
/*
 * Clickable sample-ballot runtime.
 *
 * Makes the .ballot-box buttons on sample-ballot blocks interactive so
 * readers can practice marking the ballot they'll see on June 9, 2026.
 * Enforces per-row "at most one of Yes/No marked" semantics. There is
 * no persistence, no tally, and no content reveal: clicking a box
 * toggles its aria-pressed attribute, and the X drawing is handled
 * entirely by CSS (stroke-dashoffset transition keyed to aria-pressed).
 *
 * Markup contract:
 *
 *   <div class="ballot-row">
 *     ...
 *     <div class="ballot-choices">
 *       <span class="ballot-choice">
 *         <button type="button" class="ballot-box"
 *                 aria-pressed="false" aria-label="Mark Yes">
 *           <svg class="ballot-box-x" ...>...</svg>
 *         </button>
 *         Yes
 *       </span>
 *       ... (No)
 *     </div>
 *   </div>
 *
 * Clicks anywhere on .ballot-choice (including the visible "Yes"/"No"
 * label text) are routed to the .ballot-box inside it, which gives the
 * label text an extended tap target on mobile where the 16px box is
 * below the 44px WCAG recommendation.
 *
 * Pages with no .ballot-box elements are early-returned, matching the
 * pattern used by assets/citations.js.
 */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready(function () {
    if (!document.querySelector('.ballot-box')) {
      return;
    }

    document.addEventListener('click', function (event) {
      var choice = event.target.closest('.ballot-choice');
      if (!choice) return;
      var row = choice.closest('.ballot-row');
      if (!row) return;
      var box = choice.querySelector('.ballot-box');
      if (!box) return;

      var isPressed = box.getAttribute('aria-pressed') === 'true';

      if (isPressed) {
        box.setAttribute('aria-pressed', 'false');
        return;
      }

      var siblings = row.querySelectorAll('.ballot-box[aria-pressed="true"]');
      for (var i = 0; i < siblings.length; i++) {
        siblings[i].setAttribute('aria-pressed', 'false');
      }
      box.setAttribute('aria-pressed', 'true');
    });
  });
})();
```

Why delegate on `document` rather than per-button: matches the house style of `citations.js` (also uses DOM-level patterns), one listener handles every row on every page, and future ballots added to the site Just Work without re-registering.

Why `event.target.closest('.ballot-choice')` rather than `closest('.ballot-box')`: clicks on the visible "Yes"/"No" label text should also mark the adjacent box (mobile tap-target fix). The `.ballot-choice` span wraps both the button and the text, so closest-to-`.ballot-choice` catches both paths. Then `choice.querySelector('.ballot-box')` finds the button inside.

Why `closest('.ballot-row')` check after `.ballot-choice`: defensive. If a future page has a `.ballot-choice` that's not inside a `.ballot-row`, it won't accidentally become interactive.

- [ ] **Step 3.2: Register `ballot.js` in `_includes/head.html`**

Open `_includes/head.html`. Find line 24:

```html
<script defer src="{{ '/' | relative_url }}assets/citations.js"></script>
```

Add a new line immediately after it:

```html
<script defer src="{{ '/' | relative_url }}assets/citations.js"></script>
<script defer src="{{ '/' | relative_url }}assets/ballot.js"></script>
```

The `defer` attribute ensures the script runs after the DOM is parsed but before `DOMContentLoaded` fires; the IIFE's `ready()` guard is still included as a safety net in case the script is ever loaded without `defer`.

- [ ] **Step 3.3: Verify the file loads in the browser**

Reload `http://localhost:4000/question-2-trash.html` and open DevTools.

Confirm:
- Network tab: `ballot.js` appears in the list with HTTP 200.
- Console tab: no JavaScript errors reported.
- Elements tab: inspect a ballot-box button — `aria-pressed` is still `"false"`.

- [ ] **Step 3.4: Click-test the Q2 ballot**

On `http://localhost:4000/question-2-trash.html`, click the Yes box.

Expected:
- Two SVG strokes draw in over ~300ms (first stroke 0-150ms, second 150-300ms).
- The button's `aria-pressed` attribute (visible in Elements tab) is now `"true"`.

Click the No box.

Expected:
- Yes box strokes reverse-animate out (both simultaneously, since there's no delay on the un-pressed state).
- No box strokes draw in with the same two-stage sequence.

Click the No box again.

Expected:
- No box strokes reverse-animate out.
- Neither box has an X.

Click the "Yes" label text (not the box).

Expected:
- Yes box strokes draw in. Tapping the label routes to the button.

- [ ] **Step 3.5: Click-test the Q1 and Q2 ballots on the override page**

On `http://localhost:4000/what-is-the-override.html`, confirm:

- Q1A, Q1B, Q1C rows are independent: marking Q1A Yes does not clear Q1B's mark.
- Within a row: marking Yes after No clears No first and then marks Yes.
- Q2 ballot at the bottom of the page behaves the same as on the trash page.

- [ ] **Step 3.6: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/clickable-ballots
git add assets/ballot.js _includes/head.html
git commit -m "$(cat <<'EOF'
Add ballot.js click handler and load it site-wide

The handler delegates clicks on .ballot-choice so both the button
and the visible "Yes"/"No" label act as the tap target. Per-row
state: at most one of Yes/No has aria-pressed="true". Clicking an
already-pressed box clears it; clicking the sibling switches. No
persistence, no tally, no content reveal.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Accessibility, reduced-motion, and graceful-degradation verification

**Goal:** Run the full verification pass from the design spec (Section 7). If anything fails, fix it in a small follow-up commit and re-verify. This task produces a commit only if fixes are needed.

**Files:**
- No code changes unless a verification step fails.

### Steps

- [ ] **Step 4.1: Keyboard navigation**

On `http://localhost:4000/what-is-the-override.html`, click somewhere neutral, then press Tab repeatedly.

Expected:
- Focus ring (navy outline, `--c-buoy`) appears on the first ballot box.
- Tab order follows visual order: Q1A Yes, Q1A No, Q1B Yes, Q1B No, Q1C Yes, Q1C No, then Q2 Yes, Q2 No.
- Pressing Enter on a focused box toggles its mark.
- Pressing Space on a focused box also toggles its mark.

If the tab order is wrong or focus ring is missing on any box, that's a bug in Task 1's CSS or Task 2's markup — fix before proceeding.

- [ ] **Step 4.2: Reduced-motion**

Enable Reduce Motion in macOS: System Settings → Accessibility → Display → Reduce motion. Reload `http://localhost:4000/question-2-trash.html`.

Click the Yes box.

Expected:
- The X appears immediately without a draw animation.
- Clicking again clears it immediately.

If the animation still runs with Reduce Motion enabled, the `@media (prefers-reduced-motion: reduce)` rule in Task 1 is missing or mis-scoped — fix before proceeding.

Turn Reduce Motion off again.

- [ ] **Step 4.3: Screen reader announcement (VoiceOver)**

Enable VoiceOver (Cmd+F5). Navigate with VO+arrow keys to a ballot box on `http://localhost:4000/question-2-trash.html`.

Expected announcement (approximate):
- "Mark Yes, toggle button, not pressed"

Press VO+Space to activate.

Expected announcement:
- "Mark Yes, toggle button, pressed"

Navigate to the No box and activate.

Expected: No is announced as pressed, Yes silently returns to not-pressed.

Exit VoiceOver (Cmd+F5 again).

- [ ] **Step 4.4: Mobile viewport / tap targets**

Open DevTools → Device Mode (Cmd+Shift+M in Chrome) and select a phone size (e.g., iPhone SE 375×667). Reload `http://localhost:4000/question-2-trash.html`.

Expected:
- The ballot renders without horizontal scroll.
- Tapping the "Yes" text (not the box itself) marks the Yes box.
- Tap target feels comfortable: the entire `.ballot-choice` span (box + label) is clickable, so the effective tap area is well above 44px.

- [ ] **Step 4.5: JavaScript-disabled fallback**

In DevTools, open Command Menu (Cmd+Shift+P) and run "Disable JavaScript". Reload `http://localhost:4000/question-2-trash.html`.

Expected:
- The ballot renders identically to today's static version (empty boxes, "Yes"/"No" labels).
- Clicking does nothing, but nothing is visibly broken.
- The focus ring still shows on Tab (because buttons are inherently focusable).

Re-enable JavaScript in DevTools.

- [ ] **Step 4.6: Dark mode sanity check**

Switch macOS to Dark mode (System Settings → Appearance → Dark). Reload `http://localhost:4000/question-2-trash.html`. Click the Yes box.

Expected:
- The X stroke is visible against the dark background (uses `var(--text)` which flips in dark mode).
- The focus ring is still visible against the dark background.

Switch back to Light mode.

- [ ] **Step 4.7: Dev server console is clean**

Scroll through the terminal running `bundle exec jekyll serve`.

Expected: no build warnings or errors introduced by this change. Liquid template errors (e.g., a stray `{{` in ballot.js would be flagged since `.js` isn't processed by Liquid, so this is essentially a sanity check — but worth scanning).

- [ ] **Step 4.8: Commit any fixes, or move on**

If any step above required a code change, stage and commit the fix with a descriptive message:

```bash
cd /Users/agbaber/marblehead/.worktrees/clickable-ballots
git add <files>
git commit -m "$(cat <<'EOF'
Fix <specific issue> in clickable sample ballots

<One or two sentences on what was wrong and what the fix does.>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no fixes were needed, skip this step. The plan is complete.

---

## Post-implementation

Once all four tasks are done and verification passes:

1. Push the `clickable-ballots` branch with the inline PAT URL form (per memory rule `feedback_pat_first_push.md`):
   ```bash
   cd /Users/agbaber/marblehead/.worktrees/clickable-ballots
   source /Users/agbaber/marblehead/.env
   git push "https://agbaber:${GITHUB_TOKEN}@github.com/agbaber/marblehead.git" clickable-ballots:clickable-ballots -u
   ```

2. Open a pull request via `gh pr create` or `mcp__github__create_pull_request`, per the CLAUDE.md rule "Always open a PR after pushing." Suggested PR title: `Add clickable sample ballots`. Body should reference the design spec at `docs/superpowers/specs/2026-04-11-clickable-sample-ballots-design.md` and the "try it out" neutrality framing.

3. Report the PR URL back to Andrew.

---

## Self-review (performed when writing this plan)

- **Spec coverage:** Every section of the design spec maps to a task:
  - Markup change → Task 2
  - CSS additions → Task 1
  - JS behavior / state model → Task 3
  - How the JS loads → Task 3 step 3.2
  - Accessibility (keyboard, aria-pressed, focus ring) → Task 1 (CSS), Task 2 (aria-label), Task 3 (aria-pressed toggling), Task 4 (verification)
  - Mobile / tap targets → Task 3 (click delegation from `.ballot-choice`), Task 4.4 (verification)
  - Verification plan → Task 4
  - `prefers-reduced-motion` → Task 1 (CSS), Task 4.2 (verification)
  - Dark mode risk → Task 4.6 (verification)
  - Graceful degradation → Task 4.5 (verification)

- **Placeholder scan:** No TBD, TODO, "fill in," or "similar to task N" in the plan. Every code block is literal and complete.

- **Type consistency:** All selectors, attributes, and class names are consistent across tasks (`button.ballot-box`, `.ballot-box-x`, `.ballot-box-x-stroke`, `aria-pressed`, `aria-label`).

- **Scope:** One feature, four tasks, ~55 lines of JS + ~30 lines of CSS + 10 markup edits. Appropriate for a single implementation plan.
