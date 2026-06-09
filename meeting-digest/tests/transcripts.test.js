import { describe, it, expect } from 'vitest';
import { parseFrontmatter, parseTranscript, extractDateFromFilename, withinLastSevenDays } from '../worker/src/lib/transcripts.js';

const SAMPLE = `---
slug: select-board-2026-06-10
board: select-board
board_display: "Select Board"
date: 2026-06-10
title: "Select Board: June 10, 2026"
vimeo_id: 1234567890
vimeo_url: "https://vimeo.com/1234567890"
duration_seconds: 3600
ai_generated: true
status: published
source: vimeo-auto+llm

summary_card:
  headline: "Board approves $5.43M Mary Allen contract"
  summary: "The board approved the contract."
  decisions:
    - "Approved Mary Allen contract"
  votes:
    - motion: "Approve"
      result: "in favor (unanimous)"

topic_segments:
  - topic: override
    topic_confidence: 0.95
    start_seconds: 754
    end_seconds: 1200
    featured: true
    headline: "Board signals support for Tier 2"
    dek: "Two members spoke."
    summary: "Discussion of tier mechanics."
    key_speakers: ["Chair Fox"]
  - topic: bonding-capital
    start_seconds: 2291
    end_seconds: 2900
    headline: "Mary Allen funding path approved"
    dek: "$5.43M contract."
    summary: "Details."
---

> Disclaimer here.

**[0:00](https://vimeo.com/1234567890#t=0s)** Body text.
`;

describe('parseFrontmatter', () => {
  it('returns the YAML block as a string and the body separately', () => {
    const { yaml, body } = parseFrontmatter(SAMPLE);
    expect(yaml).toContain('slug: select-board-2026-06-10');
    expect(yaml).toContain('topic_segments:');
    expect(body).toContain('Body text');
  });
  it('returns null yaml when frontmatter is missing', () => {
    const r = parseFrontmatter('no frontmatter here');
    expect(r.yaml).toBeNull();
    expect(r.body).toBe('no frontmatter here');
  });
});

describe('parseTranscript', () => {
  it('extracts the load-bearing fields for the digest', () => {
    const t = parseTranscript('select-board-2026-06-10.md', SAMPLE);
    expect(t.slug).toBe('select-board-2026-06-10');
    expect(t.board).toBe('select-board');
    expect(t.board_display).toBe('Select Board');
    expect(t.date).toBe('2026-06-10');
    expect(t.title).toBe('Select Board: June 10, 2026');
    expect(t.vimeo_url).toBe('https://vimeo.com/1234567890');
    expect(t.summary_card.headline).toBe('Board approves $5.43M Mary Allen contract');
    expect(t.topic_segments).toHaveLength(2);
    expect(t.topic_segments[0].topic).toBe('override');
    expect(t.topic_segments[0].start_seconds).toBe(754);
    expect(t.topic_segments[0].featured).toBe(true);
    expect(t.topic_segments[1].topic).toBe('bonding-capital');
  });
  it('returns null on unparseable input', () => {
    expect(parseTranscript('x.md', 'not yaml')).toBeNull();
  });
});

describe('extractDateFromFilename', () => {
  it('reads YYYY-MM-DD from the slug', () => {
    expect(extractDateFromFilename('select-board-2026-06-10.md')).toBe('2026-06-10');
    expect(extractDateFromFilename('board-of-health-2025-01-03.md')).toBe('2025-01-03');
  });
  it('returns null on filenames without a date', () => {
    expect(extractDateFromFilename('readme.md')).toBeNull();
  });
});

describe('withinLastSevenDays', () => {
  it('returns true for dates in the window relative to a fixed "now"', () => {
    const now = new Date('2026-06-12T12:00:00Z').getTime();
    expect(withinLastSevenDays('2026-06-06', now)).toBe(true);
    expect(withinLastSevenDays('2026-06-12', now)).toBe(true);
    expect(withinLastSevenDays('2026-06-05', now)).toBe(false);
    expect(withinLastSevenDays('2026-06-13', now)).toBe(false);
  });
});
