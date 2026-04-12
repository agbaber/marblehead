# Clickable Sample Ballots Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the X-on-square sample ballot rendering (shipped in PR #124 as `f2ecaaa`) with a fill-in-oval rendering that matches how real Massachusetts optical-scan ballots work. Ovals render on the right of each "Yes"/"No" label, clicking an oval fades the fill in over ~200ms, and every ballot block gains a prominent "To vote, completely fill in the oval..." instruction at the top plus a subtle diagonal SAMPLE watermark.

**Architecture:** Five files modified. The CSS and markup are reshaped so the shape is an ellipse, the position is on the right of the label, the animation is fill-opacity instead of stroke-dashoffset, and the ballot block has a new instruction paragraph and a watermark pseudo-element. The JS click-handler logic is unchanged except for a selector rename (`.ballot-box` → `.ballot-oval`).

**Tech Stack:** Jekyll static site, vanilla JavaScript (IIFE, ES5, matching `assets/citations.js` conventions), CSS custom properties from `assets/site.css`, SVG `<ellipse>` for the fillable shape. No new dependencies, no build step, no local dev server (verification is static-file-only; runtime checks deferred to the PR reviewer).

**Reference:** [Design spec](../specs/2026-04-12-clickable-sample-ballots-overhaul-design.md)

**Prerequisite state:** Starting from `ballot-overhaul` branch off `origin/main` at commit `f2ecaaa`, which is the merged state of PR #124 (the X-on-square implementation).

---

## File Structure

This plan modifies four existing files and creates no new files. (The new spec at `docs/superpowers/specs/2026-04-12-clickable-sample-ballots-overhaul-design.md` was already committed before Task 1 by the brainstorming step.)

- **`assets/site.css`** — new rules added for `.ballot-oval*`, `.ballot-choice-label`, `.ballot-instructions-gesture/strategy/example`, `.ballot::after` watermark; existing `.ballot-instructions`, `.ballot`, and `.ballot-choice` rules updated; old `.ballot-box*` rules deleted in Task 3.
- **`question-2-trash.html`** — the single Q2 ballot block gets a new `.ballot-instructions` gesture paragraph; its two `.ballot-choice` spans are rewritten with label-before-button source order and `.ballot-oval` button markup containing an inline `<ellipse>` SVG.
- **`what-is-the-override.html`** — Q1's existing flat-text `.ballot-instructions` becomes a two-paragraph wrapper (gesture + strategy); Q2 gets a new `.ballot-instructions` gesture paragraph inserted between its header and first row; all 8 `.ballot-choice` spans across the 4 ballot-rows are rewritten in the same way as the trash page.
- **`assets/ballot.js`** — two selector literals change (`.ballot-box` → `.ballot-oval`) and the comment block header is rewritten to describe ovals + fill-in instead of boxes + X.

No changes to: `_includes/head.html`, `_config.yml`, any other HTML page, `assets/citations.js`, the `community-pulse/` worker, data files, or any STYLE_GUIDE rules.

---

## Task 1: Add new CSS rules for ovals, fill animation, instruction blocks, and SAMPLE watermark

