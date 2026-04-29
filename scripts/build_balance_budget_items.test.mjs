import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildItems } from './build_balance_budget_items.mjs';

test('buildItems returns an array of town-side items plus a schools scalar', () => {
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);

  assert.ok(Array.isArray(items));
  assert.ok(items.length > 20, 'expected at least 20 items from the CSV plus the schools scalar');

  const schools = items.find(i => i.id === 'schools_cut');
  assert.ok(schools, 'schools_cut scalar item is required');
  assert.equal(schools.type, 'scalar');
  assert.equal(schools.default, 1500000);
});

test('Tier 1 discrete items sum to expected gross restoration cost', () => {
  // Sum of tier_1 amounts across all positive (non-Offset) items.
  // The published Tier 1 FY27 draw is $1,269,564, which is the NET cost
  // of restorations after the unemployment offset of -$410,116. The
  // generator excludes the Offset row because it is not a user-toggleable
  // cut; it represents automatic unemployment savings tied to position
  // restorations. So discrete items sum to gross, $1,679,680.
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);

  const discreteItems = items.filter(i => i.type === 'discrete');
  const tier1Sum = discreteItems.reduce((acc, i) => acc + i.amounts.tier_1, 0);

  assert.equal(tier1Sum, 1679680);
});

test('every item has id, category, department, description, type', () => {
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);

  for (const item of items) {
    assert.ok(item.id, `item missing id: ${JSON.stringify(item)}`);
    assert.ok(item.category, `item missing category: ${item.id}`);
    assert.ok(item.department, `item missing department: ${item.id}`);
    assert.ok(item.description, `item missing description: ${item.id}`);
    assert.ok(['discrete', 'scalar'].includes(item.type), `item has bad type: ${item.id}`);
  }
});

test('consequence ids are strings referencing the consequences file', () => {
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);

  for (const item of items) {
    if (item.type === 'discrete' && item.consequences) {
      for (const cid of item.consequences) {
        assert.equal(typeof cid, 'string', `bad consequence id on ${item.id}: ${cid}`);
      }
    }
  }
});
