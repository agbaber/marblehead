const MONTHS = '(January|February|March|April|May|June|July|August|September|October|November|December)';
const FOOTER_PATTERNS = [
  new RegExp(`^\\s*${MONTHS}\\s+\\d{1,2},\\s*\\d{4}\\s+\\d{1,4}\\s*$`, 'i'),
  /^\s*Page\s+\d+\s+of\s+\d+\s*$/i,
  /^\s*\d{1,4}\s*$/,
];

export function stripFooters(text) {
  const lines = text.split('\n');
  const kept = lines.filter(line => !FOOTER_PATTERNS.some(re => re.test(line)));
  return kept.join('\n').replace(/\n{3,}/g, '\n\n');
}
