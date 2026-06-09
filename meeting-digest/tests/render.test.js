// meeting-digest/tests/render.test.js
import { describe, it, expect } from 'vitest';
import { renderSubject, renderHtml, renderText, formatTimecode } from '../worker/src/lib/render.js';

const SB_MATCH = {
  transcript: {
    slug: 'select-board-2026-06-10',
    board: 'select-board',
    board_display: 'Select Board',
    date: '2026-06-10',
    title: 'Select Board: June 10, 2026',
    vimeo_url: 'https://vimeo.com/1234567890',
    summary_card: {
      headline: 'Board approves $5.43M Mary Allen contract',
      summary: 'The board approved the contract.'
    }
  },
  matched_segments: [
    { topic: 'override', start_seconds: 754, headline: 'Board signals support for Tier 2', dek: 'Two members spoke.' },
    { topic: 'bonding-capital', start_seconds: 2291, headline: 'Mary Allen funding path approved', dek: '$5.43M contract.' }
  ]
};
const SUB = { manage_token: 'mtok', email: 'hi@example.com' };
const ENV = { SITE_BASE_URL: 'https://marbleheaddata.org' };

describe('formatTimecode', () => {
  it('formats H:MM:SS over an hour', () => {
    expect(formatTimecode(3725)).toBe('1:02:05');
  });
  it('formats M:SS under an hour', () => {
    expect(formatTimecode(754)).toBe('12:34');
  });
});

describe('renderSubject', () => {
  it('uses single-meeting form for 1 match', () => {
    expect(renderSubject([SB_MATCH])).toBe('[MHD Data] Select Board: Board approves $5.43M Mary Allen contract');
  });
  it('joins headlines with " · " for 2-3 matches', () => {
    const two = [SB_MATCH, { ...SB_MATCH, transcript: { ...SB_MATCH.transcript, summary_card: { headline: 'Second meeting' } } }];
    expect(renderSubject(two)).toBe('[MHD Data] 2 meetings this week: Board approves $5.43M Mary Allen contract · Second meeting');
  });
  it('truncates with "..." for 4+ matches', () => {
    const four = Array.from({ length: 4 }, (_, i) => ({
      ...SB_MATCH,
      transcript: { ...SB_MATCH.transcript, summary_card: { headline: `H${i+1}` } }
    }));
    expect(renderSubject(four)).toBe('[MHD Data] 4 meetings this week: H1 · H2 · H3...');
  });
});

describe('renderHtml', () => {
  it('includes a header, one card per meeting, and a footer with manage/unsubscribe', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-12');
    expect(html).toContain('Marblehead Data');
    expect(html).toContain('Week ending');
    expect(html).toContain('Board approves $5.43M Mary Allen contract');
    expect(html).toContain('Select Board');
    expect(html).toContain('Matching segments');
    expect(html).toContain('12:34');
    expect(html).toContain('marbleheaddata.org/me/subscription/?token=mtok');
    expect(html).toContain('marbleheaddata.org/api/unsubscribe?token=mtok');
    expect(html).toContain('AI-generated');
  });
  it('omits the "Matching segments" block when matched_segments is empty', () => {
    const noSegs = { ...SB_MATCH, matched_segments: [] };
    const html = renderHtml([noSegs], SUB, ENV, '2026-06-12');
    expect(html).not.toContain('Matching segments');
  });
  it('escapes HTML in user-influenced fields', () => {
    const evil = {
      transcript: { ...SB_MATCH.transcript, summary_card: { headline: '<script>alert(1)</script>', summary: 'x' } },
      matched_segments: []
    };
    const html = renderHtml([evil], SUB, ENV, '2026-06-12');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderText', () => {
  it('produces a plain-text mirror with the same content', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-12');
    expect(text).toContain('Marblehead Data');
    expect(text).toContain('Board approves $5.43M Mary Allen contract');
    expect(text).toContain('SELECT BOARD');
    expect(text).toContain('12:34');
    expect(text).not.toContain('<');
    expect(text).not.toContain('&gt;');
  });
});
