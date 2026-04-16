// Neighbor Verification Network — full implementation.
// Handles registration, passkey auth, invites, votes, branches, revocation, recovery.
// Uses @passwordless-id/webauthn (no Node.js built-ins).

import { server } from '@passwordless-id/webauthn';
import {
  signJWT, verifyJWT, extractJWT,
  createChallenge, verifyChallenge,
  generateRecoveryKey, hashRecoveryKey,
} from './jwt.js';

const VALID_ANSWERS = ['a', 'b', 'c', 'u'];
const VALID_STANCES = ['agree', 'disagree', 'alert'];
const BONUS_INVITE_THRESHOLD = 3; // grandchildren needed per bonus batch
const BONUS_INVITE_AMOUNT = 3;
const MIN_BRANCH_SIZE_FOR_BREAKDOWN = 5;

// Random branch names — Marblehead Revolutionary War themed.
// Assigned automatically when a branch is created.
const BRANCH_NAMES = [
  "Glover's Regiment",
  "The Hannah Crew",
  "Mugford's Prize",
  "Fort Sewall Watch",
  "Old North Company",
  "Marblehead Mariners",
  "The Schooner Guard",
  "Powder House Hill",
  "Elbridge's Table",
  "Harbor Defense",
  "The Cod Fleet",
  "Abbot Hall Circle",
  "Lighthouse Keepers",
  "Castle Rock Company",
  "The Neck Watch",
  "Crocker Park Scouts",
  "Devereux Runners",
  "Naugus Head Lookout",
  "The Causeway Guard",
  "Burial Hill Society",
  "Cat Island Crew",
  "Little Harbor Band",
  "The Skipjack Circle",
  "Barnegat Posse",
  "Fountain Inn Club",
  "Gerry's Signers",
  "Tucker's Wharf Co.",
  "The Fog Signal",
  "Oakum Bay Watch",
  "Peach's Point Guard",
  "Goodwin's Head Post",
  "The Cannonball Run",
  "Lovis Cove Militia",
  "Old Burial Hill Co.",
  "Marblehead Neck Guard",
  "The Pinky Fleet",
  "Redcoat Watchers",
  "Spirit of '76 Brigade",
  "Lee Mansion Circle",
  "Redd's Pond Society",
];

/**
 * Route /api/verify/* requests. Returns a Response or null (not handled).
 */
export async function handleVerify(request, env, url) {
  const webauthnOrigin = getWebAuthnOrigin(request, env);
  const secret = env.JWT_SECRET || 'dev-secret-not-for-production';

  // ── Registration ──────────────────────────────────────────────

  // Register a new resident (two-sided handshake).
  if (url.pathname === '/api/verify/register' && request.method === 'POST') {
    return handleRegister(request, env, secret, webauthnOrigin);
  }

  // Complete passkey registration after /register returned a challenge.
  if (url.pathname === '/api/verify/passkey/register' && request.method === 'POST') {
    return handlePasskeyRegister(request, env, secret, webauthnOrigin);
  }

  // ── Authentication ────────────────────────────────────────────

  // Request a challenge for passkey authentication.
  if (url.pathname === '/api/verify/passkey/auth-challenge' && request.method === 'POST') {
    return handleAuthChallenge(request, env, secret);
  }

  // Authenticate with a passkey assertion.
  if (url.pathname === '/api/verify/passkey/auth' && request.method === 'POST') {
    return handleAuth(request, env, secret, webauthnOrigin);
  }

  // Register an additional passkey on a new device.
  if (url.pathname === '/api/verify/passkey/add-device' && request.method === 'POST') {
    return handleAddDevice(request, env, secret, webauthnOrigin);
  }

  // ── Invites ───────────────────────────────────────────────────

  // Create an invite for a specific neighbor.
  if (url.pathname === '/api/verify/invite' && request.method === 'POST') {
    return handleInviteCreate(request, env, secret);
  }

  // ── Profile ───────────────────────────────────────────────────

  // Get current resident info.
  if (url.pathname === '/api/verify/me' && request.method === 'GET') {
    return handleMe(request, env, secret);
  }

  // ── Verified votes ────────────────────────────────────────────

  if (url.pathname === '/api/verify/vote' && request.method === 'POST') {
    return handleVote(request, env, secret);
  }

  // ── Branches ──────────────────────────────────────────────────

  if (url.pathname === '/api/verify/branches' && request.method === 'GET') {
    return handleBranches(request, env);
  }

  if (url.pathname.match(/^\/api\/verify\/branches\/[^/]+\/votes$/) && request.method === 'GET') {
    return handleBranchVotes(request, env, url, secret);
  }

  // ── Branch naming ─────────────────────────────────────────────

  // Get available names for renaming.
  if (url.pathname === '/api/verify/branch-name/available' && request.method === 'GET') {
    return handleAvailableNames(request, env, secret);
  }

  // Vote to rename your branch.
  if (url.pathname === '/api/verify/branch-name/vote' && request.method === 'POST') {
    return handleBranchNameVote(request, env, secret);
  }

  // ── Revocation ────────────────────────────────────────────────

  if (url.pathname === '/api/verify/revoke' && request.method === 'POST') {
    return handleRevoke(request, env, secret);
  }

  // ── Recovery ──────────────────────────────────────────────────

  if (url.pathname === '/api/verify/recovery/use-key' && request.method === 'POST') {
    return handleRecoveryUseKey(request, env, secret, webauthnOrigin);
  }

  if (url.pathname === '/api/verify/recovery/create' && request.method === 'POST') {
    return handleRecoveryCreate(request, env, secret);
  }

  if (url.pathname === '/api/verify/recovery/redeem' && request.method === 'POST') {
    return handleRecoveryRedeem(request, env, secret, webauthnOrigin);
  }

  return null; // not handled
}

