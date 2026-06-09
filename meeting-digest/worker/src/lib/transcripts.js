// meeting-digest/worker/src/lib/transcripts.js

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function parseFrontmatter(text) {
  if (typeof text !== 'string') return { yaml: null, body: text || '' };
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { yaml: null, body: text };
  return { yaml: m[1], body: m[2] };
}

// Minimal YAML extraction. We only read keys/values we care about; no general parser.
// Returns undefined for missing keys.
function scalar(yaml, key) {
  const re = new RegExp(`^${key}: (.+)$`, 'm');
  const m = yaml.match(re);
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function summaryCard(yaml) {
  const m = yaml.match(/^summary_card:\n((?:[ \t][^\n]*\n?|\n)*)/m);
  if (!m) return null;
  const block = m[1];
  const get = (k) => {
    const r = new RegExp(`^  ${k}: (.+)$`, 'm');
    const mm = block.match(r);
    if (!mm) return undefined;
    return mm[1].trim().replace(/^["']|["']$/g, '');
  };
  return {
    headline: get('headline') || '',
    summary: get('summary') || ''
  };
}

function topicSegments(yaml) {
  const m = yaml.match(/^topic_segments:\n((?:[ \t][^\n]*\n?|\n)*)/m);
  if (!m) return [];
  const block = m[1];
  const entries = block.split(/^  - /m).slice(1);
  return entries.map(entry => {
    const lines = entry.split('\n');
    const out = {};
    for (const line of lines) {
      const ll = line.replace(/^    /, '');
      const mm = ll.match(/^(\w+): (.+)$/);
      if (!mm) continue;
      let v = mm[2].trim().replace(/^["']|["']$/g, '');
      if (mm[1] === 'start_seconds' || mm[1] === 'end_seconds') v = Number(v);
      if (mm[1] === 'featured') v = v === 'true';
      if (mm[1] === 'topic_confidence') v = Number(v);
      out[mm[1]] = v;
    }
    return out;
  }).filter(s => s.topic);
}

export function parseTranscript(filename, text) {
  const { yaml } = parseFrontmatter(text);
  if (!yaml) return null;
  const slug = scalar(yaml, 'slug');
  const board = scalar(yaml, 'board');
  const date = scalar(yaml, 'date');
  if (!slug || !board || !date) return null;
  return {
    slug,
    board,
    board_display: scalar(yaml, 'board_display') || board,
    date,
    title: scalar(yaml, 'title') || slug,
    vimeo_url: scalar(yaml, 'vimeo_url') || '',
    summary_card: summaryCard(yaml),
    topic_segments: topicSegments(yaml)
  };
}

export function extractDateFromFilename(filename) {
  const m = filename.match(DATE_RE);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function withinLastSevenDays(isoDate, nowMs) {
  const d = Date.parse(isoDate + 'T00:00:00Z');
  if (Number.isNaN(d)) return false;
  return d >= nowMs - SEVEN_DAYS_MS && d <= nowMs;
}

// Fetch the latest transcript files via GitHub Contents API.
// Returns: array of parsed transcript objects (only ones in the 7-day window).
// Throws on network failure; caller decides retry policy.
export async function fetchRecentTranscripts(env, nowMs = Date.now()) {
  const dirUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/_transcripts?ref=${env.GITHUB_BRANCH}`;
  const dirResp = await fetch(dirUrl, {
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'marblehead-meeting-digest' }
  });
  if (!dirResp.ok) {
    throw new Error(`GitHub dir listing failed: ${dirResp.status}`);
  }
  const entries = await dirResp.json();
  const recent = entries
    .filter(e => e.type === 'file' && e.name.endsWith('.md'))
    .map(e => ({ name: e.name, date: extractDateFromFilename(e.name), download_url: e.download_url }))
    .filter(e => e.date && withinLastSevenDays(e.date, nowMs));

  const results = [];
  for (const e of recent) {
    const fileResp = await fetch(e.download_url, {
      headers: { 'User-Agent': 'marblehead-meeting-digest' }
    });
    if (!fileResp.ok) continue;
    const text = await fileResp.text();
    const t = parseTranscript(e.name, text);
    if (t) results.push(t);
  }
  results.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return results;
}
