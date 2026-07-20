# Chunk + map-reduce for oversized transcripts in `enrich_batch.mjs`

## Problem

`scripts/transcripts/enrich_batch.mjs` sends each candidate transcript's full
body as one request inside a single `client.messages.batches.create()` POST.
When a single body exceeds `claude-sonnet-4-6`'s 200K-token context window, the
whole batch create is rejected with `400 terminated` (the server severs the
connection before the SDK reads the error body, so it surfaces as
`status: 400, error: undefined, message: "terminated"`). One oversized request
fails the entire run, so nothing enriches and no transcripts land on the site.

Observed 2026-07: 17 unenriched school-committee transcripts (~10 MB total);
four exceed the window on their own (up to ~1.26 MB body ≈ ~315K tokens).
A separate cause — an Anthropic monthly usage cap — was lifted 2026-07-14; this
spec addresses only the oversized-transcript failure that remained.

## Approach

Split oversized transcripts into time-ordered chunks, enrich each chunk (map),
then combine the per-chunk outputs into one `summary_card` + one
`topic_segments` list (reduce).

The transcript body is timecoded paragraphs of the form
`**[H:MM:SS](https://vimeo.com/<id>#t=<seconds>s)** text...`, separated by blank
lines. The `#t=<seconds>` values are **absolute**, so chunking on paragraph
boundaries preserves timestamps for free: segments produced from a later chunk
already carry correct absolute `start_seconds` / `end_seconds`, and the reduce
step simply concatenates topic segments in chunk order.

## New modules (pure, unit-tested under `scripts/transcripts/lib/`)

1. `chunk_transcript.mjs` — `chunkBody(body, maxChars)`
   - Splits `body` on blank-line paragraph boundaries into ordered chunks, each
     `<= maxChars` where possible.
   - A single paragraph larger than `maxChars` is emitted as its own chunk
     (never split mid-paragraph — we would corrupt a timecode link).
   - Returns `[{ text, index, total }]`; one chunk when `body.length <= maxChars`.

2. `pack_batches.mjs` — `packRequests(requests, maxBytes)`
   - Greedily packs request objects into sub-batches whose summed
     `JSON.stringify(req).length` stays `<= maxBytes`.
   - A single request larger than `maxBytes` gets its own sub-batch.
   - Returns `Array<Array<request>>`. Defensive against an aggregate-POST-size
     termination in addition to the per-request context overflow (we cannot
     probe which one the API enforces from this environment).

3. `reduce_segments.mjs` — `concatSegments(perChunkSegments)`
   - Input: array (per chunk, in order) of `topic_segments` arrays.
   - Concatenates in order; keeps at most one `featured: true` (first wins,
     strips the rest); enforces non-decreasing `start_seconds` (drops/reorders
     nothing silently — if a later chunk's first segment starts before the prior
     chunk's last, it is left as-is because absolute timecodes should already be
     ordered; a monotonicity violation is surfaced, not hidden).

## Reduce prompt

`scripts/transcripts/prompts/reduce_card.md` — instructs the model that the
input is consecutive partial summaries of ONE meeting and to emit a single
`summary_card` JSON object (`headline`, `summary`, `decisions`, `votes`) for the
whole meeting, under the same neutrality/accuracy constraints as `summary.md`.
Input payload is the JSON array of the K partial `summary_card`s only (tiny).

## Flow changes in `enrich_batch.mjs`

Constants: `MAX_CHARS_PER_REQUEST = 450_000` (~112K tokens; safe under 200K
after 16K `max_tokens` output + system prompt), `MAX_BATCH_BYTES = 4_000_000`.

`run` (and the equivalent `submit`/`collect` split):
1. Build requests. For each candidate: body `<= MAX_CHARS_PER_REQUEST` → one
   request with `custom_id: slug` (unchanged). Otherwise → K chunk requests with
   `custom_id: "<slug>#<i>of<K>"` (1-indexed), each carrying one chunk body.
2. `packRequests(requests, MAX_BATCH_BYTES)` → submit each sub-batch; persist all
   batch ids in the state file; poll all until every batch is `ended`; stream
   results from all.
3. Group results by base slug (strip `#<i>of<K>`). 
   - Single-request slug: parse + `mergeFrontmatter` as today.
   - Multi-chunk slug: parse each chunk result; `concatSegments` their
     `topic_segments`; issue one real-time reduce call to synthesize the unified
     `summary_card`; `mergeFrontmatter`.
4. Per-slug failure isolation: if any chunk of a slug is missing / errored /
   fails validation, log to `FAIL_LOG` and skip that slug (it retries next run).
   Other slugs still merge and land.

## Non-goals

- No change to selection (`select_candidates.mjs`) or to the per-transcript
  output schema consumed by the site.
- No truncation — every word of the transcript is seen by the model.
- Not switching to the 1M-context beta (explicitly deferred in favor of
  chunking).

## Testing / proof

- Unit tests (`npm run test:transcripts`, `node --test`, no API key needed):
  `chunk_transcript.test.mjs`, `pack_batches.test.mjs`,
  `reduce_segments.test.mjs`, covering: under/over threshold, oversized single
  paragraph, byte-capped packing, oversized-single-request packing, featured
  dedup, monotonic ordering.
- End-to-end proof: `gh workflow run ingest-meetings.yml --ref
  fix/enrich-chunk-oversized` and confirm the 17-transcript backlog enriches and
  an `auto-meetings` PR opens.
