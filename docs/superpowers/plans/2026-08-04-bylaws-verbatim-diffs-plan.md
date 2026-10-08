# Verbatim Diffs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Produce validated word-level diffs for the 32 diff-eligible (2017–2024) bylaw amendments and upgrade those records from `blame` to `verbatim`, so the history and web view show real red/green changes.

**Architecture:** A Python stage (`scripts/bylaws/diffs/`, pdfplumber) that re-extracts each amendment's article block from the report PDF, classifies characters (bold = added, mid-strike = removed), localizes the changed passage to the affected section, and validates the reconstructed `after` against the current codified text before emitting. A Node merge step folds validated diffs into `amendments.jsonl`.

**Tech Stack:** Python 3 + pdfplumber (venv, `requirements.txt`); pytest for the pure classifier; existing Node pipeline for the merge.

---

## Task 1: PDF fetch + cache

**Files:** Create `scripts/bylaws/diffs/fetch_pdfs.py`, `scripts/bylaws/diffs/requirements.txt`

- [ ] Read `data/town_docs/annual_reports/manifest.csv`; for years 2017–2024, download each PDF to `data/bylaws-history/raw/pdfs/<year>.pdf` (gitignored). Skip if present. Surface HTTP failures (don't treat as "no diff").
- [ ] `requirements.txt`: `pdfplumber`, `pytest`.
- [ ] Verify: all 8 PDFs present, sizes > 0. Commit the script (not the PDFs).

## Task 2: Character classifier (pure, TDD)

**Files:** Create `scripts/bylaws/diffs/lib/classify.py`, `scripts/bylaws/diffs/lib/test_classify.py`

- [ ] **Test first** — feed a fixture list of char dicts `{text,bold,struck}` representing `license fee of $15 $20` (bold on the new value, strike on the old) and assert `classify(chars)` returns tokens `[{op:" ",text:"license fee of "},{op:"-",text:"$15"},{op:"+",text:"$20"}]` and `before/after` strings.
- [ ] Run: `pytest` → fail (no module).
- [ ] **Implement** `classify(chars)`: bold ⇒ `+` (added); struck-and-not-bold ⇒ `-` (removed); else unchanged. Merge adjacent same-op runs. Return `{tokens, before, after}`. (Rule proven against 2024 §13-10 ground truth.)
- [ ] Run: `pytest` → pass.

## Task 3: Article-block char stream from PDF

**Files:** Create `scripts/bylaws/diffs/lib/pdfblock.py`

- [ ] `article_chars(pdf, article)` → ordered chars for that article's **warrant** block (the copy with styled text), gathered across page boundaries, with page furniture (running header/footer, page numbers, "MARBLEHEAD TOWN REPORT YYYY") filtered by y-band and known patterns. Each char carries `text, fontname, x0,x1,top,bottom` plus a computed `bold` and `struck` (mid-band horizontal rule test, distinct from baseline underline).
- [ ] Disambiguate multiple "Article N" occurrences (warrant vs results vs index): choose the block that contains the convention marker / the most bold+strike chars.
- [ ] Verify on 2024 Art. 33: the stream contains the fee sentence with correct bold/strike flags.

## Task 4: Localize to section + validate

**Files:** Create `scripts/bylaws/diffs/lib/localize.py`

- [ ] Given an article's classified tokens and an affected section's current codified text (from `section-index.json` + `bylaws/*.md`), extract the changed passage for that section (anchor on section heading / subsection letters; for single-section articles the whole changed span is the passage).
- [ ] **Validate**: the reconstructed `after` must be a substring of (or high-similarity match to) the current codified section text. Pass ⇒ emit; fail ⇒ record a reject with reason.

## Task 5: Orchestrator → diffs.jsonl

**Files:** Create `scripts/bylaws/diffs/extract_diffs.py`; output `data/bylaws-history/diffs.jsonl`, `data/bylaws-history/diffs.rejects.jsonl`

- [ ] Load `amendments.jsonl`; for each 2017–2024 record, open its year PDF, get the article stream, classify, localize per affected section, validate. Emit `{date,article,section,before,after,tokens,source}` for passes.
- [ ] Print a coverage report: of 32 eligible, how many produced ≥1 validated diff, and the reject reasons. Log dropped ones (no silent truncation).

## Task 6: Merge into amendments (Node)

**Files:** Modify `scripts/bylaws/extract_amendments.mjs` (or add `merge_diffs.mjs`)

- [ ] Where a validated diff exists for `date|article|section`, set that record's `change = {kind:"edit", section, before, after, tokens}` and `fidelity = "verbatim"`. Others stay `blame` / `touched`.
- [ ] Re-run; confirm N records now `verbatim`.

## Task 7: Consumers

**Files:** Modify `scripts/bylaws/build_repo.mjs`, `scripts/bylaws/verify_golden.mjs`

- [ ] build_repo: for verbatim records, include the unified before/after in the commit body.
- [ ] verify_golden: for each verbatim record, assert its `after` reconciles with the current codified section text.
- [ ] Run full pipeline + golden green.

## Task 8: Regenerate + publish

- [ ] `node scripts/bylaws/build_repo.mjs && node scripts/bylaws/verify_golden.mjs`; then `publish.mjs`. Update the web preview's diff source from generated `diffs.jsonl`.
