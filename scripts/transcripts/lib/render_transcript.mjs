const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function buildSlug(boardSlug, isoDate) {
  return `${boardSlug}-${isoDate}`;
}

export function buildTitle(boardDisplay, isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${boardDisplay}: ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

const DISCLAIMER = [
  '> Transcript captured from MHTV\'s Vimeo auto-captioning. No speaker labels;',
  '> proper names and dollar figures occasionally misheard. Click any timecode to',
  '> jump to that moment in the source video.',
].join('\n');

export function renderTranscript({
  board_slug,
  board_display,
  date,
  vimeo_id,
  duration_seconds,
  body,
}) {
  const slug = buildSlug(board_slug, date);
  const title = buildTitle(board_display, date);
  const vimeoUrl = `https://vimeo.com/${vimeo_id}`;
  const frontmatter = [
    '---',
    `slug: ${slug}`,
    `board: ${board_slug}`,
    `board_display: "${board_display}"`,
    `date: ${date}`,
    `title: "${title}"`,
    `vimeo_id: ${vimeo_id}`,
    `vimeo_url: "${vimeoUrl}"`,
    `duration_seconds: ${duration_seconds}`,
    'ai_generated: true',
    'status: published',
    'source: vimeo-auto',
    '---',
  ].join('\n');
  return `${frontmatter}\n\n${DISCLAIMER}\n\n${body}\n`;
}
