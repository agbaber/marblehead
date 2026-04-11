import { describe, it, expect } from 'vitest';
import { slugify } from '../../assets/community-pulse/widget.js';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Staffing Cuts')).toBe('staffing-cuts');
  });

  it('strips punctuation', () => {
    expect(slugify("What's in the no-override budget?")).toBe('whats-in-the-no-override-budget');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(slugify('too   many     spaces')).toBe('too-many-spaces');
    expect(slugify('leading---hyphens')).toBe('leading-hyphens');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('   spaces around   ')).toBe('spaces-around');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('is deterministic', () => {
    expect(slugify('Same Input')).toBe(slugify('Same Input'));
  });
});
