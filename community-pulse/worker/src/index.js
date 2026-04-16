// Cloudflare Worker for the community pulse reactions counter.
// Exposes three endpoints:
//   GET  /api/reactions?section_ids=a,b,c   (batched fetch)
//   POST /api/reactions                     (increment one section)
//   POST /api/votes                         (place or move a vote)
//
// Backed by a D1 database. No auth, no sessions.

import { handleVerify } from './verify.js';
import { serveVerifyPage, serveBranchesPage } from './pages.js';
import { STREETS } from './streets.js';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // per section per window per ip
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
// 'a','b','c' are the real positions; 'u' is "not sure yet", a first-class
// choice so readers can unlock evidence without being forced to guess.
const VALID_ANSWERS = ['a', 'b', 'c', 'u'];

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

  // Neighbor verification network endpoints.
  if (url.pathname.startsWith('/api/verify/')) {
    const verifyResponse = await handleVerify(request, env, url);
    if (verifyResponse) return verifyResponse;
  }

  // Street list for address typeahead.
  if (url.pathname === '/api/streets') {
    return new Response(JSON.stringify(STREETS), {
      status: 200,
      headers: { ...corsHeaders(env), 'Cache-Control': 'public, max-age=86400' }
    });
  }

  // Serve full pages from the worker (staging/preview).
  // Proxy the production homepage with API base rewritten to this worker.
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return proxyHomepage(url.origin);
  }
  if (url.pathname === '/verify') {
    return serveVerifyPage(url.origin);
  }
  if (url.pathname === '/branches') {
    return serveBranchesPage(url.origin);
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

  // Batch queries in chunks of 80 to stay under D1's bind parameter limit.
  const BATCH = 80;
  let results = [];
  for (let i = 0; i < sectionIds.length; i += BATCH) {
    const chunk = sectionIds.slice(i, i + BATCH);
    const placeholders = chunk.map(() => '?').join(',');
    const { results: rows } = await env.DB.prepare(
      `SELECT section_id, total_count, count_24h FROM reactions WHERE section_id IN (${placeholders})`
    ).bind(...chunk).all();
    results = results.concat(rows);
  }

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

/** Build the "mind-change" section ID for a topic.
 *  Incremented once every time a voter moves from one answer to another,
 *  so the client can display "X reconsidered after reading the evidence". */
function moveCounterSectionId(topic) {
  return 'index.html#m-' + topic;
}

/** Fetch current pick counts for every valid answer on a topic. */
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

/** Current mind-change count for a topic (0 if never moved). */
async function getMoveCount(env, topic) {
  const row = await env.DB.prepare(
    'SELECT total_count FROM reactions WHERE section_id = ?'
  ).bind(moveCounterSectionId(topic)).first();
  return row ? row.total_count : 0;
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
    const moves = await getMoveCount(env, topic);
    return new Response(JSON.stringify({ picks, moves, your_vote: answer }), { status: 200, headers: corsHeaders(env) });
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
      const moves = await getMoveCount(env, topic);
      return new Response(JSON.stringify({ picks, moves, your_vote: answer }), { status: 200, headers: corsHeaders(env) });
    }

    // Move vote: decrement old, increment new, update record,
    // and log the reconsideration so the client can surface the rate.
    await decrementReaction(env, answerSectionId(topic, existing.answer), now);
    await incrementReaction(env, answerSectionId(topic, answer), now);
    await incrementReaction(env, moveCounterSectionId(topic), now);
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
  const moves = await getMoveCount(env, topic);
  return new Response(JSON.stringify({ picks, moves, your_vote: answer }), { status: 200, headers: corsHeaders(env) });
}

