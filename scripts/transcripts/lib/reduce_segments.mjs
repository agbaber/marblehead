// Combine the per-chunk topic_segments of one oversized transcript into a
// single chronological list.
//
// Chunks arrive in order and their segments already carry absolute seconds, so
// concatenation is the natural merge. Two guarantees are enforced:
//   - At most one segment keeps `featured: true` (first occurrence wins); the
//     per-chunk prompt allows one featured per chunk, but a meeting has one.
//   - Output is stably sorted by start_seconds, so a mild local inversion from
//     ASR noise inside a chunk can't ship out-of-order segments to the site.
//
// Input objects are not mutated (the featured strip is applied to shallow
// copies).
export function concatSegments(perChunkSegments) {
  const flat = perChunkSegments.flat();
  let featuredSeen = false;
  const normalized = flat.map((s) => {
    if (s.featured === true) {
      if (featuredSeen) {
        const { featured, ...rest } = s;
        return rest;
      }
      featuredSeen = true;
    }
    return s;
  });
  return normalized
    .map((s, i) => [s, i])
    .sort((a, b) => a[0].start_seconds - b[0].start_seconds || a[1] - b[1])
    .map(([s]) => s);
}
