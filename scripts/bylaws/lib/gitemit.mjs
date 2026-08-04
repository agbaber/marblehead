import { toIdentity } from './identity.mjs';
import { execFileSync } from 'node:child_process';

export function initRepo(dir) {
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'bylaws-pipeline']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'pipeline@marblehead.town']);
}

export function commitInto(dir, commit, changedFiles) {
  execFileSync('git', ['-C', dir, 'add', ...changedFiles]);
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: commit.authorName, GIT_AUTHOR_EMAIL: commit.authorEmail,
    GIT_AUTHOR_DATE: commit.date,
    GIT_COMMITTER_NAME: commit.authorName, GIT_COMMITTER_EMAIL: commit.authorEmail,
    GIT_COMMITTER_DATE: commit.date,
  };
  execFileSync('git', ['-C', dir, 'commit', '-q', '-m', commit.subject, '-m', commit.body], { env });
}

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
  lines.push(`Meeting: ${rec.meeting.date} ${rec.meeting.type}`);
  lines.push(`Source: ${rec.source.doc}${rec.source.page ? ` p.${rec.source.page}` : ''}`);
  lines.push(`Fidelity: ${rec.fidelity}`);
  // git cannot store commit timestamps before the 1970 Unix epoch. For pre-1970
  // Town Meetings the git author date is clamped to 1970-01-01; the true meeting
  // date is preserved in the subject year and the "Meeting:" body line above.
  const safeDate = Number(rec.meeting.date.slice(0, 4)) < 1970 ? '1970-01-01' : rec.meeting.date;
  return {
    subject,
    body: lines.join('\n'),
    authorName: id.name,
    authorEmail: id.email,
    date: `${safeDate}T12:00:00`,
  };
}
