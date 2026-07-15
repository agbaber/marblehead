---
title: Marblehead Bylaws History (v1) — design
date: 2026-07-15
status: approved
scope: General Bylaws (Part I) only; Zoning (Ch. 200) deferred to phase 2
---

# Marblehead Bylaws History — v1 design

## Goal

Provide line-level, time-aware provenance for Marblehead's **General
Bylaws (Part I)**. A reader points at any clause and learns:

- *when* that language entered the law,
- *which* Town Meeting and article changed it,
- *who* sponsored the article, and
- *how the vote went*,

plus a real before/after text diff wherever we have the source material.

**Product:** a web tool on marbleheaddata.org (blame / timeline / diff).
**Byproduct:** a real, pushable git repository generated from the same
data — commits, git-blame, git log, per-Town-Meeting tags. No scripted
GitHub PRs.

## The honest core (load-bearing constraints)

These are not incidental; they define what the project may and may not
claim.

1. **Open Town Meeting is anonymous.** Marblehead votes by electronic
   keypad and records only aggregate tallies (`Voted Yes N No M`). There
   is no roll call and never has been. We attribute the **sponsor** (the
   board or petitioner who moved the article) and the **aggregate
   tally** only. We never imply per-person vote data, because it does
   not exist.

2. **We never fabricate historical legal text.** Where we cannot
   reconstruct the exact wording of a section at a past date, the record
   is marked "not reconstructed" — never invented. This follows the
   project's primary-source discipline: every number and quote traces to
   a source document, or it is a bug.

3. **1967 is a floor, not an origin.** The eCode codification derives
   from the 1967 Code; Marblehead has passed bylaws since 1649. "History
   to 1967" means "back to the first machine-clean codified baseline,"
   and we say so.

## Fidelity model (what v1 actually delivers)

| Period | What we hold | Fidelity |
|---|---|---|
| 2006 – today | Annual Town Report warrant text (article language, sponsor, tally) **already in repo** at `data/town_docs/annual_reports/` | **verbatim** — real before/after diffs |
| 1967 – 2005 | eCode per-section amendment notes (`[Amended M-D-YYYY ATM Art. N]`) only — dates, not prior text | **blame** — "this section was touched at this meeting"; no reconstructed prior text |
| pre-1967 | not in scope | — |

The `fidelity` field on every amendment record is the seam that lets us
upgrade 1967–2005 to verbatim later (see "Deferred").

## Architecture

The **canonical structured store is the single source of truth.** Both
the git repo and the web tool are *renderings* of it — neither is
authored by hand.

### 1. Canonical data — `data/bylaws-history/`

- `bylaws/*.md` — the current codified General Bylaws (Part I) from
  eCode, one file per chapter (e.g. `bylaws/074-dogs.md`),
  section-addressable. This is HEAD.
- `amendments.jsonl` — one record per (meeting, article) that touched
  the bylaws:

  ```jsonc
  {
    "meeting": { "date": "2019-05-06", "type": "ATM" },
    "article": 14,
    "sponsor": "Planning Board",
    "vote": { "yes": 611, "no": 204, "threshold": "majority", "met": true },
    "disposition": "passed",            // passed | defeated | withdrawn | referred
    "affects": ["074-3", "074-5"],      // chapter-section refs
    "change": { /* strike/insert or before→after (verbatim); "touched" (blame) */ },
    "source": { "doc": "Annual-Report-2019.txt", "page": 187 },
    "fidelity": "verbatim"              // verbatim | blame
  }
  ```

### 2. Pipeline (deterministic, re-runnable)

1. **Ingest current text.** Obtain eCode Part I → write `bylaws/*.md`
   (HEAD). Also scrape the `[Amended M-D-YYYY ATM Art. N]` annotations on
   each section → the **blame backbone to the 1967 Code**.
2. **Extract verbatim amendments (2006–2025).** Parse the Annual Town
   Reports for article text, sponsor, tally, disposition; map each
   amending article to the section(s) it changes; capture the
   strike/insert. Extraction is LLM-assisted but **verified against the
   quoted source at write time** (citation discipline) — not blind.
3. **Reconcile.** For 2006+, eCode's amendment dates must agree with the
   report-derived amendments. Discrepancies are flagged, not silently
   resolved.
4. **Replay.** Walk HEAD backward applying the inverse of each verbatim
   diff to reconstruct prior text; blame-only amendments become
   touch-only synthetic commits (no reconstructed text).

### 3. git repo (byproduct)

Generated oldest → newest so HEAD reproduces the current eCode text
exactly. Each commit:

- `author` = sponsor, mapped to a stable identity
  (e.g. `Finance Committee <fincom@marblehead>`),
- `date` = meeting date,
- message = article title + `Voted Yes N No M` + threshold + source
  citation + fidelity tag,
- one **tag per Town Meeting**.

Verbatim commits carry real diffs. Blame-only commits carry a note and a
placeholder marker where prior text is unknown — never fabricated text.
No scripted GitHub PRs (deliberately skipped; effort/novelty ratio poor).

### 4. Web tool (the product)

On marbleheaddata.org, STYLE_GUIDE-compliant, editorially neutral:

- **Blame view** — current bylaw text; each section annotated with its
  latest amending meeting; click for article / sponsor / vote / source.
- **Timeline** — every Town Meeting as a point; click to see the
  bylaw-touching articles that year, with diffs where verbatim.
- **Diff view** — pick two dates; render the chapter diff (verbatim
  range only; graceful "not available before 2006" outside it).

Diff add/remove coloring uses neutral semantics (it marks insertion vs
deletion, not good vs bad), consistent with the style guide's ban on
green-good / red-bad value judgments.

## Correctness / testing

- **Golden test:** replaying every commit must reproduce the current
  eCode Part I text byte-for-byte. This is the master check that the
  reconstruction is faithful.
- Every `amendments.jsonl` record must carry a `source` citation
  (enforced by lint, consistent with existing repo content guardrails).
- Parsed vote tallies must match the annual-report source text
  (spot-check + count reconciliation).
- The sponsor-identity mapping table gets a human review pass before the
  repo is generated.

## Known risks (plan tasks, not blockers)

1. **eCode is bot-protected** (403 / JS challenge). v1's *first* task is
   obtaining Part I via General Code's PDF/print export (or a Town Clerk
   request), not naive scraping. Everything downstream depends on it —
   flag early.
2. **Article → section mapping** is the fiddly NLP step; it needs
   verification, not a blind LLM pass.
3. **Sponsor attribution** is not always clean in the reports; it needs
   a mapping + review pass (many articles default to the Select Board).
4. **Pre-2006 blame completeness** depends on eCode having cataloged old
   changes; the record may be lumpy, and we disclose that on the site.

## Out of scope for v1 (deferred)

- **Zoning (Chapter 200)** — phase 2. It is the most-amended and
  highest-interest body of law but also the bulk of the extraction work.
- **Pre-2006 verbatim text** — backfill later if General Code supplements
  (each a full-code snapshot = a natural diff point) can be obtained from
  General Code or the Town Clerk. The `fidelity` field is the hook.
- **Scripted GitHub PRs** — the "browse it like a codebase with real
  merged/closed PRs" treatment is intentionally not built; commit history
  + blame + tags deliver the value without the fragile machinery.

## Data sources

- eCode360 Part I — https://ecode360.com/MA1991 (current text through
  2024-05-06; per-section amendment histories).
- Annual Town Reports 2006–2025 — `data/town_docs/annual_reports/`
  (already in repo; verbatim warrant text + tallies + sponsors).
- (Deferred) General Code supplements / pre-2006 print reports — for
  1967–2005 verbatim backfill.
