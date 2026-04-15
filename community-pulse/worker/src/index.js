// Cloudflare Worker for the community pulse reactions counter
// and anonymous ballot-pick aggregation.
//
// Reactions endpoints:
//   GET  /api/reactions?section_ids=a,b,c   (batched fetch)
//   POST /api/reactions                     (increment one section)
//
// Ballot-pick endpoints:
//   GET  /api/ballot?page=what-is-the-override   (aggregate results)
//   POST /api/ballot                             (submit picks)
//
// Backed by D1. No auth, no sessions.

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

  if (url.pathname === '/api/reactions') {
    if (request.method === 'GET') return handleGet(request, env);
    if (request.method === 'POST') return handlePost(request, env);
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(env) });
  }

  if (url.pathname === '/api/ballot') {
    if (request.method === 'GET') return handleBallotGet(request, env);
    if (request.method === 'POST') return handleBallotPost(request, env);
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(env) });
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders(env) });
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

async function hashIp(ip) {
  const enc = new TextEncoder().encode(`${ip}:community-pulse-salt`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Returns true if this (ip, section) is under the rate limit. Increments the bucket if so. */
async function checkAndIncrementRateLimit(env, ip, sectionId) {
  const ipHash = await hashIp(ip || 'unknown');
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;

  // Lazily clean up all old rows across the whole table.
  await env.DB.prepare(
    'DELETE FROM rate_limits WHERE window_start < ?'
  ).bind(windowStart).run();

  const existing = await env.DB.prepare(
    'SELECT count FROM rate_limits WHERE ip_hash = ? AND section_id = ? AND window_start = ?'
  ).bind(ipHash, sectionId, windowStart).first();

  if (existing && existing.count >= RATE_LIMIT_MAX) {
    return false;
  }
  if (existing) {
    await env.DB.prepare(
      'UPDATE rate_limits SET count = count + 1 WHERE ip_hash = ? AND section_id = ? AND window_start = ?'
    ).bind(ipHash, sectionId, windowStart).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO rate_limits (ip_hash, section_id, window_start, count) VALUES (?, ?, ?, 1)'
    ).bind(ipHash, sectionId, windowStart).run();
  }
  return true;
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
  const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const allowed = await checkAndIncrementRateLimit(env, clientIp, sectionId);

  const now = Date.now();
  const existing = await env.DB.prepare(
    'SELECT total_count, count_24h, window_24h_start FROM reactions WHERE section_id = ?'
  ).bind(sectionId).first();

  let total, count24h, windowStart;
  if (!allowed) {
    // Rate-limited: return current counts without incrementing.
    if (existing) {
      total = existing.total_count;
      count24h = existing.count_24h;
    } else {
      total = 0;
      count24h = 0;
    }
    return new Response(JSON.stringify({ total, last_24h: count24h }), { status: 200, headers: corsHeaders(env) });
  }

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

// ---------------------------------------------------------------------------
// Ballot-pick endpoints
// ---------------------------------------------------------------------------

const VALID_QUESTIONS = ['1A', '1B', '1C', '2'];
const VALID_VOTES = ['Y', 'N'];
const VALID_PAGES = ['what-is-the-override', 'question-2-trash'];

/** Canonicalize picks into a deterministic combo string. */
function toCombo(picks) {
  return Object.keys(picks)
    .sort()
    .map(k => k + ':' + picks[k])
    .join(',');
}

/** Parse a combo string back into a picks object. */
function fromCombo(combo) {
  const picks = {};
  for (const part of combo.split(',')) {
    const [q, v] = part.split(':');
    picks[q] = v;
  }
  return picks;
}

/** Build aggregate results from grouped combo rows. */
function buildAggregate(rows) {
  const questions = {};
  for (const q of VALID_QUESTIONS) {
    questions[q] = { yes: 0, no: 0 };
  }
  const highestTier = { '1A': 0, '1B': 0, '1C': 0, none: 0 };
  let total = 0;

  for (const row of rows) {
    const picks = fromCombo(row.combo);
    const cnt = row.cnt;
    total += cnt;

    for (const q of VALID_QUESTIONS) {
      if (picks[q] === 'Y') questions[q].yes += cnt;
      else if (picks[q] === 'N') questions[q].no += cnt;
    }

    // Highest Q1 tier with a Yes vote (1A > 1B > 1C).
    if (picks['1A'] === 'Y') highestTier['1A'] += cnt;
    else if (picks['1B'] === 'Y') highestTier['1B'] += cnt;
    else if (picks['1C'] === 'Y') highestTier['1C'] += cnt;
    else highestTier.none += cnt;
  }

  return { total, questions, highest_tier: highestTier };
}

async function handleBallotGet(request, env) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page');
  if (!page || !VALID_PAGES.includes(page)) {
    return new Response(JSON.stringify({ error: 'invalid page' }), { status: 400, headers: corsHeaders(env) });
  }

  const { results } = await env.DB.prepare(
    'SELECT combo, COUNT(*) as cnt FROM ballot_picks WHERE page = ? GROUP BY combo'
  ).bind(page).all();

  const aggregate = buildAggregate(results);
  return new Response(JSON.stringify(aggregate), { status: 200, headers: corsHeaders(env) });
}

async function handleBallotPost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400, headers: corsHeaders(env) });
  }

  // Validate picks.
  if (!body || typeof body.picks !== 'object' || body.picks === null) {
    return new Response(JSON.stringify({ error: 'missing picks' }), { status: 400, headers: corsHeaders(env) });
  }
  const picks = {};
  for (const [k, v] of Object.entries(body.picks)) {
    if (!VALID_QUESTIONS.includes(k)) {
      return new Response(JSON.stringify({ error: 'invalid question: ' + k }), { status: 400, headers: corsHeaders(env) });
    }
    if (!VALID_VOTES.includes(v)) {
      return new Response(JSON.stringify({ error: 'invalid vote: ' + v }), { status: 400, headers: corsHeaders(env) });
    }
    picks[k] = v;
  }
  if (Object.keys(picks).length === 0) {
    return new Response(JSON.stringify({ error: 'empty picks' }), { status: 400, headers: corsHeaders(env) });
  }

  // Validate page.
  const page = body.page;
  if (!page || !VALID_PAGES.includes(page)) {
    return new Response(JSON.stringify({ error: 'invalid page' }), { status: 400, headers: corsHeaders(env) });
  }

  // Rate limit: one submission per IP, ever.
  const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const ipHash = await hashIp(clientIp);

  const existing = await env.DB.prepare(
    'SELECT submitted_at FROM ballot_rate_limits WHERE ip_hash = ?'
  ).bind(ipHash).first();

  if (existing) {
    // Already submitted. Return current results so the client can display them.
    const { results } = await env.DB.prepare(
      'SELECT combo, COUNT(*) as cnt FROM ballot_picks WHERE page = ? GROUP BY combo'
    ).bind(page).all();
    const aggregate = buildAggregate(results);
    return new Response(JSON.stringify({ error: 'already_submitted', results: aggregate }), { status: 200, headers: corsHeaders(env) });
  }

  const combo = toCombo(picks);
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO ballot_picks (combo, page, created_at) VALUES (?, ?, ?)'
  ).bind(combo, page, now).run();

  await env.DB.prepare(
    'INSERT INTO ballot_rate_limits (ip_hash, submitted_at) VALUES (?, ?)'
  ).bind(ipHash, now).run();

  // Return updated aggregate.
  const { results } = await env.DB.prepare(
    'SELECT combo, COUNT(*) as cnt FROM ballot_picks WHERE page = ? GROUP BY combo'
  ).bind(page).all();
  const aggregate = buildAggregate(results);

  return new Response(JSON.stringify({ submitted: true, results: aggregate }), { status: 200, headers: corsHeaders(env) });
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
