// Renders a "save passkey" card and runs the WebAuthn add-device flow.
// Used by /verify-me.html (post-FB-claim) and /profile.html.

import { client } from 'https://cdn.jsdelivr.net/npm/@passwordless-id/webauthn@2.3.5/dist/esm/index.js';

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

const JWT_KEY = 'verify_jwt';
const SKIP_KEY = 'passkey_save_skipped_at';
const SKIP_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readJwt() { return localStorage.getItem(JWT_KEY); }
function setJwt(jwt) { localStorage.setItem(JWT_KEY, jwt); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

/**
 * Returns true if the save-passkey card should be shown for this user/device.
 * Caller is responsible for knowing whether the user already has a passkey
 * (`profile.has_passkey`). This function only enforces the skip cool-off.
 */
export function shouldPromptPasskeySave() {
  const skipped = localStorage.getItem(SKIP_KEY);
  if (!skipped) return true;
  return (Date.now() - parseInt(skipped, 10)) > SKIP_TTL_MS;
}

/**
 * Feature-detect: does this device have a platform authenticator
 * (Touch ID / Face ID / Windows Hello)?
 */
async function platformAuthAvailable() {
  if (!window.PublicKeyCredential ||
      !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

/**
 * Mount the card into the given container. Returns a promise that
 * resolves when the user has either saved a passkey or skipped.
 */
export async function mountPasskeySaveCard(container, opts = {}) {
  const { onSaved, onSkipped, headline = 'Save a passkey for faster sign-in' } = opts;

  if (!(await platformAuthAvailable())) {
    // Device cannot make a passkey — render nothing and resolve as skipped.
    if (onSkipped) onSkipped({ reason: 'unsupported' });
    return;
  }

  container.innerHTML = `
    <div class="vm-card vm-card--info">
      <h3>${escapeHtml(headline)}</h3>
      <p>Next time, sign in with Touch ID or Face ID instead of Facebook. Stored on this device only.</p>
      <div style="display:flex; gap:12px; margin-top:14px; flex-wrap:wrap;">
        <button class="vm-submit" id="pks-save" style="max-width:260px">Save passkey</button>
        <button class="vm-submit" id="pks-skip" type="button"
                style="max-width:140px; background:transparent; color:var(--text-muted); box-shadow:none;">
          Skip for now
        </button>
      </div>
      <p id="pks-status" style="margin-top:12px; color:var(--text-muted); font-size:14px;"></p>
    </div>`;

  const saveBtn = container.querySelector('#pks-save');
  const skipBtn = container.querySelector('#pks-skip');
  const status = container.querySelector('#pks-status');

  skipBtn.addEventListener('click', () => {
    localStorage.setItem(SKIP_KEY, String(Date.now()));
    container.innerHTML = '';
    if (onSkipped) onSkipped({ reason: 'user' });
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    skipBtn.disabled = true;
    status.textContent = 'Awaiting biometric…';
    try {
      // Get a challenge from the server (uses the same shape as
      // /api/verify/register's challenge response).
      const challengeRes = await fetch(`${VERIFY_API}/api/verify/passkey/auth-challenge`, {
        method: 'POST',
      });
      const challengeBody = await challengeRes.json();
      const browserChallenge = challengeBody.challenge.split('.')[0];

      const reg = await client.register({
        challenge: browserChallenge,
        user: 'verified-resident',
      });

      const r = await fetch(`${VERIFY_API}/api/verify/passkey/add-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${readJwt()}`,
        },
        body: JSON.stringify({ registration: reg, challenge: challengeBody.challenge }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      const body = await r.json();
      if (body.token) setJwt(body.token);
      localStorage.removeItem(SKIP_KEY);
      container.innerHTML = `
        <div class="vm-card vm-card--success">
          <h3>Passkey saved</h3>
          <p>Next time you visit, you'll be signed in with Touch ID / Face ID automatically.</p>
        </div>`;
      if (onSaved) onSaved();
    } catch (err) {
      saveBtn.disabled = false;
      skipBtn.disabled = false;
      status.textContent = 'Could not save the passkey. ' + (err.message || '');
    }
  });
}
