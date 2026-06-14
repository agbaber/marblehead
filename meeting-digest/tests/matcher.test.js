// meeting-digest/tests/matcher.test.js
import { describe, it, expect } from 'vitest';
import { matchTranscripts } from '../worker/src/lib/matcher.js';

const SB = {
  slug: 'select-board-2026-06-10',
  board: 'select-board',
  topic_segments: [
    { topic: 'override', start_seconds: 700 },
    { topic: 'bonding-capital', start_seconds: 2200 }
  ]
};
const SC = {
  slug: 'school-committee-2026-06-09',
  board: 'school-committee',
  topic_segments: [{ topic: 'school-budget', start_seconds: 0 }]
};
const PB_40B = {
  slug: 'planning-board-2026-06-08',
  board: 'planning-board',
  topic_segments: [{ topic: '40b-mbta', start_seconds: 1000 }]
};

describe('matchTranscripts', () => {
  it('matches by board membership', () => {
    const out = matchTranscripts([SB, SC], { boards: ['select-board'], topics: [] });
    expect(out.map(m => m.transcript.slug)).toEqual(['select-board-2026-06-10']);
  });
  it('matches by topic in topic_segments', () => {
    const out = matchTranscripts([SB, SC], { boards: [], topics: ['school-budget'] });
    expect(out.map(m => m.transcript.slug)).toEqual(['school-committee-2026-06-09']);
  });
  it('matches by EITHER board OR topic (union)', () => {
    const out = matchTranscripts([SB, SC, PB_40B], {
      boards: ['select-board'], topics: ['40b-mbta']
    });
    expect(out.map(m => m.transcript.slug).sort()).toEqual([
      'planning-board-2026-06-08', 'select-board-2026-06-10'
    ]);
  });
  it('omits topic-only match if the transcript has no matching segments', () => {
    const out = matchTranscripts([SC], { boards: [], topics: ['override'] });
    expect(out).toEqual([]);
  });
  it('returns each match as { transcript, matched_segments[] }', () => {
    const out = matchTranscripts([SB], { boards: [], topics: ['override','bonding-capital'] });
    expect(out).toHaveLength(1);
    expect(out[0].matched_segments.map(s => s.topic)).toEqual(['override','bonding-capital']);
  });
  it('returns empty matched_segments when match is board-only with no topic filter', () => {
    const out = matchTranscripts([SB], { boards: ['select-board'], topics: [] });
    expect(out[0].matched_segments).toEqual([]);
  });
});
