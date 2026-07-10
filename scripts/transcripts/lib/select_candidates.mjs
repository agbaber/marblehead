// Pure selection of which transcripts to enrich. Input is an array of
// { slug, text } where text is the full markdown (frontmatter + body).
// Returns the subset to enrich, in input order, capped at maxBatch.
//
// Rules (kept identical to the original enrich_batch.mjs listCandidates):
//   - Always skip hand-crafted POCs (frontmatter has a top-level `ingest:`).
//   - If skipBoards is set, skip files whose `board:` is in it.
//   - If source is set, skip files whose `source:` != it.
//   - Unless force, skip files that already have `summary_card:`.
//   - Cap the result at maxBatch (falsy/0 = no cap).
export function selectCandidates(items, { force = false, skipBoards = null, source = null, maxBatch = 0 } = {}) {
  const out = [];
  for (const item of items) {
    const text = item.text;
    if (/^ingest:/m.test(text)) continue;
    if (skipBoards) {
      const m = text.match(/^board: (\S+)$/m);
      if (m && skipBoards.has(m[1])) continue;
    }
    if (source) {
      const m = text.match(/^source: (\S+)$/m);
      if (!m || m[1] !== source) continue;
    }
    if (!force && /^summary_card:/m.test(text)) continue;
    out.push(item);
    if (maxBatch && out.length >= maxBatch) break;
  }
  return out;
}
