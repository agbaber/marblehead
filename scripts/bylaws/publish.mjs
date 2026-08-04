// Regenerate the bylaws history and publish it to the public repo in one command.
//
// Pipeline: [--refresh -> acquire_ecode] -> parse_bylaws -> extract_amendments ->
//           reconcile -> build_repo -> verify_golden -> force-push dist/bylaws-repo.
// verify_golden exits non-zero if the replay does not reproduce the current law,
// which aborts this script BEFORE anything is pushed.
//
// build_repo.mjs rebuilds dist/bylaws-repo from scratch each run with fixed
// author/committer dates, so commit SHAs are deterministic: an unchanged dataset
// produces an identical history and the force-push is a no-op.
//
// Flags:
//   --refresh        re-fetch Part I from eCode first (needs network + Playwright)
//   --dry-run        run the pipeline + golden but do NOT push
//   --remote <url>   override the target repo (default: agbaber/marblehead-bylaws)
//
// Run from the repo root: node scripts/bylaws/publish.mjs

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const remoteArg = args.indexOf('--remote');
const REMOTE = remoteArg >= 0 ? args[remoteArg + 1] : 'https://github.com/agbaber/marblehead-bylaws.git';
const REPO = 'dist/bylaws-repo';

function run(cmd, cmdArgs, opts = {}) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}`);
  execFileSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
}

const pipeline = [
  ...(has('--refresh') ? [['node', ['scripts/bylaws/acquire_ecode.mjs']]] : []),
  ['node', ['scripts/bylaws/parse_bylaws.mjs']],
  ['node', ['scripts/bylaws/extract_amendments.mjs']],
  ['node', ['scripts/bylaws/reconcile.mjs']],
  ['node', ['scripts/bylaws/build_repo.mjs']],
  ['node', ['scripts/bylaws/verify_golden.mjs']], // aborts (exit 1) before push on failure
];
for (const [cmd, cmdArgs] of pipeline) run(cmd, cmdArgs);

if (has('--dry-run')) {
  console.log('\n[dry-run] pipeline + golden verification passed; skipping push.');
  process.exit(0);
}

// build_repo.mjs starts REPO from a fresh `git init`, so there is never a
// pre-existing remote — add it, then force-push history and tags.
run('git', ['-C', REPO, 'remote', 'add', 'origin', REMOTE]);
run('git', ['-C', REPO, 'branch', '-M', 'main']);
run('git', ['-C', REPO, 'push', '--force', 'origin', 'main']);
run('git', ['-C', REPO, 'push', '--force', '--tags', 'origin']);

console.log(`\nPublished dist/bylaws-repo to ${REMOTE}`);
