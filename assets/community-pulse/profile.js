const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

function readJwt() { return localStorage.getItem('verify_jwt'); }

async function fetchProfile() {
  const jwt = readJwt();
  if (!jwt) return null;
  const res = await fetch(`${VERIFY_API}/api/profile`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  return res.json();
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
  localStorage.removeItem('verify_jwt');
  location.href = '/';
}

function describeClaimSource(profile) {
  if (profile.claim_source === 'assessor_match') return 'matched to assessor record';
  return 'vouched by a neighbor';
}

function render(profile) {
  const root = document.getElementById('profile-root');
  if (!profile) {
    root.innerHTML = `
      <p>You are not signed in.</p>
      <p><a href="/verify-me.html" class="btn btn--primary">Sign in</a></p>`;
    return;
  }

  const name = profile.display_name || 'verified resident';
  const publicNow = profile.public_identity === 1;
  const claimDesc = describeClaimSource(profile);
  const fbBadge = profile.has_facebook
    ? `<li>Facebook <a href="${escapeHtml(profile.fb_profile_url || '#')}" rel="noopener">view profile</a></li>` : '';
  const pkBadge = profile.has_passkey
    ? '<li>Passkey installed</li>'
    : '<li>No passkey yet. <a href="/verify.html#add-passkey">Add one</a> for faster sign-in.</li>';

  root.innerHTML = `
    <p><span class="verified-badge">Verified resident</span></p>
    <p><strong>${escapeHtml(name)}</strong></p>
    <p>Verified by: ${escapeHtml(claimDesc)}</p>

    <h2>Identity</h2>
    <label>
      Display name
      <input id="display-name" value="${escapeHtml(profile.display_name || '')}">
    </label>
    <button id="save-name" class="btn">Save name</button>

    <p style="margin-top:1rem">
      <label>
        <input type="checkbox" id="public-toggle" ${publicNow ? 'checked' : ''}>
        Show my name publicly on the site
      </label><br>
      <small>When off, you appear as "verified resident" everywhere.
      You can override this per back/rep action when you click it.</small>
    </p>

    <h3>Sign-in methods</h3>
    <ul>
      ${fbBadge}
      ${pkBadge}
    </ul>

    <div class="danger-zone">
      <h3>Release this claim</h3>
      <p>Sign out and disconnect this verified identity from your sessions.</p>
      <button id="release">Release and sign out</button>
    </div>`;

  document.getElementById('save-name').addEventListener('click', async () => {
    const v = document.getElementById('display-name').value.trim();
    const r = await postProfile({ display_name: v });
    if (r.ok) alert('Saved');
  });

  document.getElementById('public-toggle').addEventListener('change', async (e) => {
    await postProfile({ public_identity: e.target.checked ? 1 : 0 });
  });

  document.getElementById('release').addEventListener('click', async () => {
    if (confirm('Release this claim and sign out?')) await releaseClaim();
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

fetchProfile().then(render);
