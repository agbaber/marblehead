import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { formatCommit, initRepo, commitInto } from './gitemit.mjs';

test('commitInto records author, date, and subject and advances HEAD', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bylaws-'));
  initRepo(dir);
  writeFileSync(join(dir, 'chapter.md'), 'v1\n');
  commitInto(dir, {
    subject: '2019 ATM Art. 14: Amend leash bylaw',
    body: 'Voted Yes 611 No 204 (majority)',
    authorName: 'Planning Board',
    authorEmail: 'planning-board@marblehead.town',
    date: '2019-05-06T12:00:00',
  }, ['chapter.md']);
  const log = execFileSync('git', ['-C', dir, 'log', '-1', '--pretty=%an|%ae|%ad|%s', '--date=short'], { encoding: 'utf8' });
  assert.match(log, /Planning Board\|planning-board@marblehead\.town\|2019-05-06\|2019 ATM Art\. 14/);
});

const rec = {
  meeting: { date: '2019-05-06', type: 'ATM' },
  article: 14,
  title: 'Amend leash bylaw',
  sponsor: 'Planning Board',
  vote: { yes: 611, no: 204, threshold: 'majority', met: true },
  disposition: 'passed',
  source: { doc: 'Annual-Report-2019.txt', page: 187 },
  fidelity: 'verbatim',
};
const map = { 'Planning Board': 'Planning Board' };

test('builds subject with meeting, article, and title', () => {
  const c = formatCommit(rec, map);
  assert.equal(c.subject, '2019 ATM Art. 14: Amend leash bylaw');
});

test('body carries tally, sponsor, source, fidelity', () => {
  const c = formatCommit(rec, map);
  assert.match(c.body, /Voted Yes 611 No 204 \(majority\)/);
  assert.match(c.body, /Sponsor: Planning Board/);
  assert.match(c.body, /Source: Annual-Report-2019\.txt p\.187/);
  assert.match(c.body, /Fidelity: verbatim/);
});

test('author is the mapped sponsor identity; date is the meeting date', () => {
  const c = formatCommit(rec, map);
  assert.equal(c.authorName, 'Planning Board');
  assert.equal(c.authorEmail, 'planning-board@marblehead.town');
  assert.equal(c.date, '2019-05-06T12:00:00');
});

test('defeated article says Defeated in the body', () => {
  const d = { ...rec, disposition: 'defeated', vote: { yes: 204, no: 611, threshold: 'majority', met: false } };
  assert.match(formatCommit(d, map).body, /Disposition: defeated/);
});

test('clamps a pre-1970 git date but keeps the true date in subject and body', () => {
  const old = { ...rec, meeting: { date: '1954-03-11', type: 'TM' }, article: 73 };
  const c = formatCommit(old, map);
  assert.equal(c.date, '1970-01-01T12:00:00');        // git-safe timestamp
  assert.match(c.subject, /^1954 TM Art\. 73:/);       // true year preserved
  assert.match(c.body, /Meeting: 1954-03-11 TM/);      // true date preserved
});
