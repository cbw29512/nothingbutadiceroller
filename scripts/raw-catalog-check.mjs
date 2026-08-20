import assert from 'node:assert/strict';
import {
  RAW_2014,
  RAW_2024,
  RAW_CATALOGS,
  RAW_COVERAGE,
  assertCoverageMatchesCatalog,
  compileRawCatalogEntry,
  getRawCatalog,
  getRawSpell,
  validateRawCatalog,
} from '../js/shortcuts/index.mjs';

function group(entry, variantId, groupId, options = {}) {
  const plan = compileRawCatalogEntry(entry, { variantId, ...options });
  const found = plan.groups.find((candidate) => candidate.id === groupId);
  assert.ok(found, `${entry.spellId}/${variantId} missing group ${groupId}`);
  return { plan, group: found };
}

function term(entry, variantId, groupId, options = {}) {
  const result = group(entry, variantId, groupId, options);
  assert.equal(result.group.instances.length > 0, true);
  assert.equal(result.group.instances[0].terms.length, 1);
  return { ...result, instance: result.group.instances[0], term: result.group.instances[0].terms[0] };
}

function assertDie(entry, variantId, groupId, count, sides, modifier = 0, options = {}) {
  const { instance, term: dice } = term(entry, variantId, groupId, options);
  assert.deepEqual({ count: dice.count, sides: dice.sides, modifier: instance.modifier }, { count, sides, modifier });
}

for (const [ruleset, catalog, srdVersion] of [
  ['dnd5e-2014', RAW_2014, '5.1'],
  ['dnd5e-2024', RAW_2024, '5.2.1'],
]) {
  assert.equal(Object.isFrozen(catalog), true);
  assert.equal(catalog.length, 8);
  assert.equal(getRawCatalog(ruleset), catalog);
  assert.equal(RAW_CATALOGS[ruleset], catalog);
  assert.doesNotThrow(() => validateRawCatalog(catalog, { ruleset, srdVersion }));
  assert.doesNotThrow(() => assertCoverageMatchesCatalog(catalog, ruleset));
  assert.equal(RAW_COVERAGE.rulesets[ruleset].srdVersion, srdVersion);
  assert.equal(RAW_COVERAGE.rulesets[ruleset].verifiedSpellIds.length, catalog.length);

  const seen = new Set();
  for (const entry of catalog) {
    assert.equal(entry.ruleset, ruleset);
    assert.equal(entry.srdVersion, srdVersion);
    assert.equal(entry.shortcut.ruleset, ruleset);
    assert.match(entry.shortcut.sourceRef, new RegExp(`SRD ${srdVersion.replaceAll('.', '\\.')}`));
    assert.match(entry.sourceLocator, new RegExp(`SRD ${srdVersion.replaceAll('.', '\\.')}`));
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(entry.shortcut), true);
    assert.equal(seen.has(entry.spellId), false);
    seen.add(entry.spellId);
    assert.equal(getRawSpell(ruleset, entry.spellId), entry);
  }
}

assert.equal(RAW_COVERAGE.exhaustive, false);
assert.equal(RAW_COVERAGE.deferredPatterns.length >= 4, true);
assert.equal(getRawSpell('dnd5e-2024', 'not-a-spell'), null);
assert.throws(() => getRawCatalog('not-a-ruleset'), /Unknown RAW ruleset/);

