// Verified tally overlay for community pulse widgets.
// Loaded after widget.js. Checks for a verified session and augments
// each widget with a verified resident count and vote controls.
// Does nothing if the user is not authenticated.

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

let verifyJwt = null;
let verifyProfile = null;

function verifyHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (verifyJwt) h['Authorization'] = `Bearer ${verifyJwt}`;
  return h;
}

async function verifyApi(method, path, body) {
  const opts = { method, headers: verifyHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${VERIFY_API}${path}`, opts);
  return res.json();
}

/**
 * Initialize verified tally overlays on all community pulse widgets.
 * Called once after widget.js has hydrated the page.
 */
async function initVerifiedTallies() {
  verifyJwt = sessionStorage.getItem('verify_jwt');
  if (!verifyJwt) return;

  // Validate JWT by fetching profile.
  try {
    verifyProfile = await verifyApi('GET', '/api/verify/me');
    if (!verifyProfile || !verifyProfile.identity_hash) {
      verifyJwt = null;
      sessionStorage.removeItem('verify_jwt');
      return;
    }
  } catch {
    addVerifyPromo();
    return;
  }

  // Find all widgets on the page and augment them.
  const widgets = document.querySelectorAll('.cp-widget');
  if (widgets.length === 0) return;

  // Collect section IDs from widgets.
  const sectionIds = [];
  widgets.forEach(w => {
    if (w.dataset.sectionId) sectionIds.push(w.dataset.sectionId);
  });

  // Fetch verified tallies for all sections.
  // We'll use the section IDs as topics for verified votes.
  // For each, check if the resident has already voted.
  const tallies = {};
  const myVotes = {};

  // Batch: fetch tally per section.
  for (const sid of sectionIds) {
    try {
      // We don't have a batch endpoint for verified tallies yet.
      // For now, we'll show a general "N verified residents" count.
      // Individual section-level verified voting is a future enhancement.
    } catch {}
  }

  // For now, show a verified badge on each widget with the overall count.
  const branchData = await verifyApi('GET', '/api/verify/branches');
  const totalVerified = (branchData.branches || []).reduce((sum, b) => sum + b.size, 0);

  widgets.forEach(w => {
    addVerifiedBadge(w, totalVerified);
  });
}

/**
 * Add a verified tally badge to a single widget.
 */
function addVerifiedBadge(widget, totalVerified) {
  const meta = widget.querySelector('.cp-widget__meta');
  if (!meta) return;

  const badge = document.createElement('span');
  badge.className = 'cp-verified-badge';
  badge.title = 'Verified Marblehead residents in the neighbor verification network';
  badge.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5.5 8.5L7 10l3.5-4"/><circle cx="8" cy="8" r="6.5"/></svg> ${totalVerified} verified`;

  meta.insertBefore(badge, meta.firstChild);
}

/**
 * Add a subtle "Verified residents" promo link to the first widget
 * for unauthenticated visitors.
 */
function addVerifyPromo() {
  const firstWidget = document.querySelector('.cp-widget');
  if (!firstWidget) return;

  const meta = firstWidget.querySelector('.cp-widget__meta');
  if (!meta) return;

  const link = document.createElement('a');
  link.className = 'cp-verify-promo';
  link.href = '/verify.html';
  link.title = 'Join the neighbor verification network';
  link.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5.5 8.5L7 10l3.5-4"/><circle cx="8" cy="8" r="6.5"/></svg> Verify`;

  meta.insertBefore(link, meta.firstChild);
}

// ── CSS injection ──────────────────────────────────────

const style = document.createElement('style');
style.textContent = `
.cp-verified-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.78rem;
  color: var(--c-teal, #2a9d8f);
  font-weight: 600;
  white-space: nowrap;
}
.cp-verified-badge svg {
  color: var(--c-teal, #2a9d8f);
  flex-shrink: 0;
}
.cp-verify-promo {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-muted, #888);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.15s;
}
.cp-verify-promo:hover {
  color: var(--c-teal, #2a9d8f);
}
`;
document.head.appendChild(style);

// ── Auto-init ──────────────────────────────────────────

// Wait for widget.js to finish hydrating, then augment.
if (typeof document !== 'undefined') {
  // widget.js runs on DOMContentLoaded. We run after a small delay
  // to ensure widgets are rendered.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initVerifiedTallies, 100);
    });
  } else {
    setTimeout(initVerifiedTallies, 100);
  }
}