// ═══════════════════════════════════════════════════════════════
// Registration
// ═══════════════════════════════════════════════════════════════

async function handleRegister(request, env, secret, webauthnOrigin) {
  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { identity_hash, invite_token } = body;
  if (!identity_hash || !invite_token) {
    return json({ error: 'missing identity_hash or invite_token' }, env, 400);
  }

  // Look up invite.
  const invite = await env.DB.prepare(
    'SELECT token, created_by, recipient_hash, consumed_by FROM invites WHERE token = ?'
  ).bind(invite_token).first();

  if (!invite) return json({ error: 'unknown invite token' }, env, 400);
  if (invite.consumed_by) return json({ error: 'invite already used' }, env, 400);

  // Two-sided handshake: hashes must match.
  if (invite.recipient_hash !== identity_hash) {
    return json({ error: 'this invite was not created for this name/address' }, env, 400);
  }

  // Check for duplicate resident.
  const existing = await env.DB.prepare(
    'SELECT identity_hash FROM residents WHERE identity_hash = ?'
  ).bind(identity_hash).first();
  if (existing) return json({ error: 'already registered' }, env, 400);

  // Handshake valid. Return a challenge for passkey creation.
  // Resident is NOT created yet — that happens in /passkey/register
  // so a failed passkey doesn't leave a half-registered state.
  const challenge = await createChallenge(secret);

  return json({
    ok: true,
    challenge,
    identity_hash,
    invite_token,
  }, env);
}

