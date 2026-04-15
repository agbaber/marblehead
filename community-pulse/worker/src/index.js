// Cloudflare Worker for the community pulse reactions counter.
// Exposes three endpoints:
//   GET  /api/reactions?section_ids=a,b,c   (batched fetch)
//   POST /api/reactions                     (increment one section)
//   POST /api/votes                         (place or move a vote)
//
// Backed by a D1 database. No auth, no sessions.

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // per section per window per ip
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const VALID_ANSWERS = ['a', 'b', 'c'];

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
  }

  if (url.pathname === '/api/votes') {
    if (request.method === 'POST') return handleVotePost(request, env);
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

/** Increment a reaction counter by 1. */
async function incrementReaction(env, sectionId, now) {
  const existing = await env.DB.prepare(
    'SELECT total_count, count_24h, window_24h_start FROM reactions WHERE section_id = ?'
  ).bind(sectionId).first();

  if (existing) {
    const windowElapsed = (now - existing.window_24h_start) >= TWENTY_FOUR_HOURS_MS;
    const total = existing.total_count + 1;
    const count24h = windowElapsed ? 1 : existing.count_24h + 1;
    const windowStart = windowElapsed ? now : existing.window_24h_start;
    await env.DB.prepare(
      'UPDATE reactions SET total_count = ?, count_24h = ?, window_24h_start = ?, updated_at = ? WHERE section_id = ?'
    ).bind(total, count24h, windowStart, now, sectionId).run();
    return total;
  } else {
    await env.DB.prepare(
      'INSERT INTO reactions (section_id, total_count, count_24h, window_24h_start, updated_at) VALUES (?, 1, 1, ?, ?)'
    ).bind(sectionId, now, now).run();
    return 1;
  }
}

/** Decrement a reaction counter by 1, clamped to 0. */
async function decrementReaction(env, sectionId, now) {
  const existing = await env.DB.prepare(
    'SELECT total_count, count_24h, window_24h_start FROM reactions WHERE section_id = ?'
  ).bind(sectionId).first();

  if (!existing || existing.total_count <= 0) return 0;

  const windowElapsed = (now - existing.window_24h_start) >= TWENTY_FOUR_HOURS_MS;
  const total = existing.total_count - 1;
  const count24h = windowElapsed ? 0 : Math.max(existing.count_24h - 1, 0);
  const windowStart = windowElapsed ? now : existing.window_24h_start;
  await env.DB.prepare(
    'UPDATE reactions SET total_count = ?, count_24h = ?, window_24h_start = ?, updated_at = ? WHERE section_id = ?'
  ).bind(total, count24h, windowStart, now, sectionId).run();
  return total;
}

/** Build the answer-pick section ID for a topic+answer. */
function answerSectionId(topic, answer) {
  return 'index.html#a-' + topic + '-' + answer;
}

/** Fetch current pick counts for all three answers on a topic. */
async function getPickCounts(env, topic) {
  const ids = VALID_ANSWERS.map(a => answerSectionId(topic, a));
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT section_id, total_count FROM reactions WHERE section_id IN (${placeholders})`
  ).bind(...ids).all();

  const map = new Map(results.map(r => [r.section_id, r.total_count]));
  const picks = {};
  VALID_ANSWERS.forEach(a => {
    picks[a] = map.get(answerSectionId(topic, a)) || 0;
  });
  return picks;
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

/**
 * POST /api/votes -- place or move a vote.
 * Body: { topic: "override", answer: "b" }
 * Server checks its own votes table for what this IP previously picked.
 * Returns: { picks: { a: 12, b: 34, c: 5 }, your_vote: "b" }
 */
async function handleVotePost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400, headers: corsHeaders(env) });
  }

  const topic = body && body.topic;
  const answer = body && body.answer;

  if (!topic || typeof topic !== 'string') {
    return new Response(JSON.stringify({ error: 'missing topic' }), { status: 400, headers: corsHeaders(env) });
  }
  if (!answer || !VALID_ANSWERS.includes(answer)) {
    return new Response(JSON.stringify({ error: 'invalid answer' }), { status: 400, headers: corsHeaders(env) });
  }

  const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const allowed = await checkAndIncrementRateLimit(env, clientIp, 'vote-' + topic);

  if (!allowed) {
    // Rate-limited: return current counts without changing anything.
    const picks = await getPickCounts(env, topic);
    return new Response(JSON.stringify({ picks, your_vote: answer }), { status: 200, headers: corsHeaders(env) });
  }

  const ipHash = await hashIp(clientIp);
  const now = Date.now();

  // Look up existing vote for this IP + topic
  const existing = await env.DB.prepare(
    'SELECT answer FROM votes WHERE ip_hash = ? AND topic = ?'
  ).bind(ipHash, topic).first();

  if (existing) {
    if (existing.answer === answer) {
      // Already voted this way -- no-op
      const picks = await getPickCounts(env, topic);
      return new Response(JSON.stringify({ picks, your_vote: answer }), { status: 200, headers: corsHeaders(env) });
    }

    // Move vote: decrement old, increment new, update record
    await decrementReaction(env, answerSectionId(topic, existing.answer), now);
    await incrementReaction(env, answerSectionId(topic, answer), now);
    await env.DB.prepare(
      'UPDATE votes SET answer = ?, voted_at = ? WHERE ip_hash = ? AND topic = ?'
    ).bind(answer, now, ipHash, topic).run();
  } else {
    // First vote: increment new, insert record
    await incrementReaction(env, answerSectionId(topic, answer), now);
    await env.DB.prepare(
      'INSERT INTO votes (ip_hash, topic, answer, voted_at) VALUES (?, ?, ?, ?)'
    ).bind(ipHash, topic, answer, now).run();
  }

  const picks = await getPickCounts(env, topic);
  return new Response(JSON.stringify({ picks, your_vote: answer }), { status: 200, headers: corsHeaders(env) });
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
