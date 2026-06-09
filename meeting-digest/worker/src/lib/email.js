// meeting-digest/worker/src/lib/email.js

const MAX_EMAIL_LENGTH = 254;
// Pragmatic RFC-ish: at least one char before @, at least one dot in the host.
// Rejects spaces, leading/trailing dots in the local part, and adjacent dots.
const EMAIL_RE = /^[A-Za-z0-9_][A-Za-z0-9_+.-]*[A-Za-z0-9_+-]@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}$/;

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  return value.trim().toLowerCase();
}

export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_EMAIL_LENGTH) return false;
  if (value.includes('..')) return false;
  return EMAIL_RE.test(value);
}

// 32 bytes of randomness, URL-safe base64. Length 43-44 chars depending on padding.
export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // btoa is available in Workers; convert to URL-safe.
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
