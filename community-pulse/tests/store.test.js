import { describe, it, expect, beforeEach } from 'vitest';
import { openStore, getStance, setStance, getAllStances, clearStance, clearAllStances } from '../../assets/community-pulse/widget.js';

// Each test gets a fresh IndexedDB because fake-indexeddb resets per import scope.
beforeEach(async () => {
  // Clear the in-memory IndexedDB between tests by clearing the store.
  const db = await openStore();
  await clearAllStances(db);
});

describe('stance store', () => {
  it('returns null for an unknown section', async () => {
    const db = await openStore();
    const result = await getStance(db, 'no-override-budget.html#unknown');
    expect(result).toBeNull();
  });

  it('writes and reads back a stance', async () => {
    const db = await openStore();
    await setStance(db, 'no-override-budget.html#staffing-cuts', {
      stance: 'agree',
      note: 'This matches the Fin Com report.'
    });
    const result = await getStance(db, 'no-override-budget.html#staffing-cuts');
    expect(result.stance).toBe('agree');
    expect(result.note).toBe('This matches the Fin Com report.');
    expect(result.updated_at).toBeGreaterThan(0);
  });

  it('updates an existing stance in place', async () => {
    const db = await openStore();
    await setStance(db, 'section-a', { stance: 'agree', note: 'first' });
    await setStance(db, 'section-a', { stance: 'disagree', note: 'changed my mind' });
    const result = await getStance(db, 'section-a');
    expect(result.stance).toBe('disagree');
    expect(result.note).toBe('changed my mind');
  });

  it('lists all stored stances', async () => {
    const db = await openStore();
    await setStance(db, 'section-a', { stance: 'agree', note: '' });
    await setStance(db, 'section-b', { stance: 'disagree', note: '' });
    await setStance(db, 'section-c', { stance: 'alert', note: '' });
    const all = await getAllStances(db);
    expect(all.length).toBe(3);
    const ids = all.map(s => s.section_id).sort();
    expect(ids).toEqual(['section-a', 'section-b', 'section-c']);
  });

  it('clears a single stance', async () => {
    const db = await openStore();
    await setStance(db, 'section-a', { stance: 'agree', note: '' });
    await setStance(db, 'section-b', { stance: 'disagree', note: '' });
    await clearStance(db, 'section-a');
    expect(await getStance(db, 'section-a')).toBeNull();
    expect(await getStance(db, 'section-b')).not.toBeNull();
  });

  it('clears all stances', async () => {
    const db = await openStore();
    await setStance(db, 'section-a', { stance: 'agree', note: '' });
    await setStance(db, 'section-b', { stance: 'disagree', note: '' });
    await clearAllStances(db);
    expect((await getAllStances(db)).length).toBe(0);
  });
});
