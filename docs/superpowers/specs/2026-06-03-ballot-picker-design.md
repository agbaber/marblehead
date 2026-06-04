# Sample-ballot picker for where-candidates-stand.html

Date: 2026-06-03
Status: approved, ready to build

## Goal

Let a reader pick their candidates in the six contested June 9 races on
`where-candidates-stand.html`, then keep their choices: a private,
screenshot-ready "my sample ballot" summary, with an opt-in shareable
"Wrapped"-style picks card. Fully client-side. No backend, no PII.

Sign-up (email/reminder) is explicitly deferred to a later phase.

## Decisions

- **Scope:** candidates only, the six contested races on this page. The four
  ballot questions stay on the existing practice ballot in
  `whats-on-the-ballot.html`; the summary links to it.
- **Privacy:** picks live in `localStorage` only. Nothing leaves the browser
  unless the user taps the opt-in share.
- **Neutrality:** selection uses the navy/teal page accent (not green/red).
  The generic community-pulse save/share/reaction widgets are turned off on
  this page (`community_pulse: "off-sections"`) so race sections carry no
  reaction-count scoreboard.
- **No calendar reminder** (dropped from scope).

## UX

1. Each candidate row gets a JS-injected select control (progressive
   enhancement; no-JS readers see the page unchanged). Tap to select/deselect.
2. Per-race cap = the real ballot rule ("vote for not more than N"): Select
   Board 2, Recreation & Park 5, the other four races 1. Selecting past the
   cap bumps the earliest pick. A "N of M selected" counter shows on capped
   races.
3. Slim sticky progress bar: "k of 6 races chosen" + thin fill + a
   "View my ballot" button (always available, partial ballots allowed).
4. Summary (default, private): "My June 9 sample ballot" card listing each
   race and the picks. Affordances: Copy as text, Clear, link to the
   question practice ballot. Screenshot-ready on its own.
5. Opt-in "Share my picks": generates a Wrapped-style PNG including the
   picks, shared via the Web Share API (file), with a PNG-download +
   copy-text fallback. Minimal branding; footer reads
   "marbleheaddata.org - my sample ballot, not an endorsement".

## Build

- `assets/ballot-picker.js` (new), loaded via a new `ballot-picker` gate in
  `_includes/head.html` and the page's `scripts:` frontmatter.
- Picker CSS in the page's `<style>` block (page-specific).
- Share image rendered dependency-free by hand-drawing to a `<canvas>`
  (picks are short text; no html2canvas/library).
- Data hooks: `data-race` + `data-max` on each `.race`, `data-candidate` on
  each `.cand`. All interactive UI is JS-created and styled to match the
  recent pages.

## Out of scope (later)

- Email sign-up / vote reminder (separate infra + privacy-policy design).
- Including the four ballot questions in this tool.
