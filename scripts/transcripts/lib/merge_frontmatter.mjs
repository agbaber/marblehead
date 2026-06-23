function escapeQuotes(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function quoteOrBlock(text, indent) {
  if (text.includes('\n')) {
    const ind = ' '.repeat(indent);
    return '|\n' + text.split('\n').map(l => ind + l).join('\n');
  }
  return `"${escapeQuotes(text)}"`;
}

function renderSummaryCard(card) {
  const lines = ['summary_card:'];
  lines.push(`  headline: "${escapeQuotes(card.headline)}"`);
  lines.push(`  summary: ${quoteOrBlock(card.summary, 4)}`);
  if (Array.isArray(card.decisions) && card.decisions.length > 0) {
    lines.push('  decisions:');
    for (const d of card.decisions) lines.push(`    - "${escapeQuotes(d)}"`);
  }
  if (Array.isArray(card.votes) && card.votes.length > 0) {
    lines.push('  votes:');
    for (const v of card.votes) {
      lines.push(`    - motion: "${escapeQuotes(v.motion)}"`);
      lines.push(`      result: "${escapeQuotes(v.result)}"`);
    }
  }
  return lines.join('\n');
}

function renderTopicSegments(segs) {
  const lines = ['topic_segments:'];
  for (const s of segs) {
    lines.push(`  - topic: ${s.topic}`);
    if (typeof s.topic_confidence === 'number') {
      lines.push(`    topic_confidence: ${s.topic_confidence}`);
    }
    lines.push(`    start_seconds: ${s.start_seconds}`);
    lines.push(`    end_seconds: ${s.end_seconds}`);
    if (s.featured === true) lines.push('    featured: true');
    lines.push(`    headline: "${escapeQuotes(s.headline)}"`);
    if (s.dek) lines.push(`    dek: "${escapeQuotes(s.dek)}"`);
    lines.push(`    summary: ${quoteOrBlock(s.summary, 6)}`);
    if (Array.isArray(s.key_speakers) && s.key_speakers.length > 0) {
      const arr = s.key_speakers.map(k => `"${escapeQuotes(k)}"`).join(', ');
      lines.push(`    key_speakers: [${arr}]`);
    }
  }
  return lines.join('\n');
}

// Find the frontmatter block at the start of the file.
function splitFile(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('file has no YAML frontmatter');
  return { yaml: m[1], body: m[2] };
}

// Remove any previous summary_card / topic_segments blocks.
function stripPriorBlocks(yaml) {
  const lines = yaml.split('\n');
  const out = [];
  let skipping = false;
  for (const line of lines) {
    if (/^(summary_card|topic_segments):/.test(line)) { skipping = true; continue; }
    if (skipping && /^[a-zA-Z_]/.test(line)) skipping = false;
    if (!skipping) out.push(line);
  }
  return out.join('\n');
}

export function mergeFrontmatter(existing, summaryCard, topicSegments) {
  const { yaml, body } = splitFile(existing);
  const stripped = stripPriorBlocks(yaml)
    .replace(/^source: vimeo-auto$/m, 'source: vimeo-auto+llm')
    .replace(/^source: youtube-auto$/m, 'source: youtube-auto+llm');
  const newYaml = [
    stripped,
    renderSummaryCard(summaryCard),
    renderTopicSegments(topicSegments),
  ].join('\n\n');
  return `---\n${newYaml}\n---\n${body}`;
}
