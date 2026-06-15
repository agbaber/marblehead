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

async function init() {
  const isClaimStep = location.hash === '#claim';

  // The FB callback sets verify_jwt as HttpOnly so JS cannot read it.
  // We re-fetch /api/profile to check whether the session is already a
  // full resident. If so, redirect to /profile.
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

  // Fetch the FB display name from /api/me/pre. The verify_jwt cookie
  // is HttpOnly, so we authenticate via credentials:'include' (the cookie
  // travels automatically on same-origin and cross-origin-with-credentials).
  const preRes = await fetch(`${VERIFY_API}/api/me/pre`, {
    credentials: 'include',
  });
  if (preRes.ok) {
    const meta = await preRes.json();
    document.getElementById('claim-fb-name').textContent = meta.fb_display_name || '';
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

  const res = await fetch(`${VERIFY_API}/api/claim/address`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
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
