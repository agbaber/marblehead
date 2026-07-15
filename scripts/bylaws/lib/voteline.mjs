const VOTE_RE = /^\s*Voted\s+Yes\s+(\d+)\s+No\s+(\d+)\s*(.*)$/i;

const THRESHOLDS = [
  { re: /2\/3(rd)?/i, name: 'two-thirds' },
  { re: /4\/5(th)?/i, name: 'four-fifths' },
];

export function parseVoteLine(line) {
  const m = VOTE_RE.exec(line);
  if (!m) return null;
  const yes = Number(m[1]);
  const no = Number(m[2]);
  let tail = (m[3] || '').trim();
  let threshold = 'majority';
  for (const t of THRESHOLDS) {
    if (t.re.test(tail)) { threshold = t.name; break; }
  }
  const met = /achieved/i.test(tail) ? true : yes > no;
  const rest = tail.replace(/^:\s*/, '')
                   .replace(/\b\d\/\d(rd|th)?\s*vote\s*(achieved|not achieved)\b/i, '')
                   .trim();
  return { yes, no, threshold, met, rest };
}
