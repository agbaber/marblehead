# Design: AI-generated meeting transcripts and summaries

**Status:** draft, awaiting review
**Date:** 2026-05-08
**Author:** Andrew Baber + Claude

## Goal

Turn every public Marblehead board/committee meeting on MHTV into a
searchable, browsable artifact on marbleheaddata.org so residents can
keep tabs on what's happening — both chronologically ("what
happened this week?") and by topic ("show me everything anyone said
about 40B housing").

## Why now

Town transcripts are not currently produced (Andrew asked MHTV for AI
transcripts; no response). MHTV publishes meetings as Vimeo video, but
neither MHTV nor the town produces searchable text. AssemblyAI's
diarized output (validated in a 6-min POC against the 4-22-26 Select
Board meeting) is now good enough to publish with a "may contain
errors" disclaimer. Backfilling and going-forward coverage costs ~$25/mo
in API spend.

This unlocks two downstream features in the project backlog:
- **Email subscriptions** by board and topic (subscribers want
  "summaries of School Committee meetings" or "any meeting that mentions
  the override")
- **Question aggregation** (verified questions about FinCom budget
  discussion need a searchable record of what FinCom actually
  discussed)

Without transcripts, both are blocked. Transcripts are the foundation.

## What exists already

- `pull_meetings.mjs` — indexes MHTV's Vimeo channel and scrapes town
  PDF minutes; outputs `data/meetings.json`. **Reused as the discovery
  layer.** No new polling code needed.
- Jekyll static site with Pagefind full-text search across all pages.
  **Transcripts as Markdown become searchable for free.**
- Cloudflare Worker + D1 for community-pulse (verification network).
  **Not used in v1.** Reserved for the subscription delivery layer that
  ships next.
- Hetzner box with always-on systemd-managed services. **Hosts the
  transcription pipeline as a systemd timer.**

## User-facing surfaces

Three views over one set of artifacts:

1. **`/meetings/` (chronological feed)** — reverse-chrono cards: meeting
   name + date + 1-sentence headline + expand for ~100-word summary +
   click-through to full transcript page. Filterable by board.
2. **`/topics/<topic>/` (topic page)** — reverse-chrono feed of
   *segments* tagged with this topic across all meetings. Each row:
   meeting + date + speaker + ~30-second quote + jump-link to the
   timestamped Vimeo URL.
3. **`/meetings/<board>/<YYYY-MM-DD>/` (full transcript page)** —
   speaker-labeled transcript, topic sidebar (jump-to-timestamp), prominent
   "AI-generated, may contain errors. Source video on MHTV →" disclaimer,
   link back to Vimeo.

## Pipeline architecture

A single Python script (`scripts/transcribe_meetings.py`), run by a
systemd timer on the Hetzner box once daily, executes the full
pipeline:

```
                                                Hetzner box (systemd timer)
   ┌─────────────────────────────────────────────────────────────────────┐
   │                                                                     │
   │  1. node pull_meetings.mjs        (refresh data/meetings.json)      │
   │                                                                     │
   │  2. Diff meetings.json ⇄ _transcripts/                              │
   │     → list of un-transcribed meetings                               │
   │                                                                     │
   │  3. For each new meeting:                                           │
   │     a. yt-dlp -f bestaudio --extract-audio  → /tmp/.../audio.mp3    │
   │     b. POST audio bytes → AssemblyAI /v2/upload                     │
   │     c. POST transcript job (universal-2, speaker_labels=true)       │
   │     d. Poll /v2/transcript/<id> until completed                     │
   │     e. Anthropic API → summary + topic-segment JSON                 │
   │        (with Claude prompt-caching, 5min TTL)                       │
   │     f. Render: _transcripts/<slug>.md (frontmatter + transcript)    │
   │                                                                     │
   │  4. git checkout -b auto/transcripts-<date>                         │
   │     git add + commit + push                                         │
   │     gh pr create  (PR title: "Transcripts: <list of meetings>")     │
   │                                                                     │
   │  5. Andrew reviews PR (≈ 5 min/meeting), edits summary if needed,   │
   │     merges. Jekyll rebuild → live.                                  │
   │                                                                     │
   └─────────────────────────────────────────────────────────────────────┘
```

Why one script not Worker+D1: the runner needs `yt-dlp`, `ffmpeg`, and
~50 MB of RAM per meeting to handle audio. Workers can't run yt-dlp;
Cloudflare R2 plus a containerized yt-dlp would solve that but adds
infrastructure. The Hetzner box already has the tooling and is
always-on. When subscriptions ship, a Worker reads repo state via
GitHub API and sends emails — no migration needed.

## Data model

Each meeting produces **one Markdown file** in the Jekyll collection
`_transcripts/`. All structured data lives in YAML frontmatter; the
Markdown body is the human-readable transcript. Slug format:
`<board>-<YYYY-MM-DD>` (e.g. `_transcripts/select-board-2026-04-22.md`).
Permalink: `/meetings/<slug>/`.

```markdown
---
layout: transcript
slug: select-board-2026-04-22
board: select-board
board_display: "Select Board"
date: 2026-04-22
title: "Select Board: April 22, 2026"
vimeo_id: 1185906675
vimeo_url: "https://vimeo.com/1185906675"
duration_seconds: 2969
ai_generated: true
status: published

summary_card:
  headline: "Approved $24.9M bond sale to Oppenheimer at 5.32% TIC"
  summary: "~100-word paragraph capturing decisions and discussion arc."
  decisions:
    - "Approved sale of $24,975,000 GO bonds to Oppenheimer Co."
    - "Authorized town treasurer to execute SEC Rule 15c2-12 disclosure"
  votes:
    - motion: "Approve bond sale"
      result: "5-0"
      members_in_favor: ["Fox", "Krieger", "Singing"]

topic_segments:
  - topic: bonding-capital
    topic_confidence: 0.95
    start_seconds: 600
    end_seconds: 1100
    summary: "Bond sale closing — accepted Oppenheimer's bid at $26.4M for $24.975M par."
    key_speakers: ["Speaker A (bond agent)", "Speaker C (chair)"]

ingest:
  transcribed_at: "2026-05-08T13:00:00Z"
  assemblyai_id: "e85994e3-..."
  speech_model: "universal-2"
  speech_model_cost_usd: 0.81
  summary_model: "claude-sonnet-4-6"
  summary_cost_usd: 0.04
---

[ 0:00:32 ] **Speaker A** (bond agent, name not identified):
Public safety, education, accessibility, technology and library
services as follows. We have roads and sidewalks at $9,098,250...

[ 0:53:36 ] **Speaker C** (board chair, voting "in favor"):
Any questions from the board?
```

Speaker labels stay generic ("Speaker A", "Speaker B") in v1 — they may
be edited to real names by the reviewer when obvious from context, with
a parenthetical role/uncertainty marker.

`/topics/<topic>/` pages iterate `site.transcripts` and filter by
`topic_segments[].topic`. The future subscription engine reads the same
collection via the GitHub API.

## Topic taxonomy (hybrid)

Initial fixed list (13 seeds, drives subscription topics):

```
override                Override / Prop 2½ / fiscal
school-budget           Schools — finance, budget, MPS
health-insurance        Health insurance, GIC, OPEB, insurance-vs-wage
40b-mbta                Housing — 40B / MBTA Communities / 3A
bonding-capital         Bonds, capital plan, debt
trash-dpw               Solid waste, DPW operations
labor-personnel         Labor contracts, hiring, personnel
public-comment          Resident public comment periods
permits-zoning          ZBA, Planning, Conservation, permits
public-safety           Police, fire, harbor, public safety
recreation-events       Rec, events, harbor, parks
elections-procedural    Elections, ballots, procedural
admin-housekeeping      Reading minutes, future agenda items, votes-on-votes
```

The LLM is given this list and may *also* propose a new topic per
segment (with a `topic_confidence` < 0.5 and a `proposed_new: true`
flag). New topic proposals accumulate in
`data/transcripts_proposed_topics.json`. Andrew reviews proposals
monthly and promotes to the fixed list if useful.

This keeps subscriptions sane (a fixed set of subscribable topics) while
allowing the taxonomy to evolve.

## LLM prompt structure (Anthropic)

One Claude API call per meeting transcript:

- **Model**: `claude-sonnet-4-6` (cheap and fast enough; large context)
- **Cache**: full prompt template + topic list cached (5-min TTL); only
  the transcript itself is the per-request input
- **Output**: structured JSON matching the `<slug>.json` schema above,
  validated against a JSON schema before commit
- **Prompt content**:
  - System: editorial style guide ("neutral, factual, no editorial
    language; numbers must match transcript verbatim")
  - The fixed topic list
  - Few-shot example: one prior meeting with hand-written summary
  - User: full speaker-labeled transcript

Cost per meeting at ~10K tokens: ~$0.05-0.10. 800 meetings/yr ≈ $80/yr.

## Trust model (two-tier)

| Artifact | Disclaimer | Review before publish |
|---|---|---|
| Transcript (`.md`) | Banner: "AI-generated transcript. May contain errors. Source video at MHTV →" | None — auto-published with PR merge |
| Summary card + topic segments (`.json`) | Implicitly editorial | **Yes** — Andrew reviews PR diff, edits if wrong |

Editorial constraints in the LLM prompt:
- Numbers (dollars, percentages, dates) must match the transcript
  verbatim — model is instructed to copy not paraphrase
- No characterizations ("controversial", "shocking", "easily")
- Quote attributions only when speaker label is clear; otherwise
  "the board discussed"
- Decisions list must cite the timestamp where the decision occurred
  (so reviewer can verify in the source video)

Corrections after publish: existing `feedback.html` flow (GitHub-issue
path) covers it; a future `corrections-archive.html` can list
correction history.

## Failure modes

| Failure | Detection | Response |
|---|---|---|
| Vimeo URL won't yt-dlp (auth, geoblock) | `yt-dlp` non-zero exit | Skip meeting, log to `data/transcripts_failures.json`, retry next run |
| AssemblyAI 5xx or timeout | Status check returns `error` | Skip meeting, retry next run (re-upload audio fresh) |
| LLM JSON schema invalid | JSON parse / schema check fails | Mark transcript as draft-only; commit transcript without summary; flag in PR description for manual summary |
| Audio is silent / very short (<60s) | AAI returns near-empty utterances | Skip — almost certainly a procedural test recording |
| Multiple meetings published same day | All go in one PR | Acceptable — keeps review batched |
| AAI mis-attributes speakers across boundaries | Reviewer catches in PR | Reviewer edits speaker labels in the .md; reviewer's edits override |
| Cron run takes >2hr | Bounded by # new meetings × ~5min each | Acceptable on Hetzner; not a Workers problem |

## Out of scope for v1

- Subscription email delivery (separate spec)
- Backfill (decide after 1 month of going-forward operation; ~$216 if
  yes)
- Vimeo embed on transcript pages (link out is sufficient)
- Real-name speaker resolution (manual edits in PR for now)
- Topic page UI polish — generate a basic Jekyll loop, defer design
- PDF minutes ingestion (already in `pull_meetings.mjs`; current spec
  scopes to video-only)
- Executive session content (not published by MHTV; not relevant)

## Success criteria

- Cron has run nightly for 14 consecutive days without manual intervention
- ≥80% of MHTV-published meetings have transcripts within 48 hours
- Reviewer time bounded — target ≤60 min/wk at peak (8 meetings × 5 min
  + occasional fix-up); revisit if it consistently exceeds that
- At least one resident has cited a transcript page in a Facebook
  override-debate thread (qualitative — proves the artifact is
  consumable)
- `/topics/override/` and `/topics/school-budget/` pages exist and are
  populated

## Implementation handoff

This spec defines what gets built. The next step is `writing-plans` to
break the implementation into concrete, ordered tasks with file paths
and verification steps. Out of scope for the spec: actual code
structure, library choices beyond what's stated, test layout.
