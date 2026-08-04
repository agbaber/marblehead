// Reconcile the eCode amendment skeleton against the Annual Town Reports.
//
// For every post-cutoff eCode amendment, the report for that year should contain
// an article with the same number (that's where sponsor/tally come from). Two
// signals worth surfacing:
//   - discrepancy: eCode dates an amendment to (year, article) but the report for
//     that year has no such article number — a real mismatch (ATM/STM numbering,
//     an off-by-a-year eCode date, or a missed report). Worth a human look.
//   - unenriched: the article exists in the report but stated no sponsor — benign,
//     just reported as a count.

export function reconcile(records, reportArticlesByYear, { cutoff }) {
  const discrepancies = [];
  let postCutoff = 0, enriched = 0, unenriched = 0;
  for (const rec of records) {
    const year = Number(rec.meeting.date.slice(0, 4));
    if (year < cutoff) continue;
    postCutoff++;
    const arts = reportArticlesByYear[year];
    if (!arts) continue; // no report on file for that year
    if (!arts.has(rec.article)) {
      discrepancies.push({ date: rec.meeting.date, article: rec.article, affects: rec.affects });
    } else if (rec.sponsor && rec.sponsor !== 'Town Meeting') {
      enriched++;
    } else {
      unenriched++;
    }
  }
  return { discrepancies, stats: { postCutoff, enriched, unenriched } };
}
