# Historical Minutes Catalog: Design Spec

**Date:** 2026-04-16
**Status:** Approved (brainstorming)
**Next step:** Implementation plan via `superpowers:writing-plans`

## 1. Problem statement

Marblehead residents arguing about the FY27 override repeatedly ask two
questions about the Select Board, Finance Committee, and School Committee:

1. **"Is the board even trying?"** That is, have these bodies substantively
   engaged with the structural fiscal pressures that produced the FY27
   deficit, or have they only reacted to acute crises?
2. **"What have we tried, and what came of it?"** That is, what specific
   reforms, studies, working groups, or policy moves have been attempted to
   address systemic cost drivers, and what was the outcome?

The site has no first-party answer to either question. There is no curated,
primary-source-cited record of attempts. Public minutes archives exist but
are unindexed and impractical for a resident to read in bulk.

This project builds that record.

## 2. Goals and non-goals

**Goals.**

- A catalogue of attempts by SB / FinCom / SC, FY19 through present, to
  address systemic fiscal issues. Every entry traces to primary-source
  minutes.
- A reader can filter by topic, body, year, attempt type, and outcome to
  answer their own version of the two motivating questions.
- A future session can resume work and add new meetings without re-vetting
  prior entries.

**Non-goals.**

- No interpretive narrative on top of the catalogue. The data speaks for
  itself; the framing is neutral per `STYLE_GUIDE.md` and `CLAUDE.md`. No
  "the board failed to act," no "ignored," no green/red colour cues on
  outcomes.
- Not a meeting recap system. Each entry surfaces one *attempt*, not a
  summary of the meeting it appeared in.
- Not real-time. The catalogue covers historical minutes that have been
  published. Live meeting tracking remains in `data/changelog.html`.
- Not advocacy infrastructure. Per the editorial stance, the catalogue must
  be defensible against the charge that it was assembled to support a
  particular vote.

## 3. Scope

**Bodies (3):** Select Board, Finance Committee, School Committee.

**Time horizon:** FY19 (Jul 2018) through present. This matches the
`how-we-got-here.html` "seven-year FinCom warning arc" framing and starts
when the structural deficit first became publicly named.

**What counts as an "attempt":** Voted motions, adopted policies, funded
studies, formal appointments of working groups, warrant articles, **plus**
named proposals presented in a meeting that received substantive
discussion (even if not voted). The `attempt_type` field on each entry
preserves the distinction.

What does *not* count: passing mentions, public-comment items, generic
agenda touches without substance.

**Topic taxonomy (initial whitelist + escape hatch):**

1. `healthcare_gic`: health insurance, GIC, employee benefits
2. `pensions_opeb`: pensions, OPEB, post-employment liability
3. `special_ed_collaborative`: SPED, out-of-district, collaborative tuition
4. `structural_deficit_reserves`: deficit, reserves, free cash policy
5. `revenue_diversification`: new growth, fees, PILOT, voluntary contributions
6. `override_prop25`: override and Prop 2½ history (asks, pass/fail, debt exclusions)
7. `regionalization_shared`: regionalization, shared services, consolidation
8. `capital_facilities_debt`: capital plan, facilities, debt service
9. `solid_waste`: trash funding model
10. `staffing_fte_bargaining`: FTE structural decisions, collective bargaining cost items
11. `other_candidate`: escape hatch. Every `other_candidate` row is reviewed in vet to decide: add to taxonomy, drop, or merge

The taxonomy may grow during Phase 2 vet rounds. Once it stabilizes, it
freezes for Phase 3.

## 4. Architecture: phased structure

| Phase | Output | Phase exit gate |
|---|---|---|
| 1, Corpus build | `data/minutes/{body}/{YYYY-MM-DD}.{pdf,txt}` + `data/minutes_manifest.csv` | Every minutes file we *can* obtain is downloaded, OCR'd if needed, and listed in the manifest with a known `status`. Gaps explicit. |
| 2, Sample extraction & vet | Validated catalogue subset + tightened rubric + `minutes_extraction_rubric.md` | Two consecutive vet rounds produce no taxonomy changes; acceptance rate stabilizes (≥80% accepted with at most minor edits). |
| 3, Full sweep | Full `data/catalog.csv` + reader-facing page (form decided per data) | Spot-check sample passes (acceptance rate matches Phase 2). Output surface decided. |

