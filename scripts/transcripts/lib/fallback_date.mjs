// Date resolution for YouTube videos whose titles carry no date.
//
// Per-video yt-dlp calls (upload_date) are bot-blocked from datacenter IPs,
// including GitHub Actions runners. Without a guard, every CI run of
// pull_youtube.mjs re-fails those lookups and writes a degraded index,
// discarding dates that a previous run from an unblocked IP had resolved.
// Consulting the previous index first makes CI runs non-destructive and
// skips redundant per-video calls everywhere.

export function buildPreviousDateMap(previousIndex) {
  const map = new Map();
  for (const m of previousIndex?.meetings ?? []) {
    if (m.youtube_id && m.date) map.set(m.youtube_id, m);
  }
  return map;
}

export function resolveFallbackDate(youtubeId, previousMap, fetchUploadDate) {
  const prev = previousMap.get(youtubeId);
  if (prev) {
    return {
      date: prev.date,
      date_approximate: prev.date_approximate !== false,
      from_previous_index: true,
    };
  }
  const fetched = fetchUploadDate(youtubeId);
  if (!fetched) return null;
  return { date: fetched, date_approximate: true, from_previous_index: false };
}
