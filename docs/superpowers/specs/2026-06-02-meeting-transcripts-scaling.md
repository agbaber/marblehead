# Design: scaling meeting transcripts beyond the POC

**Status:** draft, awaiting review
**Date:** 2026-06-02
**Author:** Andrew Baber + Claude
**Builds on:** [2026-05-08-meeting-transcripts-design.md](2026-05-08-meeting-transcripts-design.md) (PR #754, Phase 1 UI scaffolding)

## What's shipped after PR #754

- Newspaper-style transcript layout (`_layouts/transcript.html`) with lead story card, secondary article grid, reference disclosures, and full-transcript body
- Two real-data POCs in `_transcripts/`:
  - `select-board-2026-04-08.md` &mdash; 177-min meeting, override-tier debate, MOU preview, full warrant
  - `school-committee-2026-04-09.md` &mdash; ~180-min meeting, mostly routine business, plus budget vote and override endorsement
- One boring-layout comparison view at `/meetings/select-board-2026-04-08-boring/`
- Schema for `summary_card`, `topic_segments[]` (with `headline`, `dek`, `featured`, `start_seconds`, markdown `summary`, `key_speakers`), and `associated_documents[]`

Both POCs were authored by hand: Claude read the transcript directly and wrote the YAML. **There is no pipeline yet.**

## Goal

Cover every public Marblehead board / committee meeting that matters &mdash; reliably, sustainably, with a per-meeting cost low enough that the project can keep running without further sponsorship &mdash; and answer the "or maybe just some based on minutes?" tradeoff explicitly.

## The two scaling dimensions

| | Today | Scaled |
|---|---|---|
| **Authorship** | Claude reads transcript and writes YAML in a session | LLM does both steps unattended; human reviews PR |
| **Source feed** | Two transcripts on disk; SC video lives on YouTube not Vimeo | Multi-source ingest: MHTV Vimeo + MPS YouTube channel |
| **Coverage** | 2 meetings | ~6-8 meetings/month at peak (warrant + budget season); ~4-5/month off-season |

## Decision: which meetings get the full treatment

**Default: the 5 boards that drive policy.** Skip everything else automatically. Hand-promote individual meetings when something newsworthy actually happens at a non-default board.

### Default coverage (automated pipeline)

- **Select Board** &mdash; ~36/year (every other Wednesday)
- **School Committee** &mdash; ~24/year
- **Finance Committee** &mdash; ~20/year peak, ~12/year off-season
- **Town Meeting** &mdash; 2/year (annual + special)
- **Board of Health** &mdash; ~10/year (all of them; the substantive-vs-routine split is too noisy to automate, and the volume is small enough that overinclusion is cheap)

Total: **~90 meetings/year** covered by the automated nightly pipeline.

### Skipped by default

- **Planning Board, ZBA, Conservation Commission, Recreation & Parks Commission** &mdash; case-by-case procedural meetings. "Approved a setback variance at 47 Atlantic Ave" is not a story; the format ("headlines you can skim and pick from") adds nothing over the PDF minutes the town already publishes. **~120 meetings/year skipped.**
- **Subcommittees, joint working sessions, school-building-committee technical meetings** &mdash; not in the `_transcripts/` collection at all. They appear in `data/meetings.json` (the chronological video index) but get no summary page. **~200 meetings/year skipped.**

### Hand promotion when a skipped meeting matters

When an agenda at one of the skipped boards hits a real story (a 40B project at Planning Board, an MBTA 3A enforcement action, a big-money capital decision), an editor writes a one-off transcript file the same way the Select Board 4/8 and School Committee 4/9 POCs in PR #754 were written: read the video, write the YAML, open a PR. Takes ~20 min.

This matches how news organizations cover government: not the ZBA's calendar, but the ZBA meeting where something newsworthy happens.

Expected volume: **~5-10 hand-promoted meetings/year**, concentrated in spring (warrant + planning-board MBTA cycles).

### Why this isn't a three-tier system

An earlier draft proposed Tier A (full transcript, the 5 boards), Tier B (summary-from-PDF for procedural boards), and Tier C (index row only for subcommittees). The Tier B layer was cargo-culted: there's no evidence any resident wants systematic Planning Board summaries, and publishing them dilutes the signal on `/meetings/` &mdash; a reader who can skim 8 routine Planning Board cards a month stops trusting the Select Board card next to them. If demand for Planning Board coverage emerges later, adding it back is a few lines of config. Until then, skipping is the editorial choice.

### How the board list lives in code

Hardcoded list in `scripts/transcripts/lib/config.mjs`:

```js
export const DEFAULT_BOARDS = [
  'Marblehead Select Board Meeting',
  'Marblehead School Committee',
  'Marblehead Finance Committee',
  'Marblehead Town Meeting',
  'Marblehead Board of Health',
];
```

If a board isn't on the list, the pipeline skips the meeting silently. Adding a board is one line. Hand-promoting one meeting from a non-default board is a separate PR with a single new `_transcripts/<slug>.md` file.

## Source feeds

### MHTV Vimeo (already done)

- `pull_meetings.mjs` indexes `https://vimeo.com/api/v2/marbleheadtv/videos.json`. Authoritative for Select Board, Finance Committee, Town Meeting, Board of Health, Planning, Zoning, Recreation.
- `--deep` flag uses Playwright to scroll past the API's 60-video cap for backfill.

### MPS YouTube (new)

- School Committee publishes to `https://www.youtube.com/channel/UC3mmZuBmhKUJsXeWbqwFQJQ` &mdash; their own channel, not MHTV.
- Add `pull_meetings.mjs --youtube` (or a sibling script): use `yt-dlp --flat-playlist --print-json` to list channel uploads. Output merges into `data/meetings.json` with `source: 'youtube'` on the row.
- This requires updating the layout's `vimeo_url` → `source_url` and adding `source_label` (e.g. "MHTV", "School Committee YouTube"). One-time schema migration.

### Town PDF minutes (reference only, not automated)

- `pull_meetings.mjs --pdfs` already scaffolded (see CLAUDE.md project memory). Boards' minutes pages live on marbleheadma.gov.
- PDFs are not pulled into the nightly pipeline. They exist as a reference for the editor when hand-promoting a meeting from a skipped board, since the town's PDF minutes typically lag the meeting by 2-4 weeks but are an authoritative cross-check.

### Hard problems we are not solving in this design

- **Speaker diarization quality across YouTube vs Vimeo Zoom recordings.** YouTube uploads do not always have separate channels for each speaker. AssemblyAI's universal-2 speaker labels may be poorer on YouTube. Accept the quality drop; flag in the disclaimer.
- **Executive sessions.** Not published. Out of scope.
- **Joint sessions** with multiple boards. Treat as one meeting, assign to whichever board "owns" it (usually the host).

## Pipeline architecture (Phase 2 implementation)

A nightly systemd timer on the Hetzner box runs `scripts/transcribe.mjs`:

```
1. node pull_meetings.mjs                       (refresh Vimeo)
2. node pull_meetings.mjs --youtube             (refresh SC YouTube)
3. node pull_meetings.mjs --pdfs                (refresh town PDFs)
4. Diff meetings.json against _transcripts/
5. For each new meeting:
   a. Look up board in DEFAULT_BOARDS
   b. If not in the list: skip (no further action)
   c. yt-dlp -f bestaudio --extract-audio  → /tmp/<id>.mp3
   d. POST audio bytes → AssemblyAI /v2/upload
   e. POST transcript job (universal-2, speaker_labels=true)
   f. Poll until completed
   g. Anthropic API → summary card + topic_segments JSON, with
      prompt-caching (5-min TTL on system prompt + topic seeds)
   h. Render: _transcripts/<board>-<YYYY-MM-DD>.md
6. For each new meeting, run a schema-validation pass before commit:
   - Required fields present
   - topic_segments[].topic ∈ seeds list (or proposed_new: true)
   - dollar figures match `\$[\d,]+` regex (catch "S15M" OCR errors)
   - speaker labels not empty
7. git checkout -b auto/transcripts-<date>
   git add + commit + push
   gh pr create  (PR title: "Transcripts: <list of meetings>")
8. Andrew reviews PR (≈ 5-8 min/meeting), edits where needed, merges. Jekyll rebuild → live.
```

### Cost model

| | Per meeting | Per month at scale | Per year |
|---|---:|---:|---:|
| AssemblyAI universal-2 (~3hr audio) | $0.81 | ~$8 peak, ~$5 off-season | ~$60 |
| Claude Sonnet 4.6 summary (~15K input, ~3K output, prompt-cached) | $0.06 | $0.50 | $5 |
| Hetzner box | &mdash; | &mdash; | already running |
| **Total** | | **~$8/mo** | **~$65/yr** |

Hand-promoted meetings cost ~$1 each (same AssemblyAI run + LLM call) and happen ~5-10/year, so the budget gap is rounding error.

## Open questions for the human reviewer

1. **Do we backfill?** The 2025 fiscal year was the run-up to the FY27 deficit emerging. Backfilling Select Board + School Committee + FinCom for FY25 + FY26 would cost ~$150 in transcription + ~$10 in LLM and create a real research archive. Decision: yes / no?
2. **Joint sessions.** Tag with both boards? Recommend: assign to host, tag with both in `topic_segments[].key_speakers`.
3. **MPS YouTube auth.** YouTube public channel doesn't need auth; yt-dlp handles it. No problem.
4. **Auto-published transcripts before human review.** Phase 1 spec already says "auto-published with PR merge." Keep that; the LLM mistakes will be on the body text, which already has the "AI-generated, may contain errors" disclaimer. The summary card is the editorial layer that the reviewer sees in the PR.
5. **Pagefind indexes the transcript body.** Confirmed. Residents will be able to search "Bouvier Road" and land on the right meeting. No further work.

## Success criteria

- ≥80% of default-board meetings published within 48 hours of the meeting
- Reviewer time ≤30 min/week peak (~6 meetings × 5 min average, including occasional hand promotions)
- Cron runs 30 days unattended without manual intervention
- At least one resident has cited a transcript URL in a public-comment thread

## Out of scope for this scaling design

- Email subscriptions (covered in the companion spec at [2026-06-02-meeting-questions-and-subscriptions.md](2026-06-02-meeting-questions-and-subscriptions.md))
- Question routing (same companion spec)
- Real-name speaker resolution beyond what's in the audio (Phase 3)
- Vimeo embedding on the transcript page (link-out is sufficient)
- Index pages (`/meetings/`, `/topics/*`) layout updates &mdash; those are intentionally untouched

## Implementation handoff

The pipeline implementation plan from the original spec
([2026-05-08-meeting-transcripts.md](../plans/2026-05-08-meeting-transcripts.md))
covers Tasks 10-18 (Phase 2). This scaling spec adds:

- Task 19: `DEFAULT_BOARDS` list + skip-everything-else dispatch in `scripts/transcripts/lib/config.mjs`
- Task 20: YouTube source feed in `pull_meetings.mjs --youtube`
- Task 21: schema migration `vimeo_*` → `source_url` + `source_label`
- Task 22: backfill flag (`--backfill --since=2024-07-01`) on the orchestrator, scoped to default boards

Next step: `writing-plans` skill on this spec to break those into ordered tasks with file paths.