for (const ruleset of ['dnd5e-2014', 'dnd5e-2024']) {
  const acidArrow = getRawSpell(ruleset, 'acid-arrow');
  assertDie(acidArrow, 'slot-2', 'initial-damage', 4, 4, 0, { inputs: { toHit: 9 } });
  assertDie(acidArrow, 'slot-2', 'later-damage', 2, 4, 0, { inputs: { toHit: 9 } });
  assertDie(acidArrow, 'slot-9', 'initial-damage', 11, 4, 0, { inputs: { toHit: 9 } });
  assertDie(acidArrow, 'slot-9', 'later-damage', 9, 4, 0, { inputs: { toHit: 9 } });
  const acidAttack = term(acidArrow, 'slot-2', 'attack', { inputs: { toHit: 9 } });
  assert.deepEqual({ count: acidAttack.term.count, sides: acidAttack.term.sides, modifier: acidAttack.instance.modifier }, { count: 1, sides: 20, modifier: 9 });
  assert.equal(acidArrow.shortcut.variants[0].groups.find((candidate) => candidate.id === 'attack').modifier, 0);
  assert.equal(acidArrow.shortcut.variants[0].groups.find((candidate) => candidate.id === 'initial-damage').crit.policy, 'double-dice');
  assert.equal(acidArrow.shortcut.variants[0].groups.find((candidate) => candidate.id === 'later-damage').crit.policy, 'none');
  assert.throws(() => compileRawCatalogEntry(acidArrow, { variantId: 'slot-2' }), /requires toHit/);
  assert.throws(() => compileRawCatalogEntry(acidArrow, { variantId: 'slot-2', inputs: { toHit: 9, spellSaveDc: 17 } }), /is not allowed/);

  const acidSplash = getRawSpell(ruleset, 'acid-splash');
  [1, 2, 3, 4].forEach((count, index) => assertDie(acidSplash, `tier-${index + 1}`, 'damage', count, 6));
  assert.deepEqual(acidSplash.shortcut.variants.map((variant) => variant.label), ['Levels 1–4', 'Levels 5–10', 'Levels 11–16', 'Levels 17+']);

  const fireBolt = getRawSpell(ruleset, 'fire-bolt');
  [1, 2, 3, 4].forEach((count, index) => {
    assertDie(fireBolt, `tier-${index + 1}`, 'damage', count, 10, 0, { inputs: { toHit: 9 } });
    const attack = term(fireBolt, `tier-${index + 1}`, 'attack', { inputs: { toHit: 9 } });
    assert.equal(attack.instance.modifier, 9);
  });
  assert.equal(fireBolt.shortcut.variants[0].groups.find((candidate) => candidate.id === 'damage').crit.policy, 'double-dice');
  assert.equal(fireBolt.shortcut.variants[0].groups.find((candidate) => candidate.id === 'attack').modifier, 0);

  const fireball = getRawSpell(ruleset, 'fireball');
  assertDie(fireball, 'slot-3', 'damage', 8, 6);
  assertDie(fireball, 'slot-9', 'damage', 14, 6);
  assert.equal(fireball.shortcut.variants.length, 7);
  assert.deepEqual(fireball.requiredInputs, []);

  const magicMissile = getRawSpell(ruleset, 'magic-missile');
  const mm1 = group(magicMissile, 'slot-1', 'dart-damage').group;
  const mm9 = group(magicMissile, 'slot-9', 'dart-damage').group;
  assert.equal(mm1.instances.length, 3);
  assert.equal(mm9.instances.length, 11);
  assert.deepEqual(mm1.instances[0].terms[0], { count: 1, sides: 4 });
  assert.equal(mm1.instances[0].modifier, 1);
  assert.equal(mm9.instances[10].modifier, 1);

  const scorchingRay = getRawSpell(ruleset, 'scorching-ray');
  const ray2 = compileRawCatalogEntry(scorchingRay, { variantId: 'slot-2', inputs: { toHit: 8 } });
  const ray9 = compileRawCatalogEntry(scorchingRay, { variantId: 'slot-9', inputs: { toHit: 8 } });
  assert.equal(ray2.groups.find((candidate) => candidate.id === 'attack').instances.length, 3);
  assert.equal(ray2.groups.find((candidate) => candidate.id === 'ray-damage').instances.length, 3);
  assert.equal(ray9.groups.find((candidate) => candidate.id === 'attack').instances.length, 10);
  assert.equal(ray9.groups.find((candidate) => candidate.id === 'ray-damage').instances.length, 10);
  assert.equal(ray9.groups.find((candidate) => candidate.id === 'attack').instances[9].modifier, 8);
  assert.deepEqual(ray9.groups.find((candidate) => candidate.id === 'ray-damage').instances[9].terms[0], { count: 2, sides: 6 });
  assert.equal(ray9.groups.find((candidate) => candidate.id === 'ray-damage').instances[9].crit.triggerInstanceId, 'attack:10');

  const disintegrate = getRawSpell(ruleset, 'disintegrate');
  assertDie(disintegrate, 'slot-6', 'damage', 10, 6, 40);
  assertDie(disintegrate, 'slot-9', 'damage', 19, 6, 40);

  const harm = getRawSpell(ruleset, 'harm');
  assert.equal(harm.scalingMode, 'fixed');
  assert.equal(harm.shortcut.variants.length, 1);
  assertDie(harm, 'base', 'damage', 14, 6);
}

const ids2014 = RAW_2014.map((entry) => entry.spellId).sort();
const ids2024 = RAW_2024.map((entry) => entry.spellId).sort();
assert.deepEqual(ids2014, ids2024);

console.log(`RAW catalog checks passed: ${RAW_2014.length} SRD 5.1 + ${RAW_2024.length} SRD 5.2.1 verified spell records.`);
