import { describe, it, expect } from 'vitest';
import { parsePrimer } from '../worker/src/lib/primer.js';

describe('parsePrimer', () => {
  it('parses a valid primer markdown into a primer object', () => {
    const md = `---
week_index: 1
title: "What this site is"
link_url: /about/
link_label: "About marbleheaddata.org"
---
First paragraph of body copy.

Second paragraph of body copy.
`;
    const p = parsePrimer('01-welcome.md', md);
    expect(p).toEqual({
      filename: '01-welcome.md',
      week_index: 1,
      title: 'What this site is',
      link_url: '/about/',
      link_label: 'About marbleheaddata.org',
      body_paragraphs: [
        'First paragraph of body copy.',
        'Second paragraph of body copy.'
      ]
    });
  });

  it('returns null when frontmatter is missing entirely', () => {
    expect(parsePrimer('bad.md', 'no frontmatter here')).toBeNull();
  });

  it('returns null when week_index is missing', () => {
    const md = `---
title: "x"
link_url: /a/
link_label: "b"
---
body
`;
    expect(parsePrimer('bad.md', md)).toBeNull();
  });

  it('returns null when week_index is non-numeric', () => {
    const md = `---
week_index: not-a-number
title: "x"
link_url: /a/
link_label: "b"
---
body
`;
    expect(parsePrimer('bad.md', md)).toBeNull();
  });

  it('returns null when any required string field is missing', () => {
    const md = `---
week_index: 2
title: "x"
link_url: /a/
---
body
`;
    expect(parsePrimer('bad.md', md)).toBeNull();
  });

  it('treats a single-paragraph body as one entry', () => {
    const md = `---
week_index: 3
title: "x"
link_url: /a/
link_label: "b"
---
Only one paragraph here.
`;
    const p = parsePrimer('03-x.md', md);
    expect(p.body_paragraphs).toEqual(['Only one paragraph here.']);
  });

  it('preserves body text verbatim (no HTML escaping at parse time)', () => {
    const md = `---
week_index: 4
title: "x"
link_url: /a/
link_label: "b"
---
Text with <angle> and & ampersand.
`;
    const p = parsePrimer('04-x.md', md);
    expect(p.body_paragraphs[0]).toBe('Text with <angle> and & ampersand.');
  });
});
