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
| **Source feed** | Two transcripts on disk; SC video lives on YouTube not Vimeo | Multi-source ingest: MHTV Vimeo, MPS YouTube channel, town PDF minutes |
| **Coverage** | 2 meetings | ~30 meetings/month at peak (warrant + budget season); ~12-15/month off-season |

## Decision: which meetings get the full treatment

Three tiers, picked deliberately. Not every meeting deserves the same surface area.

### Tier A: full transcript + summary card (high-stakes recurring boards)

- **Select Board** &mdash; ~36/year (every other Wednesday)
- **School Committee** &mdash; ~24/year
- **Finance Committee** &mdash; ~20/year peak, ~12/year off-season
- **Town Meeting** &mdash; 2/year (annual + special)
- **Board of Health** when on substantive issues (trash, social hosting, public-safety overlap; not routine permit hearings) &mdash; ~6/year

Total: **~90 meetings/year** at full treatment. These are the meetings residents ask about, the ones that drive policy, and the ones where a PR-comment thread on the splashy page becomes worth maintaining.

### Tier B: summary card + topic chips, no transcript body (procedural boards with low resident interest but real decisions)

- **Planning Board** &mdash; comprehensive permits, MBTA 3A compliance, mostly procedural
- **Zoning Board of Appeals** &mdash; permit appeals, mostly case-by-case
- **Board of Health** routine permit/license meetings (the procedural majority)
- **Recreation & Parks Commission**
- **Conservation Commission**

Total: **~120 meetings/year**, treated more like newspaper briefs &mdash; one or two paragraphs, the votes table, no `topic_segments[]` rich content, no full transcript. Cost per meeting drops by an order of magnitude because we skip transcription and LLM is given the PDF minutes only.

### Tier C: just a row in `data/meetings.json`, no `_transcripts/` entry

- Subcommittee meetings, joint sessions covered by Tier A, school-building-committee technical sessions, etc.

Total: **~200/year**. The chronological feed at `/meetings/` shows these as title + date + "no summary" so they remain searchable for residents who know what they're looking for, but we don't burn LLM tokens summarizing them.

### How we pick the tier at ingest time

Hardcoded mapping in `scripts/transcripts/lib/config.mjs`:

```js
export const BOARD_TIERS = {
  'Marblehead Select Board Meeting':            'A',
  'Marblehead School Committee':                'A',
  'Marblehead Finance Committee':               'A',
  'Marblehead Town Meeting':                    'A',
  'Marblehead Planning Board':                  'B',
  'Marblehead Zoning Board':                    'B',
  'Marblehead Board of Health':                 'B',    // upgrade by hand if substantive
  'Marblehead Recreation and Parks':            'B',
  'Marblehead Conservation Commission':         'B',
  // anything else → C (no automated summary)
};
```

Upgrading a Tier B meeting to A is a one-line PR (after the meeting). Downgrading is the same.

## Source feeds

### MHTV Vimeo (already done)

- `pull_meetings.mjs` indexes `https://vimeo.com/api/v2/marbleheadtv/videos.json`. Authoritative for Select Board, Finance Committee, Town Meeting, Board of Health, Planning, Zoning, Recreation.
- `--deep` flag uses Playwright to scroll past the API's 60-video cap for backfill.

### MPS YouTube (new)

- School Committee publishes to `https://www.youtube.com/channel/UC3mmZuBmhKUJsXeWbqwFQJQ` &mdash; their own channel, not MHTV.
- Add `pull_meetings.mjs --youtube` (or a sibling script): use `yt-dlp --flat-playlist --print-json` to list channel uploads. Output merges into `data/meetings.json` with `source: 'youtube'` on the row.
- This requires updating the layout's `vimeo_url` → `source_url` and adding `source_label` (e.g. "MHTV", "School Committee YouTube"). One-time schema migration.

### Town PDF minutes (Tier B)

- `pull_meetings.mjs --pdfs` already scaffolded (see CLAUDE.md project memory). Boards' minutes pages on marbleheadma.gov:
  - `/select-board/minutes`
  - `/finance-committee/minutes`
  - `/planning-board/minutes`
  - `/zoning-board-of-appeals/minutes`
  - `/board-of-health/minutes`
  - `/board-of-assessors/minutes`
