# Override capacity vs. draw: surfacing the levy-limit distinction

**Date:** 2026-06-02
**Status:** Design / spec
**Page(s):** `what-is-the-override.html`, `two-votes.html`
**Source of truth:** April 8, 2026 Town Administrator override presentation
(`source-archive-v1/2026-04-08_Override_Presentation.pdf`); per-tier draw
schedule in `data/override_draws_schedule.csv`.

## Problem

A resident raised, in essence: a $15M override raises the levy limit by the
full $15M in year one, and from year two the town can assess that full base
plus the normal 2.5% Proposition 2&frac12; growth, even though it only plans
to *spend* a fraction during the three-year phase-in. The only thing holding
the line is the town's promise (the MOU), not the law.

That is correct. The ballot questions are worded to assess the full amount in
FY27:

> "Shall the Town of Marblehead be allowed to assess an additional
> **$15,000,000** in real estate and personal property taxes ... for the
> fiscal year beginning July 1, 2026?" (Question 1A; 1B = $12M, 1C = $9M)

An operating override permanently raises the **levy limit** by the voted
amount, effective the fiscal year named. A town may then **under-levy** (assess
less than the limit); in Massachusetts the unused difference is **excess levy
capacity** that stays in the limit and compounds at 2.5%/yr. It is not clawed
back for under-levying.

The site currently describes only the **draw** (spending) side and frames the
phase-in as if the *override itself* is not fully real until FY29:

- `what-is-the-override.html`: "the full override is **active** only in Year 3";
  `.phase-chart-caption`: "Cumulative override levy **active** in each fiscal
  year".
- `two-votes.html`: "the dollar figure on the warrant is the Tier 3 **first-year
  draw** ... not the full $15M override amount".

Both are true of *spending* but read as if the *capacity* (the levy limit) is
not raised in full in year one. That is exactly the distinction the resident
says is not told to the public, and the site inadvertently reinforces the
omission.

## Goal

Surface the **levy limit (capacity)** vs. **actual levy (the draw)** distinction
honestly and neutrally, without implying the town is concealing money. State
the legal mechanic, show the gap, and steelman the town's side (the MOU directs
overages and the year-one constraint is real).

Non-goals: no change to the calculator math (already correct), no longer-horizon
"compounds forever" chart (editorially risky; the whole levy grows 2.5%/yr by
law regardless of any override), no advocacy framing.

## The visualization

**Title:** Authorized capacity vs. planned draw &mdash; Tier 3 ($15M override)

A small SVG column chart, one column per fiscal year (FY27, FY28, FY29), each
column rising to the **levy-limit ceiling** for that year. Solid fill = the
planned draw (what the MOU commits to assess); hatched segment above = unused
capacity (authorized but not drawn). A dashed line marks the ceiling.

Rendered as `<svg class="chart">` using the existing SVG chart classes (no
inline `style`/`fill`/`stroke` on SVG elements, per STYLE_GUIDE). Placed in the
**"What It Costs"** section of `what-is-the-override.html`, immediately after the
existing `.phase-chart` (the draw chart), as its companion. Visual family
matches the existing chart (same palette tokens, same FY headers).

### Data

Capacity = the override's incremental contribution to the levy limit: the full
override amount raised in FY27, then &times;1.025 per year. Draw = cumulative
planned draw from `data/override_draws_schedule.csv`
(`total_drawn_by_year_end`, Tier 3).

| FY   | Capacity (levy limit, $) | Planned draw ($) | Unused gap ($) |
|------|-------------------------:|-----------------:|---------------:|
| FY27 | 15,000,000               | 4,296,718        | 10,703,282     |
| FY28 | 15,375,000               | 10,537,365       | 4,837,635      |
| FY29 | 15,759,375               | 15,000,000       | 759,375        |

Derivations:
- FY28 capacity = 15,000,000 &times; 1.025 = 15,375,000.
- FY29 capacity = 15,375,000 &times; 1.025 = 15,759,375.
- Even at "full" phase-in (FY29) capacity is $15.76M, not $15M, because two
  years of 2.5% have compounded on the base. The FY29 gap ($0.76M) is that
  compounding overhang.

