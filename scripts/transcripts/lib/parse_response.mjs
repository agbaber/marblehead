import { isKnownTopic } from './topics.mjs';
import { normalizeSummaries } from './normalize_markdown.mjs';

const OCR_DOLLAR_RE = /\bS\d[\d.,]*M?\b/;

function validateSegment(seg, i, errors) {
  if (!seg || typeof seg !== 'object') {
    errors.push(`topic_segments[${i}]: not an object`);
    return;
  }
  if (!isKnownTopic(seg.topic)) {
    errors.push(`topic_segments[${i}]: unknown topic "${seg.topic}"`);
  }
  if (!Number.isInteger(seg.start_seconds) || seg.start_seconds < 0) {
    errors.push(`topic_segments[${i}]: start_seconds must be a non-negative integer`);
  }
  if (!Number.isInteger(seg.end_seconds) || seg.end_seconds <= seg.start_seconds) {
    errors.push(`topic_segments[${i}]: end_seconds must be an integer greater than start_seconds`);
  }
  if (typeof seg.headline !== 'string' || !seg.headline.trim()) {
    errors.push(`topic_segments[${i}]: headline required`);
  }
  if (typeof seg.summary !== 'string' || !seg.summary.trim()) {
    errors.push(`topic_segments[${i}]: summary required`);
  }
  if (seg.summary && OCR_DOLLAR_RE.test(seg.summary)) {
    errors.push(`topic_segments[${i}]: OCR-style dollar figure in summary (e.g. "S15M")`);
  }
}

function stripFences(text) {
  // The prompt says "no code fences" but models occasionally wrap output anyway.
  return text
    .replace(/^\s*```(?:json)?\s*\n/, '')
    .replace(/\n```\s*$/, '')
    .trim();
}

export function parseResponse(text) {
  const errors = [];
  let obj;
  try {
    obj = JSON.parse(stripFences(text));
  } catch (e) {
    return { valid: false, errors: [`invalid JSON: ${e.message}`] };
  }

  const card = obj.summary_card;
  if (!card || typeof card !== 'object') {
    errors.push('summary_card missing');
  } else {
    if (typeof card.headline !== 'string' || !card.headline.trim()) {
      errors.push('summary_card.headline required');
    }
    if (typeof card.summary !== 'string' || !card.summary.trim()) {
      errors.push('summary_card.summary required');
    }
    if (card.summary && OCR_DOLLAR_RE.test(card.summary)) {
      errors.push('summary_card.summary contains OCR-style dollar figure (e.g. "S15M")');
    }
    if (card.headline && OCR_DOLLAR_RE.test(card.headline)) {
      errors.push('summary_card.headline contains OCR-style dollar figure');
    }
  }

  const segs = obj.topic_segments;
  if (!Array.isArray(segs)) {
    errors.push('topic_segments must be an array');
  } else {
    let featuredCount = 0;
    segs.forEach((s, i) => {
      validateSegment(s, i, errors);
      if (s && s.featured === true) featuredCount += 1;
    });
    if (featuredCount > 1) {
      errors.push(`more than one featured topic_segment (got ${featuredCount}, max 1)`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  normalizeSummaries({ summary_card: card, topic_segments: segs });
  return { valid: true, summary_card: card, topic_segments: segs, errors: [] };
}