**Goal:** Land all the styling for the new ballot rendering while the existing markup is still the old X-on-square form. The new `.ballot-oval*` rules target classes that don't exist in any HTML yet, so they're inert. The existing `.ballot-instructions`, `.ballot`, and `.ballot-choice` rules are updated in place, which causes a small visible change on the live page between this task and Task 2 (Q1's instruction text restyles slightly, the SAMPLE watermark appears on both ballots). This intermediate state is acceptable because the commits land back-to-back.

**Files:**
- Modify: `assets/site.css` (add new rules near the existing `.ballot*` rule cluster around lines 1249–1390; update `.ballot`, `.ballot-instructions`, `.ballot-choice` rules in place)

### Steps

- [ ] **Step 1.1: Locate the existing `.ballot` rule and update it to enable the watermark**

Open `assets/site.css` and find the `.ballot` rule around line 1250:

```css
.ballot {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  margin: 20px 0 24px;
  overflow: hidden;
  max-width: 720px;
}
```

(Exact property list may vary slightly — match whatever is currently there.) The existing rule already has `overflow: hidden`, so the only addition needed is `position: relative` so the absolutely-positioned `::after` watermark anchors correctly.

Replace with:

```css
.ballot {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  margin: 20px 0 24px;
  overflow: hidden;
  max-width: 720px;
  position: relative;
}
```

(If the existing rule already has `position: relative` for any reason, leave it alone.)

- [ ] **Step 1.2: Update the existing `.ballot-instructions` rule to accommodate nested `<p>` children**

Find the existing `.ballot-instructions` rule around line 1276:

```css
.ballot-instructions {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 8px 14px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--c-buoy) 4%, var(--surface));
  border-bottom: 1px solid var(--border);
  border-top: 1px solid var(--border);
}
```

Replace with:

```css
.ballot-instructions {
  padding: 12px 18px 14px;
  background: color-mix(in srgb, var(--c-buoy) 6%, var(--surface));
  border-bottom: 1px solid var(--border);
  border-top: 1px solid var(--border);
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

Note: the existing flat-text rule uses `text-transform: uppercase; letter-spacing: 0.8px` which was visually appropriate for the short legacy "Vote YES or NO on each question…" string. The new styling is normal case with slightly larger type, to make room for the longer gesture instruction and to look more like real ballot instruction text. Between Task 1 and Task 2, Q1's legacy instruction renders with the new styling briefly — still readable, just different.

- [ ] **Step 1.3: Update the existing `.ballot-choice` rule to set gap and add the new label class**

Find the existing `.ballot-choice` rule around line 1328 (just below `.ballot-choices`):

```css
.ballot-choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text);
}
```

(Exact property values may vary.) Update it so the gap is 8px and the label class gets an explicit rule:

```css
.ballot-choice {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text);
}
.ballot-choice-label {
  line-height: 1;
}
```

- [ ] **Step 1.4: Add new `.ballot-oval` button rule and SVG fill animation rules**

Immediately after the existing `.ballot-box` rule block (which still exists because the old markup still uses it — we'll delete the dead `.ballot-box*` rules in Task 3), add the new `.ballot-oval` rules:

```css

/* New fill-in-oval ballot buttons (replaces .ballot-box* X-on-square) */
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

Why `width: 22px; height: 14px` + `border-radius: 50%`: on non-square dimensions, `border-radius: 50%` renders as an ellipse whose axes match the width and height. 22:14 gives a pill-ish proportion that reads as "ballot oval."

- [ ] **Step 1.5: Add the `.ballot::after` SAMPLE watermark at the end of the ballot rule cluster**

After all the ballot-related rules (after the existing `@media (max-width: 600px)` mobile block, or wherever the ballot cluster ends — easiest anchor: just before the next top-level section comment in the file), add:

```css

/* SAMPLE watermark for ballot blocks */
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

Why `rgba(11, 22, 32, 0.05)`: that's a hard-coded hex-to-rgb of `--c-navy` at 5% opacity. Subtle enough not to compete with ballot content, visible enough to read as "SAMPLE" on close inspection. Both `.ballot > *` z-index 1 and `.ballot::after` z-index 0 ensure the watermark sits beneath the content.

- [ ] **Step 1.6: Verify the CSS changes are syntactically clean**

```bash
cd /Users/agbaber/marblehead/.worktrees/ballot-overhaul
grep -c "ballot-oval" assets/site.css
```

Expected: at least 8 lines matching (the new oval/fill rules). If the count is suspiciously low, re-check the edits.

```bash
grep -c "ballot-box" assets/site.css
```

Expected: the same count as before Task 1 (the old rules should still be in place, since we don't delete them until Task 3).

- [ ] **Step 1.7: Commit**

```bash
git add assets/site.css
git commit -m "$(cat <<'EOF'
Add CSS for fill-in-oval ballot markup and SAMPLE watermark

Adds the .ballot-oval button rules, .ballot-oval-fill SVG fill
animation, .ballot-instructions styling for nested <p> children,
.ballot-instructions-gesture/strategy/example, .ballot-choice-label,
and the .ballot::after SAMPLE watermark. The old .ballot-box* rules
stay in place for now; they become dead code once the markup is
converted in the next commit, and get deleted in Task 3.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Convert the HTML markup on both files

**Goal:** Rewrite every `.ballot-choice` to use label-before-button source order with the new `.ballot-oval` button containing an inline `<ellipse>` SVG. Replace Q1's existing flat-text `.ballot-instructions` on `what-is-the-override.html` with the two-paragraph wrapper. Insert a new `.ballot-instructions` block on the two Q2 ballots (one on each file). After this task, the page renders with ovals on the right of each label, the SAMPLE watermark is visible, clicks do nothing yet because `ballot.js` still queries `.ballot-box`.

