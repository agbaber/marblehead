# Surface `where-candidates-stand` on the homepage and top nav

**Date:** 2026-06-06
**Status:** approved (design)
**Election context:** Annual Town Election is **Tuesday, June 9, 2026** — three days from this spec.

## Why

`where-candidates-stand.html` shipped in PRs #789/#790 with positions for six contested races plus a sample-ballot picker. It is the most timely page on the site right now, and it is not linked from the homepage at all today. Only `whats-on-the-ballot.html` is featured in nav (as "Ballot"); a first-time visitor has no path from the front door to the candidate guide.

This spec covers two surgical changes — a 4th top-nav link and a single new homepage scroll-stop — that surface the page during the election week without restructuring the rest of the front page. Both changes are easy to revert after June 9.

Scope is intentionally narrow: only `where-candidates-stand` is surfaced. `what-can-we-do` and the meeting-transcripts hub are out of scope and may be addressed separately later.

## Change 1 — top nav: add a "Candidates" link

Edit `_includes/nav.html`. Insert one new `<a class="nav-link">` between the existing **Ballot** and **Questions** links, mirroring the existing pattern (relative URL + `aria-current="page"` guard on `/where-candidates-stand.html`).

Resulting nav order: `Ballot · Candidates · Questions · Browse · [search] · [theme]`.

### Mobile considerations

The nav row gains one link. Spot-check at 375px (iPhone SE width) that the brand wordmark, four nav links, and two icon buttons still fit without wrapping or truncation. If anything overflows:

- Acceptable fix: drop the " MHD Data" wordmark next to the favicon at narrow widths (the favicon itself stays as the brand mark).
- Not acceptable: hide any nav link behind a hamburger that doesn't exist today — that's a bigger nav restructure than this spec covers.

### Revert path

Delete the one line. No other files reference the new link.

## Change 2 — homepage: new scroll-stop after the Ballot stop

Edit `index.html`. Insert a new `<section class="home-stop">` between the existing `#ballot` stop (ends ~line 628) and the existing `#fails` stop (starts ~line 630).

### Tint

**Not tinted.** Do not add `home-stop--tinted`. This breaks strict alternation (we'll have two non-tinted stops in a row — candidates and fails), which is an accepted tradeoff. Re-flipping tints downstream of the insertion is rejected to minimize diff and to keep the post-election revert trivial.

### Structure

Follows the existing scroll-stop pattern used by `#ballot` and `#deficit`:

1. **Eyebrow label** (`.home-eye`): `JUNE 9 BALLOT · WHO'S RUNNING`
2. **Big number** (`.home-big`, no color modifier): `6 contested races / 18 candidates`
   - The "/" separator uses the same inline `<span style="color:var(--text-muted); font-weight:500;">` treatment the existing ballot stop uses for "4 questions / 3 override tiers".
3. **Caption** (`.home-cap`): one sentence naming the six bodies (Select Board, School Committee, Moderator, Recreation & Park, Cemetery, Housing Authority) and noting all six have more candidates than seats.
4. **Race list** (`.race-list`, new class): six rows, one per contested race. Each row shows the body name on the left and "N for M seats" on the right, with a faint bottom divider. Patterned after the existing `.driver-list` styling on the deficit stop (label + amount columns with hairline rule between rows), but lighter — no bar chart, just two columns of text.
5. **Deep-link** (`.home-deeper`): "→ Candidate positions and sample-ballot picker" → `where-candidates-stand.html`.

### Race-list rows (authoritative)

Counts and seat tallies are pulled directly from the `race-meta` lines in `where-candidates-stand.html` (lines 577, 624, 671, 703, 785, 818):

| Body | Candidates | Seats |
| --- | --- | --- |
| Select Board | 3 | 2 |
| School Committee | 3 | 2 |
| Moderator | 2 | 1 |
| Recreation & Park Commission | 6 | 5 |
| Cemetery Commission | 2 | 1 |
| Housing Authority | 2 | 1 |

Total candidates = 18; total contested races = 6. These two numbers go in the big-number line; the table above goes in the list.

### CSS

Add a scoped `.race-list` block at the top of `index.html`'s `<style>` section, near the existing `.driver-list` rules. Two columns (body name left, seat-count right), faint bottom border per row, no border on `:last-child`. Tabular numerals on the right column. Reuses existing tokens (`var(--text)`, `var(--text-muted)`, etc.); no new CSS variables.

No JavaScript is added by this section. The existing countdown and cost-slider scripts are untouched.

### Editorial guardrail

Headline copy is factual logistics ("6 contested races / 18 candidates"). No editorial framing of which candidates favor or oppose the override — that's on the candidates page itself. This matches the project rule in `STYLE_GUIDE.md` to state facts in captions, not conclusions.

### Revert path

Delete the new `<section>` (~25 lines of markup) and the `.race-list` CSS block. No downstream references.

## What this spec does *not* do

- Does not surface `what-can-we-do.html` or `meetings.html` on the homepage.
- Does not change the "Data and tools" grid at the bottom of the homepage.
- Does not change other tinted-stop ordering (the two-non-tinted run with `#fails` is accepted).
- Does not add a mobile hamburger or restructure nav layout.
- Does not modify the candidates page itself.

## Verification

Per project Definition of Done, this is a UI change and requires a Playwright screenshot in `proof/<branch-name>.png` before the PR is marked ready. Capture at `1440x900` with `--device-scale-factor=2`, no `--full-page` (above-the-fold view of the homepage showing nav + at least the new scroll-stop). Also run `tests/nav-test.mjs` (Chromium + WebKit) per the project rule on nav/layout CSS changes.

Smoke test (`npm run test:local`) should remain at 52/0.
