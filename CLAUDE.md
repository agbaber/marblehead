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

## Don't read your own branch name back as user intent

You (Claude) usually pick the branch name for a new task, often before the
user has said anything beyond a question. That means the branch name
reflects *your* early interpretation, not the user's stated request. Don't
then turn around mid-conversation and cite the branch name as evidence of
what the user wants ("the branch is called `claude/add-ballot-info-XXXX`
so I assume you want a ballot info page added"). The user didn't name it;
you did. If you're unsure what the user wants, ask them directly, or act
on the words they actually said in the conversation.

Branch names are scratch paper for where commits will land. They are not
a user requirements document.

## Always open a PR after pushing

When you push a branch, always open a pull request for it as the next
step &ndash; don't wait to be asked. This overrides the default
"don't create PRs unless asked" behavior for this repo. Use
`mcp__github__create_pull_request` and report the PR URL back to the
user so they can find it without hunting.

One exception: if the push was explicitly a fixup onto an existing open
PR's branch, don't open a second PR.

## Default to manual merge; only use --auto when explicitly asked

When the user asks you to merge a PR, default to a plain
`gh pr merge <n> --squash --delete-branch` (or the equivalent MCP
`merge_pull_request` call). **Do not** enable auto-merge unless the user
specifically says "auto-merge it" or "fire-and-forget it."

Why: auto-merge fires the moment required checks pass, which can be
seconds after CI starts. Any commit pushed to the branch after that
moment ends up orphaned, parented on a pre-merge SHA. PR #621 hit this
exact bug on 2026-04-18: a follow-up commit landed milliseconds after
auto-merge fired and had to be cherry-picked into a recovery PR (#622).

This default is safer now that "Require branches to be up to date" is
**off** in branch protection: a manual merge no longer triggers a
rebase loop, so `--auto` is no longer needed to avoid the
push-wait-retry dance. Use it only when you genuinely want
fire-and-forget (e.g. you're closing the session and a long CI run is
in flight).

When you do use `--auto`, still check `mergeStateStatus == CLEAN`
before passing `--delete-branch` to avoid the orphaning issue
documented below.

## Post the preview URL when asking for a live review

Every PR gets a Cloudflare Pages preview deploy (see
`.github/workflows/preview.yml`), and the workflow posts a sticky
comment with `header: preview-url` containing a **Branch URL** (stable
across pushes) and a **This commit** URL (pinned to the current SHA).

Whenever you ask the user to look at a change in the live PR &ndash;
e.g. "can you eyeball this before merging?", "does this look right?",
"ready for review" &ndash; include the full preview URL in your message,
not just the PR link. Fetch it from the sticky preview comment (find
the comment whose body starts with `### Preview` and pull the
`**Branch URL:**` value). Prefer the Branch URL for ongoing review
since it follows new pushes; use the commit URL only when pinning to a
specific SHA matters.

If the preview comment isn't there yet (workflow still running or
failed), say so rather than sending a bare PR link and making the user
hunt for it.

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

### Never rewrite a file you haven't freshly read from your branch

Before editing a large file (especially `index.html`), **always read
its current contents from the branch you're working on**. Do not rely
on a version you read earlier in the conversation or from a different
branch. Full-file writes from a stale context silently revert other
people's merged work.

Concretely:

- **Targeted edits only.** Use find-and-replace or line-range edits,
  never write the entire file from memory. If you can't express your
  change as a surgical edit, re-read the file first.
- **Check your diff before committing.** Run `git diff --stat` and
  look at the line counts. If your change is supposed to add 50 lines
  but the diff shows 800 deletions, something is wrong -- you likely
  overwrote content that was already there.
- **Especially on iOS / web sessions** where the tool writes whole
  files: the session may have loaded an old copy of the file hours
  earlier. Always re-fetch before writing.

This rule exists because commit `cbaaed6` (Apr 16 2026) did a
full-file rewrite of `index.html` from a stale base and silently
reverted four previously-merged PRs (#410, #413, #416, #420).

### PR scope

One PR per logical change. Don't piggyback unrelated fixes (e.g. adding
`CLAUDE.md`) onto an open feature PR. If you discover an unrelated issue
mid-task, start a fresh branch off `main` for it rather than mixing it
into the current PR.
