import assert from 'node:assert/strict';
import { RAW_2014, RAW_2024, RAW_CATALOGS, RAW_COVERAGE, assertCoverageMatchesCatalog, compileRawCatalogEntry, getRawCatalog, getRawSpell, validateRawCatalog } from '../js/shortcuts/index.mjs';

const EXPECTED_IDS = ['acid-splash', 'fire-bolt', 'ray-of-frost', 'burning-hands', 'shatter', 'fireball', 'ice-storm', 'cone-of-cold', 'disintegrate', 'finger-of-death', 'sunburst', 'meteor-swarm'];

function instance(ruleset, spellId, variantId, groupId = 'damage') {
  const entry = getRawSpell(ruleset, spellId);
  assert.ok(entry, `${ruleset} missing ${spellId}`);
  const plan = compileRawCatalogEntry(entry, { variantId });
  const group = plan.groups.find((candidate) => candidate.id === groupId);
  assert.ok(group, `${spellId}/${variantId} missing ${groupId}`);
  assert.equal(group.instances.length, 1);
  return group.instances[0];
}

function assertDice(ruleset, spellId, variantId, count, sides, modifier = 0, groupId = 'damage') {
  const result = instance(ruleset, spellId, variantId, groupId);
  assert.deepEqual(result.terms, [{ count, sides }]);
  assert.equal(result.modifier, modifier);
}

for (const [ruleset, catalog, srdVersion] of [
  ['dnd5e-2014', RAW_2014, '5.1'],
  ['dnd5e-2024', RAW_2024, '5.2.1'],
]) {
  assert.equal(Object.isFrozen(catalog), true);
  assert.equal(catalog.length, 12);
  assert.deepEqual(catalog.map((entry) => entry.spellId), EXPECTED_IDS);
  assert.equal(getRawCatalog(ruleset), catalog);
  assert.equal(RAW_CATALOGS[ruleset], catalog);
  assert.doesNotThrow(() => validateRawCatalog(catalog, { ruleset, srdVersion }));
  assert.doesNotThrow(() => assertCoverageMatchesCatalog(catalog, ruleset));
  assert.equal(RAW_COVERAGE.rulesets[ruleset].verifiedSpellIds.length, 12);

  for (const entry of catalog) {
    assert.equal(entry.ruleset, ruleset);
    assert.equal(entry.srdVersion, srdVersion);
    assert.deepEqual(entry.requiredInputs, []);
    assert.equal(getRawSpell(ruleset, entry.spellId), entry);
    for (const variant of entry.shortcut.variants) {
      assert.ok(variant.groups.length >= 1);
      assert.ok(variant.groups.every((group) => group.kind === 'damage'));
      assert.ok(variant.groups.every((group) => group.crit.policy === 'none'));
    }
  }

  assertDice(ruleset, 'acid-splash', 'tier-1', 1, 6);
  assertDice(ruleset, 'acid-splash', 'tier-4', 4, 6);
  assertDice(ruleset, 'fire-bolt', 'tier-4', 4, 10);
  assertDice(ruleset, 'ray-of-frost', 'tier-4', 4, 8);
  assertDice(ruleset, 'burning-hands', 'slot-1', 3, 6);
  assertDice(ruleset, 'burning-hands', 'slot-9', 11, 6);
  assertDice(ruleset, 'shatter', 'slot-2', 3, 8);
  assertDice(ruleset, 'shatter', 'slot-9', 10, 8);
  assertDice(ruleset, 'fireball', 'slot-3', 8, 6);
  assertDice(ruleset, 'fireball', 'slot-9', 14, 6);
  assertDice(ruleset, 'ice-storm', 'slot-4', 4, 6, 0, 'cold-damage');
  assertDice(ruleset, 'cone-of-cold', 'slot-5', 8, 8);
  assertDice(ruleset, 'cone-of-cold', 'slot-9', 12, 8);
  assertDice(ruleset, 'disintegrate', 'slot-6', 10, 6, 40);
  assertDice(ruleset, 'disintegrate', 'slot-9', 19, 6, 40);
  assertDice(ruleset, 'finger-of-death', 'base', 7, 8, 30);
  assertDice(ruleset, 'sunburst', 'base', 12, 6);
  assertDice(ruleset, 'meteor-swarm', 'base', 20, 6, 0, 'fire-damage');
  assertDice(ruleset, 'meteor-swarm', 'base', 20, 6, 0, 'bludgeoning-damage');
}

assertDice('dnd5e-2014', 'ice-storm', 'slot-4', 2, 8, 0, 'bludgeoning-damage');
assertDice('dnd5e-2014', 'ice-storm', 'slot-9', 7, 8, 0, 'bludgeoning-damage');
assertDice('dnd5e-2024', 'ice-storm', 'slot-4', 2, 10, 0, 'bludgeoning-damage');
assertDice('dnd5e-2024', 'ice-storm', 'slot-9', 7, 10, 0, 'bludgeoning-damage');
assert.equal(getRawSpell('dnd5e-2024', 'not-a-spell'), null);
assert.throws(() => getRawCatalog('not-a-ruleset'), /Unknown RAW ruleset/);

console.log('RAW catalog checks passed: 12 locked damage examples for SRD 5.1 and SRD 5.2.1.');

