// eCode writes multiple amendments as a semicolon list under a single leading
// keyword: "Amended <date1>; <date2>; <date3>". The action word is therefore
// optional on each entry and carries forward from the most recent one seen.
const ENTRY_RE = /(?:(Added|Amended|Repealed)\s+)?(\d{1,2})-(\d{1,2})-(\d{4})\s+(ATM|STM)\s+by\s+Art\.?\s+(\d+)/gi;

function iso(mm, dd, yyyy) {
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function parseAmendmentNotes(text) {
  const out = [];
  let lastAction = null;
  for (const m of (text || '').matchAll(ENTRY_RE)) {
    if (m[1]) lastAction = m[1].toLowerCase();
    if (!lastAction) continue; // a bare date with no governing keyword is not an amendment note
    out.push({
      action: lastAction,
      date: iso(m[2], m[3], m[4]),
      type: m[5].toUpperCase(),
      article: Number(m[6]),
    });
  }
  return out;
}
