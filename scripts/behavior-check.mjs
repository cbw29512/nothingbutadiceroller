import assert from 'node:assert/strict';
import { buildPhysicsNotation } from '../js/utils.js';
import { getCriticalOutcome, parseRollResults } from '../js/roll-results.js';
import { normalizeCustomSides, secureCustomRoll } from '../js/custom-roll.js';
import { canRollFromTray } from '../js/tray-controls.js';
import { formatNaturalRollFeedback, formatRollButtonLabel } from '../js/ui.js';

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

for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
  const type = `d${sides}`;
  const standard = buildPhysicsNotation([{ type }], 'normal');
  assert.deepEqual(standard.pool, [{ type }]);
  assert.deepEqual(standard.notation, [{ qty: 1, sides }]);
}

const mixedNotation = buildPhysicsNotation([
  { type: 'd20' },
  { type: 'd6' },
  { type: 'd6' },
  { type: 'd4' },
], 'normal');
assert.deepEqual(mixedNotation.notation, [
  { qty: 1, sides: 20 },
  { qty: 2, sides: 6 },
  { qty: 1, sides: 4 },
]);

const mixedStandard = parseRollResults([
  ...group([14], 20, 0),
  ...group([5, 2], 6, 1),
  ...group([3], 4, 2),
], 'normal');
assert.equal(mixedStandard.total, 24);
assert.deepEqual(mixedStandard.keptD20s, [14]);
assert.equal(getCriticalOutcome(
  [{ type: 'd20' }, { type: 'd6' }, { type: 'd6' }, { type: 'd4' }],
  'normal',
  mixedStandard.keptD20s,
), null);

const d100Result = parseRollResults(group([87], 100), 'normal');
assert.equal(d100Result.total, 87);
assert.equal(d100Result.breakdown, 'Base roll: d100 = 87');

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

assert.equal(formatNaturalRollFeedback('nat20'), '🎉 NATURAL 20! 🎉');
assert.equal(formatNaturalRollFeedback('nat1'), '💀 NATURAL 1! 💀');
assert.equal(formatNaturalRollFeedback('other'), '');

assert.equal(normalizeCustomSides(2), 2);
assert.equal(normalizeCustomSides(3), 3);
assert.equal(normalizeCustomSides('3'), 3);
assert.equal(normalizeCustomSides('d3'), 3);
assert.equal(normalizeCustomSides('D37'), 37);
assert.equal(normalizeCustomSides(' d1000000 '), 1_000_000);
assert.throws(() => normalizeCustomSides('d1'));
assert.throws(() => normalizeCustomSides('d1000001'));
assert.throws(() => normalizeCustomSides('d3.5'));
assert.throws(() => normalizeCustomSides('three'));

for (const sides of [2, 3, 37, 1_000_000]) {
  for (let index = 0; index < 64; index += 1) {
    const value = secureCustomRoll(sides);
    assert.ok(Number.isInteger(value));
    assert.ok(value >= 1 && value <= sides);
  }
}

assert.equal(canRollFromTray({
  physicsReady: true,
  rolling: false,
  selectedDice: [{ type: 'd20' }],
}), true);
assert.equal(canRollFromTray({ physicsReady: true, rolling: false, selectedDice: [] }), false);
assert.equal(canRollFromTray({
  physicsReady: false,
  rolling: false,
  selectedDice: [{ type: 'd20' }],
}), false);
assert.equal(canRollFromTray({
  physicsReady: true,
  rolling: true,
  selectedDice: [{ type: 'd20' }],
}), false);

assert.equal(formatRollButtonLabel([]), 'Roll Dice');
assert.equal(formatRollButtonLabel([
  { type: 'd4' },
  { type: 'd4' },
  { type: 'd4' },
]), 'Roll 3d4');
assert.equal(formatRollButtonLabel([
  { type: 'd20' },
  { type: 'd6' },
  { type: 'd20' },
]), 'Roll 2d20 + d6');

console.log(
  'Behavior checks passed: all seven standard dice, mixed pools/totals, d100, ADV/DIS, rules-neutral natural d20 feedback, multi-d20 gating, custom dN boundaries/ranges, tray roll eligibility, and dynamic roll labels.',
);