- Output: `data/meetings.json.pdfs[]` rows with `pdf_url`, `board`, `date`. **For Tier B**, the PDF is the primary source &mdash; no transcription needed, LLM reads it directly.
- Tier A still prefers video + transcription because the minutes are typically thin and lag the meeting by weeks.

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
   a. Look up tier (A / B / C) by board name
   b. If C: skip (no further action)
   c. If A:
      - yt-dlp -f bestaudio --extract-audio  → /tmp/<id>.mp3
      - POST audio bytes → AssemblyAI /v2/upload
      - POST transcript job (universal-2, speaker_labels=true)
      - Poll until completed
      - Anthropic API → summary card + topic_segments JSON, with
        prompt-caching (5-min TTL on system prompt + topic seeds)
      - Render: _transcripts/<board>-<YYYY-MM-DD>.md
   d. If B:
      - Skip transcription entirely
      - Download PDF, extract text via pdftotext
      - Anthropic API → summary card + topic_segments JSON (no full
        transcript body; the .md has just the YAML frontmatter)
      - Render: _transcripts/<board>-<YYYY-MM-DD>.md with body =
        "Full minutes available at <pdf_url>"
6. For each new meeting, run a schema-validation pass before commit:
   - Required fields present
   - topic_segments[].topic ∈ seeds list (or proposed_new: true)
   - dollar figures match `\$[\d,]+` regex (catch "S15M" OCR errors)
   - speaker labels not empty
7. git checkout -b auto/transcripts-<date>
   git add + commit + push
   gh pr create  (PR title: "Transcripts: <list of meetings>")
8. Andrew reviews PR (≈ 3 min/meeting at Tier B, 8 min at Tier A),
   edits where needed, merges. Jekyll rebuild → live.
```

### Cost model

| | Per meeting | Per month at scale | Per year |
|---|---:|---:|---:|
| Tier A AssemblyAI universal-2 (~3hr audio) | $0.81 | ~$8 (peak), ~$5 (off-season) | ~$72 |
| Tier A Claude Sonnet 4.6 summary (~15K input tokens, ~3K output, prompt-cached) | $0.06 | $0.50 | $6 |
| Tier B Claude Sonnet 4.6 from PDF (~5K input, ~2K output, cached) | $0.02 | $0.20 | $2.40 |
| Hetzner box | &mdash; | &mdash; | already running |
| **Total** | | **~$9/mo** | **~$80/yr** |

This is comfortably absorbable.

## Open questions for the human reviewer

1. **Do we backfill?** The 2025 fiscal year was the run-up to the FY27 deficit emerging. Backfilling Select Board + School Committee + FinCom for FY25 + FY26 would cost ~$200 in transcription + ~$15 in LLM and create a real research archive. Decision: yes / no?
2. **Tier B board-of-health override.** Some BOH meetings are routine permits; others (social hosting, trash) are high-stakes. Mark substantive ones for upgrade after the meeting, or just put BOH in A and accept some waste? Recommendation: A unless we see a wave of waste.
3. **Joint sessions.** Tag with both boards? Recommend: assign to host, tag with both in `topic_segments[].key_speakers`.
4. **MPS YouTube auth.** YouTube public channel doesn't need auth; yt-dlp handles it. No problem.
5. **Auto-published transcripts before human review.** Phase 1 spec already says "auto-published with PR merge." Keep that; the LLM mistakes will be on the body text, which already has the "AI-generated, may contain errors" disclaimer. The summary card is the editorial layer that the reviewer sees in the PR.
6. **Pagefind indexes the transcript body.** Confirmed. Residents will be able to search "Bouvier Road" and land on the right meeting. No further work.

## Success criteria

- ≥80% of Tier A meetings published within 48 hours of the meeting
- Reviewer time ≤45 min/week peak (8 meetings × 5 min Tier A + 3 meetings × 3 min Tier B)
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

- Task 19: tier-mapping config + dispatch in `scripts/transcripts/lib/config.mjs`
- Task 20: YouTube source feed in `pull_meetings.mjs --youtube`
- Task 21: schema migration `vimeo_*` → `source_url` + `source_label`
- Task 22: PDF-minutes path for Tier B (skip transcription, parse PDF directly)
- Task 23: backfill flag (`--backfill --since=2024-07-01`) on the orchestrator

Next step: `writing-plans` skill on this spec to break those into ordered tasks with file paths.
