# Bylaws history pipeline

Builds a git repository of Marblehead's General Bylaws (Part I) where each
commit is a Town Meeting article, authored by its sponsor and carrying its
vote tally. See `docs/superpowers/specs/2026-07-15-bylaws-history-design.md`.

## Run order
1. `node scripts/bylaws/acquire_ecode.mjs`      # snapshot current codified text
2. `node scripts/bylaws/parse_bylaws.mjs`       # -> data/bylaws-history/bylaws/*.md + section-index.json
3. `node scripts/bylaws/extract_amendments.mjs` # -> amendments.jsonl
4. `node scripts/bylaws/reconcile.mjs`          # -> reconcile-report.md
5. `node scripts/bylaws/build_repo.mjs`         # -> generated git repo
6. `node scripts/bylaws/verify_golden.mjs`      # master check: replay == current text

## Publish
`node scripts/bylaws/publish.mjs` runs steps 2-6 and force-pushes the generated
`dist/bylaws-repo` to the public repo (github.com/agbaber/marblehead-bylaws), so
the browsable history never drifts from this pipeline. It aborts before pushing
if `verify_golden` fails. Flags: `--refresh` (re-fetch eCode first, needs network
+ Playwright), `--dry-run` (build + verify, no push), `--remote <url>`.

## Test
`node --test scripts/bylaws/lib/*.test.mjs`

## Honest constraints (do not violate)
- Open Town Meeting is anonymous: attribute sponsor + aggregate tally only.
- Never fabricate historical text: blame-only records carry no reconstructed body.
