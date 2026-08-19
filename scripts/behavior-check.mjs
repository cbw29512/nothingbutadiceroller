import assert from 'node:assert/strict';
import { buildPhysicsNotation } from '../js/utils.js';
import { getCriticalOutcome, parseRollResults } from '../js/roll-results.js';

function group(values, sides = 20, id = 0) {
  return [{
    id,
    qty: values.length,
    sides,
    rolls: values.map((value, rollId) => ({
      groupId: id,
      rollId,
      sides,
      value,
    })),
  }];
}

const advantageNotation = buildPhysicsNotation([], 'advantage');
assert.deepEqual(advantageNotation.pool, [{ type: 'd20' }]);
assert.deepEqual(advantageNotation.notation, [{ qty: 2, sides: 20 }]);

const advantage = parseRollResults(group([1, 20]), 'advantage');
assert.equal(advantage.total, 20);
assert.deepEqual(advantage.keptD20s, [20]);
assert.equal(getCriticalOutcome([{ type: 'd20' }], 'advantage', advantage.keptD20s), 'nat20');

const disadvantage = parseRollResults(group([1, 20]), 'disadvantage');
assert.equal(disadvantage.total, 1);
assert.deepEqual(disadvantage.keptD20s, [1]);
assert.equal(getCriticalOutcome([{ type: 'd20' }], 'disadvantage', disadvantage.keptD20s), 'nat1');

const mixedNat20 = parseRollResults([
  ...group([20]),
  ...group([4], 6, 1),
  ...group([7, 3], 8, 2),
], 'normal');
assert.equal(getCriticalOutcome(
  [{ type: 'd20' }, { type: 'd6' }, { type: 'd8' }, { type: 'd8' }],
  'normal',
  mixedNat20.keptD20s,
), 'nat20');

const mixedNat1 = parseRollResults([
  ...group([1]),
  ...group([5], 12, 1),
], 'normal');
assert.equal(getCriticalOutcome(
  [{ type: 'd20' }, { type: 'd12' }],
  'normal',
  mixedNat1.keptD20s,
), 'nat1');

const multipleD20s = parseRollResults([{ id: 0, qty: 3, sides: 20, rolls: [
  { groupId: 0, rollId: 0, sides: 20, value: 20 },
  { groupId: 0, rollId: 1, sides: 20, value: 7 },
  { groupId: 0, rollId: 2, sides: 20, value: 1 },
] }], 'normal');
assert.equal(getCriticalOutcome(
  [{ type: 'd20' }, { type: 'd20' }, { type: 'd20' }, { type: 'd6' }],
  'normal',
  multipleD20s.keptD20s,
), null);

console.log('Behavior checks passed: ADV/DIS, kept-d20 criticals, mixed pools, and multi-d20 gating.');
