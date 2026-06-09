// meeting-digest/worker/src/lib/matcher.js

// subscription: { boards: string[], topics: string[] }
// Returns: [{ transcript, matched_segments: [{topic, start_seconds, headline, dek}] }, ...]
//   matched_segments are the topic_segments whose topic is in subscription.topics.
//   If the subscriber filtered only by board, matched_segments is empty.

export function matchTranscripts(transcripts, subscription) {
  const boards = new Set(subscription.boards || []);
  const topics = new Set(subscription.topics || []);
  const out = [];
  for (const t of transcripts) {
    const boardMatch = boards.has(t.board);
    const segs = (t.topic_segments || []).filter(s => topics.has(s.topic));
    const topicMatch = segs.length > 0;
    if (boardMatch || topicMatch) {
      out.push({ transcript: t, matched_segments: segs });
    }
  }
  return out;
}
