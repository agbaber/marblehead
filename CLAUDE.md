# CLAUDE.md

Project notes for Claude Code / Claude iOS app sessions.

## Don't push follow-up commits to a merged branch

When a PR I pushed has already been merged, the branch it was on is **done**.
Do **not** push additional commits to it — they end up orphaned (not in any
open PR, parented on a pre-merge commit).

### How to detect this before pushing

Before starting new work on an existing feature branch, check whether its
commits are already in `origin/main`:

```bash
git fetch origin main
git log origin/main..HEAD       # if empty, every commit is already merged
git merge-base HEAD origin/main # if this equals origin/main HEAD, branch is stale
```

If the branch is stale (PR merged), start fresh instead of reusing it.

### Flow when on the iOS app / web / any non-worktree environment

1. `git fetch origin main`
2. `git checkout -b <new-branch> origin/main`
3. Make the changes (or `git cherry-pick <commit>` if the commit already exists
   on the stale branch)
4. `git push -u origin <new-branch>`
5. Open a new PR with `mcp__github__create_pull_request`

### Flow when working on a local PC

Use **git worktrees** — not the cherry-pick dance above. Each new piece of
work gets its own worktree off `main` so there's no risk of accidentally
pushing onto a merged branch.
