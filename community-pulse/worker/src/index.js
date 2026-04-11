// Cloudflare Worker for the community pulse reactions counter.
// Exposes two endpoints:
//   GET  /api/reactions?section_ids=a,b,c   (batched fetch)
//   POST /api/reactions                     (increment one section)
//
// Backed by a single D1 database with two tables. No auth, no sessions.

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // per section per window per ip
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

/**
 * Main request router. Exported for tests.
 */
export async function handleRequest(request, env) {
  const url = new URL(request.url);

  // CORS preflight.
  if (request.method === 'OPTIONS') {
    return corsResponse(request, env);
  }

  if (url.pathname !== '/api/reactions') {
    return new Response('Not Found', { status: 404, headers: corsHeaders(env) });
  }

  if (request.method === 'GET') {
    return handleGet(request, env);
  }
  if (request.method === 'POST') {
    return handlePost(request, env);
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(env) });
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('section_ids');
  if (!raw) {
    return new Response('{}', { status: 200, headers: corsHeaders(env) });
  }
  const sectionIds = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (sectionIds.length === 0) {
    return new Response('{}', { status: 200, headers: corsHeaders(env) });
  }

  // Build a single SQL query with a parameterized IN clause.
  const placeholders = sectionIds.map(() => '?').join(',');
  const stmt = env.DB.prepare(
    `SELECT section_id, total_count, count_24h FROM reactions WHERE section_id IN (${placeholders})`
  ).bind(...sectionIds);
  const { results } = await stmt.all();

  // Assemble response with zeros for unknown sections.
  const found = new Map(results.map(r => [r.section_id, { total: r.total_count, last_24h: r.count_24h }]));
  const response = {};
  for (const id of sectionIds) {
    response[id] = found.get(id) || { total: 0, last_24h: 0 };
  }
  return new Response(JSON.stringify(response), { status: 200, headers: corsHeaders(env) });
}

async function handlePost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400, headers: corsHeaders(env) });
  }
  if (!body || typeof body.section_id !== 'string' || !body.section_id) {
    return new Response(JSON.stringify({ error: 'missing section_id' }), { status: 400, headers: corsHeaders(env) });
  }

  const sectionId = body.section_id;
  const now = Date.now();

  // Load existing row if any.
  const existing = await env.DB.prepare(
    'SELECT total_count, count_24h, window_24h_start FROM reactions WHERE section_id = ?'
  ).bind(sectionId).first();

  let total, count24h, windowStart;
  if (existing) {
    const windowElapsed = (now - existing.window_24h_start) >= TWENTY_FOUR_HOURS_MS;
    total = existing.total_count + 1;
    count24h = windowElapsed ? 1 : existing.count_24h + 1;
    windowStart = windowElapsed ? now : existing.window_24h_start;
    await env.DB.prepare(
      'UPDATE reactions SET total_count = ?, count_24h = ?, window_24h_start = ?, updated_at = ? WHERE section_id = ?'
    ).bind(total, count24h, windowStart, now, sectionId).run();
  } else {
    total = 1;
    count24h = 1;
    windowStart = now;
    await env.DB.prepare(
      'INSERT INTO reactions (section_id, total_count, count_24h, window_24h_start, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(sectionId, total, count24h, windowStart, now).run();
  }

  return new Response(JSON.stringify({ total, last_24h: count24h }), { status: 200, headers: corsHeaders(env) });
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

function corsResponse(request, env) {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}
