// Drives both /vouch-request.html (requester side) and /vouch.html (voucher side).

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

const JWT_KEY = 'verify_jwt';
const POLL_INTERVAL_MS = 10000;
const SALT = 'marblehead-verify-salt';

function readJwt() { return localStorage.getItem(JWT_KEY); }
function setJwt(jwt) { localStorage.setItem(JWT_KEY, jwt); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

async function computeHash(name, address) {
  const input = name.toLowerCase().trim() + ':' + address.toLowerCase().trim() + ':' + SALT;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function api(method, path, body, jwt) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (jwt) opts.headers.Authorization = `Bearer ${jwt}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${VERIFY_API}${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, body: data };
}

// ── Requester side: /vouch-request.html ────────────────────────────────

async function initRequester() {
  const form = document.getElementById('vr-form');
  if (!form) return false; // not this page

  // If an active request token is already in localStorage, jump to waiting state.
  const savedToken = localStorage.getItem('vouch_request_token');
  if (savedToken) {
    startPolling(
      savedToken,
      localStorage.getItem('vouch_request_name') || '',
      localStorage.getItem('vouch_request_address') || ''
    );
    return true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('vr-name').value.trim();
    const number = document.getElementById('vr-number').value.trim();
    const street = document.getElementById('vr-street').value.trim();
    const address = `${number} ${street}`;
    if (!name || !number || !street) return;

    const submitBtn = document.getElementById('vr-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating request';

    const identity_hash = await computeHash(name, address);
    const { status, body } = await api('POST', '/api/verify/vouch-request', {
      identity_hash, name, address,
    });

    if (status === 200) {
      localStorage.setItem('vouch_request_token', body.token);
      localStorage.setItem('vouch_request_name', name);
      localStorage.setItem('vouch_request_address', address);
      startPolling(body.token, name, address);
    } else if (body && body.error === 'active_request_exists') {
      localStorage.setItem('vouch_request_token', body.existing_token);
      startPolling(body.existing_token,
                   localStorage.getItem('vouch_request_name') || '',
                   localStorage.getItem('vouch_request_address') || '');
    } else if (body && body.error === 'already_verified') {
      renderError('You are already verified. Redirecting to your profile.');
      setTimeout(() => { location.href = '/profile.html'; }, 1500);
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request a vouch';
      renderError('Could not create the request. Please try again.');
    }
  });
  return true;
}

function startPolling(token, name, address) {
  const formSection = document.getElementById('vr-form-section');
  const waitingSection = document.getElementById('vr-waiting-section');
  if (formSection) formSection.hidden = true;
  if (waitingSection) waitingSection.hidden = false;

  const linkEl = document.getElementById('vr-link');
  const params = new URLSearchParams({ token });
  if (name) params.set('n', name);
  if (address) params.set('a', address);
  const link = `${location.origin}/vouch.html?${params.toString()}`;
  if (linkEl) {
    linkEl.value = link;
    linkEl.addEventListener('focus', () => linkEl.select());
  }
  const copyBtn = document.getElementById('vr-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); copyBtn.textContent = 'Copied'; }
      catch { copyBtn.textContent = 'Copy failed'; }
      setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1500);
    });
  }

  poll(token);
}

async function poll(token) {
  const { status, body } = await api('GET', `/api/verify/vouch-status?token=${encodeURIComponent(token)}`);
  if (status === 404) {
    localStorage.removeItem('vouch_request_token');
    renderError('This request is no longer valid.');
    return;
  }
  if (status !== 200) {
    setTimeout(() => poll(token), POLL_INTERVAL_MS);
    return;
  }
  if (body.status === 'verified') {
    if (body.jwt) setJwt(body.jwt);
    localStorage.removeItem('vouch_request_token');
    renderVerified();
    return;
  }
  if (body.status === 'declined') {
    localStorage.removeItem('vouch_request_token');
    renderDeclined();
    return;
  }
  if (body.status === 'expired') {
    localStorage.removeItem('vouch_request_token');
    renderExpired();
    return;
  }
  setTimeout(() => poll(token), POLL_INTERVAL_MS);
}

function renderError(msg) {
  const el = document.getElementById('vr-result');
  if (el) el.innerHTML = `<div class="vm-card vm-card--warn"><p>${escapeHtml(msg)}</p></div>`;
}
function renderVerified() {
  const el = document.getElementById('vr-result');
  if (el) {
    el.innerHTML = `<div class="vm-card vm-card--success">
      <h3>Verified</h3>
      <p>Your neighbor confirmed. Continuing to your profile.</p>
    </div>`;
  }
  setTimeout(() => { location.href = '/profile.html#passkey-save'; }, 1500);
}
function renderDeclined() {
  const el = document.getElementById('vr-result');
  if (el) {
    el.innerHTML = `<div class="vm-card vm-card--warn">
      <h3>Not confirmed</h3>
      <p>Your neighbor did not confirm this request. You can ask a different neighbor or
         <a href="/verify-me.html">start over</a>.</p>
    </div>`;
  }
}
function renderExpired() {
  const el = document.getElementById('vr-result');
  if (el) {
    el.innerHTML = `<div class="vm-card vm-card--warn">
      <h3>Request expired</h3>
      <p>This request was not confirmed within 7 days. <a href="/vouch-request.html">Start a new request.</a></p>
    </div>`;
  }
}

// ── Voucher side: /vouch.html ──────────────────────────────────────────

async function initVoucher() {
  const root = document.getElementById('vc-root');
  if (!root) return false; // not this page

  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  if (!token) { root.innerHTML = renderTokenError('No token provided.'); return true; }

  const jwt = readJwt();
  if (!jwt) {
    root.innerHTML = `<div class="vm-card vm-card--info">
      <h3>Sign in to vouch</h3>
      <p>You must be a verified resident to confirm this request.</p>
      <p><a class="vm-card-cta" href="/verify-me.html">Sign in</a></p>
    </div>`;
    return true;
  }

  const { status, body } = await api('GET', `/api/verify/vouch-status?token=${encodeURIComponent(token)}`);
  if (status === 404 || (body && body.error === 'unknown_token')) {
    root.innerHTML = renderTokenError('This vouch request was not found.');
    return true;
  }
  if (!body || body.status !== 'pending') {
    root.innerHTML = renderTokenError(
      body.status === 'verified' ? 'This request has already been confirmed.' :
      body.status === 'declined' ? 'This request has already been declined.' :
                                   'This request has expired.'
    );
    return true;
  }

  // Name + address come from URL params (set by the requester's link).
  const name = decodeURIComponent(params.get('n') || '');
  const address = decodeURIComponent(params.get('a') || '');

  root.innerHTML = `
    <div class="vm-card vm-card--info">
      <h3>Vouch request</h3>
      <p><strong>${escapeHtml(name) || 'Someone'}</strong> at
         <strong>${escapeHtml(address) || 'a Marblehead address'}</strong>
         is asking you to vouch for them.</p>
      <p>Do you know this person and confirm they live at that address?</p>
      <div style="display:flex; gap:12px; margin-top:16px;">
        <button class="vm-submit" id="vc-confirm">Confirm</button>
        <button class="vm-submit" id="vc-decline" style="background:var(--text-faint)">Decline</button>
      </div>
      <div id="vc-result" style="margin-top:16px"></div>
    </div>`;

  document.getElementById('vc-confirm').addEventListener('click', () => respond('confirm', token, jwt));
  document.getElementById('vc-decline').addEventListener('click', () => respond('decline', token, jwt));
  return true;
}

async function respond(decision, token, jwt) {
  document.getElementById('vc-confirm').disabled = true;
  document.getElementById('vc-decline').disabled = true;
  const { status, body } = await api('POST', '/api/verify/vouch-respond', { token, decision }, jwt);
  const result = document.getElementById('vc-result');
  if (status === 200) {
    result.innerHTML = decision === 'confirm'
      ? `<p style="color:var(--c-sage)"><strong>Confirmed.</strong> Your neighbor is now verified.</p>`
      : `<p>Declined. They'll be able to ask someone else.</p>`;
  } else if (body && body.error === 'no_invites_remaining') {
    result.innerHTML = `<p>You're out of invites this cycle. Suggest the requester ask another neighbor.</p>`;
  } else {
    result.innerHTML = `<p>Could not record your response. Please try again.</p>`;
    document.getElementById('vc-confirm').disabled = false;
    document.getElementById('vc-decline').disabled = false;
  }
}

function renderTokenError(msg) {
  return `<div class="vm-card vm-card--warn"><h3>Request unavailable</h3><p>${escapeHtml(msg)}</p></div>`;
}

// ── Entry ──────────────────────────────────────────────────────────────

(async function init() {
  if (await initRequester()) return;
  await initVoucher();
})();
