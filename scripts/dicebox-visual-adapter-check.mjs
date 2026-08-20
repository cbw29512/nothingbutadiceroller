import assert from 'node:assert/strict';
import { buildExternalThemeMap, decorateDiceBoxNotation } from '../js/appearance/dicebox-visual-adapter.mjs';

const notation = [
  { qty: 2, sides: 20 },
  { qty: 3, sides: 6, data: { source: 'existing-roll' } },
  { qty: 1, sides: 37 },
];
const original = structuredClone(notation);
const runtimeThemes = {
  d20: { themeName: 'ndr_d20_test', basePath: '/api/dice-theme/token20', themeColor: '#ef4444' },
  d6: { themeName: 'ndr_d6_test', basePath: '/api/dice-theme/token6', themeColor: '#f97316' },
};
const decorated = decorateDiceBoxNotation(notation, runtimeThemes);
const stripped = decorated.map(({ theme, themeColor, ...mechanics }) => mechanics);

assert.deepEqual(notation, original, 'Visual decoration must not mutate the original notation.');
assert.deepEqual(stripped, original, 'Removing theme fields must reproduce the original notation exactly.');
assert.equal(decorated[0].theme, 'ndr_d20_test');
assert.equal(decorated[0].themeColor, '#ef4444');
assert.equal(decorated[1].qty, 3);
assert.equal(decorated[1].sides, 6);
assert.deepEqual(decorated[1].data, { source: 'existing-roll' });
assert.equal('theme' in decorated[2], false, 'Unsupported custom range dice must stay on their existing roll path.');
assert.equal('themeColor' in decorated[2], false);
assert.deepEqual(buildExternalThemeMap(runtimeThemes), {
  ndr_d20_test: '/api/dice-theme/token20',
  ndr_d6_test: '/api/dice-theme/token6',
});
for (const group of decorated) {
  for (const forbidden of ['gravity', 'throwForce', 'spinForce', 'result', 'critical', 'advantage', 'disadvantage']) {
    assert.equal(forbidden in group, false, `${forbidden} must never be introduced by the appearance adapter.`);
  }
}
console.log('DiceBox visual adapter passed: only theme/themeColor are added; all original roll mechanics remain byte-for-byte equivalent.');