async function handlePasskeyRegister(request, env, secret, webauthnOrigin) {
  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { registration, challenge, identity_hash, invite_token } = body;
  if (!registration || !challenge || !identity_hash) {
    return json({ error: 'missing registration, challenge, or identity_hash' }, env, 400);
  }

  // Verify signed challenge.
  const validChallenge = await verifyChallenge(challenge, secret);
  if (!validChallenge) {
    return json({ error: 'invalid or expired challenge' }, env, 400);
  }

  try {
    const browserChallenge = challenge.split('.')[0];

    const registrationInfo = await server.verifyRegistration(registration, {
      challenge: browserChallenge,
      origin: webauthnOrigin,
    });

    // Passkey verified. Now create the resident + consume invite atomically.
    // This is the point of no return — passkey creation succeeded in the browser.

    const now = Date.now();

    // If invite_token is provided, this is a new registration (not add-device).
    if (invite_token) {
      // Re-validate invite (in case of race condition).
      const invite = await env.DB.prepare(
        'SELECT created_by, recipient_hash, consumed_by FROM invites WHERE token = ?'
      ).bind(invite_token).first();
      if (!invite || invite.consumed_by) {
        return json({ error: 'invite already used' }, env, 400);
      }

      // Determine branch.
      const inviter = await env.DB.prepare(
        'SELECT identity_hash, branch_root, invited_by FROM residents WHERE identity_hash = ?'
      ).bind(invite.created_by).first();

      let branch_root;
      let branch_name = null;
      if (!inviter || !inviter.branch_root) {
        branch_root = identity_hash;
        branch_name = await pickBranchName(env);
      } else {
        branch_root = inviter.branch_root;
      }

      // Create resident.
      await env.DB.prepare(
        'INSERT INTO residents (identity_hash, invited_by, branch_root, invites_remaining, created_at) VALUES (?, ?, ?, 3, ?)'
      ).bind(identity_hash, invite.created_by, branch_root, now).run();

      // Auto-assign branch name.
      if (branch_name) {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO branch_names (branch_root, proposed_name, proposed_by, proposed_at) VALUES (?, ?, ?, ?)'
        ).bind(branch_root, branch_name, identity_hash, now).run();
        await env.DB.prepare(
          'INSERT OR IGNORE INTO branch_name_votes (identity_hash, branch_root, voted_name, voted_at) VALUES (?, ?, ?, ?)'
        ).bind(identity_hash, branch_root, branch_name, now).run();
      }

      // Consume invite.
      await env.DB.prepare(
        'UPDATE invites SET consumed_by = ?, consumed_at = ? WHERE token = ?'
      ).bind(identity_hash, now, invite_token).run();

      // Bonus invites for grandparent.
      await checkBonusInvites(env, invite.created_by);

      // Recovery key.
      const recovery = await generateRecoveryKey();
      await env.DB.prepare(
        'INSERT INTO recovery_keys (identity_hash, key_hash, created_at) VALUES (?, ?, ?)'
      ).bind(identity_hash, recovery.hash, now).run();

      // Store passkey credential.
      const cred = registrationInfo.credential;
      await env.DB.prepare(
        `INSERT INTO passkey_credentials (credential_id, identity_hash, public_key, algorithm, sign_count, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`
      ).bind(cred.id, identity_hash, cred.publicKey, cred.algorithm, now).run();

      const resident = await getActiveResident(env, identity_hash);
      const token = await signJWT({ sub: identity_hash, branch: resident.branch_root }, secret);

      return json({ ok: true, credential_id: cred.id, token, recovery_key: recovery.plain, branch_root: resident.branch_root, branch_name }, env);
    }

    // No invite_token — this is an add-device flow for an existing resident.
    const resident = await getActiveResident(env, identity_hash);
    if (!resident) {
      return json({ error: 'resident not found or revoked' }, env, 400);
    }

    const cred = registrationInfo.credential;
    await env.DB.prepare(
      `INSERT INTO passkey_credentials (credential_id, identity_hash, public_key, algorithm, sign_count, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`
    ).bind(cred.id, identity_hash, cred.publicKey, cred.algorithm, Date.now()).run();

    const token = await signJWT({ sub: identity_hash, branch: resident.branch_root }, secret);
    return json({ ok: true, credential_id: cred.id, token }, env);
  } catch (err) {
    return json({ error: 'passkey registration failed', detail: err.message }, env, 400);
  }
}

// ═══════════════════════════════════════════════════════════════
// Authentication
// ═══════════════════════════════════════════════════════════════

async function handleAuthChallenge(request, env, secret) {
  const challenge = await createChallenge(secret);

  // Return all credential IDs (fine at Marblehead scale).
  const { results } = await env.DB.prepare(
    `SELECT pc.credential_id FROM passkey_credentials pc
     JOIN residents r ON pc.identity_hash = r.identity_hash
     WHERE r.revoked_at IS NULL`
  ).all();
  const credentialIds = results.map(r => r.credential_id);

  return json({ challenge, credentialIds }, env);
}

async function handleAuth(request, env, secret, webauthnOrigin) {
  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { authentication, challenge } = body;
  if (!authentication || !challenge) {
    return json({ error: 'missing authentication or challenge' }, env, 400);
  }

  const validChallenge = await verifyChallenge(challenge, secret);
  if (!validChallenge) {
    return json({ error: 'invalid or expired challenge' }, env, 400);
  }

  const credRow = await env.DB.prepare(
    'SELECT credential_id, identity_hash, public_key, algorithm, sign_count FROM passkey_credentials WHERE credential_id = ?'
  ).bind(authentication.id).first();

  if (!credRow) return json({ error: 'unknown credential' }, env, 400);

  // Check resident is active.
  const resident = await getActiveResident(env, credRow.identity_hash);
  if (!resident) return json({ error: 'resident revoked' }, env, 403);

  try {
    const browserChallenge = challenge.split('.')[0];

    const authInfo = await server.verifyAuthentication(authentication, {
      id: credRow.credential_id,
      publicKey: credRow.public_key,
      algorithm: credRow.algorithm,
    }, {
      challenge: browserChallenge,
      origin: webauthnOrigin,
      userVerified: false,
      counter: credRow.sign_count,
    });

    await env.DB.prepare(
      'UPDATE passkey_credentials SET sign_count = ? WHERE credential_id = ?'
    ).bind(authInfo.counter, credRow.credential_id).run();

    const token = await signJWT({ sub: credRow.identity_hash, branch: resident.branch_root }, secret);

    return json({ ok: true, token, identity_hash: credRow.identity_hash, branch_root: resident.branch_root }, env);
  } catch (err) {
    return json({ error: 'authentication failed', detail: err.message }, env, 400);
  }
}

