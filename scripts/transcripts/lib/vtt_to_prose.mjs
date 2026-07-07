const PARAGRAPH_TARGET_SECONDS = 90;
const PAUSE_BREAK_SECONDS = 4.0;

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };

function decodeEntities(s) {
  return s.replace(/&(amp|lt|gt|quot|#39|apos);/g, m => ENTITIES[m] ?? m);
}

function tsToSeconds(ts) {
  // HH:MM:SS.mmm or MM:SS.mmm
  const parts = ts.split(':');
  let h = 0, m, s;
  if (parts.length === 3) { [h, m, s] = parts; }
  else { [m, s] = parts; }
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function parseVtt(vtt) {
  const lines = vtt.split(/\r?\n/);
  const cues = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?\.\d{3})\s+-->\s+(\d{1,2}:\d{2}(?::\d{2})?\.\d{3})/);
    if (m) {
      const start_seconds = tsToSeconds(m[1]);
      const end_seconds = tsToSeconds(m[2]);
      const textLines = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i += 1;
      }
      const text = decodeEntities(textLines.join(' ').replace(/\s+/g, ' ').trim());
      if (text) cues.push({ start_seconds, end_seconds, text });
    }
    i += 1;
  }
  return cues;
}

export function coalesceCues(cues, opts = {}) {
  const targetSeconds = opts.targetSeconds ?? PARAGRAPH_TARGET_SECONDS;
  const pauseBreakSeconds = opts.pauseBreakSeconds ?? PAUSE_BREAK_SECONDS;

  const paragraphs = [];
  let buf = null;
  let prevEnd = null;

  for (const cue of cues) {
    const pauseTooLong = prevEnd !== null && (cue.start_seconds - prevEnd) > pauseBreakSeconds;
    const targetExceeded = buf !== null && (cue.start_seconds - buf.start_seconds) > targetSeconds;

    if (buf === null || pauseTooLong || targetExceeded) {
      if (buf) paragraphs.push(buf);
      buf = { start_seconds: cue.start_seconds, text: cue.text };
    } else {
      buf.text += ' ' + cue.text;
    }
    prevEnd = cue.end_seconds;
  }
  if (buf) paragraphs.push(buf);
  return paragraphs;
}

function formatTimecode(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Build a deep-link to a specific second of the source video. Vimeo and
// MHTV-style URLs use a `#t=Ns` fragment; YouTube uses a `?t=Ns` or `&t=Ns`
// query parameter.
function jumpLink(videoUrl, seconds) {
  if (videoUrl.includes('youtube.com/watch') || videoUrl.includes('youtu.be/')) {
    const sep = videoUrl.includes('?') ? '&' : '?';
    return `${videoUrl}${sep}t=${seconds}s`;
  }
  return `${videoUrl}#t=${seconds}s`;
}

export function vttToProse(vtt, videoUrl, opts) {
  const cues = parseVtt(vtt);
  if (cues.length === 0) return '';
  const paragraphs = coalesceCues(cues, opts);
  return paragraphs
    .map(p => `**[${formatTimecode(p.start_seconds)}](${jumpLink(videoUrl, Math.floor(p.start_seconds))})** ${p.text}`)
    .join('\n\n');
}
