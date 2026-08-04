import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toIdentity } from './identity.mjs';

const map = {
  'Board of Selectmen': 'Select Board',
  'Selectmen': 'Select Board',
  'FinCom': 'Finance Committee',
};

test('canonicalizes a known alias', () => {
  const id = toIdentity('Board of Selectmen', map);
  assert.deepEqual(id, { name: 'Select Board', email: 'select-board@marblehead.town' });
});

test('slugifies an unmapped sponsor deterministically', () => {
  const id = toIdentity('Recreation & Parks Commission', map);
  assert.equal(id.name, 'Recreation & Parks Commission');
  assert.equal(id.email, 'recreation-parks-commission@marblehead.town');
});

test('handles a named citizen petitioner', () => {
  const id = toIdentity('Citizen Petition (J. Buba et al.)', map);
  assert.equal(id.email, 'citizen-petition-j-buba-et-al@marblehead.town');
});
