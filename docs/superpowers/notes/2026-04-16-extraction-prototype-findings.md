# Extraction prototype findings: select_board 2020-06-17

**Date:** 2026-04-16
**Scope:** First-pass LLM extraction against a single high-signal SB meeting, against the draft Phase 2 rubric in `docs/superpowers/specs/2026-04-16-historical-minutes-catalog-design.md` section 6.

Full output: `data/prototype_extraction_2020-06-17.md`.

## What the prototype produced

6 candidate catalog entries from a 37KB meeting (~30 action items total). Cut rate: 20 percent. Topic distribution:

| Topic | Count | Notes |
|---|---|---|
| `pensions_opeb` | 2 | OPEB funded at $0; Non-Contributory Retirement line in bundle |
| `healthcare_gic` | 1 | Group Insurance line in bundle |
| `capital_facilities_debt` | 1 | Debt service line in bundle |
| `structural_deficit_reserves` | 1 | Three reserve appropriations inside Selectmen's budget |
| `regionalization_shared` | 1 | Storm sewer drains transferred from Water and Sewer to DPW |

## The clean signal

Entry 004 (OPEB at $0) is the clearest catalog-worthy item in the meeting. One motion, one dollar amount, one policy decision with systemic implications. The rubric handles this case exactly right.

## Findings that change the Phase 2 plan

### 1. Page-footer pollution breaks verbatim quote verification

The `pdftotext -layout` output interleaves page headers/footers mid-sentence. Example from this meeting:

```
Motion made and seconded to approve
June 17, 2020 65
$650,396.00 for Salaries, $254,610.00 for Expense, ...
```

A literal reading of that sentence includes "June 17, 2020 65" as words. The LLM correctly stripped them when quoting, producing an `evidence_quote` that is semantically correct but NOT substring-findable in the raw text.

Automated verification ran after extraction:
- Entries 001, 002: quote **not findable** (both straddle a page break)
- Entries 003, 004, 005, 006: quote findable

The spec's section 9 risk table says "pre-promotion automated check verifies every accepted entry's quote appears in the source `local_txt`. Promotion blocks on mismatch." With page-footer noise, that check fails on the very content most worth cataloguing (longer multi-line motions).

**Options for Phase 2:**

a) **Strip page footers before extraction.** A small text-cleaning pass removes lines matching common footer patterns (date + small number, or "Page N of M") from the text fed to the extractor, then stores the cleaned text alongside the raw text. Quote verification runs against the cleaned text.

b) **Whitespace-normalized substring match.** The existing verification already normalizes whitespace. Extend it to also strip footer-pattern lines before the match. Quote fidelity stays technically strict, but verification tolerates known text noise.

c) **Fuzzy match (edit distance).** Weakest option. Introduces its own failure modes (false positives on common boilerplate like "Motion made and seconded to approve").

Recommendation: **(a) + (b) together.** Clean the text for extraction AND apply the same cleaning for verification. Never pass raw corpus text to the LLM.

### 2. Bundled motions need a rubric rule

The Finance Department motion in this meeting bundled eight line items into a single vote: Salaries, Expense, Operating budget subtotal, Maturing Debt, Interest, Medicare, Group Insurance, Non-Contributory Retirement. Three of those eight are systemic-topic-relevant (Debt, Group Insurance, Retirement).

The extractor chose **one entry per systemic line item within the bundle**, all sharing the same `evidence_quote`. Alternative: one entry for the whole motion with `topic=other_candidate` or a primary topic tag plus prose listing the other systemic amounts.

Recommendation: **one entry per systemic line item, shared quote, distinct `minutes_section` labels.** Preserves granularity for filtering ("show me all OPEB-related attempts"); the shared quote is not a bug, it's accurate attribution.

Add this rule explicitly to the rubric doc: "When a single motion bundles multiple systemic line items, emit one entry per systemic line item."

### 3. Substantive-discussion threshold is ambiguous

Many budget presentations in the source read:

> Fire Department. Fire Chief Jason Gilliland appeared before the Board to present his revised budget for FY 2021. Motion made and seconded to approve ...

No recorded debate. The motion is a vote on a number. Does this count as an "attempt"?

The extractor treated votes on systemic line items as attempts even without recorded deliberation. That matches the spec's attempt definition ("voted motions" count), but elevates every department's routine budget approval touching a systemic line item into an entry.

Consequence: in a typical annual budget-approval meeting, the catalog will accumulate ~5-10 entries tied to routine recurring appropriations, not real policy moves. That dilutes signal.

Recommendation: add a `deliberation` field ("discussed" / "routine" / "unknown") to the candidate schema. Entries with `deliberation=routine` and confidence medium or below can be filtered out of a default catalog view but stay in the underlying data for completeness.

### 4. Contractual obligations should probably be excluded or flagged

Entry 002 (Maturing Debt $4.64M + Interest $2.87M) is a vote on a non-discretionary obligation. It's not really an "attempt" in the policy sense; the town has to pay what it owes. Similarly, Workers Compensation (not extracted, correctly) is statutorily required.

Recommendation: add a rubric note that votes on contractually required obligations should be marked `attempt_type=vote` with `confidence=low` by default, OR the extractor can choose to skip them entirely. Debt *policy* decisions (new borrowing, refinancing, defeasance) remain in scope.

### 5. Taxonomy gap: intra-town reorganization

The Drains transfer (Water and Sewer to DPW) was tagged `regionalization_shared` because nothing else fit. The taxonomy label implies inter-municipal shared services; intra-town consolidation is conceptually distinct.

Recommendation: broaden `regionalization_shared` to `regionalization_shared_services_consolidation` covering both inter-municipal and intra-town, OR add a separate `organizational_restructuring` bucket. Decide during Phase 2 round 2A vet.

## Meta

The prototype ran against one meeting in ~90 seconds wall time (opus model). Output quality is good enough that a human-vet step on the candidates (per the Phase 2 workflow) feels like ~5-10 minutes of review per meeting. That's manageable for Round 2A (20 meetings) and Round 2B (60 meetings).

The self-critique in the prototype output caught all five issues above unprompted. This is a strong signal that the rubric + meeting-level framing is close to right; the refinements above are targeted rather than structural.

## What to do before Phase 2 starts

Treat these as Phase 2 plan prerequisites:

1. Add a text-cleaning step that strips page footer patterns. Re-run `extract_text.mjs` with a `--clean-footers` flag or a companion `clean_text.mjs`. Store raw + cleaned as `*.raw.txt` and `*.txt`.
2. Extend the rubric doc with the bundled-motion rule, the `deliberation` field, the contractual-obligation guidance, and the taxonomy clarification.
3. Decide whether to include routine recurring budget-line votes (and if so, with what confidence floor).

Phase 2 plan gets written after those three items are resolved.
