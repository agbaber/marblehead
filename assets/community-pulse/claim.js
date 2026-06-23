// /verify-me.html controller.
// Drives FB OAuth bootstrap, the claim form, the custom street autocomplete,
// and result branching.

import { tryConditionalPasskey } from './passkey-signin.js';

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

const JWT_KEY = 'verify_jwt';

// --- Session helpers --------------------------------------------------

function readJwt() { return localStorage.getItem(JWT_KEY); }
function setJwt(jwt) { localStorage.setItem(JWT_KEY, jwt); }

/**
 * The FB callback redirects here with `#token=<jwt>&claim=1`. Pull the
 * JWT out, stash in localStorage, and clear the URL so the token does
 * not linger.
 */
function consumeOAuthFragment() {
  if (!location.hash || !location.hash.includes('token=')) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('token');
  const claim = params.get('claim') === '1';
  if (!token) return null;
  setJwt(token);
  const cleanHash = claim ? '#claim' : '';
  history.replaceState(null, '', location.pathname + location.search + cleanHash);
  return { token, claim };
}

async function fetchSelf() {
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

async function fetchStreets() {
  try {
    const res = await fetch(`${VERIFY_API}/api/streets`);
    if (!res.ok) return [];
    return res.json();
  } catch (e) { return []; }
}

async function fetchPreResident() {
  const jwt = readJwt();
  if (!jwt) return null;
  try {
    const res = await fetch(`${VERIFY_API}/api/me/pre`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) { return null; }
}

// --- DOM helpers ------------------------------------------------------

function $(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

// --- Custom street autocomplete --------------------------------------

function setupAutocomplete(input, suggestEl, streets) {
  let selectedIndex = -1;
  let visibleItems = [];

  function close() {
    suggestEl.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    selectedIndex = -1;
  }

  function render(query) {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) { close(); return; }
    const matches = streets.filter(s => s.toLowerCase().includes(q));
    matches.sort((a, b) => {
      const ai = a.toLowerCase().indexOf(q);
      const bi = b.toLowerCase().indexOf(q);
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });
    visibleItems = matches.slice(0, 8);
    if (visibleItems.length === 0) { close(); return; }
    suggestEl.innerHTML = visibleItems.map((s, i) => {
      const idx = s.toLowerCase().indexOf(q);
      const before = escapeHtml(s.slice(0, idx));
      const hit    = escapeHtml(s.slice(idx, idx + q.length));
      const after  = escapeHtml(s.slice(idx + q.length));
      return `<div class="vm-suggest-item" role="option" data-idx="${i}"
                   aria-selected="false" id="claim-suggest-${i}">${before}<mark>${hit}</mark>${after}</div>`;
    }).join('');
    suggestEl.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    selectedIndex = -1;
  }

  function highlight(i) {
    const items = suggestEl.querySelectorAll('.vm-suggest-item');
    items.forEach(el => el.setAttribute('aria-selected', 'false'));
    if (i >= 0 && i < items.length) {
      items[i].setAttribute('aria-selected', 'true');
      items[i].scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', items[i].id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
    selectedIndex = i;
  }

  function choose(i) {
    if (i < 0 || i >= visibleItems.length) return;
    input.value = visibleItems[i];
    close();
    const next = document.getElementById('claim-number');
    if (next) next.focus();
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => {
    if (input.value.trim()) render(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (suggestEl.hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight(Math.min(selectedIndex + 1, visibleItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(Math.max(selectedIndex - 1, 0));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        choose(selectedIndex);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });
  // Use mousedown so the input's blur doesn't beat us to closing the menu.
  suggestEl.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.vm-suggest-item');
    if (!item) return;
    e.preventDefault();
    choose(Number(item.dataset.idx));
  });
  document.addEventListener('click', (e) => {
    if (!suggestEl.contains(e.target) && e.target !== input) close();
  });
}

// --- Result card renderers -------------------------------------------

function renderSuccess(claimed) {
  return `<div class="vm-card vm-card--success">
    <h3><span class="vm-card-icon">&check;</span>Verified</h3>
    <p>You are a verified Marblehead resident at <strong>${escapeHtml(claimed)}</strong>.</p>
    <p><a class="vm-card-cta" href="/profile.html">Go to your profile</a></p>
  </div>`;
}

function renderFirstInitialMismatch(claimed, alternatives) {
  const list = alternatives.map(escapeHtml).join(', ');
  return `<div class="vm-card vm-card--warn">
    <h3><span class="vm-card-icon" aria-hidden="true">i</span>Different name on the deed</h3>
    <p>${escapeHtml(claimed)} is on record for the household. The named owners we have are <strong>${list}</strong>.</p>
    <p>If you live here but are not on the deed (spouse, family member, recent move-in), a verified neighbor can vouch for you.</p>
    <p><a class="vm-card-cta" href="#vouch">Request a vouch</a></p>
  </div>`;
}

function renderNameMismatch(claimed) {
  return `<div class="vm-card vm-card--warn">
    <h3><span class="vm-card-icon" aria-hidden="true">i</span>Name does not match the deed</h3>
    <p>${escapeHtml(claimed)} is in our records but listed under a different owner.</p>
    <p>If you rent, recently bought, or your name is not on the deed, a verified neighbor can vouch for you.</p>
    <p><a class="vm-card-cta" href="#vouch">Request a vouch</a></p>
  </div>`;
}

function renderNoMatch(claimed) {
  return `<div class="vm-card vm-card--info">
    <h3><span class="vm-card-icon" aria-hidden="true">?</span>Address not found</h3>
    <p>We do not have <strong>${escapeHtml(claimed)}</strong> in the FY2025 assessor file. Check the spelling, or:</p>
    <p><a class="vm-card-cta" href="#vouch">Request a vouch</a></p>
  </div>`;
}

function renderRateLimit() {
  return `<div class="vm-card vm-card--warn">
    <h3><span class="vm-card-icon" aria-hidden="true">!</span>Too many attempts</h3>
    <p>You have exceeded the daily limit for claim attempts. Try again in a few hours.</p>
  </div>`;
}

function renderGenericError(status) {
  return `<div class="vm-card vm-card--warn">
    <h3><span class="vm-card-icon" aria-hidden="true">!</span>Something went wrong</h3>
    <p>We could not check that address right now (HTTP ${status}). Try again in a moment.</p>
  </div>`;
}

// --- Form submission --------------------------------------------------

async function onSubmit(e) {
  e.preventDefault();
  const street = $('claim-street').value.trim();
  const number = $('claim-number').value.trim();
  const claimed = `${number} ${street}`;
  const result = $('claim-result');
  const submit = $('claim-submit');
  const submitText = $('claim-submit-text');

  submit.disabled = true;
  submitText.textContent = 'Checking';
  result.innerHTML = `<p class="vm-loading">Matching against the assessor record</p>`;

  let res;
  try {
    const jwt = readJwt();
    res = await fetch(`${VERIFY_API}/api/claim/address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify({ claimed_address: claimed }),
    });
  } catch (err) {
    submit.disabled = false;
    submitText.textContent = 'Claim this address';
    result.innerHTML = renderGenericError('network');
    return;
  }

  submit.disabled = false;
  submitText.textContent = 'Claim this address';

  if (res.status === 429) {
    result.innerHTML = renderRateLimit();
    return;
  }
  if (!res.ok) {
    result.innerHTML = renderGenericError(res.status);
    return;
  }

  const body = await res.json();
  switch (body.status) {
    case 'match':
      if (body.session_jwt) setJwt(body.session_jwt);
      result.innerHTML = renderSuccess(claimed);
      setTimeout(() => { location.href = '/profile.html'; }, 1500);
      break;
    case 'first_initial_mismatch':
      result.innerHTML = renderFirstInitialMismatch(claimed, body.alternatives || []);
      break;
    case 'name_mismatch':
      result.innerHTML = renderNameMismatch(claimed);
      break;
    case 'no_match':
      result.innerHTML = renderNoMatch(claimed);
      break;
    default:
      result.innerHTML = renderGenericError('unknown');
  }
}

// --- Page init --------------------------------------------------------

async function init() {
  const oauth = consumeOAuthFragment();
  const isClaimStep = (oauth && oauth.claim) || location.hash === '#claim';

  // If we don't have a session and we're not handling an OAuth callback,
  // try conditional-UI passkey sign-in in parallel. The browser surfaces
  // a biometric prompt only if a passkey exists for this origin; otherwise
  // it does nothing visible.
  if (!readJwt() && !oauth) {
    tryConditionalPasskey().then(r => {
      if (r && r.token) location.href = '/profile.html';
    });
  }

  const profile = await fetchSelf();
  if (profile && profile.identity_hash) {
    location.href = '/profile.html';
    return;
  }

  if (!isClaimStep) return;

  $('claim-form-section').hidden = false;
  const primary = $('primary-cta');
  if (primary) primary.hidden = true;
  const or = document.querySelector('.vm-or');
  if (or) or.hidden = true;
  const fallback = document.querySelectorAll('.vm-fallback');
  fallback.forEach(el => { el.hidden = true; });
  document.querySelectorAll('.vm-hero .vm-cap, .vm-hero .vm-cap-sub')
    .forEach(el => { el.hidden = true; });

  const input = $('claim-street');
  const suggest = $('claim-suggest');
  const streets = await fetchStreets();
  if (streets.length) setupAutocomplete(input, suggest, streets);

  const pre = await fetchPreResident();
  if (pre && pre.fb_display_name) {
    $('claim-fb-name').textContent = pre.fb_display_name;
    $('claim-signed-in').hidden = false;
  }

  $('claim-form').addEventListener('submit', onSubmit);
}

init();
// If the hash changes after first render (e.g., the user pastes the
// post-OAuth URL by hand or the in-page navigation toggles #claim),
// re-run the controller so the form reveals or hides accordingly.
window.addEventListener('hashchange', () => { init(); });
