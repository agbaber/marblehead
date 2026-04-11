# CLAUDE.md

Project notes for Claude Code / Claude iOS app sessions on
[marbleheaddata.org](https://marbleheaddata.org).

## Read these first

Before making any content or design change, read:

- **[STYLE_GUIDE.md](STYLE_GUIDE.md)** &ndash; the design system (palette,
  typography, page types, SVG chart classes, chart principles) and a
  "What Not To Do" list. Excluded from the Jekyll build, so these rules
  don't appear on the site but are authoritative.
- **[README.md](README.md)** &ndash; project purpose, data inventory, and
  editorial stance.

If you touch CSS, charts, or page copy without reading STYLE_GUIDE first,
you will violate a rule in it. (Examples of easy-to-miss rules: no
em-dashes in site copy, no inline `style=""` on SVG elements, no
CPI/inflation comparisons for municipal cost categories, no green/red
value judgments on comparisons.)

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

## Git: don't push follow-up commits to a merged branch

When a PR is merged, the branch it was on is **done**. Do not push
additional commits to it &ndash; they end up orphaned (not in any open PR,
parented on a pre-merge commit).

### How to detect a stale branch before pushing

```bash
git fetch origin main
git log origin/main..HEAD       # if empty, every commit is already merged
git merge-base HEAD origin/main # if this equals origin/main HEAD, branch is stale
```

If the branch is stale, start fresh instead of reusing it.

### Flow on the iOS app / web (no worktrees)

1. `git fetch origin main`
2. `git checkout -b <new-branch> origin/main`
3. Make the changes (or `git cherry-pick <commit>` if the commit already
   exists on a stale branch)
4. `git push -u origin <new-branch>`
5. Open a new PR with `mcp__github__create_pull_request`

### Flow on a local PC

Use **git worktrees**, not the cherry-pick dance above. Each new piece of
work gets its own worktree off `main` so there's no risk of accidentally
pushing onto a merged branch.

### PR scope

One PR per logical change. Don't piggyback unrelated fixes (e.g. adding
`CLAUDE.md`) onto an open feature PR. If you discover an unrelated issue
mid-task, start a fresh branch off `main` for it rather than mixing it
into the current PR.
