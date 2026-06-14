import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResponse } from './parse_response.mjs';

const GOOD = JSON.stringify({
  summary_card: {
    headline: 'Three-tier override sized at $9M / $12M / $15M',
    summary: 'The board sized the FY27 override at three tiers.',
    decisions: ['Approved bond sale to Oppenheimer'],
    votes: [{ motion: 'Approve bond sale', result: 'in favor (unanimous)' }],
  },
  topic_segments: [
    {
      topic: 'override',
      topic_confidence: 0.95,
      start_seconds: 1340,
      end_seconds: 6500,
      featured: true,
      headline: "Marblehead's first tiered override",
      dek: 'On a $1M home, three-year cumulative cost ranges from $900 to $1,500.',
      summary: 'Two ballot questions.',
      key_speakers: ['Matt Fernald (CFO)'],
    },
  ],
});

test('parseResponse accepts a well-formed payload', () => {
  const r = parseResponse(GOOD);
  assert.equal(r.valid, true);
  assert.equal(r.summary_card.headline, 'Three-tier override sized at $9M / $12M / $15M');
  assert.equal(r.topic_segments[0].topic, 'override');
});

test('parseResponse rejects unknown topic slugs', () => {
  const bad = JSON.parse(GOOD);
  bad.topic_segments[0].topic = 'not-a-real-topic';
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /unknown topic.*not-a-real-topic/i);
});

test('parseResponse rejects non-integer start_seconds', () => {
  const bad = JSON.parse(GOOD);
  bad.topic_segments[0].start_seconds = '1340';
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /start_seconds/i);
});

test('parseResponse rejects empty headline', () => {
  const bad = JSON.parse(GOOD);
  bad.summary_card.headline = '';
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /headline/i);
});

test('parseResponse rejects more than one featured topic', () => {
  const bad = JSON.parse(GOOD);
  bad.topic_segments.push({
    topic: 'school-budget',
    topic_confidence: 0.9,
    start_seconds: 7000,
    end_seconds: 8000,
    featured: true,
    headline: 'A second featured topic',
    dek: 'd',
    summary: 's',
    key_speakers: [],
  });
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /more than one featured/i);
});

test('parseResponse flags OCR-style dollar figures in summary text', () => {
  const bad = JSON.parse(GOOD);
  bad.summary_card.summary = 'The board approved S15M in bonds.';
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /OCR-?style.*S\d/i);
});

test('parseResponse rejects malformed JSON', () => {
  const r = parseResponse('not json');
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /json/i);
});
