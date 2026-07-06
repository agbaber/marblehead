# Override tracker dashboard design (phase A)

Date: 2026-07-05. Status: approved in session, building.
Follow-up to the data-driven refactor (#968) and trim (#977).

## Problem

28 identical cards in five identical sections, no visuals, no sense of
time. The page's promise (statuses change as the boards deliver) is
invisible until you read every card.

## Changes

1. **Scoreboard band** under the hero. A single stacked horizontal bar,
   segment widths computed by Liquid from
   `site.data.override_tracker.items` grouped by status, with large
   count numerals above ("20 pending / 6 phase-in / 2 standing"; met
   and dropped appear when nonzero). Colors are navy-scale shades
   consistent with the status pills; no green/red. Because it renders
   from the YAML, every status change moves the bar with no page edit.

2. **Checkpoint strip.** Static SVG timeline, Jul 2026 to Jun 2030
   (same visual language as /labor-contracts.html): now; Oct 2026 first
   quarterly review; Dec 2027 teacher successor talks open; Jun 2029
   phase-in complete (FY29); Jun 2030 MOU no-new-override pledge ends.
   Chart classes from STYLE_GUIDE, no inline SVG styles.

3. **Cards become expandable rows.** `_includes/tracker-card.html` is
   replaced by a `<details class="tk-row">` include: the summary line
   is number + title + status pill; body and source render inside.
   Native disclosure, no JS. Sections keep their headers and leads.

4. Unchanged: hero copy, Section F, quarterly changelog, notes block,
   YAML schema.

## Phase B (later, with adopted FY27 line items)

The $15M phase-in money chart (FY27-FY29 stacking of the $6.5M town /
$8.5M schools / $1M capital buckets) joins the dashboard as part of the
dollar-reconciliation work.

## Testing

Jekyll build renders 28 rows; counts in the scoreboard sum to 28;
`npm run test:local` 118+; Playwright eyeball in light/dark/mobile.
