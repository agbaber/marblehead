// Backing and reps: verified residents publicly back ideas on
// what-can-we-do.html. v1 (Part A) of the backing-and-reps spec.
//
//   GET  /api/engagement?target_type=idea&target_ids=idea-01,idea-02
//        -> per-target counts + opted-in names. my_state added if the
//           caller sends a valid JWT.
//   POST /api/engagement   { target_type, target_id, state, display_name? }
//        -> set the caller's state. state 'none' removes the row.
//
// Reuses the verification layer's identity hashes and JWT auth.

import {
  authenticate,
  parseBody,
  getActiveResident,
  resolveBranchName,
  json,
} from './verify.js';
import { extractJWT, verifyJWT } from './jwt.js';

const VALID_TARGET_TYPES = ['idea', 'warrant', 'poll'];
// Writable states. 'none' removes the row; reads never see it.
const VALID_WRITE_STATES = ['back_anon', 'back_named', 'rep', 'none'];
const MAX_DISPLAY_NAME = 80;

export async function handleEngagement(request, env, url) {
  if (url.pathname !== '/api/engagement') return null;
  const secret = env.JWT_SECRET || 'dev-secret-not-for-production';

  if (request.method === 'GET') return handleGetEngagement(request, env, url, secret);
  if (request.method === 'POST') return handlePostEngagement(request, env, secret);
  return null;
}

async function handleGetEngagement(request, env, url, secret) {
  const targetType = url.searchParams.get('target_type') || 'idea';
  if (!VALID_TARGET_TYPES.includes(targetType)) {
    return json({ error: 'invalid target_type' }, env, 400);
  }

  const targetIds = (url.searchParams.get('target_ids') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (targetIds.length === 0) return json({}, env);

  // Caller identity is optional on reads; only used to fill my_state.
  let callerHash = null;
  const token = extractJWT(request);
  if (token) {
    const payload = await verifyJWT(token, secret);
    if (payload) callerHash = payload.sub;
  }

  const placeholders = targetIds.map(() => '?').join(',');
  // INNER JOIN + revoked filter: a revoked resident (e.g. confirmed
  // impersonation) drops out of counts and named lists without a backfill.
  const { results } = await env.DB.prepare(
    `SELECT e.target_id, e.state, e.identity_hash, r.display_name, r.branch_root
       FROM engagement e
       JOIN residents r ON r.identity_hash = e.identity_hash
      WHERE e.target_type = ? AND e.target_id IN (${placeholders})
        AND r.revoked_at IS NULL`
  ).bind(targetType, ...targetIds).all();

  // Resolve each branch name at most once.
  const branchCache = new Map();
  const branchLabel = async (root) => {
    if (!root) return null;
    if (!branchCache.has(root)) branchCache.set(root, await resolveBranchName(env, root));
    return branchCache.get(root);
  };

  const out = {};
  for (const id of targetIds) {
    out[id] = { back_count: 0, rep_count: 0, anon_count: 0, named_backers: [], reps: [] };
    if (callerHash) out[id].my_state = null;
  }

  for (const row of results) {
    const e = out[row.target_id];
    if (!e) continue;
    e.back_count += 1;
    if (row.state === 'rep') e.rep_count += 1;
    if (row.state === 'back_anon') e.anon_count += 1;
    if (row.state === 'back_named' || row.state === 'rep') {
      const entry = {
        name: row.display_name || 'Verified resident',
        branch: await branchLabel(row.branch_root),
      };
      // Reps are surfaced in their own list; keep named_backers to plain
      // named backers so a rep is never rendered twice.
      if (row.state === 'rep') e.reps.push(entry);
      else e.named_backers.push(entry);
    }
    if (callerHash && row.identity_hash === callerHash) e.my_state = row.state;
  }

  return json(out, env);
}

async function handlePostEngagement(request, env, secret) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const targetType = body.target_type || 'idea';
  const targetId = body.target_id;
  const state = body.state;

  if (!VALID_TARGET_TYPES.includes(targetType)) {
    return json({ error: 'invalid target_type' }, env, 400);
  }
  if (!targetId) return json({ error: 'missing target_id' }, env, 400);
  if (!VALID_WRITE_STATES.includes(state)) {
    return json({ error: 'invalid state' }, env, 400);
  }

  const resident = await getActiveResident(env, payload.sub);
  if (!resident) return json({ error: 'resident not found or revoked' }, env, 403);

  const now = Date.now();

  if (state === 'none') {
    await env.DB.prepare(
      'DELETE FROM engagement WHERE identity_hash = ? AND target_type = ? AND target_id = ?'
    ).bind(payload.sub, targetType, targetId).run();
    return json({ ok: true, engagement: await targetSummary(env, targetType, targetId, payload.sub) }, env);
  }

  // Named backing and rep both surface the resident's name publicly, so a
  // display_name must be on file. Accept one inline the first time.
  if (state === 'back_named' || state === 'rep') {
    let name = resident.display_name;
    const provided = (body.display_name || '').trim();
    if (provided) {
      name = provided.slice(0, MAX_DISPLAY_NAME);
      await env.DB.prepare('UPDATE residents SET display_name = ? WHERE identity_hash = ?')
        .bind(name, payload.sub).run();
    }
    if (!name) return json({ error: 'display_name required for named backing or rep' }, env, 400);
  }

  // Overwriting upsert -- one row per (resident, target), no history.
  await env.DB.prepare(
    `INSERT INTO engagement (identity_hash, target_type, target_id, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(identity_hash, target_type, target_id)
     DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`
  ).bind(payload.sub, targetType, targetId, state, now, now).run();

  return json({ ok: true, engagement: await targetSummary(env, targetType, targetId, payload.sub) }, env);
}

/** Aggregate counts for a single target, plus the caller's own state. */
async function targetSummary(env, targetType, targetId, callerHash) {
  const { results } = await env.DB.prepare(
    `SELECT e.state, e.identity_hash
       FROM engagement e
       JOIN residents r ON r.identity_hash = e.identity_hash
      WHERE e.target_type = ? AND e.target_id = ? AND r.revoked_at IS NULL`
  ).bind(targetType, targetId).all();

  let back_count = 0, rep_count = 0, anon_count = 0, my_state = null;
  for (const r of results) {
    back_count += 1;
    if (r.state === 'rep') rep_count += 1;
    if (r.state === 'back_anon') anon_count += 1;
    if (callerHash && r.identity_hash === callerHash) my_state = r.state;
  }
  return { back_count, rep_count, anon_count, my_state };
}
