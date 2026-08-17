// Repairs YouTube auto-caption artifacts in transcript prose.
//
// YouTube's automatic captions use a "rolling" display: each cue repeats the
// line already on screen and appends the next few words, and a parallel cue
// carries per-word timings as inline `<00:00:03.000><c>word</c>` markup. Joining
// every cue -- which is correct for Vimeo's non-rolling captions -- therefore
// emits each phrase about three times, interleaved with visible timestamp junk.
//
// The timestamps are not even hidden from readers: a tag name cannot begin with
// a digit, so a browser renders `<00:00:03.000>` as literal text rather than
// dropping it as an unknown element.
//
// Two independent repairs, deliberately kept separate so each can be reasoned
// about and tested alone:
//
//   stripCueTags        removes the inline markup (unambiguous; standard WebVTT
//                       cue-internal syntax, carrying only timing we discard)
//   collapseRepeatedRuns collapses an immediately repeated word run
//
// The second is the judgement call. It only fires on runs of MIN_RUN words or
// more, because format duplication produces cue-length runs (typically 5-10
// words) while genuine speech repeats are short ("no, no", "I think I think").
// A long phrase said twice in a row, verbatim, would be collapsed -- but in this
// corpus that is indistinguishable from the artifact, and leaving the text
// tripled is the worse error.

// Source patterns, compiled fresh per use. A /g/ regex carries lastIndex
// between .test() calls, which would make detection alternate true/false.
const CUE_TIMESTAMP = '<\\d{2}:\\d{2}:\\d{2}\\.\\d{3}>';
const CUE_SPAN = '<\\/?c(?:\\.[A-Za-z0-9_-]+)*>';

// Shortest repeated run treated as an artifact rather than speech, when called
// directly. Four words is comfortably above natural stutter length.
const MIN_RUN = 4;

// Used inside paragraphs already known to carry rolling artifacts, where
// duplication is systematic. Three words catches the short cues this format
// produces ("Any other interested?", "will second it.", "All right, um") while
// still protecting two-word stutters like "no, no" and "very very".
const MIN_RUN_IN_ARTIFACT_TEXT = 3;

export function stripCueTags(text) {
  if (!text) return text;
  const stripped = text
    .replace(new RegExp(CUE_TIMESTAMP, 'g'), ' ')
    .replace(new RegExp(CUE_SPAN, 'g'), '');
  // Removing tags leaves doubled spaces where markup abutted words.
  return stripped.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.?!;:])/g, '$1').trim();
}

/**
 * Collapse `A A` and `A A A ...` into a single `A`, where A is a run of at
 * least `minRun` words.
 *
 * Scans left to right and prefers the SHORTEST qualifying run, which is the
 * true repetition period. Preferring the longest instead would match a run that
 * is itself two copies of the period, halving `A A A A` to `A A` rather than to
 * `A`.
 */
export function collapseRepeatedRuns(text, { minRun = MIN_RUN } = {}) {
  if (!text) return text;
  const words = text.split(/\s+/);
  const out = [];
  let i = 0;

  while (i < words.length) {
    let collapsed = false;
    const remaining = words.length - i;

    for (let r = 1; r <= Math.floor(remaining / 2); r += 1) {
      let repeats = 1;
      while (true) {
        const start = i + repeats * r;
        if (start + r > words.length) break;
        let same = true;
        for (let k = 0; k < r; k += 1) {
          if (words[i + k] !== words[start + k]) { same = false; break; }
        }
        if (!same) break;
        repeats += 1;
      }
      // A run seen three or more times is the rolling format's signature and is
      // collapsed at any length, down to a single repeated word ("Great. Great.
      // Great."). A run seen only twice is ambiguous with a genuine stutter, so
      // it must also be long enough to be a caption cue rather than speech.
      const isArtifact = repeats >= 3 || (repeats >= 2 && r >= minRun);
      if (isArtifact) {
        for (let k = 0; k < r; k += 1) out.push(words[i + k]);
        i += repeats * r;
        collapsed = true;
        break;
      }
    }

    if (!collapsed) {
      out.push(words[i]);
      i += 1;
    }
  }

  return out.join(' ');
}

/**
 * Strip inline cue markup, then collapse the rolling duplication it created.
 *
 * By default a no-op on text with no cue markup, so the Vimeo caption path --
 * clean, non-rolling prose -- is never edited.
 *
 * Pass `force` when the CALLER knows the text is YouTube-sourced. Not every
 * rolling paragraph contains inline markup: YouTube alternates plain rolling
 * cues with word-timed ones, so a paragraph can be fully duplicated and carry
 * no tags at all ("The motion passes 5 to 0. And with that The motion passes 5
 * to 0. And with that"). Sniffing per paragraph misses exactly those, which is
 * why source is the better signal when it is available.
 */
export function cleanRollingCaptions(text, { force = false } = {}) {
  if (!text) return text;
  if (!force && !hasRollingArtifacts(text)) return text;

  const stripped = stripCueTags(text);
  // Iterate to a fixpoint. One pass removes the period it finds, but nested
  // duplication (a doubled cue inside a tripled line) can need another.
  let prev = stripped;
  for (let pass = 0; pass < 5; pass += 1) {
    const next = collapseRepeatedRuns(prev, { minRun: MIN_RUN_IN_ARTIFACT_TEXT });
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

// Smallest cross-paragraph overlap treated as an artifact. Two paragraphs
// genuinely ending and starting on the same two words is unremarkable; three or
// more is the rolling cue straddling a paragraph break.
const MIN_BOUNDARY_OVERLAP = 3;

const TIMECODE_PREFIX_RE = /^(\*\*\[[^\]]*\]\([^)]*\)\*\*\s*)/;

/**
 * Remove text duplicated across a paragraph boundary.
 *
 * A rolling cue that straddles a paragraph break leaves the same phrase at the
 * end of one paragraph and the start of the next. The duplicate is dropped from
 * the EARLIER paragraph, because the later one's timecode is the authoritative
 * timestamp for those words -- moving them keeps deep links pointing at the
 * moment the words were actually spoken.
 *
 * Each paragraph's timecode prefix is always preserved.
 */
export function dedupeAcrossParagraphs(paragraphs, { minOverlap = MIN_BOUNDARY_OVERLAP } = {}) {
  const out = [...paragraphs];

  for (let i = 0; i < out.length - 1; i += 1) {
    const curPrefix = (out[i].match(TIMECODE_PREFIX_RE) ?? [''])[0];
    const curBody = out[i].slice(curPrefix.length);
    const nextPrefix = (out[i + 1].match(TIMECODE_PREFIX_RE) ?? [''])[0];
    const nextBody = out[i + 1].slice(nextPrefix.length);

    const cur = curBody.split(/\s+/).filter(Boolean);
    const next = nextBody.split(/\s+/).filter(Boolean);

    // Longest overlap first, so the whole straddling phrase goes at once.
    const max = Math.min(cur.length, next.length);
    for (let k = max; k >= minOverlap; k -= 1) {
      let same = true;
      for (let j = 0; j < k; j += 1) {
        if (cur[cur.length - k + j] !== next[j]) { same = false; break; }
      }
      if (same) {
        out[i] = curPrefix + cur.slice(0, cur.length - k).join(' ');
        break;
      }
    }
  }

  return out;
}

/** True when text carries YouTube rolling-caption artifacts. */
export function hasRollingArtifacts(text) {
  if (!text) return false;
  return new RegExp(`${CUE_TIMESTAMP}|${CUE_SPAN}`).test(text);
}
