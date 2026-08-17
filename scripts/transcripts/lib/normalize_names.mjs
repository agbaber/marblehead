// Corrects known Marblehead proper nouns that speech recognition reliably
// mishears ("Coughlin" for the Coffin School, "Mary Ellis" for Mary Alley).
//
// Deliberately dumb: an allowlist of exact, human-vetted forms, matched
// case-sensitively on whole words, applied in a single pass. There is no fuzzy
// matching and no phonetic guessing, because a wrong correction is worse than
// an uncorrected mishearing -- it reads as authoritative. Terms where the right
// answer depends on context (Gerry School vs. a resident named Jerry) belong in
// `flag_only`, which reports but never rewrites.

const URL_RE = /https?:\/\/\S+/g;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build a pattern for a possibly multi-word term. Internal runs of whitespace
// match any whitespace, since cue-joined ASR text has unpredictable spacing.
// Word boundaries are only asserted on ends that are actually word characters,
// so a term like "St. Michael's (old)" still anchors on its left edge.
function termPattern(term) {
  const core = term.trim().split(/\s+/).map(escapeRe).join('\\s+');
  const lead = /^\w/.test(term.trim()) ? '\\b' : '';
  const trail = /\w$/.test(term.trim()) ? '\\b' : '';
  return `${lead}${core}${trail}`;
}

function collapse(s) {
  return s.replace(/\s+/g, ' ');
}

/**
 * Validate a dictionary and pre-compile its matchers.
 *
 * @param {{replace?: Array<{wrong: string[], right: string, kind?: string}>,
 *          flag_only?: Array<{term: string, why?: string}>}} dict
 */
export function compileDictionary(dict) {
  const entries = dict?.replace ?? [];
  const rights = new Set(entries.map(e => e.right));
  const byWrong = new Map();
  const order = [];

  for (const entry of entries) {
    const forms = Array.isArray(entry.wrong) ? entry.wrong : [entry.wrong];
    for (const raw of forms) {
      if (typeof raw !== 'string' || raw.trim() === '') {
        throw new Error(
          `known_names: entry for "${entry.right}" has an empty misheard form`,
        );
      }
      const form = collapse(raw.trim());
      if (byWrong.has(form)) {
        throw new Error(
          `known_names: misheard form "${form}" is claimed by more than one entry ` +
          `("${byWrong.get(form).right}" and "${entry.right}")`,
        );
      }
      if (rights.has(form)) {
        throw new Error(
          `known_names: "${form}" is listed as both a correct and a misheard form, ` +
          `which would make corrections order-dependent`,
        );
      }
      byWrong.set(form, { right: entry.right, kind: entry.kind });
      order.push(form);
    }
  }

  // Longest first so a specific phrase wins over a substring of itself.
  const alternation = [...byWrong.keys()]
    .sort((a, b) => b.length - a.length)
    .map(termPattern)
    .join('|');

  const flags = (dict?.flag_only ?? []).map(f => ({
    term: f.term,
    why: f.why,
    re: new RegExp(termPattern(f.term), 'g'),
  }));

  return {
    byWrong,
    order,
    flags,
    re: alternation ? new RegExp(alternation, 'g') : null,
  };
}

// Apply `fn` to the parts of `text` that are not inside a URL. Timecode links
// in transcripts carry the video URL, and a name that happens to appear in a
// path or query string is not prose -- rewriting it would break the deep link.
function outsideUrls(text, fn) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    out += fn(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(text.slice(last));
}

/**
 * Correct known mishearings in `text`.
 *
 * Single pass: output is never re-scanned, so corrections cannot chain and the
 * result does not depend on entry order.
 *
 * @returns {{text: string, hits: Array<{wrong: string, right: string, count: number}>}}
 */
export function normalizeNames(text, dict) {
  const compiled = dict?.byWrong ? dict : compileDictionary(dict);
  if (!compiled.re || !text) return { text, hits: [] };

  const counts = new Map();
  const next = outsideUrls(text, chunk =>
    chunk.replace(compiled.re, match => {
      const key = collapse(match);
      const hit = compiled.byWrong.get(key);
      if (!hit) return match;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return hit.right;
    }),
  );

  const hits = compiled.order
    .filter(form => counts.has(form))
    .map(form => ({
      wrong: form,
      right: compiled.byWrong.get(form).right,
      count: counts.get(form),
    }));

  return { text: next, hits };
}

/**
 * Report occurrences of context-dependent terms. Never rewrites.
 *
 * @returns {Array<{term: string, count: number, why?: string}>}
 */
export function findFlagged(text, dict) {
  const compiled = dict?.flags ? dict : compileDictionary(dict);
  if (!text) return [];

  const found = [];
  for (const flag of compiled.flags) {
    let count = 0;
    outsideUrls(text, chunk => {
      count += (chunk.match(flag.re) ?? []).length;
      return chunk;
    });
    if (count > 0) found.push({ term: flag.term, count, why: flag.why });
  }
  return found;
}
