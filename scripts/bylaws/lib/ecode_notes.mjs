// eCode note formats observed in the Marblehead Part I corpus:
//  - actions: Adopted | Added | Amended | Repealed (case-insensitive)
//  - meeting types: TM (pre-1990s), ATM, STM
//  - articles: "by Art. 5", "by Art 5", or "by Arts. 26 and 27" (two articles)
//  - multiple amendments as a semicolon list under ONE leading action keyword:
//    "Amended <date1>; <date2>; <date3>" — the action carries forward per entry.
// \s* (not \s+) after the action word tolerates an eCode typo where the space
// is missing, e.g. "[Amended5-3-2021 ATM by Art. 46]".
const ENTRY_RE = /(?:(Adopted|Added|Amended|Repealed)\s*)?(\d{1,2})-(\d{1,2})-(\d{4})\s+(TM|ATM|STM)\s+by\s+Arts?\.?\s+(\d+)(?:\s+and\s+(\d+))?/gi;

function iso(mm, dd, yyyy) {
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function parseAmendmentNotes(text) {
  const out = [];
  let lastAction = null;
  for (const m of (text || '').matchAll(ENTRY_RE)) {
    if (m[1]) lastAction = m[1].toLowerCase();
    if (!lastAction) continue; // a bare date with no governing keyword is not an amendment note
    const rec = {
      action: lastAction,
      date: iso(m[2], m[3], m[4]),
      type: m[5].toUpperCase(),
      article: Number(m[6]),
    };
    if (m[7]) rec.articles = [Number(m[6]), Number(m[7])]; // "Arts. N and M" enacted by two articles
    out.push(rec);
  }
  return out;
}
