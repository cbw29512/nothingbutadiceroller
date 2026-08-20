import assert from 'node:assert/strict';
import {
  RAW_2014,
  RAW_2024,
  compileRawCatalogEntry,
  getRawSpell,
} from '../js/shortcuts/index.mjs';

const EXPECTED_PHASE8_IDS = Object.freeze([
  'burning-hands',
  'guiding-bolt',
  'lightning-bolt',
  'ray-of-frost',
  'shatter',
  'thunderwave',
]);

function group(ruleset, spellId, variantId, groupId, options = {}) {
  const entry = getRawSpell(ruleset, spellId);
  assert.ok(entry, `${ruleset} missing ${spellId}`);
  const plan = compileRawCatalogEntry(entry, { variantId, ...options });
  const found = plan.groups.find((candidate) => candidate.id === groupId);
  assert.ok(found, `${ruleset}/${spellId}/${variantId} missing ${groupId}`);
  return found;
}

function assertDice(ruleset, spellId, variantId, count, sides, {
  groupId = 'damage',
  modifier = 0,
  toHit,
} = {}) {
  const options = toHit === undefined ? {} : { inputs: { toHit } };
  const found = group(ruleset, spellId, variantId, groupId, options);
  assert.equal(found.instances.length, 1);
  const instance = found.instances[0];
  assert.deepEqual(instance.terms, [{ count, sides }]);
  assert.equal(instance.modifier, modifier);
  return instance;
}

for (const [ruleset, catalog] of [
  ['dnd5e-2014', RAW_2014],
  ['dnd5e-2024', RAW_2024],
]) {
  assert.equal(catalog.length, 14);

  for (const spellId of EXPECTED_PHASE8_IDS) {
    assert.ok(getRawSpell(ruleset, spellId), `${ruleset} missing Phase 8 spell ${spellId}`);
  }

  assertDice(ruleset, 'burning-hands', 'slot-1', 3, 6);
  assertDice(ruleset, 'burning-hands', 'slot-9', 11, 6);

  const guidingDamage = assertDice(ruleset, 'guiding-bolt', 'slot-1', 4, 6);
  assert.equal(guidingDamage.crit.policy, 'none');
  assertDice(ruleset, 'guiding-bolt', 'slot-9', 12, 6);
  assert.deepEqual(getRawSpell(ruleset, 'guiding-bolt').requiredInputs, []);

  assertDice(ruleset, 'lightning-bolt', 'slot-3', 8, 6);
  assertDice(ruleset, 'lightning-bolt', 'slot-9', 14, 6);

  [1, 2, 3, 4].forEach((count, index) => {
    const variantId = `tier-${index + 1}`;
    const damage = assertDice(ruleset, 'ray-of-frost', variantId, count, 8);
    assert.equal(damage.crit.policy, 'none');
  });

  assertDice(ruleset, 'shatter', 'slot-2', 3, 8);
  assertDice(ruleset, 'shatter', 'slot-9', 10, 8);

  assertDice(ruleset, 'thunderwave', 'slot-1', 2, 8);
  assertDice(ruleset, 'thunderwave', 'slot-9', 10, 8);
}

const ids2014 = EXPECTED_PHASE8_IDS.map((id) => getRawSpell('dnd5e-2014', id)?.spellId);
const ids2024 = EXPECTED_PHASE8_IDS.map((id) => getRawSpell('dnd5e-2024', id)?.spellId);
assert.deepEqual(ids2014, EXPECTED_PHASE8_IDS);
assert.deepEqual(ids2024, EXPECTED_PHASE8_IDS);

console.log('Phase 8 RAW catalog expansion checks passed: 6 additional verified spells per ruleset.');
