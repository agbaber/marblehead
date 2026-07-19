// Public, versioned, read-only API over the warrant corpus.
// Open CORS by design: this is public-record data. Write endpoints do
// not belong in this module; they stay session-authed elsewhere.

const V1_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
  'Content-Type': 'application/json',
};

const ENDPOINTS = [
  '/api/v1/',
  '/api/v1/series',
  '/api/v1/series/:slug',
  '/api/v1/meetings/:year',
  '/api/v1/openapi.json',
];

async function computeEtag(body) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `"${hex.slice(0, 32)}"`;
}

export async function jsonResponse(request, data, { maxAge = 300, status = 200 } = {}) {
  const body = JSON.stringify(data);
  const headers = {
    ...V1_HEADERS,
    'Cache-Control': `public, max-age=${maxAge}`,
  };

  if (status === 200) {
    const etag = await computeEtag(body);
    headers.ETag = etag;

    if (request.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers });
    }
  }

  return new Response(body, { status, headers });
}

const VALID_KINDS = ['budget_line', 'money_article', 'other_article', 'consent'];

async function handleSeriesList(request, env, url) {
  const kind = url.searchParams.get('kind');
  if (kind && !VALID_KINDS.includes(kind)) {
    return jsonResponse(request, { error: 'invalid kind' }, { status: 400, maxAge: 0 });
  }

  const base =
    'SELECT s.slug, s.title, s.kind, s.first_year, s.last_year, ' +
    'COUNT(i.article_number) AS instance_count ' +
    'FROM article_series s ' +
    'LEFT JOIN article_instances i ON i.series_slug = s.slug ';
  const tail = 'GROUP BY s.slug ORDER BY s.slug';

  const stmt = kind
    ? env.DB.prepare(`${base} WHERE s.kind = ? ${tail}`).bind(kind)
    : env.DB.prepare(`${base} ${tail}`);
  const { results } = await stmt.all();

  return jsonResponse(request, { series: results });
}

async function handleSeriesDetail(request, env, slug) {
  const series = await env.DB.prepare(
    'SELECT slug, title, kind, first_year, last_year, notes FROM article_series WHERE slug = ?'
  ).bind(slug).first();

  if (!series) {
    return jsonResponse(request, { error: 'not found' }, { status: 404, maxAge: 0 });
  }

  const { results: instances } = await env.DB.prepare(
    'SELECT meeting_year, meeting_type, meeting_date, article_number, title, ' +
    'tm_result, tm_vote_yes, tm_vote_no, in_effect, notes, source_doc, source_url ' +
    'FROM article_instances WHERE series_slug = ? ' +
    'ORDER BY meeting_year ASC, meeting_type ASC, article_number ASC'
  ).bind(slug).all();

  return jsonResponse(request, { ...series, instances });
}

export async function handleApiV1(request, env, url) {
  if (!url.pathname.startsWith('/api/v1/') && url.pathname !== '/api/v1') return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: V1_HEADERS });
  }
  if (request.method !== 'GET') {
    return jsonResponse(request, { error: 'method not allowed' }, { status: 405, maxAge: 0 });
  }

  const path = url.pathname.replace(/\/$/, '') || '/api/v1';

  if (path === '/api/v1') {
    return jsonResponse(request, {
      name: 'marblehead warrant corpus api',
      version: 1,
      endpoints: ENDPOINTS,
    });
  }

  if (path === '/api/v1/series') {
    return handleSeriesList(request, env, url);
  }

  const seriesMatch = path.match(/^\/api\/v1\/series\/([a-z0-9-]+)$/);
  if (seriesMatch) {
    return handleSeriesDetail(request, env, seriesMatch[1]);
  }

  return jsonResponse(request, { error: 'not found' }, { status: 404, maxAge: 0 });
}
