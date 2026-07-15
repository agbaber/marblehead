const NOTE_RE = /\b(Added|Amended|Repealed)\s+(\d{1,2})-(\d{1,2})-(\d{4})\s+(ATM|STM)\s+by\s+Art\.?\s+(\d+)/gi;

function iso(mm, dd, yyyy) {
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function parseAmendmentNotes(text) {
  const out = [];
  for (const m of (text || '').matchAll(NOTE_RE)) {
    out.push({
      action: m[1].toLowerCase(),
      date: iso(m[2], m[3], m[4]),
      type: m[5].toUpperCase(),
      article: Number(m[6]),
    });
  }
  return out;
}
