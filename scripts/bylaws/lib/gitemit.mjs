import { toIdentity } from './identity.mjs';

export function formatCommit(rec, sponsorMap) {
  const id = toIdentity(rec.sponsor, sponsorMap);
  const year = rec.meeting.date.slice(0, 4);
  const subject = `${year} ${rec.meeting.type} Art. ${rec.article}: ${rec.title}`;
  const lines = [];
  if (rec.vote) {
    lines.push(`Voted Yes ${rec.vote.yes} No ${rec.vote.no} (${rec.vote.threshold})` +
               `${rec.vote.met ? '' : ' — not met'}`);
  }
  lines.push(`Sponsor: ${rec.sponsor}`);
  lines.push(`Disposition: ${rec.disposition}`);
  lines.push(`Source: ${rec.source.doc} p.${rec.source.page}`);
  lines.push(`Fidelity: ${rec.fidelity}`);
  return {
    subject,
    body: lines.join('\n'),
    authorName: id.name,
    authorEmail: id.email,
    date: `${rec.meeting.date}T12:00:00`,
  };
}
