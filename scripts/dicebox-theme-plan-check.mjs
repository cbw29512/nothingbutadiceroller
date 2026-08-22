import assert from 'node:assert/strict';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { replaceVisualFace } from '../js/appearance/face-customization.mjs';
import { buildAppearanceRenderPlan } from '../js/appearance/render-plan.mjs';
import {
  DICEBOX_BASE_MESH,
  DICEBOX_BASE_THEME,
  buildDiceBoxThemePlan,
} from '../js/appearance/dicebox-theme-plan.mjs';

let set = createUserDiceSet({ id: 'dicebox_theme', ownerId: 'owner', name: 'DiceBox Theme' });
set.appearance.diceSet.dice.d4.styleOverrides = { bodyColor: '#f97316' };
set.appearance.diceSet.dice.d20.styleOverrides = {
  bodyColor: '#ef4444', faceColor: '#a855f7',
  glow: { enabled: true, color: '#ffff00', intensity: 0.8 },
};
set = replaceVisualFace(set, 'd20', 20, { kind: 'icon', value: 'skull', color: '#a855f7' });
const renderPlan = buildAppearanceRenderPlan(set);
const themePlan = buildDiceBoxThemePlan(renderPlan);

assert.equal(themePlan.baseTheme, DICEBOX_BASE_THEME);
assert.equal(themePlan.dice.d20.geometry.meshFile, DICEBOX_BASE_MESH);
assert.equal(themePlan.dice.d20.geometry.meshPolicy, 'shared-canonical-immutable');
assert.equal(themePlan.dice.d20.geometry.colliderFaceMapPolicy, 'inherit-default-immutable');
assert.equal(themePlan.dice.d20.faces['20'].value, 'skull');
assert.equal(themePlan.dice.d20.material.bodyColor, '#ef4444');
assert.equal(themePlan.dice.d4.material.bodyColor, '#f97316');
assert.deepEqual(themePlan.diceAvailable, ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);

const physicsInjection = structuredClone(renderPlan);
physicsInjection.dice.d20.throwForce = 99;
assert.throws(() => buildDiceBoxThemePlan(physicsInjection), /mechanics field/);
const resultInjection = structuredClone(renderPlan);
resultInjection.result = 20;
assert.throws(() => buildDiceBoxThemePlan(resultInjection), /mechanics field/);
const wrongIdentity = structuredClone(renderPlan);
wrongIdentity.dice.d20.logicalDie = 'd6';
assert.throws(() => buildDiceBoxThemePlan(wrongIdentity), /canonical DiceBox geometry/);

console.log('DiceBox theme plan passed: default mesh/collider mapping immutable; only material and face artwork compile.');
