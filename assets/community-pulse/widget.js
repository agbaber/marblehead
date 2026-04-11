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
export function setStance(db, sectionId, { stance, note }) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      section_id: sectionId,
      stance: stance ?? null,
      note: note ?? '',
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
