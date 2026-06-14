import { BOARDS, TOPICS, SUBSCRIBABLE_TOPICS, isKnownBoard, isKnownTopic } from '../lib/topics.js';

const SUBSCRIBABLE_TOPIC_SLUGS = new Set(SUBSCRIBABLE_TOPICS.map(t => t.slug));

export async function handleGetSubscription(request, env, corsHeaders) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return jsonResp(400, { error: 'missing token' }, corsHeaders);
  const row = await env.DB.prepare(`SELECT email, boards, topics, status FROM subscriber WHERE manage_token = ?`).bind(token).first();
  if (!row || row.status === 'unsubscribed') return jsonResp(404, { error: 'not found' }, corsHeaders);
  return jsonResp(200, {
    email: row.email,
    boards: JSON.parse(row.boards),
    topics: JSON.parse(row.topics),
    available: {
      boards: BOARDS.map(b => ({ slug: b.slug, label: b.label, volume: b.volume })),
      topics: SUBSCRIBABLE_TOPICS.map(t => ({ slug: t.slug, label: t.label }))
    }
  }, corsHeaders);
}

export async function handlePreferencesUpdate(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { return jsonResp(400, { error: 'invalid body' }, corsHeaders); }
  const token = typeof body.token === 'string' ? body.token : '';
  const boards = Array.isArray(body.boards) ? body.boards : null;
  const topics = Array.isArray(body.topics) ? body.topics : null;
  if (!token || boards == null || topics == null) return jsonResp(400, { error: 'missing fields' }, corsHeaders);

  const validBoards = boards.every(isKnownBoard);
  const validTopics = topics.every(t => SUBSCRIBABLE_TOPIC_SLUGS.has(t));
  if (!validBoards || !validTopics) return jsonResp(400, { error: 'unknown slug' }, corsHeaders);
  if (boards.length === 0 && topics.length === 0) return jsonResp(400, { error: 'pick at least one board or topic' }, corsHeaders);

  const row = await env.DB.prepare('SELECT id, status FROM subscriber WHERE manage_token = ?').bind(token).first();
  if (!row || row.status === 'unsubscribed') return jsonResp(404, { error: 'not found' }, corsHeaders);

  await env.DB.prepare('UPDATE subscriber SET boards=?, topics=? WHERE id=?')
    .bind(JSON.stringify(boards), JSON.stringify(topics), row.id).run();
  return jsonResp(200, { ok: true }, corsHeaders);
}

function jsonResp(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(corsHeaders || {}) } });
}
