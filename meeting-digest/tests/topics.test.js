import { describe, it, expect } from 'vitest';
import { TOPICS, SUBSCRIBABLE_TOPICS, BOARDS, isKnownTopic, isKnownBoard } from '../worker/src/lib/topics.js';

describe('TOPICS taxonomy', () => {
  it('contains all 13 slugs from scripts/transcripts/lib/topics.mjs', () => {
    expect(TOPICS.map(t => t.slug).sort()).toEqual([
      '40b-mbta', 'admin-housekeeping', 'bonding-capital', 'elections-procedural',
      'health-insurance', 'labor-personnel', 'override', 'permits-zoning',
      'public-comment', 'public-safety', 'recreation-events', 'school-budget', 'trash-dpw'
    ]);
  });
  it('every topic has a non-empty label', () => {
    for (const t of TOPICS) expect(t.label.length).toBeGreaterThan(0);
  });
  it('SUBSCRIBABLE_TOPICS excludes admin-housekeeping and public-comment', () => {
    const slugs = SUBSCRIBABLE_TOPICS.map(t => t.slug);
    expect(slugs).not.toContain('admin-housekeeping');
    expect(slugs).not.toContain('public-comment');
    expect(slugs).toContain('override');
  });
});

describe('BOARDS', () => {
  it('contains the 5 default boards in display order', () => {
    expect(BOARDS.map(b => b.slug)).toEqual([
      'select-board', 'school-committee', 'finance-committee', 'board-of-health', 'town-meeting'
    ]);
  });
});

describe('isKnownTopic / isKnownBoard', () => {
  it('match exact slugs only', () => {
    expect(isKnownTopic('override')).toBe(true);
    expect(isKnownTopic('Override')).toBe(false);
    expect(isKnownTopic('')).toBe(false);
    expect(isKnownBoard('select-board')).toBe(true);
    expect(isKnownBoard('not-a-board')).toBe(false);
  });
});
