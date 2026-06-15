import { describe, it, expect, beforeEach } from 'vitest';
import { parsePrimer, fetchPrimers } from '../worker/src/lib/primer.js';
import { fetchMock } from 'cloudflare:test';

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

const ENV = { GITHUB_REPO: 'agbaber/marblehead', GITHUB_BRANCH: 'main' };

function primerMd(weekIndex, title) {
  return `---
week_index: ${weekIndex}
title: "${title}"
link_url: /x/
link_label: "Read"
---
Body for ${title}.
`;
}

describe('fetchPrimers', () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it('returns an empty array when the directory is empty', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([]));
    const out = await fetchPrimers(ENV);
    expect(out).toEqual([]);
  });

  it('parses files and sorts by week_index ascending', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([
        { type: 'file', name: '03-debt.md',    download_url: 'https://example.com/p3.md' },
        { type: 'file', name: '01-welcome.md', download_url: 'https://example.com/p1.md' },
        { type: 'file', name: '02-org.md',     download_url: 'https://example.com/p2.md' }
      ]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p1.md', method: 'GET' }).reply(200, primerMd(1, 'Welcome'));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p2.md', method: 'GET' }).reply(200, primerMd(2, 'Org chart'));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p3.md', method: 'GET' }).reply(200, primerMd(3, 'Debt'));

    const out = await fetchPrimers(ENV);
    expect(out.map(p => p.week_index)).toEqual([1, 2, 3]);
    expect(out[0].title).toBe('Welcome');
  });

  it('skips files that fail to parse', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([
        { type: 'file', name: '01-welcome.md', download_url: 'https://example.com/p1.md' },
        { type: 'file', name: '02-bad.md',     download_url: 'https://example.com/p2.md' }
      ]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p1.md', method: 'GET' }).reply(200, primerMd(1, 'Welcome'));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p2.md', method: 'GET' }).reply(200, 'no frontmatter');

    const out = await fetchPrimers(ENV);
    expect(out.length).toBe(1);
    expect(out[0].week_index).toBe(1);
  });

  it('throws when the directory listing fails (caller decides retry)', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(404, '');
    await expect(fetchPrimers(ENV)).rejects.toThrow(/_primers listing failed: 404/);
  });

  it('ignores non-markdown files in the directory', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([
        { type: 'file', name: '01-welcome.md', download_url: 'https://example.com/p1.md' },
        { type: 'file', name: 'README.txt',    download_url: 'https://example.com/r.txt' },
        { type: 'dir',  name: 'archived',      download_url: null }
      ]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p1.md', method: 'GET' }).reply(200, primerMd(1, 'Welcome'));

    const out = await fetchPrimers(ENV);
    expect(out.length).toBe(1);
  });

  it('when two files share a week_index, alphabetically-first filename wins', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([
        { type: 'file', name: '01-welcome.md', download_url: 'https://example.com/pw.md' },
        { type: 'file', name: '01-alt.md',     download_url: 'https://example.com/pa.md' }
      ]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/pw.md', method: 'GET' }).reply(200, primerMd(1, 'Welcome'));
    fetchMock.get('https://example.com')
      .intercept({ path: '/pa.md', method: 'GET' }).reply(200, primerMd(1, 'Alt'));

    const out = await fetchPrimers(ENV);
    expect(out.length).toBe(1);
    expect(out[0].title).toBe('Alt');
    expect(out[0].filename).toBe('01-alt.md');
  });
});

import { pickPrimer } from '../worker/src/lib/primer.js';

describe('pickPrimer', () => {
  const primers = [
    { week_index: 1, title: 'A' },
    { week_index: 2, title: 'B' },
    { week_index: 3, title: 'C' }
  ];

  it('returns primer week 1 when dripWeekIndex is 0', () => {
    expect(pickPrimer(primers, 0)?.title).toBe('A');
  });
  it('returns primer week 2 when dripWeekIndex is 1', () => {
    expect(pickPrimer(primers, 1)?.title).toBe('B');
  });
  it('returns null when the next index does not exist', () => {
    expect(pickPrimer(primers, 3)).toBeNull();
  });
  it('returns null when the primer list is empty', () => {
    expect(pickPrimer([], 0)).toBeNull();
  });
  it('tolerates non-contiguous week_index values', () => {
    const sparse = [{ week_index: 1, title: 'A' }, { week_index: 3, title: 'C' }];
    expect(pickPrimer(sparse, 0)?.title).toBe('A');
    expect(pickPrimer(sparse, 1)).toBeNull();   // looking for week 2 — not present
    expect(pickPrimer(sparse, 2)?.title).toBe('C');
  });
});
