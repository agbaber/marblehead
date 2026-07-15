import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoteLine } from './voteline.mjs';

test('parses a simple majority tally', () => {
  const r = parseVoteLine('Voted Yes 599 No 85: That the Town adopt an order');
  assert.deepEqual(r, { yes: 599, no: 85, threshold: 'majority', met: true, rest: 'That the Town adopt an order' });
});

test('parses a two-thirds tally', () => {
  const r = parseVoteLine('Voted Yes 638 No 97 2/3rd vote achieved');
  assert.equal(r.yes, 638);
  assert.equal(r.no, 97);
  assert.equal(r.threshold, 'two-thirds');
  assert.equal(r.met, true);
});

test('parses a four-fifths tally', () => {
  const r = parseVoteLine('Voted Yes 714 No 76 4/5th vote achieved');
  assert.equal(r.threshold, 'four-fifths');
  assert.equal(r.met, true);
});

test('detects a tally that appears defeated on a supermajority', () => {
  const r = parseVoteLine('Voted Yes 469 No 345');
  assert.equal(r.yes, 469);
  assert.equal(r.no, 345);
  assert.equal(r.threshold, 'majority');
  assert.equal(r.met, true);
});

test('returns null for a non-vote line', () => {
  assert.equal(parseVoteLine('To see if the Town will vote to amend'), null);
});
