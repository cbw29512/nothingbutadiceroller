import assert from 'node:assert/strict';
import {
  MAX_SHORTCUTS,
  ShortcutValidationError,
  applyCriticals,
  compileShortcut,
  createFlexShortcut,
  defineRawShortcut,
  getNextRollChangingVariantId,
  groupResolvedResults,
  validateShortcutCollection,
} from '../js/shortcuts/index.mjs';

function attackDefinition(source = 'raw') {
  const base = {
    schemaVersion: 1,
    source,
    id: source === 'raw' ? 'arcane-strike' : 'homebrew-strike',
    name: source === 'raw' ? 'Arcane Strike' : 'Homebrew Strike',
    icon: 'sword',
    category: 'attack',
    variants: [
      {
        id: 'base',
        label: 'Base',
        scaleRank: 0,
        groups: [
          {
            id: 'attack',
            label: 'Attack',
            kind: 'attack',
            repeat: 2,
            terms: [{ count: 1, sides: 20 }],
            modifier: 7,
            crit: { policy: 'none' },
          },
          {
            id: 'damage',
            label: 'Force damage',
            kind: 'damage',
            damageType: 'force',
            repeat: 2,
            terms: [{ count: 1, sides: 8 }],
            modifier: 4,
            crit: { policy: 'double-dice', triggerGroupId: 'attack' },
          },
        ],
      },
      {
        id: 'same-roll',
        label: 'Same roll',
        scaleRank: 1,
        groups: [
          {
            id: 'attack',
            label: 'Attack',
            kind: 'attack',
            repeat: 2,
            terms: [{ count: 1, sides: 20 }],
            modifier: 7,
            crit: { policy: 'none' },
          },
          {
            id: 'damage',
            label: 'Force damage',
            kind: 'damage',
            damageType: 'force',
            repeat: 2,
            terms: [{ count: 1, sides: 8 }],
            modifier: 4,
            crit: { policy: 'double-dice', triggerGroupId: 'attack' },
          },
        ],
      },
      {
        id: 'scaled',
        label: 'Scaled',
        scaleRank: 2,
        groups: [
          {
            id: 'attack',
            label: 'Attack',
            kind: 'attack',
            repeat: 2,
            terms: [{ count: 1, sides: 20 }],
            modifier: 7,
            crit: { policy: 'none' },
          },
          {
            id: 'damage',
            label: 'Force damage',
            kind: 'damage',
            damageType: 'force',
            repeat: 2,
            terms: [{ count: 2, sides: 8 }],
            modifier: 4,
            crit: { policy: 'double-dice', triggerGroupId: 'attack' },
          },
        ],
      },
    ],
  };
  if (source === 'raw') {
    base.ruleset = 'dnd5e-2024';
    base.sourceRef = 'SRD-compatible test fixture';
  }
  return base;
}

const rawInput = attackDefinition('raw');
const raw = defineRawShortcut(rawInput);
assert.equal(Object.isFrozen(raw), true);
assert.equal(Object.isFrozen(raw.variants[0].groups[0]), true);
rawInput.name = 'Mutated outside';
assert.equal(raw.name, 'Arcane Strike');

const flex = createFlexShortcut(attackDefinition('flex'));
assert.equal(flex.source, 'flex');
assert.equal(Object.isFrozen(flex), true);

assert.throws(
  () => createFlexShortcut({ ...attackDefinition('flex'), formula: 'eval(1+1)' }),
  (error) => error instanceof ShortcutValidationError && error.issues.some((issue) => issue.includes('formula is not allowed')),
);
assert.throws(
  () => createFlexShortcut({ ...attackDefinition('flex'), icon: 'https://example.com/icon.png' }),
  ShortcutValidationError,
);
assert.throws(
  () => createFlexShortcut({
    ...attackDefinition('flex'),
    variants: [{
      ...attackDefinition('flex').variants[0],
      groups: [{ ...attackDefinition('flex').variants[0].groups[0], terms: [{ count: 1, sides: 13 }] }],
    }],
  }),
  ShortcutValidationError,
);

const collection = Array.from({ length: MAX_SHORTCUTS }, (_, index) => createFlexShortcut({
  ...attackDefinition('flex'),
  id: `shortcut-${index + 1}`,
  name: `Shortcut ${index + 1}`,
}));
assert.doesNotThrow(() => validateShortcutCollection(collection));
assert.throws(() => validateShortcutCollection([...collection, { ...collection[0], id: 'shortcut-25' }]), ShortcutValidationError);

const basePlan = compileShortcut(raw, { variantId: 'base' });
assert.equal(basePlan.groups[0].instances.length, 2);
assert.equal(basePlan.groups[1].instances[1].crit.triggerInstanceId, 'attack:2');
assert.equal(Object.prototype.hasOwnProperty.call(basePlan, 'selectedDice'), false);
assert.equal(Object.isFrozen(basePlan), true);

assert.equal(getNextRollChangingVariantId(raw, 'base'), 'scaled');
assert.equal(getNextRollChangingVariantId(raw, 'scaled'), 'scaled');

const attackResults = [
  { instanceId: 'attack:1', dice: [{ sides: 20, values: [20] }] },
  { instanceId: 'attack:2', dice: [{ sides: 20, values: [11] }] },
];
const criticalPlan = applyCriticals(basePlan, attackResults);
assert.equal(criticalPlan.groups[1].instances[0].terms[0].count, 2);
assert.equal(criticalPlan.groups[1].instances[0].modifier, 4);
assert.equal(criticalPlan.groups[1].instances[0].critical, true);
assert.equal(criticalPlan.groups[1].instances[1].terms[0].count, 1);
assert.equal(basePlan.groups[1].instances[0].terms[0].count, 1);

const resolved = [
  { instanceId: 'attack:1', dice: [{ sides: 20, values: [20] }] },
  { instanceId: 'attack:2', dice: [{ sides: 20, values: [11] }] },
  { instanceId: 'damage:1', dice: [{ sides: 8, values: [5, 7] }] },
  { instanceId: 'damage:2', dice: [{ sides: 8, values: [3] }] },
];
const grouped = groupResolvedResults(criticalPlan, resolved);
assert.equal(grouped.groups[0].subtotal, 45);
assert.equal(grouped.groups[1].damageType, 'force');
assert.equal(grouped.groups[1].instances[0].total, 16);
assert.equal(grouped.groups[1].instances[1].total, 7);
assert.equal(grouped.totalsByKind.damage, 23);

assert.throws(
  () => groupResolvedResults(criticalPlan, resolved.filter((result) => result.instanceId !== 'damage:2')),
  /Missing resolved result/,
);
assert.throws(
  () => groupResolvedResults(criticalPlan, resolved.map((result) => result.instanceId === 'damage:2'
    ? { ...result, dice: [{ sides: 8, values: [9] }] }
    : result)),
  /Invalid d8 result/,
);

console.log('Shortcut domain checks passed.');
