// /verify-me.html controller.
// Drives FB OAuth bootstrap, the claim form, and result branching.

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

async function loadStreets() {
  try {
    const res = await fetch(`${VERIFY_API}/api/streets`);
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

function readSessionJwt() {
  return localStorage.getItem('verify_jwt');
}

function setSessionJwt(jwt) {
  localStorage.setItem('verify_jwt', jwt);
}

async function fetchSelf() {
  const jwt = readSessionJwt();
  if (!jwt) return null;
  const res = await fetch(`${VERIFY_API}/api/profile`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function show(el) { el.hidden = false; }

/**
 * The FB callback redirects here with `#token=<jwt>&claim=1`. Consume
 * the fragment: stash the JWT in localStorage and clear the hash so the
 * token doesn't linger in the URL bar / history.
 *
 * Returns { token, claim } extracted from the fragment, or null if the
 * fragment didn't carry an OAuth handoff.
 */
function consumeOAuthFragment() {
  if (!location.hash || !location.hash.includes('token=')) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('token');
  const claim = params.get('claim') === '1';
  if (!token) return null;
  setSessionJwt(token);
  // Clear the fragment without reloading; keep `#claim` as a state hint
  // for backward compat with bookmarks pointing at /verify-me#claim.
  const cleanHash = claim ? '#claim' : '';
  history.replaceState(null, '', location.pathname + location.search + cleanHash);
  return { token, claim };
}

async function init() {
  const oauth = consumeOAuthFragment();
  const isClaimStep = (oauth && oauth.claim) || location.hash === '#claim';

  // If we already have a JWT (just consumed, or from a prior session),
  // check whether it's a full-resident JWT. If so, head to /profile.
  const profile = await fetchSelf();
  if (profile && profile.identity_hash) {
    location.href = '/profile.html';
    return;
  }

  if (!isClaimStep) {
    // Not signed in and not in the post-callback claim step: the
    // two-door landing is already rendered. Nothing to do.
    return;
  }

  const section = document.getElementById('claim-form-section');
  show(section);

  // Streets typeahead.
  const datalist = document.getElementById('streets');
  const streets = await loadStreets();
  for (const s of streets) {
    const opt = document.createElement('option');
    opt.value = s;
    datalist.appendChild(opt);
  }

  // Fetch the FB display name from /api/me/pre using Authorization: Bearer.
  const jwt = readSessionJwt();
  if (jwt) {
    const preRes = await fetch(`${VERIFY_API}/api/me/pre`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (preRes.ok) {
      const meta = await preRes.json();
      document.getElementById('claim-fb-name').textContent = meta.fb_display_name || '';
    }
  }

  document.getElementById('claim-form').addEventListener('submit', onSubmit);
}

async function onSubmit(e) {
  e.preventDefault();
  const street = document.getElementById('claim-street').value.trim();
  const number = document.getElementById('claim-number').value.trim();
  const claimed_address = `${number} ${street}`;
  const result = document.getElementById('claim-result');
  result.textContent = 'Checking...';

  const jwt = readSessionJwt();
  const res = await fetch(`${VERIFY_API}/api/claim/address`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify({ claimed_address }),
  });

  if (!res.ok) {
    result.innerHTML = `<p class="err">Could not claim that address (HTTP ${res.status}). Try again.</p>`;
    return;
  }

  const body = await res.json();
  switch (body.status) {
    case 'match':
      if (body.session_jwt) setSessionJwt(body.session_jwt);
      result.innerHTML = `<p class="ok">You are verified as a Marblehead resident.<br>
        <a href="/profile.html" class="btn btn--primary">Go to your profile</a></p>`;
      break;
    case 'first_initial_mismatch':
      result.innerHTML = `
        <p>${escapeHtml(claimed_address)} is on record for a household whose named owners
        are <strong>${body.alternatives.map(escapeHtml).join(', ')}</strong>. Are you a
        member of this household?</p>
        <p>
          <a class="btn btn--primary" href="${escapeHtml(body.vouch_link)}">
            Yes, request a vouch
          </a>
        </p>`;
      break;
    case 'name_mismatch':
      result.innerHTML = `
        <p>${escapeHtml(claimed_address)} is in our records but listed under a different
        owner. If you rent, recently bought, or your name is not on the deed:</p>
        <p><a class="btn btn--primary" href="${escapeHtml(body.vouch_link)}">Request a vouch</a></p>`;
      break;
    case 'no_match':
      result.innerHTML = `
        <p>We do not have ${escapeHtml(claimed_address)} in our records. Recheck the
        spelling, or:</p>
        <p><a class="btn btn--primary" href="${escapeHtml(body.vouch_link)}">Request a vouch</a></p>`;
      break;
    default:
      result.innerHTML = `<p class="err">Unexpected response.</p>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

init();
