import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchReactions, incrementReaction, configureApi } from '../../assets/community-pulse/widget.js';

describe('reactions API client', () => {
  beforeEach(() => {
    configureApi({ baseUrl: 'https://pulse.example.com' });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchReactions batches section IDs into a single request', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        'no-override-budget.html#staffing-cuts': { total: 47, last_24h: 12 },
        'no-override-budget.html#melrose-comparison': { total: 13, last_24h: 2 }
      })
    });

    const result = await fetchReactions([
      'no-override-budget.html#staffing-cuts',
      'no-override-budget.html#melrose-comparison'
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const call = global.fetch.mock.calls[0];
    expect(call[0]).toMatch(/^https:\/\/pulse\.example\.com\/api\/reactions\?section_ids=/);
    expect(call[0]).toContain(encodeURIComponent('no-override-budget.html#staffing-cuts'));
    expect(result['no-override-budget.html#staffing-cuts'].total).toBe(47);
  });

  it('fetchReactions returns an empty object on network error', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    const result = await fetchReactions(['a']);
    expect(result).toEqual({});
  });

  it('fetchReactions returns an empty object on non-ok response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await fetchReactions(['a']);
    expect(result).toEqual({});
  });

  it('fetchReactions returns an empty object when called with no sections', async () => {
    const result = await fetchReactions([]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('incrementReaction POSTs the section ID', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ total: 48, last_24h: 13 })
    });

    const result = await incrementReaction('no-override-budget.html#staffing-cuts');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://pulse.example.com/api/reactions');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ section_id: 'no-override-budget.html#staffing-cuts' });
    expect(result.total).toBe(48);
  });

  it('incrementReaction returns null on network error', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    const result = await incrementReaction('a');
    expect(result).toBeNull();
  });
});
