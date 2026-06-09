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
  matched_segments: []
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
  it('uses "Board: headline" for a single meeting', () => {
    expect(renderSubject([SB_MATCH])).toBe('Select Board: Board approves $5.43M Mary Allen contract');
  });
  it('uses "N Marblehead meetings this week" for 2+ matches', () => {
    expect(renderSubject([SB_MATCH, SB_MATCH])).toBe('2 Marblehead meetings this week');
    const four = Array.from({ length: 4 }, () => SB_MATCH);
    expect(renderSubject(four)).toBe('4 Marblehead meetings this week');
  });
});

describe('renderHtml', () => {
  it('leads with brand + count, then meetings, then footer links', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-12');
    expect(html).toContain('Marblehead Data');
    expect(html).toContain('1 meeting this week');
    expect(html).toContain('Board approves $5.43M Mary Allen contract');
    expect(html).toContain('Select Board');
    expect(html).toContain('Jun 10');
    expect(html).toContain('marbleheaddata.org/me/subscription/?token=mtok');
    expect(html).toContain('marbleheaddata.org/api/unsubscribe?token=mtok');
    expect(html).toContain('AI-generated');
  });
  it('pluralises the meeting count correctly', () => {
    const html = renderHtml([SB_MATCH, SB_MATCH], SUB, ENV, '2026-06-12');
    expect(html).toContain('2 meetings this week');
  });
  it('does not surface matched_segments in the body (simpler design)', () => {
    const withSegs = {
      ...SB_MATCH,
      matched_segments: [
        { topic: 'override', start_seconds: 754, headline: 'X', dek: 'Y' }
      ]
    };
    const html = renderHtml([withSegs], SUB, ENV, '2026-06-12');
    expect(html).not.toContain('Matching segments');
    expect(html).not.toContain('12:34');
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
  it('mirrors the HTML content in plain text', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-12');
    expect(text).toContain('Marblehead Data');
    expect(text).toContain('1 meeting this week');
    expect(text).toContain('Board approves $5.43M Mary Allen contract');
    expect(text).toContain('Select Board');
    expect(text).toContain('Jun 10');
    expect(text).not.toContain('<');
    expect(text).not.toContain('&gt;');
  });
});