/** Proxy the production homepage, rewriting API_BASE to point at this worker. */
async function proxyHomepage(workerOrigin) {
  const resp = await fetch('https://marbleheaddata.org/index.html');
  if (!resp.ok) return new Response('Failed to fetch homepage', { status: 502 });
  let html = await resp.text();
  // Rewrite relative asset paths to point at production site.
  html = html.replace(/(href|src)="\//g, '$1="https://marbleheaddata.org/');
  // Rewrite API base so ballot picks + verified tallies hit the staging worker.
  html = html.replace(
    /https:\/\/marblehead-community-pulse\.agbaber\.workers\.dev/g,
    workerOrigin
  );
  // Inject verified bar code if not already present.
  if (!html.includes('pick-dist-verified')) {
    const verifiedCSS = `<style>
.pick-dist-verified{margin:8px 0 12px;padding-top:8px;border-top:1px solid var(--border);overflow:visible}
.pick-dist-verified-label{font-size:.6875rem;font-weight:600;color:var(--c-teal);margin-bottom:4px}
.pick-dist-bar-verified{height:14px;border-radius:3px;display:flex;overflow:hidden;background:var(--border);opacity:.85}
</style>`;
    const verifiedJS = `<script>
(function(){
  var jwt=localStorage.getItem('verify_jwt');if(!jwt)return;
  var API='${workerOrigin}';
  var profile=null,cache={};
  function hdr(){return{'Content-Type':'application/json','Authorization':'Bearer '+jwt}}

  // Poll every 500ms for distribution bars that need a verified overlay.
  // Simpler and more resilient than MutationObserver — handles re-renders.
  setInterval(scan,500);
  setTimeout(scan,100);

  function scan(){
    document.querySelectorAll('.pick-distribution').forEach(function(bar){
      var screen=bar.closest('.question-screen');
      if(!screen)return;
      var topic=screen.dataset.topic;
      if(!topic)return;
      // Skip if already has a verified bar.
      if(bar.nextElementSibling&&bar.nextElementSibling.classList.contains('pick-dist-verified'))return;
      addBar(topic,bar);
    });
  }

  function addBar(topic,distBar){
    getProfile(function(p){
      if(!p)return;
      // Auto-submit verified vote.
      var screen=distBar.closest('.question-screen');
      var picked=screen?screen.querySelector('.answer-card.selected'):null;
      if(picked){
        fetch(API+'/api/verify/vote',{method:'POST',headers:hdr(),body:JSON.stringify({topic:topic,answer:picked.dataset.answer})}).catch(function(){});
      }
      var key=p.branch_root+':'+topic;
      if(cache[key]){render(distBar,cache[key],p,topic);return}
      fetch(API+'/api/verify/branches/'+encodeURIComponent(p.branch_root)+'/votes?topic='+topic,{headers:hdr()})
        .then(function(r){return r.json()})
        .then(function(d){if(d&&d.breakdown){cache[key]=d;render(distBar,d,p,topic)}})
        .catch(function(){});
    });
  }

  function getProfile(cb){
    if(profile)return cb(profile);
    fetch(API+'/api/verify/me',{headers:hdr()})
      .then(function(r){return r.json()})
      .then(function(p){if(p&&p.identity_hash){profile=p;cb(p)}else cb(null)})
      .catch(function(){cb(null)});
  }

  function render(distBar,data,p,topic){
    // Remove old.
    var next=distBar.nextElementSibling;
    if(next&&next.classList.contains('pick-dist-verified'))next.remove();
    var bd=data.breakdown;
    var vA=bd.a||0,vB=bd.b||0,vC=bd.c||0,vU=bd.u||0;
    var t=vA+vB+vC+vU;if(t===0)return;
    function pct(n){return t>0?Math.round(n/t*100):0}
    var pA=pct(vA),pB=pct(vB),pC=pct(vC),pU=100-pA-pB-pC;if(pU<0)pU=0;
    var name=p.branch_name||'Your branch';
    var el=document.createElement('div');el.className='pick-dist-verified';
    el.innerHTML='<div class="pick-dist-verified-label">'+name+' ('+t+' verified)</div>'+
      '<div class="pick-dist-bar-verified">'+
      '<div class="pick-dist-seg pick-dist-a" style="width:'+pA+'%">'+(pA>=12?pA+'%':'')+'</div>'+
      '<div class="pick-dist-seg pick-dist-b" style="width:'+pB+'%">'+(pB>=12?pB+'%':'')+'</div>'+
      '<div class="pick-dist-seg pick-dist-c" style="width:'+pC+'%">'+(pC>=12?pC+'%':'')+'</div>'+
      '<div class="pick-dist-seg pick-dist-u" style="width:'+pU+'%">'+(pU>=12?pU+'%':'')+'</div>'+
      '</div>';
    distBar.after(el);
  }
})();
</script>`;
    html = html.replace('</body>', verifiedCSS + verifiedJS + '</body>');
  }
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

function corsResponse(request, env) {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}
