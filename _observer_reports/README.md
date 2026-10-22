# LWV Observer Reports

Meeting summaries written by the **League of Women Voters of Marblehead
Observer Corps** and published as public PDFs at
[my.lwv.org/massachusetts/marblehead/observer-reports](https://my.lwv.org/massachusetts/marblehead/observer-reports).

286 reports across 15 town boards, one markdown file per report
(`<board>-<YYYY-MM-DD>.md`), with faithful `pdftotext -layout` body and
minimal frontmatter (board, date, observer, source URLs). No LLM
enrichment &ndash; the text is the volunteer observer's own summary.

## Why this exists

Most of these boards **never appear on MHTV video**, so the transcript
corpus in `_transcripts/` (Select Board, Board of Health, School
Committee, Finance Committee, Town Meeting) cannot cover them. These
observer reports are the only searchable record for the untelevised
boards &ndash; Recreation & Parks, Harbors & Waters, Municipal Light Board,
Housing Authority, Conservation, Planning, and others.

## Important caveats

- These are **summaries, not verbatim transcripts.** Good for "what was
  discussed / what the board decided," not for exact official quotes. For
  quotes, use the video transcripts or official town minutes.
- Coverage is uneven. Some boards run current (Rec & Parks and Light
  Board through 2026); others lapsed &ndash; **Harbors & Waters stops
  Jan 2024**, Conservation and Planning end in 2022.
- Not built by Jekyll (this directory is not a registered collection), so
  it adds no pages to the site; it is a searchable data archive.

## Regenerate

```
node scripts/observer_reports/pull_lwv.mjs
```

Re-downloads every report and rewrites this directory. See
`_manifest.json` for the full report index (board, date, observer,
source PDF URL).
