export function applyEdit(doc, edit) {
  if (edit.kind !== 'edit') return doc;
  const body = doc[edit.section];
  if (body == null) throw new Error(`section ${edit.section} not present`);
  if (!body.includes(edit.before)) throw new Error(`before text not found in ${edit.section}`);
  return { ...doc, [edit.section]: body.replace(edit.before, edit.after) };
}

export function invertEdit(edit) {
  return { ...edit, before: edit.after, after: edit.before };
}