**Files:**
- Modify: `question-2-trash.html` (insert instructions block before line 385 ballot-row; rewrite the 2 ballot-choice lines at 390-391)
- Modify: `what-is-the-override.html` (replace line 150 Q1 instructions; insert Q2 instructions between line 188 and 189; rewrite the 8 ballot-choice lines at 156/157, 166/167, 176/177, 194/195)

### Steps

- [ ] **Step 2.1: Replace Q1's existing `.ballot-instructions` on `what-is-the-override.html`**

Open `what-is-the-override.html` and find line 150:

```html
    <div class="ballot-instructions">Vote YES or NO on each question. You may vote YES on more than one.</div>
```

Replace with:

```html
    <div class="ballot-instructions">
      <p class="ballot-instructions-gesture">To vote, completely fill in the oval to the right of your choice like this: <span class="ballot-instructions-example" aria-hidden="true"></span></p>
      <p class="ballot-instructions-strategy">Vote YES or NO on each question. You may vote YES on more than one.</p>
    </div>
```

The indentation is 4 spaces (matching the surrounding `.ballot` contents on this file).

- [ ] **Step 2.2: Insert a new `.ballot-instructions` on Q2 in `what-is-the-override.html`**

In the same file, find the Q2 ballot header closing `</div>` at line 188 followed by the first `<div class="ballot-row">` at line 189:

```html
    <div class="ballot-header">
      <div class="ballot-header-sub">Sample Ballot &middot; Town of Marblehead &middot; June 9, 2026</div>
      <div class="ballot-header-main">Question 2: Curbside Trash Funding</div>
    </div>
    <div class="ballot-row">
      <div class="ballot-q-num">2</div>
```

Replace with:

```html
    <div class="ballot-header">
      <div class="ballot-header-sub">Sample Ballot &middot; Town of Marblehead &middot; June 9, 2026</div>
      <div class="ballot-header-main">Question 2: Curbside Trash Funding</div>
    </div>
    <div class="ballot-instructions">
      <p class="ballot-instructions-gesture">To vote, completely fill in the oval to the right of your choice like this: <span class="ballot-instructions-example" aria-hidden="true"></span></p>
    </div>
    <div class="ballot-row">
      <div class="ballot-q-num">2</div>
```

Note the `old_string` uses the specific header text "Question 2: Curbside Trash Funding" to disambiguate from Q1's identical-looking header block structure.

- [ ] **Step 2.3: Insert a new `.ballot-instructions` on Q2 in `question-2-trash.html`**

Open `question-2-trash.html` and find the header closing `</div>` followed by the first `<div class="ballot-row">`:

```html
  <div class="ballot-header">
    <div class="ballot-header-sub">Sample Ballot &middot; Town of Marblehead &middot; June 9, 2026</div>
    <div class="ballot-header-main">Question 2: Curbside Trash Funding</div>
  </div>
  <div class="ballot-row">
    <div class="ballot-q-num">2</div>
```

The indentation on this file is 2 spaces (not 4, unlike the override page).

Replace with:

```html
  <div class="ballot-header">
    <div class="ballot-header-sub">Sample Ballot &middot; Town of Marblehead &middot; June 9, 2026</div>
    <div class="ballot-header-main">Question 2: Curbside Trash Funding</div>
  </div>
  <div class="ballot-instructions">
    <p class="ballot-instructions-gesture">To vote, completely fill in the oval to the right of your choice like this: <span class="ballot-instructions-example" aria-hidden="true"></span></p>
  </div>
  <div class="ballot-row">
    <div class="ballot-q-num">2</div>
```

- [ ] **Step 2.4: Convert the Yes `.ballot-choice` lines on `what-is-the-override.html` (replace_all, 4 matches)**

The override page has 4 identical Yes ballot-choice lines at indent level 10. Use a `replace_all` Edit operation.

Find (matches 4 occurrences):

```html
          <span class="ballot-choice"><button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark Yes"><svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true"><line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/><line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/></svg></button>Yes</span>
```

Replace all with:

