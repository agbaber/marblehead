// /profile.html controller. Renders the verified-resident identity card,
// or a signed-out prompt when no JWT is present.

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

const JWT_KEY = 'verify_jwt';

function readJwt() { return localStorage.getItem(JWT_KEY); }
function clearJwt() { localStorage.removeItem(JWT_KEY); }

function track(event, props) {
  try {
    if (window.posthog && window.posthog.capture) {
      window.posthog.capture(event, props || {});
    }
  } catch (e) { /* analytics never blocks the user */ }
}

async function fetchProfile() {
  const jwt = readJwt();
  if (!jwt) return null;
  try {
    const res = await fetch(`${VERIFY_API}/api/profile`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) { return null; }
}

async function postProfile(body) {
  const jwt = readJwt();
  return fetch(`${VERIFY_API}/api/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
}

async function releaseClaim() {
  const jwt = readJwt();
  await fetch(`${VERIFY_API}/api/claim`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  clearJwt();
  location.href = '/';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

function claimSourceLabel(source) {
  if (source === 'assessor_match') return 'Matched to FY2025 assessor record';
  return 'Vouched by a verified neighbor';
}

function renderSignedOut(root) {
  root.innerHTML = `
    <div class="pf-signedout">
      <h1>Profile</h1>
      <p>You are not signed in. Sign in to manage your verified-resident identity, the ideas you've backed, and how you appear on the site.</p>
      <a class="pf-signin" id="pf-signin-link" href="/verify-me.html">Sign in</a>
    </div>`;
  track('verify_profile_viewed', { state: 'signed_out' });
  document.getElementById('pf-signin-link')
    ?.addEventListener('click', () => track('verify_signin_clicked', { from: 'profile_page' }));
}

function renderProfile(root, profile) {
  const name = profile.display_name || 'Verified resident';
  const publicNow = profile.public_identity === 1;
  const sourceLabel = claimSourceLabel(profile.claim_source);

  root.innerHTML = `
    <p class="pf-eye">
      <span class="pf-eye-check" aria-hidden="true">&check;</span>
      Verified resident
    </p>
    <h1 class="pf-name">${escapeHtml(name)}</h1>
    <p class="pf-source">${escapeHtml(sourceLabel)}</p>

    <section class="pf-section">
      <h2>Identity</h2>

      <div class="pf-row">
        <div class="pf-row-label"><label for="pf-display-name">Display name</label></div>
        <div class="pf-row-value">
          <input id="pf-display-name" class="pf-input"
                 type="text" maxlength="80"
                 value="${escapeHtml(profile.display_name || '')}">
          <button id="pf-save-name" class="pf-btn">Save</button>
          <span id="pf-saved" class="pf-saved">Saved</span>
        </div>
      </div>

      <div class="pf-row">
        <div class="pf-row-label">Show name publicly</div>
        <div class="pf-row-value">
          <label class="pf-toggle">
            <input id="pf-public-toggle" type="checkbox" ${publicNow ? 'checked' : ''}>
            <span class="pf-toggle-slider" aria-hidden="true"></span>
            <span class="pf-toggle-label">${publicNow ? 'On' : 'Off'}</span>
          </label>
          <span class="pf-toggle-help">
            When off, you appear as "verified resident" on the site.
            You can still show your name on individual ideas you back.
          </span>
        </div>
      </div>
    </section>

    <section class="pf-section">
      <h2>Sign-in methods</h2>
      ${profile.has_facebook ? `
        <div class="pf-method">
          <span class="pf-method-icon pf-method-icon--fb" aria-hidden="true">f</span>
          <span class="pf-method-name">Facebook</span>
          <span class="pf-method-state pf-method-state--on">Connected</span>
        </div>` : ''}
      <div class="pf-method">
        <span class="pf-method-icon" aria-hidden="true">&#x1F511;</span>
        <span class="pf-method-name">Passkey</span>
        <span class="pf-method-state">
          ${profile.has_passkey
            ? '<span class="pf-method-state--on">Connected</span>'
            : '<a href="/verify.html#add-passkey">Add for faster sign-in</a>'}
        </span>
      </div>
    </section>

    <div class="pf-danger">
      <h2>Release this claim</h2>
      <p>Sign out and disconnect your verified identity from this device. Your past activity stays in place but you'll have to re-verify to sign back in.</p>
      <button id="pf-release" class="pf-danger-btn">Release and sign out</button>
    </div>`;

  // Wire interactions.
  const nameInput = document.getElementById('pf-display-name');
  const savedFlag = document.getElementById('pf-saved');
  const showSaved = () => {
    savedFlag.classList.add('show');
    clearTimeout(showSaved._t);
    showSaved._t = setTimeout(() => savedFlag.classList.remove('show'), 1400);
  };
  document.getElementById('pf-save-name').addEventListener('click', async () => {
    const v = nameInput.value.trim();
    const r = await postProfile({ display_name: v });
    if (r.ok) {
      showSaved();
      track('verify_display_name_saved', { is_empty: v.length === 0 });
    }
  });
  const toggle = document.getElementById('pf-public-toggle');
  toggle.addEventListener('change', async (e) => {
    const value = e.target.checked ? 1 : 0;
    await postProfile({ public_identity: value });
    e.target.parentElement.querySelector('.pf-toggle-label').textContent =
      e.target.checked ? 'On' : 'Off';
    track('verify_public_identity_changed', { value });
  });
  document.getElementById('pf-release').addEventListener('click', async () => {
    if (confirm('Release this claim and sign out?')) {
      track('verify_claim_released');
      await releaseClaim();
    }
  });

  track('verify_profile_viewed', {
    state: 'signed_in',
    claim_source: profile.claim_source,
    auth_source: profile.auth_source,
    has_facebook: !!profile.has_facebook,
    has_passkey: !!profile.has_passkey,
    public_identity: profile.public_identity === 1,
  });
}

async function init() {
  const root = document.getElementById('profile-root');
  const profile = await fetchProfile();
  if (!profile || !profile.identity_hash) {
    renderSignedOut(root);
    return;
  }
  renderProfile(root, profile);
}

init();
