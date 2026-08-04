export function orderTimeline(records) {
  return [...records]
    .map(r => ({ ...r, changesText: r.disposition === 'passed' && (r.affects?.length > 0) }))
    .sort((a, b) => {
      if (a.meeting.date !== b.meeting.date) return a.meeting.date < b.meeting.date ? -1 : 1;
      return a.article - b.article;
    });
}
