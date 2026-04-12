import { describe, it, expect } from 'vitest';
import { buildIssueUrl } from '../../assets/community-pulse/widget.js';

describe('buildIssueUrl', () => {
  it('returns a github.com/agbaber/marblehead/issues/new URL', () => {
    const url = buildIssueUrl('Test section', 'https://example.com/page.html#test');
    expect(url).toMatch(/^https:\/\/github\.com\/agbaber\/marblehead\/issues\/new\?/);
  });

  it('puts the section title in the issue title parameter', () => {
    const url = buildIssueUrl('How the $8.47M FY27 gap is calculated', 'https://example.com/p#g');
    const params = new URL(url).searchParams;
    expect(params.get('title')).toBe('Possible error: How the $8.47M FY27 gap is calculated');
  });

  it('includes the section URL as a markdown link in the body', () => {
    const url = buildIssueUrl('Test', 'https://example.com/page.html#anchor');
    const body = new URL(url).searchParams.get('body');
    expect(body).toContain('[Test](https://example.com/page.html#anchor)');
  });

  it('includes the writing prompt in the body', () => {
    const url = buildIssueUrl('Test', 'https://example.com/p#a');
    const body = new URL(url).searchParams.get('body');
    expect(body).toContain('Describe the issue:');
  });

  it('preserves section titles with colons and dollar signs unchanged', () => {
    const title = 'Health insurance: the $1.5M employer share';
    const url = buildIssueUrl(title, 'https://example.com/p#a');
    const params = new URL(url).searchParams;
    expect(params.get('title')).toBe(`Possible error: ${title}`);
  });
});
