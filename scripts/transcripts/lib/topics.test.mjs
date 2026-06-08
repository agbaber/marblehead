import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWN_TOPICS, isKnownTopic } from './topics.mjs';

test('KNOWN_TOPICS contains the 11 in-use topics', () => {
  assert.deepEqual([...KNOWN_TOPICS].sort(), [
    '40b-mbta',
    'admin-housekeeping',
    'bonding-capital',
    'labor-personnel',
    'override',
    'permits-zoning',
    'public-comment',
    'public-safety',
    'recreation-events',
    'school-budget',
    'trash-dpw',
  ]);
});

test('isKnownTopic matches case-sensitive slugs', () => {
  assert.equal(isKnownTopic('override'), true);
  assert.equal(isKnownTopic('Override'), false);
  assert.equal(isKnownTopic('overide'), false);
  assert.equal(isKnownTopic(''), false);
  assert.equal(isKnownTopic(null), false);
});