async function handleAddDevice(request, env, secret, webauthnOrigin) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { registration, challenge } = body;
  if (!registration || !challenge) {
    return json({ error: 'missing registration or challenge' }, env, 400);
  }

  const validChallenge = await verifyChallenge(challenge, secret);
  if (!validChallenge) return json({ error: 'invalid or expired challenge' }, env, 400);

  try {
    const browserChallenge = challenge.split('.')[0];
    const registrationInfo = await server.verifyRegistration(registration, {
      challenge: browserChallenge,
      origin: webauthnOrigin,
    });

    const cred = registrationInfo.credential;
    await env.DB.prepare(
      `INSERT INTO passkey_credentials (credential_id, identity_hash, public_key, algorithm, sign_count, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`
    ).bind(cred.id, payload.sub, cred.publicKey, cred.algorithm, Date.now()).run();

    return json({ ok: true, credential_id: cred.id }, env);
  } catch (err) {
    return json({ error: 'passkey registration failed', detail: err.message }, env, 400);
  }
}

// ═══════════════════════════════════════════════════════════════
// Invites
// ═══════════════════════════════════════════════════════════════

async function handleInviteCreate(request, env, secret) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { recipient_hash, recipient_label } = body;
  if (!recipient_hash) return json({ error: 'missing recipient_hash' }, env, 400);

  // Check invite budget.
  const resident = await getActiveResident(env, payload.sub);
  if (!resident) return json({ error: 'resident not found or revoked' }, env, 403);
  if (resident.invites_remaining <= 0) {
    return json({ error: 'no invites remaining' }, env, 400);
  }

  // Generate token.
  const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
  const token = btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO invites (token, created_by, recipient_hash, recipient_label, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(token, payload.sub, recipient_hash, (recipient_label || '').slice(0, 30), now).run();

  await env.DB.prepare(
    'UPDATE residents SET invites_remaining = invites_remaining - 1 WHERE identity_hash = ?'
  ).bind(payload.sub).run();

  const siteOrigin = getSiteOrigin(request, env);
  const invite_url = `${siteOrigin}/verify#invite=${token}`;

  return json({ ok: true, token, invite_url }, env);
}

// ═══════════════════════════════════════════════════════════════
// Profile
// ═══════════════════════════════════════════════════════════════

async function handleMe(request, env, secret) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  const resident = await getActiveResident(env, payload.sub);
  if (!resident) return json({ error: 'resident not found or revoked' }, env, 403);

  // All invites I created — pending and completed.
  const { results: allInvites } = await env.DB.prepare(
    'SELECT token, recipient_label, consumed_by, created_at, consumed_at FROM invites WHERE created_by = ? ORDER BY created_at DESC'
  ).bind(payload.sub).all();

  // Branch name.
  const branchName = await resolveBranchName(env, resident.branch_root);

  // Branch size.
  const sizeRow = await env.DB.prepare(
    'SELECT COUNT(*) as size FROM residents WHERE branch_root = ? AND revoked_at IS NULL'
  ).bind(resident.branch_root).first();

  // Build merged invite list with status + downstream counts.
  const siteOrigin = getSiteOrigin(request, env);
  const invites = [];
  for (const inv of allInvites) {
    const entry = {
      label: inv.recipient_label || '',
      status: inv.consumed_by ? 'joined' : 'pending',
      created_at: inv.created_at,
    };
    if (!inv.consumed_by) {
      // Pending — include the invite URL for resharing.
      entry.invite_url = `${siteOrigin}/verify#invite=${inv.token}`;
    } else {
      // Joined — count their downstream.
      const downstreamRow = await env.DB.prepare(`
        WITH RECURSIVE tree AS (
          SELECT identity_hash FROM residents WHERE invited_by = ? AND revoked_at IS NULL
          UNION ALL
          SELECT r.identity_hash FROM residents r JOIN tree t ON r.invited_by = t.identity_hash
            WHERE r.revoked_at IS NULL
        )
        SELECT COUNT(*) as count FROM tree
      `).bind(inv.consumed_by).first();
      entry.downstream = downstreamRow?.count || 0;
    }
    invites.push(entry);
  }

  return json({
    identity_hash: payload.sub,
    branch_root: resident.branch_root,
    branch_name: branchName,
    branch_size: sizeRow?.size || 0,
    invites_remaining: resident.invites_remaining,
    invites,
  }, env);
}

// ═══════════════════════════════════════════════════════════════
// Verified votes
// ═══════════════════════════════════════════════════════════════

