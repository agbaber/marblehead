// Community pulse widget module.
// Loaded by each content page as a <script defer> tag.
// Hydrates every <h2> on the page with a stance widget, unless the page
// opts out via <body data-community-pulse="off-sections">.

/**
 * Convert a heading text into an anchor ID slug.
 * Stable across runs for the same input.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')      // strip punctuation
    .replace(/[\s_-]+/g, '-')      // collapse whitespace and hyphens
    .replace(/^-+|-+$/g, '');      // trim leading and trailing hyphens
}

// ---- Stance store (IndexedDB wrapper) -----------------------------------

const DB_NAME = 'community-pulse';
const DB_VERSION = 1;
const STORE_NAME = 'stances';

/** Open the IndexedDB connection. Creates the object store on first use. */
export function openStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'section_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Read a single stance record by section_id. Returns null if missing. */
export function getStance(db, sectionId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(sectionId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Upsert a stance record. Stamps updated_at. */
export function setStance(db, sectionId, { stance, note, reacted }) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      section_id: sectionId,
      stance: stance ?? null,
      note: note ?? '',
      reacted: reacted === true,
      updated_at: Date.now()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/** Return every stance record as an array. */
export function getAllStances(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Delete a single stance by section_id. */
export function clearStance(db, sectionId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(sectionId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete every stance record. */
export function clearAllStances(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---- Reactions API client -----------------------------------------------

let apiBaseUrl = ''; // set via configureApi or a page-level data attribute

/** Configure the API base URL. Called once at widget init. */
export function configureApi({ baseUrl }) {
  apiBaseUrl = baseUrl;
}

/**
 * Fetch reaction counts for a batch of section IDs in one request.
 * Returns a map of section_id to { total, last_24h }. Returns {} on any error.
 */
export async function fetchReactions(sectionIds) {
  if (!sectionIds || sectionIds.length === 0) return {};
  try {
    const url = `${apiBaseUrl}/api/reactions?section_ids=${sectionIds.map(encodeURIComponent).join(',')}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * POST an increment for one section. Returns { total, last_24h } on success
 * or null on any error.
 */
export async function incrementReaction(sectionId) {
  try {
    const res = await fetch(`${apiBaseUrl}/api/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---- Widget rendering and hydration -------------------------------------

const STANCE_BUTTONS = [
  { key: 'agree',    glyph: '+', label: 'Agree' },
  { key: 'disagree', glyph: '−', label: 'Disagree' },
  { key: 'alert',    glyph: '!', label: 'Alert: something here caught my eye' }
];

let widgetCounter = 0;

/**
 * Build the widget DOM for one section and attach it to the given parent
 * element. Returns the widget root element.
 */
function buildWidget(sectionId, sectionTitle, initialReactions, initialStance) {
  const root = document.createElement('div');
  root.className = 'cp-widget';
  root.dataset.sectionId = sectionId;
  const widgetId = `cp-widget-${++widgetCounter}`;

  // Stance buttons.
  const buttons = document.createElement('div');
  buttons.className = 'cp-widget__buttons';
  STANCE_BUTTONS.forEach(({ key, glyph, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cp-widget__button';
    btn.dataset.stance = key;
    btn.setAttribute('aria-label', label);
    btn.textContent = glyph;
    btn.setAttribute('aria-pressed', initialStance === key ? 'true' : 'false');
    buttons.appendChild(btn);
  });
  root.appendChild(buttons);

  // Meta group: reaction count + secondary action icons. Kept as a single
  // DOM sibling to the stance buttons so CSS can give a clean two-group
  // layout (stance on the left, meta on the right) with a wider gap
  // between the groups than within each group.
  const meta = document.createElement('div');
  meta.className = 'cp-widget__meta';

  // Reaction count + delta. Hidden until real data arrives; no placeholder text.
  const count = document.createElement('span');
  count.className = 'cp-widget__count';
  const countNum = document.createElement('span');
  countNum.className = 'cp-widget__count-num';
  const countDelta = document.createElement('span');
  countDelta.className = 'cp-widget__delta';
  if (initialReactions) {
    countNum.textContent = `${initialReactions.total} reactions`;
    if (initialReactions.last_24h > 0) {
      countDelta.textContent = `+${initialReactions.last_24h} today`;
    }
  }
  count.appendChild(countNum);
  count.appendChild(countDelta);
  meta.appendChild(count);

  // Share button (copy link to clipboard). Icon = two overlapping rectangles.
  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'cp-widget__share';
  share.dataset.action = 'share';
  share.setAttribute('aria-label', 'Copy link to this section');
  share.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8.5" height="8.5" rx="1"/><path d="M2 10.5V3a1 1 0 0 1 1-1h7.5"/></svg>';
  meta.appendChild(share);

  // Note toggle. Icon = three horizontal lines of decreasing length.
  const noteToggle = document.createElement('button');
  noteToggle.type = 'button';
  noteToggle.className = 'cp-widget__note-toggle';
  noteToggle.dataset.action = 'toggle-note';
  noteToggle.setAttribute('aria-expanded', 'false');
  noteToggle.setAttribute('aria-controls', `${widgetId}-note`);
  noteToggle.setAttribute('aria-label', 'Write a private note');
  noteToggle.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8.5" x2="13" y2="8.5"/><line x1="3" y1="12" x2="10" y2="12"/></svg>';
  meta.appendChild(noteToggle);

  root.appendChild(meta);

  // Note textarea (hidden initially).
  const note = document.createElement('textarea');
  note.id = `${widgetId}-note`;
  note.className = 'cp-widget__note';
  note.placeholder = 'Write a private note. Saved locally in your browser.';
  note.setAttribute('aria-label', 'Private note, saved locally in your browser');
  note.hidden = true;
  note.rows = 3;
  root.appendChild(note);

  return root;
}

/** Show a transient toast message near the bottom of the viewport. */
function showToast(message) {
  const existing = document.querySelector('.cp-widget__toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'cp-widget__toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('cp-widget__toast--visible'));
  setTimeout(() => toast.remove(), 2400);
}

/** Debounce helper for note field saves. */
function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Wire event handlers on a single widget: stance buttons, note toggle and
 * save, share button. Reads and writes the IndexedDB store.
 */
function wireWidget(root, db, sectionId, sectionUrl, sectionTitle, initialRecord) {
  const buttons = root.querySelectorAll('.cp-widget__button');
  const noteToggle = root.querySelector('.cp-widget__note-toggle');
  const noteField = root.querySelector('.cp-widget__note');
  const shareBtn = root.querySelector('.cp-widget__share');
  const countNum = root.querySelector('.cp-widget__count-num');
  const countDelta = root.querySelector('.cp-widget__delta');

  // Track current state in closure to avoid extra IDB reads.
  let currentStance = initialRecord?.stance ?? null;
  let currentNote = initialRecord?.note ?? '';
  let currentReacted = initialRecord?.reacted === true;

  // Reflect initial note into UI (stance was already reflected by buildWidget's initialStance).
  if (currentNote) {
    noteField.value = currentNote;
    noteField.hidden = false;
    noteToggle.setAttribute('aria-expanded', 'true');
  }

  /** Persist the current stance, note, and reacted state to IndexedDB. */
  const persist = () => setStance(db, sectionId, {
    stance: currentStance,
    note: currentNote,
    reacted: currentReacted
  });

  /**
   * If this user has not yet been counted for this section, fire one
   * reactions increment and mark them counted. Subsequent calls are no-ops
   * until the user clears their browser data. Any meaningful interaction
   * (stance activate, note content, share click) routes through this helper.
   *
   * The currentReacted flag is set synchronously before awaiting the
   * network call, so a second caller that lands between the await and the
   * server's response sees the flag already set and skips. If the network
   * call fails, the flag is reverted so a retry can happen on the next
   * interaction.
   */
  async function ensureCounted() {
    if (currentReacted) return;
    currentReacted = true;
    const result = await incrementReaction(sectionId);
    if (!result) {
      currentReacted = false;
      return;
    }
    countNum.textContent = `${result.total} reactions`;
    countDelta.textContent = result.last_24h > 0 ? `+${result.last_24h} today` : '';
    await persist();
  }

  // Stance button handler.
  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const stanceKey = btn.dataset.stance;
      const currentlyPressed = btn.getAttribute('aria-pressed') === 'true';
      const newStance = currentlyPressed ? null : stanceKey;
      buttons.forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.stance === newStance ? 'true' : 'false');
      });
      currentStance = newStance;
      await persist();
      if (newStance) await ensureCounted();
    });
  });

  // Note toggle.
  noteToggle.addEventListener('click', () => {
    const isOpen = !noteField.hidden;
    noteField.hidden = isOpen;
    noteToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    if (!isOpen) noteField.focus();
  });

  // Note field debounced save. Counts as a reaction only once, the first
  // time the note contains non-empty text.
  const saveNote = debounce(async () => {
    currentNote = noteField.value;
    await persist();
    if (currentNote.trim().length > 0) await ensureCounted();
  }, 1000);
  noteField.addEventListener('input', saveNote);

  // Share button: always copy the section link to the clipboard. Counts as a reaction once.
  shareBtn.addEventListener('click', async () => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(sectionUrl);
        showToast('Link copied');
        await ensureCounted();
        return;
      } catch {
        // Fall through to the prompt fallback below.
      }
    }
    window.prompt('Copy this link:', sectionUrl);
    await ensureCounted();
  });
}

