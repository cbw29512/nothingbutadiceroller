import assert from 'node:assert/strict';
import { buildPhysicsNotation } from '../js/utils.js';
import { getCriticalOutcome, parseRollResults } from '../js/roll-results.js';

function group(values, sides = 20) {
  return [{
    id: 0,
    qty: values.length,
    sides,
    rolls: values.map((value, rollId) => ({
      groupId: 0,
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
assert.equal(
  getCriticalOutcome([{ type: 'd20' }], 'advantage', advantage.keptD20s),
  'nat20',
);

const disadvantage = parseRollResults(group([1, 20]), 'disadvantage');
assert.equal(disadvantage.total, 1);
assert.deepEqual(disadvantage.keptD20s, [1]);
assert.equal(
  getCriticalOutcome([{ type: 'd20' }], 'disadvantage', disadvantage.keptD20s),
  'nat1',
);

const advantageNoCrit = parseRollResults(group([1, 2]), 'advantage');
assert.equal(getCriticalOutcome(
  [{ type: 'd20' }],
  'advantage',
  advantageNoCrit.keptD20s,
), null);

const singleD20 = parseRollResults(group([20]), 'normal');
assert.equal(getCriticalOutcome(
  [{ type: 'd20' }],
  'normal',
  singleD20.keptD20s,
), 'nat20');

const mixedPool = parseRollResults([
  ...group([20]),
  { id: 1, qty: 1, sides: 6, rolls: [{ groupId: 1, rollId: 0, sides: 6, value: 4 }] },
], 'normal');
assert.equal(getCriticalOutcome(
  [{ type: 'd20' }, { type: 'd6' }],
  'normal',
  mixedPool.keptD20s,
), null);

const multipleD20s = parseRollResults([{ id: 0, qty: 2, sides: 20, rolls: [
  { groupId: 0, rollId: 0, sides: 20, value: 20 },
  { groupId: 0, rollId: 1, sides: 20, value: 7 },
] }], 'normal');
assert.equal(getCriticalOutcome(
  [{ type: 'd20' }, { type: 'd20' }],
  'normal',
  multipleD20s.keptD20s,
), null);

console.log('Behavior checks passed: ADV/DIS, kept-d20 critical rules, and single-d20 gating.');