async function handleVote(request, env, secret) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { topic, answer } = body;
  if (!topic) return json({ error: 'missing topic' }, env, 400);
  if (!answer || (!VALID_ANSWERS.includes(answer) && !VALID_STANCES.includes(answer))) {
    return json({ error: 'invalid answer' }, env, 400);
  }

  const resident = await getActiveResident(env, payload.sub);
  if (!resident) return json({ error: 'resident not found or revoked' }, env, 403);

  const now = Date.now();

  // Upsert: one vote per resident per topic.
  const existing = await env.DB.prepare(
    'SELECT answer FROM verified_votes WHERE identity_hash = ? AND topic = ?'
  ).bind(payload.sub, topic).first();

  if (existing) {
    await env.DB.prepare(
      'UPDATE verified_votes SET answer = ?, voted_at = ? WHERE identity_hash = ? AND topic = ?'
    ).bind(answer, now, payload.sub, topic).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO verified_votes (identity_hash, topic, answer, voted_at) VALUES (?, ?, ?, ?)'
    ).bind(payload.sub, topic, answer, now).run();
  }

  // Return current tally for this topic.
  const tally = await getVerifiedTally(env, topic);

  return json({ ok: true, your_vote: answer, tally }, env);
}

// ═══════════════════════════════════════════════════════════════
// Branches
// ═══════════════════════════════════════════════════════════════

async function handleBranches(request, env) {
  const { results: branches } = await env.DB.prepare(
    `SELECT branch_root, COUNT(*) as size
     FROM residents WHERE revoked_at IS NULL AND branch_root IS NOT NULL
     GROUP BY branch_root`
  ).all();

  const out = [];
  for (const b of branches) {
    const name = await resolveBranchName(env, b.branch_root);
    out.push({ branch_root: b.branch_root, name, size: b.size });
  }

  return json({ branches: out }, env);
}

async function handleBranchVotes(request, env, url, secret) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  // Extract branch_root from URL.
  const match = url.pathname.match(/^\/api\/verify\/branches\/([^/]+)\/votes$/);
  if (!match) return json({ error: 'invalid path' }, env, 400);
  const branchRoot = decodeURIComponent(match[1]);

  const topic = new URL(request.url).searchParams.get('topic');
  if (!topic) return json({ error: 'missing topic param' }, env, 400);

  // Show-after-you-pick: check that the requesting resident has voted.
  const myVote = await env.DB.prepare(
    'SELECT answer FROM verified_votes WHERE identity_hash = ? AND topic = ?'
  ).bind(payload.sub, topic).first();

  if (!myVote) {
    return json({ error: 'vote first to see branch breakdown' }, env, 403);
  }

  // Get branch size.
  const sizeRow = await env.DB.prepare(
    'SELECT COUNT(*) as size FROM residents WHERE branch_root = ? AND revoked_at IS NULL'
  ).bind(branchRoot).first();

  if (!sizeRow || sizeRow.size < MIN_BRANCH_SIZE_FOR_BREAKDOWN) {
    return json({ branch_root: branchRoot, size: sizeRow?.size || 0, breakdown: null, reason: 'branch too small' }, env);
  }

  // Aggregate votes for this branch + topic.
  const { results } = await env.DB.prepare(
    `SELECT vv.answer, COUNT(*) as count
     FROM verified_votes vv
     JOIN residents r ON vv.identity_hash = r.identity_hash
     WHERE r.branch_root = ? AND r.revoked_at IS NULL AND vv.topic = ?
     GROUP BY vv.answer`
  ).bind(branchRoot, topic).all();

  const breakdown = {};
  for (const r of results) breakdown[r.answer] = r.count;

  return json({ branch_root: branchRoot, size: sizeRow.size, breakdown }, env);
}

// ═══════════════════════════════════════════════════════════════
// Branch naming
// ═══════════════════════════════════════════════════════════════

/** GET available names: names from the BRANCH_NAMES list not currently assigned to any branch. */
async function handleAvailableNames(request, env, secret) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  const { results } = await env.DB.prepare(
    'SELECT DISTINCT proposed_name FROM branch_names'
  ).all();
  const used = new Set(results.map(r => r.proposed_name));
  const available = BRANCH_NAMES.filter(n => !used.has(n));

  // Also return the current name of the requester's branch.
  const resident = await getActiveResident(env, payload.sub);
  const currentName = resident ? await resolveBranchName(env, resident.branch_root) : null;

  return json({ available, current_name: currentName }, env);
}

/**
 * Vote to rename your branch. Body: { name }.
 * The name must be from the BRANCH_NAMES list and not taken by another branch.
 * If a majority of branch members vote for a new name, the branch switches.
 * The old name is freed up for other branches.
 */
