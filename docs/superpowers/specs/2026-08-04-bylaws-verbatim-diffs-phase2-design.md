---
title: Bylaws history — verbatim text diffs (phase 2) — design
date: 2026-08-04
status: scoped (feasibility proven; not yet built)
depends_on: 2026-07-15-bylaws-history-design.md (v1, shipped in PR #1033)
---

# Verbatim text diffs for the bylaws history (phase 2)

## Goal

Upgrade amendment records from **event-level** ("§ 13-10 was amended in 2024 by
the Town Clerk, 556–144") to **word-level**: the actual struck and inserted text,
so the history and the (future) web tool can show a real red-strikethrough /
green-addition diff for each change.

v1 deferred this because `pdftotext` flattened the Annual Town Reports'
strikethrough/underline formatting, leaving ambiguities like `$15 $20`. Phase 2
recovers that formatting directly from the report **PDFs**.

## Feasibility — proven, not assumed

The reports state their own convention: *"underline and bold new, strikethrough
removed."* Re-extracting the 2024 PDF with `pdfplumber` at the character level
recovers it cleanly:

- **added text** = characters in a **bold** font (`fontname` contains `Bold`);
- **removed text** = characters crossed by a thin horizontal **strike line**
  (a `line`/`rect` whose y sits in the char's middle band, distinct from the
  baseline underline);
- everything else is unchanged.

Applied to the § 13-10 fee change (known ground truth) the classifier produced
the correct diff with no manual input:

```
[-DEL] $15   [+ADD] $20   [-DEL] $20   [+ADD] $25
BEFORE: … license fee of $15 … $20 for an intact dog.
AFTER : … license fee of $20 … $25 for an intact dog.
```

A second, independent check falls out for free: the reconstructed **after** text
must be a substring of (or reconcile with) the current codified section text from
eCode. That cross-check both validates a diff and disambiguates the rare case
where bold/strike detection is uncertain.

## Honest coverage (state this on the site)

This path only reaches amendments whose report **prints the styled change**, and
the convention only appears from **2016 onward**:

| Bucket | Count | Diff? |
|---|---|---|
| 2016–2025 amendments (styled era) | **32** | reconstructable — the phase-2 target |
| 2006–2015 amendments | in the 122 | report PDFs exist but do **not** mark changes → event-only |
| pre-2006 amendments | most of the 122 | no digitized report at all → event-only |

So phase 2 fills in roughly **the last decade** of changes with real diffs; the
older ~122 stay event-level and are labeled as such. Not every 2016+ article will
yield a clean diff (prose-heavy edits, changes described by reference to an
attachment, multi-section articles) — the target is high coverage of the 32, not
100%.

## Architecture

A new pipeline stage between extract and build, reusing v1's conventions
(`scripts/bylaws/`, Node orchestration; the PDF work is Python since `pdfplumber`
is the right tool).

```
acquire_ecode → parse_bylaws → extract_amendments → [NEW: extract_diffs] → reconcile → build_repo → verify_golden
```

### 1. `scripts/bylaws/diffs/extract_diffs.py` (Python + pdfplumber)
- Input: the diff-eligible amendments (2016+) from `amendments.jsonl`, plus each
  year's report PDF (URLs already in `data/town_docs/annual_reports/manifest.csv`;
  PDFs fetched to a gitignored cache, as v1 does for eCode raw text).
- For each amendment: locate its article block in the PDF, classify chars
  (added/removed/unchanged) per the rule above, and emit a per-section diff:
  `{ section, before, after, tokens:[{op,text}] }`.
- **Validate every diff**: the `after` must reconcile with the current codified
  section text (from `section-index.json`). Diffs that fail the cross-check are
  dropped to a `diffs.rejects.jsonl` for review, never shipped. (Same
  citation-discipline gate as v1: a diff that can't be verified is a bug, not a
  guess.)

### 2. Attach to the canonical store
- Write `data/bylaws-history/diffs.jsonl`, keyed `date|article|section`.
- `extract_amendments.mjs` (or a small merge step) upgrades a record's
  `change` from `{kind:"touched"}` to
  `{kind:"edit", section, before, after, tokens}` and its `fidelity` from
  `"blame"` to `"verbatim"` when a validated diff exists. The `fidelity` field
  is already the designed hook — nothing downstream needs restructuring.

### 3. Consumers light up automatically
- **build_repo.mjs**: verbatim commits can carry a real unified diff in the body
  (or touch a `text/<chapter>.md` that actually changes), so `git show <commit>`
  displays the wording change. Blame commits are unchanged.
- **verify_golden.mjs**: extend the golden check — for verbatim records, applying
  the recorded `after` must match the current codified text for that section.
- **web tool / preview**: the `DIFFS` map the preview currently hand-populates
  becomes generated `diffs.jsonl`; red/green rendering already exists.

## Testing

- **Ground-truth fixtures**: the § 13-10 2024 fee change (this doc) is the first;
  add 3–4 more hand-verified diffs across different years/shapes (a prose edit, a
  multi-section article, a deletion-only change) as regression fixtures.
- **Cross-check invariant**: every shipped diff's `after` reconciles with current
  eCode text (automated, runs over all diffs).
- **Coverage report**: how many of the 32 eligible amendments produced a
  validated diff, and which were dropped and why — logged, not silently skipped.

## Risks

1. **Convention drift** — phrasing varies ("cross out removed", "cross through is
   omitted"); the *rendering* (bold new, strike removed) appears consistent, but
   confirm across years on real PDFs before trusting a year wholesale.
2. **Section localization** — an article amends a named section; we must find that
   section's passage inside the article's PDF text. Use the section heading /
   subsection letters as anchors; fall back to event-only if not locatable.
3. **Multi-section articles** (e.g. 2013 Art. 32 touched 5 sections) — split the
   article's changed passages per section; partial success is fine (diff the ones
   we can localize).
4. **PDF availability / re-hosting** — report PDF URLs have moved before (v1 saw
   this); the manifest is the source of truth and fetch failures must be surfaced,
   not silently treated as "no diff".
5. **Scanned vs digital** — all current report PDFs have a real text layer (no OCR
   needed, per the annual-reports README); if a future year is scanned, this path
   degrades to event-only for that year.

## Out of scope

- Amendments before 2016 (no styled source) and any 2016+ article that doesn't
  print its change — these remain event-level, honestly labeled.
- Zoning (Ch. 200) — still phase-2-of-the-other-axis; this doc is General Bylaws.
- A general prose-diff algorithm — we extract the town's *own* marked changes, not
  compute our own diff between reconstructed versions.
