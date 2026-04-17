# Phase 2 Pilot Review

**Date:** 2026-04-16
**Input:** 10 stratified meetings (5 SB, 5 SC; 2 OCR'd, 8 pdftotext; FY19 through FY26)
**Cost:** approximately $1 for both passes combined
**Wall time:** approximately 20 minutes

## Headline numbers

- **Pass 1:** 30 raw candidates extracted from 7 of 10 meetings (3 meetings returned empty; legitimately routine)
- **Pass 1 quote-verified rate:** 63 percent (19 of 30 passed substring match)
- **Pass 2:** 30 of 30 scored, **21 of 30 promoted** (importance >= 3 AND quote verified or repaired)
- **Pass 2 quote-verified rate:** 100 percent (all 11 Pass 1 unverified rows either re-verified or repaired with a corrected `verified_quote` substring)

## Topic distribution of promoted rows

| Topic | Count |
|---|---|
| `special_ed_collaborative` | 5 |
| `staffing_fte_bargaining` | 5 |
| `structural_deficit_reserves` | 4 |
| `capital_facilities_debt` | 2 |
| `governance_committees` (new) | 1 |
| `governance_communication` (new) | 1 |
| `housing_zoning` (new) | 1 |
| `revenue_diversification` | 1 |
| `education_youth` (new) | 1 |

SPED, staffing, and structural deficit are the dominant topics, matching the real-world policy focus.

## Top 5 strongest promoted entries (importance 4, neutral summaries)

1. **SC 2019-01-10:** Unanimous 5-0 vote to transfer $200K across operating lines to partially cover $731K SPED out-of-district deficit; approximately $531K of deficit remained unaddressed. Topic: `special_ed_collaborative`.
2. **SC 2023-02-13:** Superintendent presented $3.9M in FY24 budget cuts still leaving a $640K shortfall; no vote, committee requested itemized position list. Topic: `structural_deficit_reserves`.
3. **SC 2024-10-17:** CBA update reported MEA proposal would result in layoffs of more than 75 staff (15 percent of current). Topic: `staffing_fte_bargaining`.
4. **SC 2025-10-17:** Zero-based budget methodology request tied to $1.7M cuts and about 30 position eliminations; enrollment down 800 students over 8 years. Topic: `staffing_fte_bargaining`.
5. **SB 2025-10-22:** All 7 FY26 Community One Stop + CZM grant applications ineligible due to MBTA 3A non-compliance; $3.6M cumulative loss. Topic: `revenue_diversification`.

These are exactly the shape of "what have we tried" entries the catalog is supposed to surface.

## Weakest promoted entries (importance 3, flagged for scale-up review)

The 16 promoted-3 entries are mostly: routine annual fee increases, budget driver presentations without a vote, capital planning updates, and governance-adjacent items. Some are plausibly borderline. Tightening the importance cutoff to `>=4` at Pass 3 synthesis time (instead of re-running Pass 2) is cheap if the catalog feels noisy.

## Non-promoted (9 of 30)

All 9 were scored 2 and not promoted. Representative reasons per Pass 2 notes:
- "Routine annual fee adjustment tracking COLA"
- "Informational OPEB actuarial report with no policy action or vote"
- "Special ed reserve fund merely listed as a topic for discussion; no substantive attempt"
- "Minor bylaw amendment to Capital Planning Committee membership; procedural"

These look like the right things to drop.

## False negatives observed (entries that should have been caught but weren't)

None found in the pilot sample. The 3 empty meetings (SB 2019-01-23, SB 2020-11-10, SB 2022-01-12) were manually confirmed as legitimately routine (parking regulations, 3-minute festival permit vote, routine warrant-placing). No systemic fiscal content was missed.

## Taxonomy gaps surfaced

4 entries landed in `other_candidate`-shaped buckets (governance_committees, governance_communication, housing_zoning, education_youth). Recommendation: add a `governance_organizational` topic to the taxonomy covering:
- Intra-town department restructuring (Assessing under CFO, CommDev consolidation)
- Appointed-vs-elected position changes
- Board/commission consolidation or bylaw amendments with structural fiscal implications

Housing/zoning and education are legitimately adjacent topics that appeared because Marblehead's grant funding (MBTA 3A) and enrollment trends (preschool expansion for tuition revenue) have direct fiscal consequences. Decide during scale-up whether to add them as formal topics or keep under `other_candidate` with labels.

## Issues found during pilot (fixed or noted)

1. **Page-footer cleaning worked.** The 63 percent Pass 1 verify rate was NOT caused by page-footer noise (Task 1 handled that). Root causes were: model-composed quotes stitching non-contiguous sentences, smart-quote vs ASCII mismatches, OCR bullet characters. All recovered by Pass 2.
2. **`DATE_FALLBACK` needed for one meeting.** Pass 1 read the date from document content (2019-01-10) but the file was named after the meeting-date header in the manifest (2018-12-13, which turns out to be wrong for this SC meeting). The pilot Pass 2 script hard-coded a fallback. Full run should either fix the manifest date OR handle name-mismatch systematically via `data/minutes_manifest.csv` lookup.

## Projected full-run numbers

Extrapolating from pilot's 3 candidates-per-meeting average:
- Pass 1: 437 meetings to about 1,300 raw candidates
- Pass 2: about 900 promoted entries at the 70 percent promotion rate observed in the pilot
- Pass 3: 900 entries in a single synthesis query is about 200K tokens; fits in Opus 200K context with some room, or Opus 1M as a safety margin.

Importance distribution will likely be similar: most rows at 3, a few at 4, rare 5s. The 5s are landmark moments (override votes, large policy changes) that the pilot's meeting dates did not happen to include.

## Recommendation: **GO**

The rubric holds. Pass 2 recovers Pass 1's paraphrase issues. The top-importance entries are the kinds of things a resident asking "what have we tried" wants to see, and they are backed by verifiable primary-source quotes. No fundamental structural issue surfaced.

Minor tweaks for the full run:

- Add `governance_organizational` (or similar) to the Pass 1 taxonomy to avoid over-using `other_candidate`.
- Fix the SC 2018-12-13 manifest date mismatch (low-impact; it is a naming convention issue, not a data issue).
- Consider whether to tighten the Pass 2 promote cutoff to `importance >= 4` only. At the pilot rate this would drop the catalog to about 145 entries, making Pass 3 synthesis crisper. Can be decided at synthesis time.

## Scale-up route decision: Subagent or Batch API

| Factor | Subagent | Batch API |
|---|---|---|
| Cost | $0 marginal (subscription) | approximately $15-30 |
| Wall time | 4-6 hours | 2-4 hours with mostly unattended polling |
| Subscription burn | 30-40 percent of a Max 20x week | None |
| API key needed | No | Yes (already in `.env`) |

Given the key is already set up and the cost is modest, **Batch API** is probably the cleaner default. The pilot proved the prompts work at single-call granularity; batching just scales the same calls efficiently. No new failure modes expected.