async function handleBranchNameVote(request, env, secret) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { name } = body;
  if (!name) return json({ error: 'missing name' }, env, 400);

  const resident = await getActiveResident(env, payload.sub);
  if (!resident) return json({ error: 'resident not found or revoked' }, env, 403);

  // Validate the name is in the master list.
  if (!BRANCH_NAMES.includes(name)) {
    return json({ error: 'name not in the available list' }, env, 400);
  }

  // Check it's not taken by another branch.
  const takenRow = await env.DB.prepare(
    'SELECT branch_root FROM branch_names WHERE proposed_name = ? AND branch_root <> ?'
  ).bind(name, resident.branch_root).first();
  if (takenRow) return json({ error: 'name already taken by another branch' }, env, 400);

  const now = Date.now();

  // Ensure the name is proposed for this branch.
  await env.DB.prepare(
    'INSERT OR IGNORE INTO branch_names (branch_root, proposed_name, proposed_by, proposed_at) VALUES (?, ?, ?, ?)'
  ).bind(resident.branch_root, name, payload.sub, now).run();

  // Record this resident's vote.
  const existingVote = await env.DB.prepare(
    'SELECT 1 FROM branch_name_votes WHERE identity_hash = ? AND branch_root = ?'
  ).bind(payload.sub, resident.branch_root).first();

  if (existingVote) {
    await env.DB.prepare(
      'UPDATE branch_name_votes SET voted_name = ?, voted_at = ? WHERE identity_hash = ? AND branch_root = ?'
    ).bind(name, now, payload.sub, resident.branch_root).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO branch_name_votes (identity_hash, branch_root, voted_name, voted_at) VALUES (?, ?, ?, ?)'
    ).bind(payload.sub, resident.branch_root, name, now).run();
  }

  // Check if the new name has majority.
  const branchSize = await env.DB.prepare(
    'SELECT COUNT(*) as size FROM residents WHERE branch_root = ? AND revoked_at IS NULL'
  ).bind(resident.branch_root).first();
  const votesForNew = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM branch_name_votes WHERE branch_root = ? AND voted_name = ?'
  ).bind(resident.branch_root, name).first();

  const majority = Math.floor((branchSize?.size || 1) / 2) + 1;
  const currentName = await resolveBranchName(env, resident.branch_root);

  // If the new name wins by majority, clean up old proposals from other branches
  // so the old name is freed up.
  if ((votesForNew?.count || 0) >= majority && currentName === name) {
    // Remove old name proposals that no longer have votes.
    await env.DB.prepare(
      `DELETE FROM branch_names WHERE branch_root = ? AND proposed_name <> ?
       AND proposed_name NOT IN (SELECT voted_name FROM branch_name_votes WHERE branch_root = ?)`
    ).bind(resident.branch_root, name, resident.branch_root).run();
  }

  return json({
    ok: true,
    current_name: currentName,
    your_vote: name,
    votes_for: votesForNew?.count || 0,
    majority_needed: majority,
  }, env);
}

// ═══════════════════════════════════════════════════════════════
// Revocation
// ═══════════════════════════════════════════════════════════════

async function handleRevoke(request, env, secret) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  // Only the seed operator can revoke.
  const seedHash = env.SEED_IDENTITY_HASH;
  if (!seedHash || payload.sub !== seedHash) {
    return json({ error: 'not authorized' }, env, 403);
  }

  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { identity_hash } = body;
  if (!identity_hash) return json({ error: 'missing identity_hash' }, env, 400);

  const now = Date.now();

  // Cascade revocation via recursive CTE.
  await env.DB.prepare(`
    WITH RECURSIVE tree AS (
      SELECT identity_hash FROM residents WHERE identity_hash = ?
      UNION ALL
      SELECT r.identity_hash FROM residents r JOIN tree t ON r.invited_by = t.identity_hash
        WHERE r.revoked_at IS NULL
    )
    UPDATE residents SET revoked_at = ? WHERE identity_hash IN (SELECT identity_hash FROM tree)
  `).bind(identity_hash, now).run();

  return json({ ok: true }, env);
}

// ═══════════════════════════════════════════════════════════════
// Recovery
// ═══════════════════════════════════════════════════════════════

async function handleRecoveryUseKey(request, env, secret, webauthnOrigin) {
  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { recovery_key } = body;
  if (!recovery_key) return json({ error: 'missing recovery_key' }, env, 400);

  const keyHash = await hashRecoveryKey(recovery_key);

  const row = await env.DB.prepare(
    'SELECT identity_hash FROM recovery_keys WHERE key_hash = ?'
  ).bind(keyHash).first();

  if (!row) return json({ error: 'invalid recovery key' }, env, 400);

  // Verify resident is active.
  const resident = await getActiveResident(env, row.identity_hash);
  if (!resident) return json({ error: 'resident revoked' }, env, 403);

  // Issue a challenge for new passkey registration.
  const challenge = await createChallenge(secret);

  // Generate a new recovery key (old one is consumed).
  const newRecovery = await generateRecoveryKey();
  await env.DB.prepare(
    'UPDATE recovery_keys SET key_hash = ?, created_at = ? WHERE identity_hash = ?'
  ).bind(newRecovery.hash, Date.now(), row.identity_hash).run();

  return json({
    ok: true,
    challenge,
    identity_hash: row.identity_hash,
    recovery_key: newRecovery.plain,
  }, env);
}

