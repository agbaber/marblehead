import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCommit } from './gitemit.mjs';

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
