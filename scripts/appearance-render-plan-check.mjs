import assert from 'node:assert/strict';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { replaceVisualFace } from '../js/appearance/face-customization.mjs';
import { buildAppearanceRenderPlan } from '../js/appearance/render-plan.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';

let set = createUserDiceSet({ id: 'render_test', ownerId: 'owner', name: 'Render Test' });
set.appearance.diceSet.dice.d4.styleOverrides = { bodyColor: '#f97316' };
set.appearance.diceSet.dice.d20.styleOverrides = {
  bodyColor: '#ef4444', faceColor: '#a855f7',
  glow: { enabled: true, color: '#ffff00', intensity: 0.8 },
};
set.appearance.tray.color = '#050505';
set = replaceVisualFace(set, 'd20', 20, { kind: 'text', value: '☠', color: '#a855f7' });
const plan = buildAppearanceRenderPlan(set);
assert.equal(plan.dice.d4.style.bodyColor, '#f97316');
assert.equal(plan.dice.d4.logicalDie, 'd4');
assert.equal(plan.dice.d20.style.glow.color, '#ffff00');
assert.equal(plan.dice.d20.faces['20'].value, '☠');
assert.equal(plan.tray.color, '#050505');

const forbiddenKeys = new Set(['notation', 'result', 'results', 'rng', 'random', 'advantage', 'disadvantage', 'critical', 'crit', 'roll']);
function inspect(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(forbiddenKeys.has(key.toLowerCase()), false, `Render plan must not carry mechanics field: ${key}`);
    inspect(child);
  }
}
inspect(plan);

const injected = structuredClone(set);
injected.appearance.diceSet.dice.d20.styleOverrides.throwForce = 99;
assert.equal(validateDiceSet(injected).ok, false, 'Per-die style overrides cannot inject physics configuration.');
console.log('Appearance render plan passed: per-die visuals supported; roll mechanics and physics configuration excluded.');
