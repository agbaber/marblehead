# Meeting Digest email template

The digest worker (meeting-digest/worker/src/scheduled.js) builds the
body from recent MHTV transcripts matched to each subscriber's
boards and topics. This template covers the editorial shape that
wraps those matches.

## Structure

1. Subject. One line, lead with the most concrete finding from the
   week. "Select Board: Q1 FY27 spending is tracking 3% under budget"
   not "Marblehead Data weekly digest". Subject is what gets opened.
2. Lead finding (one short paragraph). The watchdog headline of the
   week. Specific number or decision, not "things happened".
3. Per-board sections (auto-generated). One sub-section per board
   the subscriber follows, with transcript-matched bullets.
4. Sidebar (optional, one item). Tool feature or civic literacy
   piece. Two sentences. Link to the page.
5. Footer (unchanged from existing worker output): unsubscribe,
   manage preferences, source attribution.

## Editorial rules

- Lead finding has a number in it whenever possible.
- Acronyms expanded on first use: "Annual Comprehensive Financial
  Report (ACFR)" not "ACFR".
- No editorial language. Say "the budget is X dollars over the FY26
  baseline", not "the budget jumped to X" or "budget surges to X".
- Source attribution inline. "From the FY27 adopted budget" or
  "From the June 3 Select Board meeting".
- Plain language, but full sentences. Email tolerates a longer
  attention span than a Facebook post.

## Summer mode

July and August: send every other Monday, not weekly. Skip the
intermediate Mondays. Human discretion: if there is nothing
substantive to report that week, skip; if there is, send.

There is no code-level summer toggle. The user decides per send.

## When the lead finding is thin

Late summer or holiday weeks may not have a watchdog lead. In that
case, lead with a civic literacy piece or a tool feature, and label
the email accordingly ("Marblehead Data: how free cash works" not
"weekly digest"). Subscribers tolerate fewer "nothing happened this
week" emails than they tolerate substantive non-watchdog ones.
