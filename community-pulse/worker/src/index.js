// Cloudflare Worker for the community pulse reactions counter.
// Exposes two endpoints:
//   GET  /api/reactions?section_ids=a,b,c   (batched fetch)
//   POST /api/reactions                     (increment one section)
//
// Backed by a single D1 database with two tables. No auth, no sessions.

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // per section per window per ip

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
  return new Response('not yet implemented', { status: 501, headers: corsHeaders(env) });
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
