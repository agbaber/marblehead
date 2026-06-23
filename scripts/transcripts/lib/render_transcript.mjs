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

const VIMEO_DISCLAIMER = [
  '> Transcript captured from MHTV\'s Vimeo auto-captioning. No speaker labels;',
  '> proper names and dollar figures occasionally misheard. Click any timecode to',
  '> jump to that moment in the source video.',
].join('\n');

const YOUTUBE_DISCLAIMER = [
  '> Transcript captured from YouTube auto-captioning. No speaker labels;',
  '> proper names and dollar figures occasionally misheard. Click any timecode to',
  '> jump to that moment in the source video.',
].join('\n');

/**
 * @param {{
 *   board_slug: string,
 *   board_display: string,
 *   date: string,
 *   vimeo_id?: string,
 *   youtube_id?: string,
 *   duration_seconds: number,
 *   body: string,
 *   source?: 'vimeo-auto'|'youtube-auto',
 *   date_approximate?: boolean,
 * }} args
 */
export function renderTranscript({
  board_slug,
  board_display,
  date,
  vimeo_id,
  youtube_id,
  duration_seconds,
  body,
  source = 'vimeo-auto',
  date_approximate = false,
}) {
  const slug = buildSlug(board_slug, date);
  const title = buildTitle(board_display, date);

  const isYouTube = source === 'youtube-auto';
  if (isYouTube && !youtube_id) throw new Error('youtube-auto source requires youtube_id');
  if (!isYouTube && !vimeo_id) throw new Error('vimeo-auto source requires vimeo_id');

  const videoUrl = isYouTube
    ? `https://www.youtube.com/watch?v=${youtube_id}`
    : `https://vimeo.com/${vimeo_id}`;
  const disclaimer = isYouTube ? YOUTUBE_DISCLAIMER : VIMEO_DISCLAIMER;

  const fields = [
    '---',
    `slug: ${slug}`,
    `board: ${board_slug}`,
    `board_display: "${board_display}"`,
    `date: ${date}`,
    `title: "${title}"`,
  ];
  if (isYouTube) {
    fields.push(`youtube_id: ${youtube_id}`);
  } else {
    fields.push(`vimeo_id: ${vimeo_id}`);
    fields.push(`vimeo_url: "${videoUrl}"`);
  }
  fields.push(`video_url: "${videoUrl}"`);
  fields.push(`duration_seconds: ${duration_seconds}`);
  if (date_approximate) fields.push('date_approximate: true');
  fields.push('ai_generated: true');
  fields.push('status: published');
  fields.push(`source: ${source}`);
  fields.push('---');

  return `${fields.join('\n')}\n\n${disclaimer}\n\n${body}\n`;
}
