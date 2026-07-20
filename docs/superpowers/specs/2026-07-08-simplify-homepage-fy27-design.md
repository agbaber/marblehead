---
title: Simplify the homepage for FY27
date: 2026-07-08
status: draft
---

# Simplify the homepage for FY27

## Why

The live homepage has grown to a stale-KPI hero plus ten tiles at equal
visual weight. The tiles mix two different kinds of thing — top-level
site sections (Primer, Checkbook, Data, Meetings, Act, Override,
Structure) and specific featured pieces (Tracker, School Buildings,
Group Insurance) — and there is no visual signal separating them. The
result is decision-paralysis: a first-time visitor scans ten tiles and
cannot tell what the site is *made of* versus what happens to be
promoted this week.

The hero KPI ("FY27 spending so far: $7.5M as of Jul 1") compounds the
problem. Seven days into a new fiscal year the number is arbitrary and
already stale before a visitor reads it, and it competes with the
tiles for the top-of-page attention that should belong to the site's
identity.

The goal is a homepage that immediately answers "what is this and
what's here." Not a magazine cover, not a dashboard. A map of the
site, with featured pieces clearly labelled as such.

## What changes

### 1. Replace the hero

Remove the KPI hero block entirely. The "$X.XM spending so far" number,
the caption, the sub-caption, and the "Open the Checkbook" button all
go.

In its place: a plain identity block.

- **H1:** "Marblehead Budget Data"
- **Tagline:** "Open data on the town's and schools' finances.
  Spending, debt, meetings, and how to take part."

No stats. No CTA button. Vertical rhythm matches the current
`.home-hero` padding so the transition to the tinted tile block below
feels the same.

### 2. Split the tile grid into two labelled rows

Same tile styling as today. Two visual groups separated by a small
divider heading.

**Row 1 — Sections (7 tiles):**

| tile | eyebrow | destination |
|---|---|---|
| How Marblehead's budget works | PRIMER | `/marblehead-101/` |
| What the town is spending | CHECKBOOK | `/checkbook/` |
| Charts, tables, and source documents | DATA | `/data/` |
| What the boards are actually talking about | MEETINGS | `/meetings/` |
| Questions worth asking | ACT | `/what-can-we-do.html` |
| What passed on June 9 | 2026 OVERRIDE | `/2026-override/` |
| Who runs Marblehead? | STRUCTURE | `/org-chart` |

At the 3-column desktop breakpoint this is 3 + 3 + 1. The Structure
tile sits alone on the third row. Verified in the mock — the negative
space reads as intentional; no CSS change needed.

**Row 2 — Notable pieces (3 tiles):**

Preceded by a small divider heading:

```
NOTABLE PIECES  ────────────────────────────
```

| tile | eyebrow | destination |
|---|---|---|
| Is the override delivering? | TRACKER | `/override-tracker.html` |
| What's getting fixed at the schools? | SCHOOL BUILDINGS | `/school-building-maintenance.html` |
| 11 years, $28M, one budget line | GROUP INSURANCE | `/the-insurance-surplus.html` |

Three tiles = one clean row at desktop.

Tile copy is unchanged from live. The eyebrow labels are unchanged.
The only thing new here is the divider heading and the reordering.

### 3. Add the divider heading style

New style block scoped to the homepage:

```css
.home-divider {
  margin: 40px 0 18px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.home-divider h2 {
  font-family: 'Libre Franklin', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin: 0;
}
.home-divider .rule {
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--c-navy) 12%, transparent);
}
```

Markup:

```html
<div class="home-divider">
  <h2>Notable pieces</h2>
  <span class="rule"></span>
</div>
```

Sits between the two `.home-tiles` grids, inside the same
`.home-stop.home-stop--tinted` band so the background continues.

## What does not change

- Site nav (`_includes/nav.html`) — untouched
- Footer — untouched
- Tile CSS (`.home-tile`, `.home-tiles`) — untouched
- Tile copy — untouched
- Tile destinations — unchanged
- `_data/checkbook.json` — no longer referenced by the homepage but
  still consumed by the checkbook page and other tools, so no data
  changes
- Watermark lighthouse SVG background — untouched
- Meta tags (`og_*`, `title`) — untouched

The hero-block CSS (`.home-hero`, `.home-eye`, `.home-big`,
`.home-cap`, `.home-cap-sub`, `.home-deeper`) becomes dead code on
`index.html`. Delete the classes from `index.html`'s `<style>` block
so the file stays honest.

## Success looks like

- A first-time visitor lands on the page and can say what the site is
  in one sentence within 3 seconds of looking at it.
- The section tiles read as "here's the site" and the notable-pieces
  tiles read as "and here are three specific investigations."
- No number on the homepage is ever more than a day stale, because
  there are no live numbers on the homepage.
- The homepage no longer needs to be refreshed each time
  `_data/checkbook.json` updates.

## Non-goals

- Redesigning tile styling
- Rewriting tile copy
- Adding search, activity feed, or other new patterns (explicitly
  ruled out during brainstorming — those are separate future
  experiments)
- Changing the nav
- Removing tiles beyond the ones already promoted from Structure

## Testing

- `npm run test:local` — Playwright smoke suite must still pass.
- Manual: load `/` at desktop (1440), tablet (768), and mobile (400)
  widths in Chromium and WebKit. Verify:
  - Identity block reads cleanly at all three widths
  - Section tiles wrap: 3 cols → 2 cols → 1 col
  - Divider heading stays legible when the rule wraps to a narrow
    width
  - No layout shift when the tinted band starts
- Screenshot proof committed to `proof/simplify-homepage-fy27.png`
  before opening the PR.

## Rollout

Single PR that:

1. Rewrites `index.html`:
   - Replaces hero with identity block
   - Reorders tiles: 7 section tiles first, then divider heading, then
     3 notable-piece tiles
   - Removes dead hero CSS from the `<style>` block
   - Adds `.home-divider` CSS
2. Adds a Playwright screenshot to `proof/`
3. PR body links the Cloudflare Pages preview URL (once available)
   and lists the paths to review: `/`, plus a quick check that
   `/checkbook/`, `/data/`, `/marblehead-101/` etc. all still resolve
   from the new tiles.
