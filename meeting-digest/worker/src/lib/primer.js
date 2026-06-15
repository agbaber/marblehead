//
// Reads _primers/NN-slug.md from the marblehead Jekyll repo and turns each
// into a structured primer object the Worker can render into the digest.
//
// File contract (see spec docs/superpowers/specs/2026-06-15-...):
//   ---
//   week_index: 1                       (required integer)
//   title: "..."                        (required string)
//   link_url: /about/                   (required string)
//   link_label: "..."                   (required string)
//   ---
//   Body paragraph 1.
//
//   Body paragraph 2.
//
// Anything malformed returns null and the caller logs + skips.

function frontmatterAndBody(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { yaml: m[1], body: m[2] };
}

function scalar(yaml, key) {
  const re = new RegExp(`^${key}: (.+)$`, 'm');
  const m = yaml.match(re);
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

export function parsePrimer(filename, text) {
  const fb = frontmatterAndBody(text);
  if (!fb) return null;
  const { yaml, body } = fb;

  const rawWeekIndex = scalar(yaml, 'week_index');
  const title = scalar(yaml, 'title');
  const link_url = scalar(yaml, 'link_url');
  const link_label = scalar(yaml, 'link_label');
  if (rawWeekIndex === undefined || !title || !link_url || !link_label) return null;
  const week_index = Number.parseInt(rawWeekIndex, 10);
  if (!Number.isFinite(week_index) || week_index < 1) return null;

  const body_paragraphs = body
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return { filename, week_index, title, link_url, link_label, body_paragraphs };
}

export async function fetchPrimers(env) {
  const dirUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/_primers?ref=${env.GITHUB_BRANCH}`;
  const dirResp = await fetch(dirUrl, {
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'marblehead-meeting-digest' }
  });
  if (!dirResp.ok) {
    throw new Error(`_primers listing failed: ${dirResp.status}`);
  }
  const entries = await dirResp.json();
  const candidates = entries
    .filter(e => e.type === 'file' && e.name.endsWith('.md'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parsed = [];
  for (const e of candidates) {
    let fileResp;
    try {
      fileResp = await fetch(e.download_url, { headers: { 'User-Agent': 'marblehead-meeting-digest' } });
    } catch {
      console.log(`[digest] _primers fetch error: ${e.name}`);
      continue;
    }
    if (!fileResp.ok) {
      console.log(`[digest] _primers fetch ${e.name}: ${fileResp.status}`);
      continue;
    }
    const text = await fileResp.text();
    const p = parsePrimer(e.name, text);
    if (!p) {
      console.log(`[digest] _primers parse failure: ${e.name}`);
      continue;
    }
    parsed.push(p);
  }

  // Sort by week_index, with alphabetical filename order as the tiebreaker.
  // The candidates list is already in filename order, so a stable sort here
  // means dups land in the right order before dedupe.
  parsed.sort((a, b) => a.week_index - b.week_index);

  // Dedupe by week_index — alphabetically-first filename wins.
  const seen = new Set();
  const out = [];
  for (const p of parsed) {
    if (seen.has(p.week_index)) {
      console.log(`[digest] _primers duplicate week_index ${p.week_index}: ignoring ${p.filename}`);
      continue;
    }
    seen.add(p.week_index);
    out.push(p);
  }
  return out;
}
