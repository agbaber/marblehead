// Surfaces a passkey sign-in via WebAuthn conditional UI.
// On supporting browsers (Safari 16+, Chrome 108+), this triggers the
// OS biometric sheet if the device has a passkey registered for this
// origin. If the user has no passkey, the call resolves to null and
// nothing visible happens — the FB CTA stays as the visible fallback.

import { client } from 'https://cdn.jsdelivr.net/npm/@passwordless-id/webauthn@2.3.5/dist/esm/index.js';

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

const JWT_KEY = 'verify_jwt';

function setJwt(jwt) { localStorage.setItem(JWT_KEY, jwt); }

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${VERIFY_API}${path}`, opts);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Attempt a conditional-UI passkey sign-in. Returns the resulting profile,
 * or null if no passkey was used / available.
 */
export async function tryConditionalPasskey() {
  // Feature-detect conditional UI support.
  if (!window.PublicKeyCredential ||
      !PublicKeyCredential.isConditionalMediationAvailable) return null;
  let available = false;
  try { available = await PublicKeyCredential.isConditionalMediationAvailable(); }
  catch { return null; }
  if (!available) return null;

  // Request a challenge from the server.
  const challenge = await api('POST', '/api/verify/passkey/auth-challenge');
  if (!challenge || !challenge.challenge) return null;

  // Invoke the WebAuthn library with conditional mediation.
  // The @passwordless-id/webauthn client does not expose a `mediation`
  // option directly, so we drop to the underlying navigator API.
  let auth;
  try {
    const browserChallenge = challenge.challenge.split('.')[0];
    const credential = await navigator.credentials.get({
      mediation: 'conditional',
      publicKey: {
        challenge: Uint8Array.from(atob(
          browserChallenge.replace(/-/g, '+').replace(/_/g, '/')
        ), c => c.charCodeAt(0)),
        userVerification: 'preferred',
        // Empty allowCredentials lets the browser show ALL discoverable
        // credentials in the autofill prompt — this is the conditional-UI
        // shape.
        allowCredentials: [],
      },
    });
    if (!credential) return null;
    auth = client._formatAuthentication
      ? client._formatAuthentication(credential)
      : formatAuth(credential);
  } catch (err) {
    // User dismissed or the browser surfaced nothing — silently return.
    return null;
  }

  const r = await api('POST', '/api/verify/passkey/auth', {
    authentication: auth, challenge: challenge.challenge,
  });
  if (!r || !r.ok || !r.token) return null;
  setJwt(r.token);
  return r;
}

function formatAuth(credential) {
  // Minimal formatter mirroring @passwordless-id/webauthn's expected shape
  // when we have to call navigator.credentials.get directly.
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return {
    id: credential.id,
    rawId: toB64(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || null,
    response: {
      authenticatorData: toB64(credential.response.authenticatorData),
      clientDataJSON: toB64(credential.response.clientDataJSON),
      signature: toB64(credential.response.signature),
      userHandle: credential.response.userHandle ? toB64(credential.response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults() : {},
  };
}