async function handleRecoveryCreate(request, env, secret) {
  const payload = await authenticate(request, env, secret);
  if (payload instanceof Response) return payload;

  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { identity_hash } = body;
  if (!identity_hash) return json({ error: 'missing identity_hash' }, env, 400);

  // Verify the target was invited by the authenticated resident.
  const target = await env.DB.prepare(
    'SELECT identity_hash, invited_by FROM residents WHERE identity_hash = ? AND revoked_at IS NULL'
  ).bind(identity_hash).first();

  if (!target || target.invited_by !== payload.sub) {
    return json({ error: 'can only create recovery for someone you invited' }, env, 403);
  }

  // Generate a recovery token (stored as a temporary invite-like token).
  const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
  const token = btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, '-').replace(/_/g, '_').replace(/=+$/, '');

  // Store in a simple format: reuse recovery_keys with a temporary key.
  // The invitee can use this token at /api/verify/recovery/redeem.
  // Store the token hash alongside a reference.
  const tokenHash = await hashRecoveryKey(token);

  // We store this as a new recovery key for the target, replacing any existing one.
  await env.DB.prepare(
    `INSERT OR REPLACE INTO recovery_keys (identity_hash, key_hash, created_at) VALUES (?, ?, ?)`
  ).bind(identity_hash, tokenHash, Date.now()).run();

  return json({ ok: true, recovery_token: token }, env);
}

async function handleRecoveryRedeem(request, env, secret, webauthnOrigin) {
  const body = await parseBody(request, env);
  if (body instanceof Response) return body;

  const { token } = body;
  if (!token) return json({ error: 'missing token' }, env, 400);

  const tokenHash = await hashRecoveryKey(token);
  const row = await env.DB.prepare(
    'SELECT identity_hash FROM recovery_keys WHERE key_hash = ?'
  ).bind(tokenHash).first();

  if (!row) return json({ error: 'invalid recovery token' }, env, 400);

  const resident = await getActiveResident(env, row.identity_hash);
  if (!resident) return json({ error: 'resident revoked' }, env, 403);

  const challenge = await createChallenge(secret);

  // Generate a new recovery key.
  const newRecovery = await generateRecoveryKey();
  await env.DB.prepare(
    'UPDATE recovery_keys SET key_hash = ?, created_at = ? WHERE identity_hash = ?'
  ).bind(newRecovery.hash, Date.now(), row.identity_hash).run();

  return json({
    ok: true,
    challenge,
    identity_hash: row.identity_hash,
    recovery_key: newRecovery.plain,
  }, env);
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** Parse JSON body, returning a Response on failure. */
async function parseBody(request, env) {
  try {
    return await request.json();
  } catch {
    return json({ error: 'invalid body' }, env, 400);
  }
}

/** Authenticate via JWT. Returns the payload or a 401 Response. */
async function authenticate(request, env, secret) {
  const token = extractJWT(request);
  if (!token) return json({ error: 'missing authorization' }, env, 401);

  const payload = await verifyJWT(token, secret);
  if (!payload) return json({ error: 'invalid or expired token' }, env, 401);

  // Check revocation.
  const resident = await getActiveResident(env, payload.sub);
  if (!resident) return json({ error: 'resident revoked' }, env, 403);

  return payload;
}

/** Get an active (non-revoked) resident row. */
async function getActiveResident(env, identity_hash) {
  return env.DB.prepare(
    'SELECT identity_hash, branch_root, invited_by, invites_remaining, created_at FROM residents WHERE identity_hash = ? AND revoked_at IS NULL'
  ).bind(identity_hash).first();
}

/** Pick a random branch name not already in use. */
async function pickBranchName(env) {
  const { results } = await env.DB.prepare(
    'SELECT DISTINCT proposed_name FROM branch_names'
  ).all();
  const used = new Set(results.map(r => r.proposed_name));
  const available = BRANCH_NAMES.filter(n => !used.has(n));
  if (available.length === 0) {
    // All names used — fall back to a numbered name.
    return `Branch ${used.size + 1}`;
  }
  return available[Math.floor(Math.random() * available.length)];
}

/** Check if a resident's grandparent earns bonus invites. */
async function checkBonusInvites(env, inviterHash) {
  // Find the inviter's inviter (grandparent).
  const inviter = await env.DB.prepare(
    'SELECT invited_by FROM residents WHERE identity_hash = ?'
  ).bind(inviterHash).first();

  if (!inviter || !inviter.invited_by) return;

  const grandparent = inviter.invited_by;

  // Count grandchildren: residents whose invited_by was invited_by the grandparent.
  const { results } = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM residents r
     WHERE r.invited_by IN (
       SELECT identity_hash FROM residents WHERE invited_by = ?
     ) AND r.revoked_at IS NULL`
  ).bind(grandparent).all();

  const grandchildCount = results[0]?.count || 0;

  // Grant bonus invites at every multiple of the threshold.
  // Calculate how many bonuses have been earned vs. how many have been granted.
  // The resident starts with 3 invites. Each bonus adds 3.
  // Total earned invites = 3 + (floor(grandchildren / threshold) * 3).
  // We can't easily track "bonuses already granted" without a column, so just
  // set invites_remaining to the max of current and what they should have.
  const bonusBatches = Math.floor(grandchildCount / BONUS_INVITE_THRESHOLD);
  const totalEarned = 3 + (bonusBatches * BONUS_INVITE_AMOUNT);

  // Get current state.
  const gp = await env.DB.prepare(
    'SELECT invites_remaining FROM residents WHERE identity_hash = ?'
  ).bind(grandparent).first();

  if (gp) {
    // Count total invites ever created by this grandparent.
    const usedRow = await env.DB.prepare(
      'SELECT COUNT(*) as used FROM invites WHERE created_by = ?'
    ).bind(grandparent).first();
    const used = usedRow?.used || 0;

    const shouldHaveRemaining = totalEarned - used;
    if (shouldHaveRemaining > gp.invites_remaining) {
      await env.DB.prepare(
        'UPDATE residents SET invites_remaining = ? WHERE identity_hash = ?'
      ).bind(shouldHaveRemaining, grandparent).run();
    }
  }
}

/** Get the verified tally for a topic (across all active residents). */
async function getVerifiedTally(env, topic) {
  const { results } = await env.DB.prepare(
    `SELECT vv.answer, COUNT(*) as count
     FROM verified_votes vv
     JOIN residents r ON vv.identity_hash = r.identity_hash
     WHERE vv.topic = ? AND r.revoked_at IS NULL
     GROUP BY vv.answer`
  ).bind(topic).all();

  const tally = {};
  for (const r of results) tally[r.answer] = r.count;

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT vv.identity_hash) as total
     FROM verified_votes vv
     JOIN residents r ON vv.identity_hash = r.identity_hash
     WHERE vv.topic = ? AND r.revoked_at IS NULL`
  ).bind(topic).first();

  return { answers: tally, total_voters: totalRow?.total || 0 };
}

