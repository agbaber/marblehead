import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BOARDS, boardForTitle } from './config.mjs';

test('DEFAULT_BOARDS lists the five in-scope boards', () => {
  const slugs = DEFAULT_BOARDS.map(b => b.slug).sort();
  assert.deepEqual(slugs, [
    'board-of-health',
    'finance-committee',
    'school-committee',
    'select-board',
    'town-meeting',
  ]);
});

test('boardForTitle matches Select Board with the canonical prefix', () => {
  const m = boardForTitle('Marblehead Select Board Meeting: 5-27-26');
  assert.equal(m.slug, 'select-board');
  assert.equal(m.display, 'Select Board');
});

test('boardForTitle matches School Committee without the Marblehead prefix', () => {
  const m = boardForTitle('School Committee Meeting 9-14-22');
  assert.equal(m.slug, 'school-committee');
});

test('boardForTitle matches FinCom by either name', () => {
  assert.equal(boardForTitle('Marblehead Finance Committee 3-12-25').slug, 'finance-committee');
  assert.equal(boardForTitle('FINCOM Meeting 4-2-24').slug, 'finance-committee');
});

test('boardForTitle returns null on unrelated titles', () => {
  assert.equal(boardForTitle('MHS Scores and Stats - Week 3'), null);
  assert.equal(boardForTitle("'Headliner - The News of Marblehead: 6-5-26"), null);
});

test('boardForTitle returns null on board-member interview profiles', () => {
  assert.equal(boardForTitle('Select Board - Jim Full'), null);
  assert.equal(boardForTitle('School Committee - Sarah Fox'), null);
});

test('boardForTitle rejects Headliner news segments that mention a board', () => {
  assert.equal(boardForTitle("'Headliner - Board of Health Updates"), null);
  assert.equal(boardForTitle("'Headliner Town Meeting Preview - Article 34"), null);
  assert.equal(boardForTitle("'Headliner - School Committee Election Results"), null);
});

test('boardForTitle accepts meeting subtitles that look like names mid-string', () => {
  // "Finance Committee Meeting - Warrant Articles Overview 4.10.23" exists in
  // the real corpus and used to be wrongly rejected by the unanchored
  // profile-name regex.
  const m = boardForTitle('Finance Committee Meeting - Warrant Articles Overview 4.10.23');
  assert.equal(m?.slug, 'finance-committee');
});