```html
          <span class="ballot-choice"><span class="ballot-choice-label">Yes</span><button type="button" class="ballot-oval" aria-pressed="false" aria-label="Mark Yes"><svg class="ballot-oval-fill" viewBox="0 0 24 16" aria-hidden="true"><ellipse cx="12" cy="8" rx="10" ry="6"/></svg></button></span>
```

- [ ] **Step 2.5: Convert the No `.ballot-choice` lines on `what-is-the-override.html` (replace_all, 4 matches)**

In the same file, use another `replace_all`.

Find (matches 4 occurrences):

```html
          <span class="ballot-choice"><button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark No"><svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true"><line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/><line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/></svg></button>No</span>
```

Replace all with:

```html
          <span class="ballot-choice"><span class="ballot-choice-label">No</span><button type="button" class="ballot-oval" aria-pressed="false" aria-label="Mark No"><svg class="ballot-oval-fill" viewBox="0 0 24 16" aria-hidden="true"><ellipse cx="12" cy="8" rx="10" ry="6"/></svg></button></span>
```

- [ ] **Step 2.6: Convert both `.ballot-choice` lines on `question-2-trash.html`**

Open `question-2-trash.html`. The single ballot has 8-space indent (not 10). Convert both lines in one Edit using the two adjacent lines as the `old_string`:

Find:

```html
        <span class="ballot-choice"><button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark Yes"><svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true"><line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/><line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/></svg></button>Yes</span>
        <span class="ballot-choice"><button type="button" class="ballot-box" aria-pressed="false" aria-label="Mark No"><svg class="ballot-box-x" viewBox="0 0 20 20" aria-hidden="true"><line class="ballot-box-x-stroke" x1="4" y1="4" x2="16" y2="16"/><line class="ballot-box-x-stroke" x1="16" y1="4" x2="4" y2="16"/></svg></button>No</span>
```

Replace with:

```html
        <span class="ballot-choice"><span class="ballot-choice-label">Yes</span><button type="button" class="ballot-oval" aria-pressed="false" aria-label="Mark Yes"><svg class="ballot-oval-fill" viewBox="0 0 24 16" aria-hidden="true"><ellipse cx="12" cy="8" rx="10" ry="6"/></svg></button></span>
        <span class="ballot-choice"><span class="ballot-choice-label">No</span><button type="button" class="ballot-oval" aria-pressed="false" aria-label="Mark No"><svg class="ballot-oval-fill" viewBox="0 0 24 16" aria-hidden="true"><ellipse cx="12" cy="8" rx="10" ry="6"/></svg></button></span>
```

- [ ] **Step 2.7: Verify markup consistency via grep**

```bash
cd /Users/agbaber/marblehead/.worktrees/ballot-overhaul
grep -c 'class="ballot-box"' question-2-trash.html what-is-the-override.html
```

Expected: both files report `:0`. No `.ballot-box` button markup should remain in either HTML file.

```bash
grep -c 'class="ballot-oval"' question-2-trash.html what-is-the-override.html
```

Expected: `question-2-trash.html:2`, `what-is-the-override.html:8`. Ten ovals total across both files.

```bash
grep -c 'ballot-instructions-gesture' question-2-trash.html what-is-the-override.html
```

Expected: `question-2-trash.html:1`, `what-is-the-override.html:2`. Three gesture paragraphs total (one per `.ballot` instance).

```bash
grep -c 'ballot-instructions-strategy' what-is-the-override.html
```

Expected: `1`. Only Q1 has the strategy paragraph.

```bash
grep -c 'ballot-choice-label' question-2-trash.html what-is-the-override.html
```

Expected: `question-2-trash.html:2`, `what-is-the-override.html:8`. One label span per ballot-choice.

- [ ] **Step 2.8: Spot-check one converted row by reading it back**

```bash
grep -A1 -n 'ballot-q-num">1A' what-is-the-override.html
```

Expected output includes the 1A ballot-row block with the new markup visible. Read the lines around the 1A row and confirm the structure matches:

```
ballot-row → ballot-q-num "1A" → ballot-q-main → ballot-q-text → ballot-choices
  → ballot-choice (Yes label first, then ballot-oval button)
  → ballot-choice (No label first, then ballot-oval button)
```

If the label is on the wrong side of the button, the source order is wrong — re-check Step 2.4.

- [ ] **Step 2.9: Commit**

