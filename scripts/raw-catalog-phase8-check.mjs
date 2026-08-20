import assert from 'node:assert/strict';
import { RAW_2014, RAW_2024, getRawSpell } from '../js/shortcuts/index.mjs';

const expectedLevels = [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
for (const catalog of [RAW_2014, RAW_2024]) {
  assert.equal(catalog.length, 12);
  assert.deepEqual(catalog.map((entry) => entry.spellLevel), expectedLevels);
}
assert.deepEqual(RAW_2014.map((entry) => entry.spellId), RAW_2024.map((entry) => entry.spellId));
assert.equal(getRawSpell('dnd5e-2014', 'ice-storm').srdVersion, '5.1');
assert.equal(getRawSpell('dnd5e-2024', 'ice-storm').srdVersion, '5.2.1');

console.log('Curated RAW selection checks passed: matching cantrips and one spell per level.');

