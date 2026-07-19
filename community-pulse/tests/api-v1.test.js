import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { handleRequest } from '../worker/src/index.js';

async function get(path, headers = {}) {
  const req = new Request(`https://pulse.example.com${path}`, { headers });
  return handleRequest(req, env);
}

beforeEach(async () => {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS article_series (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      first_year INTEGER,
      last_year INTEGER,
      notes TEXT
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS article_instances (
      series_slug TEXT NOT NULL,
      meeting_year INTEGER NOT NULL,
      meeting_type TEXT NOT NULL DEFAULT 'annual',
      meeting_date TEXT,
      article_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      amount REAL,
      fincom_recommendation TEXT,
      tm_result TEXT,
      tm_vote_yes INTEGER,
      tm_vote_no INTEGER,
      in_effect INTEGER,
      notes TEXT,
      source_doc TEXT,
      source_url TEXT,
      PRIMARY KEY (meeting_year, meeting_type, article_number)
    )
  `).run();
  await env.DB.prepare('DELETE FROM article_instances').run();
  await env.DB.prepare('DELETE FROM article_series').run();

  await env.DB.prepare(
    "INSERT INTO article_series (slug, title, kind, first_year, last_year, notes) VALUES " +
    "('walls-and-fences','Walls and Fences','money_article',2019,2025,NULL)," +
    "('consent-articles','Consent Articles','consent',2024,2025,NULL)"
  ).run();
  await env.DB.prepare(
    "INSERT INTO article_instances (series_slug, meeting_year, meeting_type, meeting_date, article_number, title, tm_result, tm_vote_yes, tm_vote_no, in_effect, notes, source_doc, source_url) VALUES " +
    "('walls-and-fences',2024,'annual','2024-05-06',9,'Walls and Fences','adopted',674,107,NULL,NULL,'atr2024.pdf','https://example.com/atr2024.pdf')," +
    "('walls-and-fences',2025,'annual','2025-05-06',9,'Walls and Fences','adopted',392,36,NULL,NULL,'atr2025.pdf','https://example.com/atr2025.pdf')," +
    "('consent-articles',2025,'annual','2025-05-06',3,'Consent Articles','adopted',402,22,NULL,NULL,'atr2025.pdf','https://example.com/atr2025.pdf')"
  ).run();
});

describe('GET /api/v1/', () => {
  it('returns the endpoint index with open CORS', async () => {
    const res = await get('/api/v1/');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const body = await res.json();
    expect(body.name).toBe('marblehead warrant corpus api');
    expect(body.version).toBe(1);
    expect(body.endpoints).toContain('/api/v1/series');
  });
});

describe('unknown v1 path', () => {
  it('returns JSON 404 with open CORS', async () => {
    const res = await get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.json()).toEqual({ error: 'not found' });
  });
});

describe('ETag handling', () => {
  it('returns 304 on matching If-None-Match', async () => {
    const first = await get('/api/v1/');
    const etag = first.headers.get('ETag');
    expect(etag).toBeTruthy();
    const second = await get('/api/v1/', { 'If-None-Match': etag });
    expect(second.status).toBe(304);
  });
});

describe('GET /api/v1/series', () => {
  it('lists series with instance counts', async () => {
    const res = await get('/api/v1/series');
    expect(res.status).toBe(200);
    const body = await res.json();
    const walls = body.series.find(s => s.slug === 'walls-and-fences');
    expect(walls).toEqual({
      slug: 'walls-and-fences', title: 'Walls and Fences', kind: 'money_article',
      first_year: 2019, last_year: 2025, instance_count: 2,
    });
  });

  it('filters by kind', async () => {
    const res = await get('/api/v1/series?kind=consent');
    const body = await res.json();
    expect(body.series.map(s => s.slug)).toEqual(['consent-articles']);
  });

  it('rejects an unknown kind', async () => {
    const res = await get('/api/v1/series?kind=bogus');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid kind' });
  });
});

describe('GET /api/v1/series/:slug', () => {
  it('returns the series with its instances oldest first', async () => {
    const res = await get('/api/v1/series/walls-and-fences');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe('walls-and-fences');
    expect(body.instances).toHaveLength(2);
    expect(body.instances[0].meeting_year).toBe(2024);
    expect(body.instances[1].meeting_year).toBe(2025);
    expect(body.instances[1].tm_vote_yes).toBe(392);
    expect(body.instances[1].source_url).toBe('https://example.com/atr2025.pdf');
  });

  it('404s an unknown slug', async () => {
    const res = await get('/api/v1/series/not-a-series');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });
});
