import assert from 'node:assert/strict';
import { buildPhysicsNotation } from '../js/utils.js';
import { buildExternalThemeMap, decorateDiceBoxNotation } from '../js/appearance/dicebox-visual-adapter.mjs';

const runtimeThemes = {
  d20: { themeName: 'ndr_d20_test', basePath: '/api/dice-theme/token20', themeColor: '#ef4444' },
  d6: { themeName: 'ndr_d6_test', basePath: '/api/dice-theme/token6', themeColor: '#f97316' },
  d100: { themeName: 'ndr_d100_test', basePath: '/api/dice-theme/token100', themeColor: '#7c3aed' },
};

function assertVisualOnly(notation, label) {
  const original = structuredClone(notation);
  const decorated = decorateDiceBoxNotation(notation, runtimeThemes);
  const stripped = decorated.map(({ theme, themeColor, ...mechanics }) => mechanics);
  assert.deepEqual(notation, original, `${label}: visual decoration must not mutate original notation.`);
  assert.deepEqual(stripped, original, `${label}: removing visual fields must reproduce notation exactly.`);
  for (const group of decorated) {
    for (const forbidden of ['gravity', 'throwForce', 'spinForce', 'result', 'critical', 'advantage', 'disadvantage']) {
      assert.equal(forbidden in group, false, `${label}: ${forbidden} must never be introduced by appearance.`);
    }
  }
  return decorated;
}

const normal = buildPhysicsNotation([
  { type: 'd20' }, { type: 'd6' }, { type: 'd6' }, { type: 'd100' },
], 'normal').notation;
const normalDecorated = assertVisualOnly(normal, 'normal mixed roll');
assert.deepEqual(normal, [
  { qty: 1, sides: 20 }, { qty: 2, sides: 6 }, { qty: 1, sides: 100 },
]);
assert.equal(normalDecorated[0].theme, 'ndr_d20_test');
assert.equal(normalDecorated[1].theme, 'ndr_d6_test');
assert.equal(normalDecorated[2].theme, 'ndr_d100_test');

const advantage = buildPhysicsNotation([{ type: 'd20' }, { type: 'd6' }], 'advantage').notation;
const advantageDecorated = assertVisualOnly(advantage, 'advantage roll');
assert.deepEqual(advantage, [{ qty: 2, sides: 20 }, { qty: 1, sides: 6 }]);
assert.equal(advantageDecorated[0].qty, 2, 'ADV still rolls two physical d20s.');

const disadvantage = buildPhysicsNotation([{ type: 'd20' }], 'disadvantage').notation;
const disadvantageDecorated = assertVisualOnly(disadvantage, 'disadvantage roll');
assert.deepEqual(disadvantage, [{ qty: 2, sides: 20 }]);
assert.equal(disadvantageDecorated[0].qty, 2, 'DIS still rolls two physical d20s.');

const unsupported = [{ qty: 1, sides: 37, data: { source: 'existing-roll' } }];
const unsupportedDecorated = assertVisualOnly(unsupported, 'unsupported custom-range roll');
assert.equal('theme' in unsupportedDecorated[0], false, 'Unsupported custom-range dice stay on their existing path.');
assert.equal('themeColor' in unsupportedDecorated[0], false);
assert.deepEqual(unsupportedDecorated[0].data, { source: 'existing-roll' });

assert.deepEqual(buildExternalThemeMap(runtimeThemes), {
  ndr_d20_test: '/api/dice-theme/token20',
  ndr_d6_test: '/api/dice-theme/token6',
  ndr_d100_test: '/api/dice-theme/token100',
});

console.log('DiceBox visual adapter passed against real roller notation: normal, ADV/DIS, d100, mixed pools, and custom-range rolls keep mechanics unchanged.');