/**
 * Walk every element with a data-stance-section attribute and inject a
 * widget next to it. Widgets are opt-in only: authors add the attribute
 * to the specific headings or blocks they want to capture.
 */
export async function hydrateWidgets() {
  // Opt-out check (also used as a performance short-circuit via conditional script inclusion in the layout).
  if (document.body.dataset.communityPulse === 'off-sections') return;

  const pagePath = location.pathname.replace(/^\//, '') || 'index.html';
  const collectedTargets = [];
  const seenSlugs = new Set();

  // Opt-in: elements with an explicit data-stance-section attribute.
  document.querySelectorAll('[data-stance-section]').forEach(el => {
    const slug = el.dataset.stanceSection.trim();
    if (!slug) return;
    // If this slug is already in use on the page, skip (author should pick a unique slug).
    if (seenSlugs.has(slug)) return;
    seenSlugs.add(slug);
    if (!el.id) el.id = slug;
    const title = el.getAttribute('aria-label') || el.textContent.trim().slice(0, 80) || slug;
    collectedTargets.push({
      element: el,
      sectionId: `${pagePath}#${slug}`,
      title
    });
  });

  if (collectedTargets.length === 0) return;

  // Batch-fetch reaction counts for all targets in one request.
  const reactionsMap = await fetchReactions(collectedTargets.map(t => t.sectionId));

  // Open IndexedDB once for all widgets on the page.
  let db;
  try {
    db = await openStore();
  } catch {
    // IndexedDB disabled (private mode, etc). Skip widgets silently.
    return;
  }

  // Fetch all existing stances in a single transaction (much faster than per-widget).
  const allStances = await getAllStances(db);
  const stanceMap = new Map(allStances.map(s => [s.section_id, s]));

  // Build and wire each widget. Wrap the target element and the widget
  // in a flex container so the widget floats inline-right of the target
  // on desktop and stacks below on mobile (handled by CSS).
  for (const target of collectedTargets) {
    const initialReactions = reactionsMap[target.sectionId];
    const initialRecord = stanceMap.get(target.sectionId) || null;
    const widget = buildWidget(
      target.sectionId,
      target.title,
      initialReactions,
      initialRecord?.stance
    );
    const parent = target.element.parentNode;
    if (!parent) continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'cp-section-row';
    parent.insertBefore(wrapper, target.element);
    wrapper.appendChild(target.element);
    wrapper.appendChild(widget);
    wireWidget(
      widget,
      db,
      target.sectionId,
      `${location.origin}${location.pathname}#${target.element.id}`,
      target.title,
      initialRecord
    );
  }

  // Re-scroll to a fragment if one is present (fixes runtime-anchor-generation
  // timing: the browser tried to scroll before we inserted the IDs).
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
}

// ---- Auto-init on DOMContentLoaded --------------------------------------

if (typeof document !== 'undefined') {
  // Configure API base URL from a script data attribute if present.
  const script = document.currentScript || document.querySelector('script[src*="community-pulse/widget.js"]');
  if (script && script.dataset.apiBase) {
    configureApi({ baseUrl: script.dataset.apiBase });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateWidgets);
  } else {
    hydrateWidgets();
  }
}
