// Split a transcript body into ordered chunks small enough to enrich
// individually. A body is blank-line-separated timecoded paragraphs of the
// form `**[H:MM:SS](https://vimeo.com/<id>#t=<seconds>s)** text...`.
//
// Chunking happens ONLY on paragraph boundaries: a timecode link must never be
// split, or the resulting chunk would carry a corrupt / absent timestamp. The
// `#t=<seconds>` values are absolute, so downstream topic segments from a later
// chunk already carry correct absolute seconds and simply concatenate in order.
//
// A single paragraph larger than maxChars is emitted whole in its own chunk
// (we would rather send one oversized request than corrupt a timecode).
//
// Returns [{ text, index, total }]; a body already under maxChars is one chunk.
export function chunkBody(body, maxChars) {
  const paras = body.split('\n\n');
  const chunks = [];
  let current = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join('\n\n'));
    current = [];
    currentLen = 0;
  };

  for (const p of paras) {
    // +2 accounts for the '\n\n' separator that will rejoin this paragraph.
    const addLen = current.length === 0 ? p.length : currentLen + 2 + p.length;
    if (current.length > 0 && addLen > maxChars) {
      flush();
    }
    current.push(p);
    currentLen = current.length === 1 ? p.length : currentLen + 2 + p.length;
  }
  flush();

  const total = chunks.length;
  return chunks.map((text, index) => ({ text, index, total }));
}
