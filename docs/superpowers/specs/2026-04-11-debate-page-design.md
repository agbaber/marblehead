# The override debate page — design

**Date:** 2026-04-11
**Owner:** Andrew Baber
**Status:** Approved, ready for implementation plan

## Purpose

Add a new page to marbleheaddata.org that presents the strongest version of both sides of the FY27 override debate, as a tool for readers (and the author) who are still deciding how to vote. The page is explicitly not a recommendation or a summary; it is a map of where the real disagreements are.

The author has disclosed on `about.html` that he is genuinely undecided. This page is the place he (and any other undecided reader) works through both sides in parallel.

## Approach

**Steelmanning both sides.** Each side's case is presented in the voice its proponents would use, with the strongest version of its arguments, without inflating marginal claims or strawmanning the opposition. The goal is that a Marblehead resident holding either view would read their side and say "yes, that is my argument."

**Mirror structure.** The two essays address the same five tensions in the same order, so the synthesis at the end has a spine to work against and the reader can compare positions point by point.

**Composite voice with primary-source quotes where available.** Each side is written as a synthesized argument, not a transcript of specific individuals. Where a primary-source quote sharpens a point and has been verified (per the site's quote-attribution rule), it is embedded inline in the relevant block. Blocks without quotes run as prose only — no placeholders visible to readers.

## Page architecture

- **File:** `/the-debate.html` at site root
- **URL:** `marbleheaddata.org/the-debate.html`
- **Title:** "The override debate, both sides"
- **Not in top nav** (nav is already 6 items dense)
- **Linked from index** via a new featured card above the three section grids
- **Inbound links** from `about`, `how-we-got-here`, `why-not-elsewhere`, `what-fails`, `what-is-the-override` — added in a second commit after the page is settled

## Content spine

### TL;DR (top of page)

Two `.perspective` blocks, ~75 words each, same length and structure. One for each side.

### Five tensions (body)

For each tension: a 1-2 sentence framing question, a `.perspective--supporter` block (120-180 words), a `.perspective--skeptic` block (120-180 words), a `.mini-synthesis` block (1-2 sentences on the crux of disagreement).

1. **Where does the cost pressure come from?** External (exogenous cost drivers) vs. internal (policy choices the town made and keeps making).
2. **Are the proposed reductions damage or discipline?** Service hollowing-out vs. long-overdue correction to accumulated growth.
3. **Is this a one-time reset or the start of annual asks?** Multi-year stability from the tier structure vs. cost drivers that don't pause when the override passes.
4. **Do meaningful alternatives exist?** Structural constraints (95.5% residential, no new growth) vs. alternatives that haven't been seriously tried.
5. **Can we trust the people asking?** FinCom's documented 16-year record of restraint vs. Select Board culture of above-inflation growth without course correction.

### Closing synthesis

Bulleted 5-point summary of the mini-syntheses, followed by a single closing paragraph naming the honest conclusion: the data on this site supports both readings, and the vote is about which reading feels more accurate. The closing paragraph is added in a second commit, after the tensions are settled.

## Component design

### `.perspective` (new, inline in page `<style>`)

The core block. One per side per tension. Left-border accent (3px), subtle background tint via `color-mix`, rounded right corners. Supporter uses `--c-teal` (harbor teal), skeptic uses `--c-brass` (brass). Deliberately not red/green — those carry a right/wrong connotation.

Contains:
- `.perspective-label` — small uppercase letter-spaced label ("OVERRIDE-SUPPORTER READING" or "SKEPTIC READING")
- Flowing paragraph(s) of the argument
- Optional `.perspective-quote` (blockquote) for embedded primary-source quotes

### `.mini-synthesis` (new, inline)

Quieter than either perspective block. No accent color, just a top border in `--divider`, slightly smaller text, intentionally understated. Reads as meta-commentary, not a third position.

### `.featured-card` (new, added to `assets/site.css`)

A new card component for the home page, larger and visually distinct from the existing question cards. Spans the full width of the question grid. Used once, above the three section grids, pointing to the debate page.

## Visual and UX decisions

- Dark mode works via CSS custom property tokens; no extra work
- No sticky "jump to tension" sidebar, no accordions, no interactivity — the page is a continuous read
- No icons, illustrations, or featured-quote banners — type-first, matching site voice
- Mobile: blocks stack naturally since each is already full-width

## Drafting approach

**Phase 1 (first live commit):**
- Draft all 5 tensions + TL;DR in one pass
- Ship without the closing paragraph and without back-links from the four existing pages
- Quotes embedded only where a primary source has been verified; quote-pending blocks run as prose
- Build the HTML, inline CSS, and test locally desktop + mobile
- Commit: new `the-debate.html` + `.featured-card` addition to `assets/site.css` + featured card on `index.html`

**Phase 2 (iteration):**
- User reviews each tension live using the test: "Would a Marblehead resident holding this view read this as fair?"
- Redraft per-tension based on feedback
- Add closing synthesis paragraph once the five tensions are settled
- Add back-links from `about`, `how-we-got-here`, `why-not-elsewhere`, `what-fails`, `what-is-the-override`
- Add quotes as primary sources become available

**Discipline to reduce bias:** Draft the skeptic case first for each tension. Writing the harder side first forces it to actually work before comparing to the easier one.

## Out of scope

- Never-override ideological bloc (named once in the intro as a boundary condition, but not engaged argumentatively)
- Author-view disclosure (already handled by `about.html`)
- Senior-burden framing (handled on `senior-tax-relief.html`)
- Melrose/Stoneham deep narrative (handled in `case_studies.md` and `what-fails.html`; debate page refers to these without duplicating)
- Historical FinCom transmittal arc (handled fully on `how-we-got-here.html`; debate page refers without duplicating)

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Author unconsciously steelmans one side and weak-mans the other | Draft skeptic first discipline; post-publish gut-check from author on each tension |
| Primary-source quotes for the skeptic side may be harder to find than for the supporter side, creating visual asymmetry | Blocks without quotes run as prose — no placeholder boxes. Asymmetric quote density is acceptable as long as the argument is equally strong. |
| The closing paragraph ("data supports both readings") may read as cop-out | Defer to phase 2 so it's written only after the two cases have been tested and settled |
| Index featured card promotes the debate page above the existing cards, which could read as "this is the most important page" | That is the intent. For undecided voters it *is* the most useful page. For decided voters, it is ignorable. |

## Success criteria

- A Marblehead resident holding the override-supporter view reads the supporter case and says "yes, that is my argument, fairly represented"
- A Marblehead resident holding the skeptic view reads the skeptic case and says the same
- An undecided reader comes away with a clearer sense of where the real disagreements are, not a recommendation on how to vote
- The page does not duplicate content that lives on `how-we-got-here`, `what-fails`, `why-not-elsewhere`, or `what-is-the-override`; it complements them

## Implementation note

Implementation plan to be written via the `writing-plans` skill as the next step.
