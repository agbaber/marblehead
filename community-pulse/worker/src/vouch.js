// Peer-vouch-on-demand: handlers for the three /api/verify/vouch-* endpoints.
// See docs/superpowers/specs/2026-06-22-passkey-first-login-design.md

const VOUCH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * POST /api/verify/vouch-request
 * Body: { identity_hash, name, address }
 * Returns: { token, expires_at } | { error }
 */
export async function handleVouchRequest(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const { identity_hash, name, address } = body;
  if (!identity_hash || !name || !address) {
    return json({ error: 'missing_fields' }, 400);
  }

  // Reject if requester is already a verified (non-revoked) resident.
  const existing = await env.DB.prepare(
    'SELECT identity_hash FROM residents WHERE identity_hash = ? AND revoked_at IS NULL'
  ).bind(identity_hash).first();
  if (existing) return json({ error: 'already_verified' }, 400);

  // Reject if requester already has a pending active request.
  const active = await env.DB.prepare(
    `SELECT token FROM vouch_requests WHERE requester_hash = ?
     AND status = 'pending' AND expires_at > ?`
  ).bind(identity_hash, Date.now()).first();
  if (active) return json({ error: 'active_request_exists', existing_token: active.token }, 400);

  const token = randomToken();
  const now = Date.now();
  const expires_at = now + VOUCH_TTL_MS;

  await env.DB.prepare(
    `INSERT INTO vouch_requests
     (token, requester_hash, requester_name, requester_address, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(token, identity_hash, name, address, now, expires_at).run();

  return json({ token, expires_at });
}
