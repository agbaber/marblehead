// Build base amendment records from the eCode section-index blame events.
//
// The section-index attaches, to each section, the Town Meeting events that
// touched it (date, type, article, action). eCode only records amendments that
// PASSED (they are in the current law), so every base record is disposition
// "passed". Grouping by (date, article) collapses "this meeting's article N
// touched sections X and Y" into one record with affects: [X, Y].

export function groupEvents(index) {
  const byKey = new Map();
  for (const [ref, meta] of Object.entries(index)) {
    for (const ev of meta.notes || []) {
      const key = `${ev.date}|${ev.article}`;
      let rec = byKey.get(key);
      if (!rec) {
        rec = {
          meeting: { date: ev.date, type: ev.type },
          article: ev.article,
          actions: new Set(),
          affects: new Set(),
        };
        byKey.set(key, rec);
      }
      rec.actions.add(ev.action);
      rec.affects.add(ref);
    }
  }
  return [...byKey.values()]
    .map(r => ({
      meeting: r.meeting,
      article: r.article,
      actions: [...r.actions],
      affects: [...r.affects].sort(),
    }))
    .sort((a, b) =>
      a.meeting.date !== b.meeting.date
        ? (a.meeting.date < b.meeting.date ? -1 : 1)
        : a.article - b.article);
}
