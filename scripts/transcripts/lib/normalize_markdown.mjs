// Kramdown (GFM) only starts a table at a block boundary. A pipe row that
// directly follows a paragraph or heading line is swallowed into that block,
// and smart-typography then rewrites the `|---|---|` delimiter row into
// `|—|—|`, so the reader sees a run of em-dashes instead of a table.
// LLM enrichment writes `**Key figures:**` immediately above the header row
// often enough that this is worth normalizing rather than re-prompting.

const PIPE_ROW = /^\s*\|.*\|\s*$/;
const DELIMITER_ROW = /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/;

/**
 * Insert blank lines around any markdown table that is glued to the block
 * above or below it. A trailing prose line invalidates the table just as a
 * leading one does. Tables already fenced by blank lines are left alone.
 */
export function normalizeMarkdownTables(md) {
  if (typeof md !== 'string' || !md.includes('|')) return md;

  const lines = md.split('\n');
  const out = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1];
    const prev = out[out.length - 1];
    const isPipe = PIPE_ROW.test(line);

    const startsTable =
      isPipe && !DELIMITER_ROW.test(line) && next !== undefined && DELIMITER_ROW.test(next);

    if (startsTable && !inTable) {
      if (prev !== undefined && prev.trim() !== '' && !PIPE_ROW.test(prev)) out.push('');
      inTable = true;
    } else if (inTable && !isPipe) {
      // First non-pipe line after the table body closes it.
      if (line.trim() !== '') out.push('');
      inTable = false;
    }

    out.push(line);
  }

  return out.join('\n');
}

/** Apply table normalization to every summary field in an enrichment payload. */
export function normalizeSummaries({ summary_card, topic_segments }) {
  if (summary_card && typeof summary_card.summary === 'string') {
    summary_card.summary = normalizeMarkdownTables(summary_card.summary);
  }
  if (Array.isArray(topic_segments)) {
    for (const seg of topic_segments) {
      if (seg && typeof seg.summary === 'string') {
        seg.summary = normalizeMarkdownTables(seg.summary);
      }
    }
  }
}