### Honesty guardrails (must appear in caption or adjacent prose)

1. The 2.5% growth is **not unique to the override**. The entire levy grows up
   to 2.5%/yr by state law (M.G.L. c.59 &sect;21C) with or without an override;
   the override only enlarges the base the 2.5% applies to. The chart isolates
   the override's incremental share of the limit for clarity, not because it is
   a separate tax.
2. **New growth is excluded** (~$460K/yr from new construction also raises the
   limit, outside the override). Keeping it out isolates the override effect.
3. **FY27 gap is held back by the appropriation rule** &mdash; the town cannot
   assess more than Town Meeting appropriates. **FY28+ gap is held back only by
   the MOU**, which is non-binding (changing it takes a two-thirds vote of the
   Select Board, School Committee, and Finance Committee together).
4. **MOU overage waterfall:** revenue above the draw caps goes first to the
   stabilization fund (5% target), then capital, then OPEB and pension. So the
   capacity is not unaccounted-for under the current commitment &mdash; but the
   commitment is a promise, not a statute.

### Proposed caption

> The levy limit rises by the full override amount in FY27; the draw is what the
> town commits to assess under the
> [MOU](what-is-the-override.html#mou-commitments). In FY27 the gap is held back
> by the appropriation rule (the town cannot assess more than Town Meeting
> appropriates). From FY28 on, the gap is held back only by the MOU, which is
> not binding: changing it takes a two-thirds vote of all three boards. Under
> the MOU, revenue above the draw caps goes first to stabilization, then
> capital, then pension and OPEB. The 2.5% growth shown is the same Proposition
> 2&frac12; growth the whole levy gets by law; new construction growth is
> excluded. Source: ballot questions and draw schedule, April 8, 2026 override
> presentation.

(External source becomes a `<sup class="cite">` footnote per the citations
runtime; the MOU link is an internal `<a href>`.)

## Text changes

### `what-is-the-override.html`, "What It Costs" section

1. Intro sentence: replace "Year 1 draws only a fraction of the full amount;
   the full override is **active** only in Year 3" with framing that the full
   **cost** phases in over three years while the levy **limit** is raised in
   full in year one, pointing to the new capacity chart.
2. `.phase-chart-caption`: change "Cumulative override levy **active** in each
   fiscal year" to language that names it as the **draw/spending** schedule, not
   capacity.
3. `.takeaway--neutral` box: keep the "you do not pay the full amount in year
   one" point (true of cost), but ensure nearby prose distinguishes cost from
   capacity so the two charts are not read as contradictory.
4. Keep the existing 2.5%-compounding paragraph ($899 vs $918); optionally add a
   one-clause pointer to the new chart.

### `two-votes.html`

Tighten the sentence at line ~82 so it distinguishes:
- the **ballot override amount** (full $15M / $12M / $9M, which raises the levy
  limit), from
- the **first-year appropriation/draw** (~$4.3M for Tier 3, what is actually
  spent and assessed in FY27).

Keep the existing citation to `override_draws_schedule.csv`.

## Build / review notes

- One worktree branch, one PR (`claude/override-capacity-vs-draw`).
- Watch the documented chart-layout traps on this site: label collisions,
  viewBox clipping, editorial labels. Verify on the Cloudflare PR preview at
  desktop and mobile before requesting review.
- Re-read `what-is-the-override.html` and `two-votes.html` from this branch
  before editing; targeted edits only, check `git diff --stat`.
- No em-dashes / en-dash-as-em-dash in copy. Neutral semantic colors only.

## Open items deferred to the plan

- Exact SVG geometry (viewBox, column widths, hatch pattern definition) and
  whether the ceiling/draw use existing series tokens or a neutral pair.
- Whether the new chart needs a short `<ul class="tldr">`-style legend or an
  inline keyed legend.