```bash
git add question-2-trash.html what-is-the-override.html
git commit -m "$(cat <<'EOF'
Rebuild ballot markup with ovals on the right of each choice

Every .ballot-choice is rewritten so the Yes/No label text comes
first in source order and the new .ballot-oval button (containing
an inline <ellipse> SVG) comes second, rendering the mark area to
the right of the label to match real MA optical-scan ballots. A
new .ballot-instructions block is added to every sample ballot with
the verbatim "To vote, completely fill in the oval..." gesture
instruction; Q1's existing strategy instruction ("you may vote YES
on more than one") is preserved as a second paragraph.

No .ballot-box markup remains in HTML after this commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update `assets/ballot.js` and remove dead `.ballot-box` CSS rules

**Goal:** Rename the two `.ballot-box` selector literals in the click handler to `.ballot-oval`, rewrite the top-of-file comment to describe the new interaction, and delete the now-dead `.ballot-box*` CSS rules from `assets/site.css`. After this task, there is no `.ballot-box` reference anywhere in the repo other than the historical 2026-04-11 spec/plan documents (which are kept as historical record).

**Files:**
- Modify: `assets/ballot.js` (comment block rewrite + two selector renames)
- Modify: `assets/site.css` (delete dead `.ballot-box*` rules)

### Steps

- [ ] **Step 3.1: Rewrite the top-of-file comment block in `assets/ballot.js`**

Open `assets/ballot.js`. The current comment block (roughly lines 1–33) describes the X-on-square design. Replace the entire comment block with:

```javascript
/*
 * Clickable sample-ballot runtime.
 *
 * Makes the .ballot-oval buttons on sample-ballot blocks interactive so
 * readers can practice marking the ballot they'll see on June 9, 2026.
 * Enforces per-row "at most one of Yes/No marked" semantics. There is
 * no persistence, no tally, and no content reveal: clicking an oval
 * toggles its aria-pressed attribute, and the fill-in animation is
 * handled entirely by CSS (fill-opacity transition on the inner
 * <ellipse>, keyed to the button's aria-pressed state).
 *
 * Markup contract:
 *
 *   <div class="ballot-row">
 *     ...
 *     <div class="ballot-choices">
 *       <span class="ballot-choice">
 *         <span class="ballot-choice-label">Yes</span>
 *         <button type="button" class="ballot-oval"
 *                 aria-pressed="false" aria-label="Mark Yes">
 *           <svg class="ballot-oval-fill" ...>
 *             <ellipse .../>
 *           </svg>
 *         </button>
 *       </span>
 *       ... (No)
 *     </div>
 *   </div>
 *
 * Clicks anywhere on .ballot-choice (including the visible Yes/No
 * label text) are routed to the .ballot-oval inside it, which gives
 * the label text an extended tap target on mobile where the 22x14
 * oval is below the 44px WCAG recommendation.
 *
 * Pages with no .ballot-oval elements are early-returned, matching
 * the pattern used by assets/citations.js.
 */
```

Leave the IIFE body (the `(function () { 'use strict'; ... })();` block) in place for now — it still contains the old selectors.

- [ ] **Step 3.2: Update the early-return selector**

In the IIFE body, find:

```javascript
    if (!document.querySelector('.ballot-box')) {
      return;
    }
```

Replace with:

```javascript
    if (!document.querySelector('.ballot-oval')) {
      return;
    }
```

- [ ] **Step 3.3: Update the per-choice box query**

Find:

```javascript
      var box = choice.querySelector('.ballot-box');
      if (!box) return;
```

Replace with:

```javascript
      var box = choice.querySelector('.ballot-oval');
      if (!box) return;
```

(The local variable name `box` is kept as-is because it's an internal identifier that doesn't affect behavior, and renaming it to `oval` is churn. Leave it.)

- [ ] **Step 3.4: Update the sibling sweep selector**

Find:

```javascript
      var siblings = row.querySelectorAll('.ballot-box[aria-pressed="true"]');
```

Replace with:

```javascript
      var siblings = row.querySelectorAll('.ballot-oval[aria-pressed="true"]');
