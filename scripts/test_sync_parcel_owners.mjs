import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRow, parseCsv } from './sync_parcel_owners.mjs';

test('buildRow normalizes address and trims owner', () => {
  const r = buildRow({
    site_addr: ' 12 State St ',
    owner1: 'SMITH JOHN A  ',
    prop_id: '14 50 0',
    fy: '2025',
  });
  assert.equal(r.address_normalized, '12 STATE STREET');
  assert.equal(r.owner_name, 'SMITH JOHN A');
  assert.equal(r.parcel_id, '14 50 0');
  assert.equal(r.fy, 2025);
  assert.ok(typeof r.updated_at === 'number');
});

test('buildRow skips rows with missing address', () => {
  assert.equal(buildRow({ site_addr: '', owner1: 'X' }), null);
  assert.equal(buildRow({ owner1: 'X' }), null);
});

test('buildRow skips rows with missing owner', () => {
  assert.equal(buildRow({ site_addr: '12 State St', owner1: '' }), null);
});

test('parseCsv handles minimal header + row', () => {
  const csv = 'site_addr,owner1,prop_id,fy\n12 State St,SMITH JOHN,14 50 0,2025\n';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].site_addr, '12 State St');
  assert.equal(rows[0].owner1, 'SMITH JOHN');
});