**Key principle.** Each phase produces durable artifacts checked into the
repo (per the `feedback_persist_extracted_data` memory). No phase depends
on volatile in-conversation state. A future session resumes from the
manifest, the rubric, and the catalogue.

**Phases are sequential gates, not parallel tracks.** No Phase 3 work
begins until Phase 2's rubric stabilizes. No Phase 2 work begins until
Phase 1's manifest is complete enough to defend the sample selection.

## 5. Phase 1: corpus build

**Goal.** Inventory and download every minutes PDF for SB / FinCom / SC,
FY19 → present, with explicit gap accounting.

**Sources to investigate (Phase 1 first task):**

- Town site (`marblehead.org` and related): Select Board minutes archive,
  Finance Committee archive
- School site (`marbleheadschools.org` or equivalent): School Committee
  minutes archive
- Wayback Machine for any years missing from current archives
- Town Clerk PDFs (some boards publish through the Clerk's archive)

**Pipeline:**

1. **Discover.** For each body, walk the public archive page(s) and
   enumerate every meeting between FY19 and today. Capture: meeting date,
   body, document URL, document type (**minutes** only; agendas and
   packets are out of scope for this catalogue).
2. **Download.** Pull each PDF to
   `data/minutes/{body}/{YYYY-MM-DD}.pdf`. Body uses canonical short
   names: `select_board`, `fincom`, `school_committee`.
3. **Extract text.** Run `pdftotext` first; if output is empty or garbage
   (scanned PDFs), fall back to OCR (mirror the approach
   `.tmp_research/` already uses). Write text alongside the PDF as
   `{YYYY-MM-DD}.txt`.
4. **Manifest.** Write/update `data/minutes_manifest.csv` with columns:

   ```
   body,meeting_date,source_url,local_pdf,local_txt,extraction_method,text_quality,status,notes
   ```

   - `status` ∈ `{downloaded, missing, restricted, not_published}`
   - `extraction_method` ∈ `{pdftotext, ocr, none}`
   - `text_quality` ∈ `{clean, degraded, unreadable}` (visual check on a
     sample, default to `clean` for `pdftotext` output)
   - Gaps stay in the manifest with explanations, since they are themselves data.

**Idempotent re-run.** Running discovery twice should not re-download
anything already in the manifest. New meetings (newer than the latest in
the manifest) get appended.

**No extraction in Phase 1.** Tempting to start tagging while reading,
but mixing extraction with corpus build pollutes the rubric. Phase 1 ends
with a complete corpus and an empty catalogue.

**Phase 1 exit gate.** Manifest covers FY19 → today. Every row has
`status` filled. Every `downloaded` row has both `local_pdf` and
`local_txt` populated. A sample of `text_quality=clean` rows has been
visually confirmed readable. `git status` shows the new `data/minutes/**`
files and `data/minutes_manifest.csv` as the only additions.

**Implementation cost estimate.** Roughly 350 to 460 meetings expected.
Discovery scraper: 1 session per body (3 total). Download + OCR: bulk
job. Realistic Phase 1 wall time: 1 to 2 working sessions.

## 6. Phase 2: sample extraction & vet

**Sample selection.**

*Round 2A: FinCom, one year.* All FinCom meetings from FY24
(Jul 2023 to Jun 2024). Pre-MOU but inside the acute deficit window;
recent enough for current vocabulary; FinCom annual report for FY24
exists as ground-truth comparison. ~20 meetings.

*Round 2B: time-stratified across all bodies.* One quarter from each
fiscal year FY19 to FY26 (default Jan to Mar of each), across SB + FinCom +
SC. ~60 meetings. Tests whether the rubric generalizes across bodies and
across multi-year vocabulary drift.

Round 2A first, full vet, rubric tightening. Then Round 2B with the
tightened rubric, full vet, tighten again.

**Extraction prompt produces candidate entries.** For each meeting text,
the LLM emits a JSON array of candidate catalogue entries against this
schema:

```json
{
  "entry_id": "fincom_2024-02-13_001",
  "meeting_date": "2024-02-13",
  "body": "fincom",
  "topic": "healthcare_gic",
  "topic_other_label": null,
  "attempt_type": "proposal",
  "what_was_tried": "Member X proposed exploring municipal opt-out from GIC for FY26 if rate increases exceed Y%",
  "outcome": "Referred to subcommittee for cost analysis; no follow-up by end of FY24",
  "evidence_quote": "...verbatim quote, 1-3 sentences, from minutes...",
  "minutes_section": "Item 7: Health insurance projections",
  "confidence": "medium"
}
```

- `entry_id` format: `{body}_{date}_{seq}` where `seq` is zero-padded
  three digits, unique within meeting.
- `topic` ∈ taxonomy (section 3) or `other_candidate`
- `topic_other_label` is free text, only set when `topic = other_candidate`
- `attempt_type` ∈ `{vote, proposal, study, working_group, warrant_article}`
- `confidence` ∈ `{high, medium, low}` (LLM self-rated)
- `evidence_quote` is **mandatory**: no entry without a verbatim quote
  from the source text.

**Manual vet workflow.**

Candidates land in `data/catalog_candidates_round_{2a,2b}.csv` with two
empty review columns: `vet_decision` (`accept | reject | edit |
needs_source_check`) and `vet_notes` (free text). Andrew reviews row by
row, fills the columns, and edits `what_was_tried` or `outcome` text in
place where wording is wrong. Accepted rows get promoted to
`data/catalog.csv` (the validated catalogue).

**Automated quote verification before promotion.** Every accepted entry's
`evidence_quote` must be findable in the corresponding `local_txt` via
substring match (whitespace-normalized). Promotion blocks on mismatch.

**Rubric artifacts that come out of vet.**

- `docs/superpowers/specs/minutes_extraction_rubric.md`: taxonomy with
  definitions and inclusion/exclusion examples (updated each round)
- `data/catalog_vet_log.md`: qualitative notes on what the extractor
  missed, hallucinated, or miscategorized (informs prompt refinement for
  next round)

**Phase 2 exit gate.** Two consecutive vet rounds produce no taxonomy
changes and the acceptance rate stabilizes at ≥80% accepted with at most
minor edits. At that point the rubric is stable enough to scale.

## 7. Phase 3: full sweep

1. Run validated extractor against every `status=downloaded` row in the
   manifest not yet covered by Phase 2.
2. Land candidates in `data/catalog_candidates_round_3.csv`.
3. **Spot-check.** Random sample of `max(30, 5% of corpus)` candidates
   across bodies and years. Acceptance rate must match Phase 2's stable
   rate. If not, treat as Phase 2 reopen, not Phase 3 proceed.
4. Promote accepted rows to `data/catalog.csv`. Keep `entry_id` stable so
   future updates can reference rows.
5. **Decide output surface** (deferred from brainstorming) once
   `catalog.csv` is populated. The catalogue's actual content shape
   decides:
   - Sparse / quote-heavy → `/data/` doc-page (raw evidence, like
     `data/changelog.html`)
   - Dense / clusterable → top-level `/what-have-we-tried.html`
   - Both rich → narrative top-level + `/data/` table

## 8. Schemas (load-bearing)

### `data/minutes_manifest.csv`

| column | type | notes |
|---|---|---|
| `body` | enum | `select_board` \| `fincom` \| `school_committee` |
| `meeting_date` | date | ISO `YYYY-MM-DD` |
| `source_url` | url | Original document URL on town/school site or Wayback |
| `local_pdf` | path | Empty if status ≠ `downloaded` |
| `local_txt` | path | Empty if status ≠ `downloaded` |
| `extraction_method` | enum | `pdftotext` \| `ocr` \| `none` |
| `text_quality` | enum | `clean` \| `degraded` \| `unreadable` |
| `status` | enum | `downloaded` \| `missing` \| `restricted` \| `not_published` |
| `notes` | text | Free text, especially for non-`downloaded` rows |

### `data/catalog_candidates_round_{N}.csv`

All fields from the candidate JSON schema (section 6) flattened to CSV
columns, plus:

| column | type | notes |
|---|---|---|
| `vet_decision` | enum | empty initially; `accept` \| `reject` \| `edit` \| `needs_source_check` |
| `vet_notes` | text | free text from human reviewer |

### `data/catalog.csv`

Same columns as candidate CSV minus `confidence` and the `vet_*` columns.
Adds:

| column | type | notes |
|---|---|---|
| `promoted_from` | string | Round identifier, e.g. `round_2a`, `round_2b`, `round_3` |
| `promoted_at` | date | ISO date the row was promoted |

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Some bodies don't publish minutes consistently (especially older years) | Manifest captures gaps explicitly with `status=missing/not_published`. The catalogue page's coverage statement names the gaps. |
| OCR garbage on scanned PDFs leaks into extraction | `text_quality` field gates extraction. `degraded` rows extracted with a flag; vet treats them as low-confidence by default. `unreadable` rows skipped entirely until reprocessed. |
| LLM hallucinates entries or quotes | `evidence_quote` is mandatory. Pre-promotion automated check verifies every accepted entry's quote appears in the source `local_txt`. Promotion blocks on mismatch. |
| Rubric drifts mid-Phase-3 (catalogue becomes inconsistent) | Phase 3 freezes the rubric. If a real new topic emerges, finish Phase 3 with current rubric, then add a Phase 3.5 amendment pass over the corpus for the new topic only. |
| Editorial-stance violation (catalogue becomes implicit advocacy) | Rubric explicitly forbids interpretive language in `what_was_tried` or `outcome`. Facts only, no "failed to act," no "ignored." Per `CLAUDE.md` and `STYLE_GUIDE.md`. Vet step checks language. |
| Project sprawl or abandonment mid-corpus | Each phase produces durable artifacts checked into the repo. A future session resumes from the manifest. No state lives only in conversation. |
| Town minutes archive structure changes mid-project | Discovery code keeps source URLs, not just file paths. Re-running discovery against a changed archive surfaces missing files in the manifest. |

## 10. Testing

- **Phase 1.** Visual check of `text_quality=clean` sample. Spot-check
  that `status=missing` URLs actually 404. Manifest re-run is no-op
  against unchanged corpus.
- **Phase 2.** Every accepted entry's `evidence_quote` is grep-verified
  against `local_txt` before promotion. Acceptance rate tracked in
  `catalog_vet_log.md`. Round-over-round taxonomy diff tracked.
- **Phase 3.** Spot-check sample size = `max(30, 5% of corpus)`. Same
  grep verification for every promoted entry.

## 11. Success criteria

- Catalogue exists with ≥1 row per identified attempt, FY19 → present,
  across all 3 bodies (where minutes are available).
- Every catalogue row traces to a primary source minutes file in the repo.
- Manifest's coverage statement names known gaps (missing years,
  non-publishing bodies).
- A reader can answer "what has the FinCom proposed about healthcare
  costs since FY19?" by filtering the catalogue.
- A future session can re-run the pipeline and add new meetings without
  re-vetting old work.
- A skeptic can challenge any catalogue entry by clicking through to the
  cited minutes file and reading the surrounding context.

## 12. Open questions deferred to implementation

- **Output surface.** Decided in Phase 3 once the catalogue's shape is
  known. Options: `/data/` doc-page, top-level `/what-have-we-tried.html`,
  or both.
- **Scraper architecture.** Phase 1 may use Playwright (precedent: open PR
  #543 for DLS Schedule A) or a lighter `requests`-based approach,
  depending on what each archive page requires. Decided per body during
  Phase 1 discovery.
- **OCR engine.** `.tmp_research/` already uses an OCR pipeline; the
  Phase 1 implementation should reuse whatever produced those `_p-N.txt`
  files rather than introducing a second tool.
- **Catalogue page UI.** Filter controls, layout, mobile behavior, all
  decided after Phase 3 knows the data.