/** Resolve the winning branch name (most votes, ties broken by earliest proposal). */
async function resolveBranchName(env, branchRoot) {
  if (!branchRoot) return null;

  const row = await env.DB.prepare(
    `SELECT bn.proposed_name, COUNT(bnv.identity_hash) as votes, bn.proposed_at
     FROM branch_names bn
     LEFT JOIN branch_name_votes bnv ON bn.branch_root = bnv.branch_root AND bn.proposed_name = bnv.voted_name
     WHERE bn.branch_root = ?
     GROUP BY bn.proposed_name
     ORDER BY votes DESC, bn.proposed_at ASC
     LIMIT 1`
  ).bind(branchRoot).first();

  return row?.proposed_name || null;
}

/** Get the site origin for building URLs (invite links, etc). */
function getSiteOrigin(request, env) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  if (allowed !== '*') return allowed;
  // ALLOWED_ORIGIN is *, so use the request origin or referer.
  const origin = request.headers.get('Origin') || '';
  if (origin && origin !== 'null') return origin;
  const referer = request.headers.get('Referer') || '';
  if (referer) { try { return new URL(referer).origin; } catch {} }
  return 'https://marbleheaddata.org';
}

/** Determine the WebAuthn origin for verification. */
function getWebAuthnOrigin(request, env) {
  const requestOrigin = request.headers.get('Origin') || '';
  // For WebAuthn verification, we need the actual browser origin.
  // Use the request Origin header when: it's localhost, ALLOWED_ORIGIN is *,
  // or it matches the allowed origin.
  if (requestOrigin) {
    const allowed = env.ALLOWED_ORIGIN || '*';
    if (allowed === '*' || requestOrigin === allowed || requestOrigin.startsWith('http://localhost')) {
      return requestOrigin;
    }
  }
  return env.ALLOWED_ORIGIN || 'http://localhost:8787';
}

/** JSON response with CORS headers. */
function json(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    },
  });
}
