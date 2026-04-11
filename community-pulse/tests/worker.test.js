import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { handleRequest } from '../worker/src/index.js';

// Create tables directly since we don't have a proper migrations directory set up.
beforeEach(async () => {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS reactions (
      section_id TEXT PRIMARY KEY,
      total_count INTEGER NOT NULL DEFAULT 0,
      count_24h INTEGER NOT NULL DEFAULT 0,
      window_24h_start INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      ip_hash TEXT NOT NULL,
      section_id TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip_hash, section_id, window_start)
    )
  `).run();
  await env.DB.prepare('DELETE FROM reactions').run();
  await env.DB.prepare('DELETE FROM rate_limits').run();
});

describe('GET /api/reactions', () => {
  it('returns an empty object when no section_ids param', async () => {
    const req = new Request('https://pulse.example.com/api/reactions');
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });

  it('returns zeros for unknown sections', async () => {
    const req = new Request('https://pulse.example.com/api/reactions?section_ids=a%23foo,b%23bar');
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['a#foo']).toEqual({ total: 0, last_24h: 0 });
    expect(body['b#bar']).toEqual({ total: 0, last_24h: 0 });
  });

  it('returns stored counts for known sections', async () => {
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO reactions (section_id, total_count, count_24h, window_24h_start, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind('page.html#sec', 42, 7, now, now).run();

    const req = new Request('https://pulse.example.com/api/reactions?section_ids=page.html%23sec');
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['page.html#sec']).toEqual({ total: 42, last_24h: 7 });
  });

  it('includes CORS headers', async () => {
    const req = new Request('https://pulse.example.com/api/reactions?section_ids=a');
    const res = await handleRequest(req, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });
});
