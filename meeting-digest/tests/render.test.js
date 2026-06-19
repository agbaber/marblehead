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
  it('adds UTM params to editorial meeting links but not to manage/unsubscribe', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-12');
    expect(html).toContain('/meetings/select-board-2026-06-10/?utm_source=digest&utm_medium=email&utm_campaign=weekly');
    expect(html).not.toContain('/me/subscription/?token=mtok&utm_source');
    expect(html).not.toContain('/api/unsubscribe?token=mtok&utm_source');
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
  it('adds UTM params to editorial meeting links in text version', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-12');
    expect(text).toContain('/meetings/select-board-2026-06-10/?utm_source=digest&utm_medium=email&utm_campaign=weekly');
    // Manage/unsubscribe links stay clean (no UTM appended).
    expect(text).toMatch(/\/me\/subscription\/\?token=mtok(?!.*utm_source)/);
    expect(text).toMatch(/\/api\/unsubscribe\?token=mtok(?!.*utm_source)/);
  });
});

const PRIMER_1 = {
  filename: '01-welcome.md',
  week_index: 1,
  title: 'What this site is',
  link_url: '/about/',
  link_label: 'About marbleheaddata.org',
  body_paragraphs: ['First para.', 'Second para.']
};

describe('renderHtml with primer', () => {
  it('omits the primer card when primer is null', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', null, 0);
    expect(html).not.toMatch(/Site primer/);
  });

  it('renders the primer card when primer is provided', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', PRIMER_1, 4);
    expect(html).toContain('Site primer · 1 of 4');
    expect(html).toContain('What this site is');
    expect(html).toContain('First para.');
    expect(html).toContain('Second para.');
    expect(html).toContain('About marbleheaddata.org');
  });

  it('UTM-tags the primer link with per-week campaign', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', PRIMER_1, 4);
    expect(html).toMatch(/href="https:\/\/marbleheaddata\.org\/about\/\?utm_source=digest&utm_medium=email&utm_campaign=primer-week-1"/);
  });

  it('HTML-escapes primer body content', () => {
    const angry = { ...PRIMER_1, body_paragraphs: ['<script>alert(1)</script>'] };
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', angry, 4);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders primer total of N when maxPrimerIndex is N', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', PRIMER_1, 7);
    expect(html).toContain('Site primer · 1 of 7');
  });
});

describe('renderText with primer', () => {
  it('omits the primer block when primer is null', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-15', null, 0);
    expect(text).not.toMatch(/SITE PRIMER/);
  });

  it('appends the primer block with a separator when primer is provided', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-15', PRIMER_1, 4);
    expect(text).toMatch(/\n---\n\nSITE PRIMER · 1 of 4\n/);
    expect(text).toContain('What this site is');
    expect(text).toContain('First para.');
    expect(text).toContain('Second para.');
    expect(text).toMatch(/About marbleheaddata\.org: https:\/\/marbleheaddata\.org\/about\/\?utm_source=digest&utm_medium=email&utm_campaign=primer-week-1/);
  });
});

describe('renderHtml footer reply prompt', () => {
  it('includes "Got a question or correction? Just reply to this email." in the HTML footer', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15');
    expect(html).toContain('Got a question or correction? Just reply to this email.');
  });
});

describe('renderText footer reply prompt', () => {
  it('includes "Got a question or correction? Just reply to this email." above the manage line in the text footer', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-15');
    expect(text).toContain('Got a question or correction? Just reply to this email.');
    // Reply prompt must come before "Manage subscription" line
    const replyIdx = text.indexOf('Got a question or correction?');
    const manageIdx = text.indexOf('Manage subscription:');
    expect(replyIdx).toBeGreaterThan(-1);
    expect(manageIdx).toBeGreaterThan(replyIdx);
  });
});
