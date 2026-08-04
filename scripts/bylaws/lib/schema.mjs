export const DISPOSITIONS = ['passed', 'defeated', 'withdrawn', 'referred'];
export const FIDELITIES = ['verbatim', 'blame'];
const MEETING_TYPES = ['ATM', 'STM', 'TM']; // TM = pre-ATM/STM Town Meeting (eCode uses it for pre-1990s events)

export function validateAmendment(a) {
  const errs = [];
  if (!a || typeof a !== 'object') return ['record is not an object'];
  if (!a.meeting || !/^\d{4}-\d{2}-\d{2}$/.test(a.meeting.date || ''))
    errs.push('meeting.date must be YYYY-MM-DD');
  if (!MEETING_TYPES.includes(a.meeting?.type))
    errs.push(`meeting.type must be one of ${MEETING_TYPES.join(', ')}`);
  if (!Number.isInteger(a.article)) errs.push('article must be an integer');
  if (!a.sponsor || typeof a.sponsor !== 'string') errs.push('sponsor is required');
  if (!DISPOSITIONS.includes(a.disposition))
    errs.push(`disposition must be one of ${DISPOSITIONS.join(', ')}`);
  if (!FIDELITIES.includes(a.fidelity))
    errs.push(`fidelity must be one of ${FIDELITIES.join(', ')}`);
  if (!Array.isArray(a.affects)) errs.push('affects must be an array of section refs');
  if (!a.source || !a.source.doc) errs.push('source.doc is required (citation discipline)');
  if (a.disposition === 'passed' && a.vote &&
      (!Number.isInteger(a.vote.yes) || !Number.isInteger(a.vote.no)))
    errs.push('passed record needs integer vote.yes and vote.no');
  if (a.fidelity === 'verbatim' && a.change?.kind !== 'edit')
    errs.push('verbatim record requires change.kind === "edit" with before/after text');
  return errs;
}
