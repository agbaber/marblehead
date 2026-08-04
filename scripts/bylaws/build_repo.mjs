// Generate a real git repository of Marblehead's General Bylaws (Part I).
//
// v1 is blame-level (verbatim before/after text is phase 2), so the repo is a
// provenance history, honest about that:
//   - an initial "import" commit lands the current codified text (bylaws/*.md)
//     exactly as eCode has it today (HEAD text integrity is checked by
//     verify_golden.mjs);
//   - then one commit per (meeting, article) amendment, oldest -> newest, each
//     appending the event to provenance/<chapter>.md for the affected chapters,
//     authored by the real sponsor, dated to the meeting, with the vote tally in
//     the message; every distinct Town Meeting gets a tag.
//
// Result: `git log provenance/174-town-meeting.md` is Chapter 174's amendment
// timeline with real authors and votes; HEAD holds the current law verbatim.
// Run after extract_amendments.mjs.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { formatCommit, initRepo, commitInto } from './lib/gitemit.mjs';

const BYLAWS = 'data/bylaws-history/bylaws';
const INDEX = 'data/bylaws-history/section-index.json';
const AMEND = 'data/bylaws-history/amendments.jsonl';
const SPONSOR_MAP = 'data/bylaws-history/sponsor-map.json';
const REPO = 'dist/bylaws-repo';

const index = JSON.parse(readFileSync(INDEX, 'utf8'));
const sponsorMap = JSON.parse(readFileSync(SPONSOR_MAP, 'utf8'));
const amendments = readFileSync(AMEND, 'utf8').trim().split('\n').map(l => JSON.parse(l));

// section ref -> chapter provenance filename (e.g. "174-1" -> "174-town-meeting.md")
const provFileFor = ref => index[ref]?.file || 'unmapped.md';

// Fresh repo, current text as the import baseline.
rmSync(REPO, { recursive: true, force: true });
mkdirSync(`${REPO}/bylaws`, { recursive: true });
mkdirSync(`${REPO}/provenance`, { recursive: true });
for (const name of readdirSync(BYLAWS)) {
  writeFileSync(`${REPO}/bylaws/${name}`, readFileSync(`${BYLAWS}/${name}`));
}
writeFileSync(`${REPO}/README.md`,
  '# Marblehead General Bylaws (Part I) — provenance history\n\n' +
  'HEAD `bylaws/` is the current codified text (eCode, 2024-05-06). Each commit ' +
  'under `provenance/` is a Town Meeting amendment, authored by its sponsor and ' +
  'carrying its vote where recorded. Open Town Meeting is anonymous: sponsor and ' +
  'aggregate tally only, never a per-person vote. Verbatim before/after text is a ' +
  'planned phase 2.\n');
initRepo(REPO);
execFileSync('git', ['-C', REPO, 'add', '-A']);
execFileSync('git', ['-C', REPO, 'commit', '-q', '-m',
  'Import current codified General Bylaws (Part I) from eCode (2024-05-06)']);

// Replay amendments oldest -> newest.
const tagged = new Set();
for (const rec of amendments) {
  const title = rec.title || `${rec.actions.join('/')} § ${rec.affects.join(', ')}`;
  const commit = formatCommit({ ...rec, title }, sponsorMap);

  const chapters = [...new Set(rec.affects.map(provFileFor))];
  for (const ch of chapters) {
    const line = `- ${rec.meeting.date} ${rec.meeting.type} Art. ${rec.article}: ` +
      `${rec.actions.join('/')} § ${rec.affects.join(', ')} — ${rec.sponsor}` +
      `${rec.vote ? ` (Voted Yes ${rec.vote.yes} No ${rec.vote.no})` : ''}\n`;
    appendFileSync(`${REPO}/provenance/${ch}`, line);
  }
  commitInto(REPO, commit, chapters.map(c => `provenance/${c}`));

  const tag = `TM-${rec.meeting.date}`;
  if (!tagged.has(tag)) {
    execFileSync('git', ['-C', REPO, 'tag', tag]);
    tagged.add(tag);
  }
}

const count = execFileSync('git', ['-C', REPO, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim();
console.log(`built ${REPO}: ${count} commits, ${tagged.size} Town Meeting tags, ${amendments.length} amendments replayed`);
