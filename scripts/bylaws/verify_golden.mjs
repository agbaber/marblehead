// Golden verification for the generated repo (v1, blame-level):
//  1. HEAD's bylaws/*.md byte-equals the canonical current text — the amendment
//     replay must never corrupt the law.
//  2. Commit count == 1 import + every amendment record.
// (Verbatim historical-text replay is phase 2; there is no old-text to diff yet.)

import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const REPO = 'dist/bylaws-repo';
const SRC = 'data/bylaws-history/bylaws';
const AMEND = 'data/bylaws-history/amendments.jsonl';

let failures = 0;

for (const name of readdirSync(SRC)) {
  const want = readFileSync(`${SRC}/${name}`, 'utf8');
  const got = execFileSync('git', ['-C', REPO, 'show', `HEAD:bylaws/${name}`], { encoding: 'utf8' });
  if (got !== want) { failures++; console.error(`MISMATCH: bylaws/${name} (HEAD differs from canonical text)`); }
}

const records = readFileSync(AMEND, 'utf8').trim().split('\n').length;
const commits = Number(execFileSync('git', ['-C', REPO, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim());
const expected = records + 1;
if (commits !== expected) { failures++; console.error(`COMMIT COUNT: got ${commits}, expected ${expected} (1 import + ${records} amendments)`); }

if (failures) {
  console.error(`GOLDEN FAILED: ${failures} problem(s).`);
  process.exit(1);
}
console.log(`GOLDEN PASSED: HEAD reproduces current law exactly; ${commits} commits (1 import + ${records} amendments).`);