```

- [ ] **Step 3.5: Syntax-check the JS file**

```bash
cd /Users/agbaber/marblehead/.worktrees/ballot-overhaul
node --check assets/ballot.js && echo "syntax ok"
```

Expected output: `syntax ok`.

- [ ] **Step 3.6: Delete the dead `.ballot-box*` CSS rules**

Open `assets/site.css` and find the block of dead rules that were added in PR #124. They're adjacent to the still-live `.ballot-box` base rule. Delete every rule that starts with any of the following selectors:

- `button.ballot-box {` (the interactive button version)
- `button.ballot-box:focus-visible {`
- `.ballot-box-x {`
- `.ballot-box-x-stroke {`
- `button.ballot-box[aria-pressed="true"] .ballot-box-x-stroke {`
- `button.ballot-box[aria-pressed="true"] .ballot-box-x-stroke:nth-child(2) {`
- `@media (prefers-reduced-motion: reduce) { .ballot-box-x-stroke { ... } }` (the X-specific one; the new `.ballot-oval-fill ellipse { transition: none; }` reduced-motion rule from Task 1 stays)

Also delete the base `.ballot-box` rule itself (around line 1338) since no markup references `.ballot-box` anymore:

```css
.ballot-box {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid var(--text);
  border-radius: 2px;
  background: var(--surface);
  flex-shrink: 0;
}
```

And the mobile-only override:

```css
  .ballot-box { width: 16px; height: 16px; }
```

(inside the `@media (max-width: 600px)` block). Delete that single line.

- [ ] **Step 3.7: Verify no `.ballot-box` references remain anywhere**

```bash
grep -n "ballot-box" assets/site.css assets/ballot.js question-2-trash.html what-is-the-override.html _includes/head.html 2>&1
```

Expected: no matches. If any show up, something was missed.

```bash
grep -rn "ballot-box" docs/superpowers/specs/2026-04-11-* docs/superpowers/plans/2026-04-11-* 2>&1 | head -5
```

Expected: matches DO appear in the 2026-04-11 historical spec/plan docs (which is fine — those are preserved as historical record of the original implementation).

- [ ] **Step 3.8: Commit**

```bash
git add assets/ballot.js assets/site.css
git commit -m "$(cat <<'EOF'
Rename ballot.js selectors to .ballot-oval and delete dead CSS

The click handler's two selector literals and the early-return
query change from .ballot-box to .ballot-oval to match the new
markup. The top-of-file comment block is rewritten to describe
the fill-in-oval interaction instead of X-on-square. Dead CSS
rules (.ballot-box, button.ballot-box, .ballot-box-x,
.ballot-box-x-stroke, plus the X-specific prefers-reduced-motion
override) are removed from assets/site.css.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Static verification, push, and open PR

**Goal:** Run the full static-verification pass from the spec, push the branch via the PAT URL form, and open a PR with the manual verification checklist in the body. After this task, the overhaul is on a branch ready for Andrew to merge once he has eyes on the rendered output.

**Files:**
- No code changes unless a verification step surfaces a bug.

### Steps

- [ ] **Step 4.1: Final static-verification grep pass**

```bash
cd /Users/agbaber/marblehead/.worktrees/ballot-overhaul

# No .ballot-box references in live code
grep -rn "ballot-box" assets/ _includes/ *.html 2>&1 || echo "clean"

# Exactly 10 ballot-oval buttons
grep -c 'class="ballot-oval"' question-2-trash.html what-is-the-override.html

# Exactly 10 aria-pressed="false" defaults
grep -c 'aria-pressed="false"' question-2-trash.html what-is-the-override.html

# Exactly 3 gesture paragraphs (one per .ballot)
grep -c 'ballot-instructions-gesture' question-2-trash.html what-is-the-override.html

# Exactly 1 strategy paragraph (Q1 only)
grep -c 'ballot-instructions-strategy' what-is-the-override.html

# JS syntax
node --check assets/ballot.js && echo "js syntax ok"
```

All outputs should match: 0 or "clean" for ballot-box; trash:2 override:8 for ballot-oval; trash:2 override:8 for aria-pressed; trash:1 override:2 for gesture (matching the 3 `.ballot` instances); override:1 for strategy; "js syntax ok" for node check.

- [ ] **Step 4.2: Confirm commit list**

```bash
git log --oneline origin/main..HEAD
```

Expected output: 4 commits ahead of main. The spec commit (`c7fce98` approximately) is already present from the brainstorming step; the three Task 1–3 commits are added on top.

- [ ] **Step 4.3: Confirm no merge conflicts with latest origin/main**

```bash
git fetch origin main
git log --oneline HEAD..origin/main
```

If the output is empty, the branch is still directly off main's tip and can fast-forward merge. If there are new commits on origin/main that touch any of `assets/site.css`, `assets/ballot.js`, `question-2-trash.html`, `what-is-the-override.html`, or `_includes/head.html`, flag the conflict and pause for resolution.

- [ ] **Step 4.4: Push the branch via the inline PAT URL form**

Per the `feedback_pat_first_push.md` memory rule, push directly via the token URL on the first attempt (no `git push -u origin` fallback):

```bash
set -a && source /Users/agbaber/marblehead/.env && set +a
git -c credential.helper= push \
  "https://x-access-token:${GITHUB_TOKEN}@github.com/agbaber/marblehead.git" \
  ballot-overhaul 2>&1 | sed "s/${GITHUB_TOKEN}/<redacted>/g"
```

Expected output: `* [new branch] ballot-overhaul -> ballot-overhaul`.

- [ ] **Step 4.5: Open the PR via `gh pr create`**

Per the `reference_github_auth.md` memory rule, unset the shell's `GH_TOKEN` (which points at the wrong account) before invoking `gh`:

```bash
unset GH_TOKEN
set -a && source /Users/agbaber/marblehead/.env && set +a
gh pr create --repo agbaber/marblehead --base main --head ballot-overhaul \
  --title "Overhaul sample ballots: fill-in ovals on the right, not X-on-square" \
  --body "$(cat <<'EOF'
## Summary

Replaces the X-on-square clickable sample ballot rendering (shipped in #124 as `f2ecaaa`) with a fill-in-oval rendering that matches how real Massachusetts optical-scan ballots actually work. Ovals render on the right of each Yes/No label, clicking an oval fades the fill in over ~200ms, and every ballot block gains the verbatim "To vote, completely fill in the oval..." instruction plus a subtle diagonal SAMPLE watermark.

## Why this is a follow-up to #124

The shipped #124 feature modeled the wrong muscle memory. MA optical-scan ballots (confirmed via the Sandwich MA sample ballot for their May 2026 town election, 950 CMR 54, and the MA Secretary of the Commonwealth's optical-scan framework) use fill-in ovals on the right of each choice label. X marks on squares on the left is precisely what poll workers tell voters NOT to do — optical scanners may fail to register an X. The #124 feature, which was pitched as a "try it out" civic-literacy affordance, was actively teaching the wrong gesture.

The bigger root issue: the site's existing sample ballots (which predated #124) were square-shaped and left-positioned from the start. The #124 feature inherited those errors and compounded them with the wrong animation. This PR fixes all three dimensions (shape, position, mark gesture) in a single overhaul.

## Design + plan

- [Design spec](docs/superpowers/specs/2026-04-12-clickable-sample-ballots-overhaul-design.md)
- [Implementation plan](docs/superpowers/plans/2026-04-12-clickable-sample-ballots-overhaul-implementation.md)
- The original [2026-04-11 X-on-square spec](docs/superpowers/specs/2026-04-11-clickable-sample-ballots-design.md) and [plan](docs/superpowers/plans/2026-04-11-clickable-sample-ballots-implementation.md) are preserved as historical record.

## What changed

- `assets/site.css` — new `.ballot-oval` button rules, new `.ballot-oval-fill` SVG fill-opacity animation, updated `.ballot-instructions` for nested `<p>` children (gesture + strategy variants), new `.ballot-choice-label`, new `.ballot::after` SAMPLE watermark. Dead `.ballot-box*` rules deleted.
- `question-2-trash.html` — Q2 ballot gets a new `.ballot-instructions` gesture block; both ballot-choices rewritten with label-before-button source order and `.ballot-oval` markup.
- `what-is-the-override.html` — Q1 instructions become a two-paragraph wrapper (gesture + strategy preserved); Q2 gets a new gesture-only instructions block; all 8 ballot-choices across the 4 rows rewritten.
- `assets/ballot.js` — two selector literals renamed from `.ballot-box` to `.ballot-oval`, comment block rewritten.

## Manual verification (no local dev server available)

Static checks I ran locally: JS parses (`node --check`), zero `ballot-box` references remain in live code, exactly 10 `.ballot-oval` buttons, exactly 3 gesture paragraphs, exactly 1 strategy paragraph, CSS selectors align with markup.

What I need you to confirm on the deploy preview or after merge:

- [ ] Ovals render to the **right** of the "Yes"/"No" label on every row (Q1A, Q1B, Q1C on the override page, Q2 on both pages)
- [ ] Clicking an oval smoothly fades the fill in over ~200ms
- [ ] Clicking an already-filled oval fades it back out
- [ ] Clicking the sibling switches (previously filled one fades out while the clicked one fades in)
- [ ] Clicking the "Yes"/"No" label text (not the oval itself) still marks the adjacent oval — mobile tap target
- [ ] Q1 rows are independent (marking Q1A does not affect Q1B or Q1C)
- [ ] Tab through the ballots with the keyboard — focus ring visible, Enter and Space both toggle
- [ ] "TO VOTE, completely fill in the oval…" instruction visible on every sample ballot, above the first row
- [ ] Q1's "you may vote YES on more than one" strategy instruction still visible underneath the gesture instruction
- [ ] SAMPLE watermark visible diagonally across each ballot, subtle enough not to compete with content
- [ ] `prefers-reduced-motion: reduce` disables the fade (marks snap in/out instantly)
- [ ] Dark mode: fill is visible against the dark background
- [ ] JS disabled: ballot still renders as static empty ovals on the right of each label

Items with question marks to confirm rather than assume:

- [ ] Oval proportions (22px x 14px) look right vs. a wider or taller oval
- [ ] SAMPLE watermark opacity (5% navy) is tuned appropriately — too subtle / too loud / just right
- [ ] Instruction background color tint (6% buoy blue) harmonizes with the ballot header above it

## Test plan

All the checkboxes above. If any fails, I iterate before merge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected output: a URL like `https://github.com/agbaber/marblehead/pull/NNN`.

- [ ] **Step 4.6: Report the PR URL**

The PR URL from step 4.5 is the final deliverable of the plan. Report it back to Andrew so he can click through the rendered output.

---

## Post-implementation

The overhaul is a visible user-facing change that cannot be runtime-verified from this session (no local Jekyll dev server — see `project_no_local_dev_server.md`). After the PR is open, Andrew clicks through the deploy preview or waits for the GitHub Pages build after merge, then either:

1. **Merges** via `gh pr merge <num> --repo agbaber/marblehead --squash --delete-branch` from the parent worktree (per `feedback_gh_pr_merge_from_worktree.md`), then the local worktree at `.worktrees/ballot-overhaul` should be removed via `git worktree remove` and the local branch deleted.
2. **Requests fixes** if any verification step fails, in which case the agent iterates in the same worktree and pushes follow-up commits to the same branch.

---

## Self-review (performed when writing this plan)

- **Spec coverage:** Every section of the design spec maps to a task:
  - Markup change (label-before-button source order, `.ballot-oval` buttons) → Task 2 steps 2.4–2.6
  - New ballot-level instruction blocks (gesture + strategy) → Task 2 steps 2.1–2.3
  - CSS: oval button rules, fill animation, instruction styling, watermark → Task 1
  - JS selector rename → Task 3 steps 3.2–3.4
  - Dead CSS cleanup → Task 3 step 3.6
  - Graceful degradation (JS disabled still renders empty ovals) → inherited from Task 1 base `.ballot-oval` rule, no separate task needed
  - Accessibility (aria-pressed, focus ring, reduced-motion) → Task 1 (CSS) + Task 2 (markup keeps aria-labels)
  - Mobile tap target via `.ballot-choice` click delegation → inherited from existing `ballot.js` logic, no change needed
  - Verification plan → Task 4 static checks + PR manual checklist

- **Placeholder scan:** No TBD, TODO, "similar to task N", or steps without concrete code. Every CSS block, HTML snippet, and command is literal.

- **Type consistency:** Class names are consistent throughout: `.ballot-oval`, `.ballot-oval-fill`, `.ballot-oval-fill ellipse`, `.ballot-choice-label`, `.ballot-instructions-gesture`, `.ballot-instructions-strategy`, `.ballot-instructions-example`. The JS `box` variable name is kept (internal identifier, renaming adds churn).

- **Scope:** Appropriate for a single implementation plan. 4 tasks, ~50 lines of new CSS, ~40 lines of dead CSS deleted, 10 HTML markup conversions, 4 JS edits (comment block + 3 selector literals). Small and well-contained.
