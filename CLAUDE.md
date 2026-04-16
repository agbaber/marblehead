# CLAUDE.md

Project notes for Claude Code / Claude iOS app sessions on
[marbleheaddata.org](https://marbleheaddata.org).

## Read these first

Before making any content or design change, read:

- **[STYLE_GUIDE.md](STYLE_GUIDE.md)** -- the design system (palette,
  typography, page types, SVG chart classes, chart principles) and a
  "What Not To Do" list. Excluded from the Jekyll build, so these rules
  don't appear on the site but are authoritative.
- **[README.md](README.md)** -- project purpose, data inventory, and
  editorial stance.

If you touch CSS, charts, or page copy without reading STYLE_GUIDE first,
you will violate a rule in it. (Examples of easy-to-miss rules: no
em-dashes in site copy, no inline `style=""` on SVG elements, no
standalone CPI/inflation comparisons as the sole benchmark for a
municipal cost category, no green/red value judgments on comparisons.)

## Editorial stance

From README: *"This is not an advocacy project. The goal is to make the
data accessible and verifiable so residents can form their own opinions
based on facts, not rhetoric."*

STYLE_GUIDE reinforces this: *"State facts in captions, not conclusions.
No editorial language in captions or notes."*

In practice:

- No "shocking", "outrageous", "crisis", "skyrocketing" etc.
- No framing that implies a voter should vote yes or no on an override.
- Comparisons should use neutral semantic colors, never green-good /
  red-bad, because Marblehead residents disagree on what's good and bad.
- Caveats on volatile data (FY23 FTE jump, FY13 OPEB spike, GASB pension
  volatility) must be surfaced where the number appears, not hidden.

## No meta-narration

Don't write sentences that describe what the page is about to do. Just do
it. "This page explains why, maps the actual overlap, and sizes the
realistic savings" is three clauses that say nothing a reader couldn't
learn by scrolling down. Cut the tour-guide voice entirely:

- **Kill:** "This page shows...", "This section covers...", "Below you'll
  find...", "The following table classifies...", "Here we walk through..."
- **Replace with:** the actual claim, finding, or context that earns the
  sentence's existence. If removing the sentence loses nothing, remove it.
- **Test:** read the sentence back. If it would still be true about a
  *blank* page with the same title, it's filler.

## Every number must trace to a primary source

From README: *"Every number should be traceable to a primary source. If
it's not, that's a bug."*

When adding a chart, table, or stat:

1. Cite the source document and page (see `data/SOURCE_LOOKUP.md` for
   the pattern: "FY24 ACFR page 129, Property Tax Levies and Collections").
2. If the source is a multi-year compilation, note which year's document
   the value came from.
3. If a number is derived, say so and show the derivation.
4. Primary sources: ACFRs, DOR DLS reports, GIC rate sheets, PERAC
   valuations, FinCom reports, proposed budgets, State of the Town
   presentations. News articles are secondary and should only be used
   when primary data is not yet available.

## Markdown doc pages: use `body_class: doc-page`

`_config.yml` defaults all pages to `layout: page`, so markdown files in
`data/` don't need to specify a layout. For markdown pages that render
heavy lists, tables, or long URLs (e.g. `data/DATA_CATALOG.md`,
`data/SOURCE_LOOKUP.md`, `data/case_studies.md`), add to the frontmatter:

```yaml
---
body_class: doc-page
title: ...
---
```

This opts into the scoped `body.doc-page .page ...` styles in
`assets/site.css` (list bullets, responsive fallback tables, long-URL
wrapping, inline code). Without it, markdown lists render bulletless and
long URLs cause horizontal scroll on mobile.

When styling doc-page markdown content, always scope selectors with
`body.doc-page .page` so bespoke HTML pages that already use `.page` with
their own `.tier-list`, `.tldr ul`, etc. are not affected.

## Parallel-session safety

Multiple Claude sessions edit this repo concurrently. Every session must
assume another session is modifying the same files right now. One
principle: **never trust your in-memory copy of a file.**

- **Targeted edits only.** Use find-and-replace or line-range edits,
  never write an entire file from memory. If you can't express your
  change as a surgical edit, re-read the file first.
- **Re-read before writing.** Before editing a large file (especially
  `index.html`), always read its current contents from the branch you're
  working on. Do not rely on a version you read earlier in the
  conversation or from a different branch.
- **Check your diff before committing.** Run `git diff --stat` and look
  at the line counts. If your change is supposed to add 50 lines but the
  diff shows 800 deletions, you likely overwrote content from another
  session.
- **iOS / web sessions** write whole files. The session may have loaded
  an old copy hours earlier. Always re-fetch before writing.

This rule exists because commit `cbaaed6` (Apr 16 2026) did a full-file
rewrite of `index.html` from a stale base and silently reverted four
previously-merged PRs (#410, #413, #416, #420).

## Git workflow

### Always work from fresh main

Each piece of work gets its own branch off `origin/main`. On a local PC,
use **git worktrees** (not checkout). On iOS / web, use:

```bash
git fetch origin main
git checkout -b <new-branch> origin/main
# make changes
git push -u origin <new-branch>
```

### Don't push to merged branches

When a PR is merged, the branch is **done**. Do not push follow-up
commits to it -- they end up orphaned. Check before pushing:

```bash
git fetch origin main
git log origin/main..HEAD       # if empty, branch is stale
```

If stale, start a fresh branch instead.

### Always open a PR after pushing

Open a pull request immediately after pushing -- don't wait to be asked.
Report the PR URL back to the user. One exception: fixup pushes onto an
existing open PR's branch.

### Keep PRs small

One PR per logical change. Don't piggyback unrelated fixes onto a
feature PR. CI will fail if a PR touches more than 5 files or 500 lines.
Add `[large]` to the PR title to override for intentional large changes.

### Don't read your own branch name back as user intent

You (Claude) usually pick the branch name before the user has said
anything beyond a question. The branch name reflects your early
interpretation, not the user's stated request. If you're unsure what
the user wants, ask them directly.
