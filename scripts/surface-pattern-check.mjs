import assert from 'node:assert/strict';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { buildAppearanceRenderPlan } from '../js/appearance/render-plan.mjs';
import { buildDiceBoxThemePlan } from '../js/appearance/dicebox-theme-plan.mjs';
import { buildDiceBoxRuntimeTheme } from '../js/appearance/dicebox-runtime-theme.mjs';
import { RUNTIME_THEME_VERSION, decodeRuntimeThemePayload, validateRuntimeThemePayload } from '../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeSvg } from '../js/appearance/runtime-theme-response.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';

const set = createUserDiceSet({ id: 'pattern_contract', ownerId: 'owner', name: 'Pattern Contract' });
set.appearance.diceSet.defaultStyle.pattern = {
  type: 'marble', primaryColor: '#f8fafc', secondaryColor: '#7c3aed', intensity: 0.7, scale: 0.6,
};
set.appearance.diceSet.dice.d6.styleOverrides.pattern = {
  type: 'speckle', primaryColor: '#22d3ee', secondaryColor: '#0f172a', intensity: 0.65, scale: 0.4,
};
assert.equal(validateDiceSet(set).ok, true);

const renderPlan = buildAppearanceRenderPlan(set);
assert.equal(renderPlan.dice.d20.style.pattern.type, 'marble');
assert.equal(renderPlan.dice.d6.style.pattern.type, 'speckle');
assert.equal(renderPlan.dice.d6.style.pattern.primaryColor, '#22d3ee');

const themePlan = buildDiceBoxThemePlan(renderPlan);
assert.equal(themePlan.dice.d20.material.pattern.type, 'marble');
assert.equal(themePlan.dice.d6.material.pattern.type, 'speckle');
for (const forbidden of ['result', 'rng', 'roll', 'gravity', 'mass', 'friction']) {
  assert.equal(forbidden in themePlan.dice.d20.material.pattern, false, `Pattern state must never contain mechanics key ${forbidden}.`);
}

const glyphPlan = {
  commands: [{
    dieType: 'd20',
    logicalResult: 20,
    strategy: 'centered-region',
    text: '20',
    color: '#ffffff',
    fontId: null,
    region: { minU: 0, minV: 0, maxU: 1, maxV: 1, centerU: 0.5, centerV: 0.5 },
  }],
};
const runtime = buildDiceBoxRuntimeTheme(glyphPlan, themePlan, 'd20');
const payload = decodeRuntimeThemePayload(runtime.token);
assert.equal(payload.v, RUNTIME_THEME_VERSION);
assert.deepEqual(payload.p, ['marble', '#f8fafc', '#7c3aed', 0.7, 0.6]);
assert.equal(validateRuntimeThemePayload(payload).ok, true);
const svgA = buildRuntimeThemeSvg(payload);
const svgB = buildRuntimeThemeSvg(payload);
assert.equal(svgA, svgB, 'Pattern artwork must be deterministic for identical visual settings.');
assert.match(svgA, /patternMarble/);
assert.match(svgA.toLowerCase(), /#7c3aed/);

const legacyCompatible = createUserDiceSet({ id: 'legacy_patternless', ownerId: 'owner', name: 'Legacy Patternless' });
delete legacyCompatible.appearance.diceSet.defaultStyle.pattern;
assert.equal(validateDiceSet(legacyCompatible).ok, true, 'Previously saved sets without pattern fields must remain valid.');
assert.equal(buildAppearanceRenderPlan(legacyCompatible).dice.d20.style.pattern.type, 'none');

for (const type of ['none', 'marble', 'swirl', 'speckle', 'split']) {
  const candidate = structuredClone(payload);
  candidate.p = [type, '#ffffff', '#000000', 0.5, 0.5];
  assert.equal(validateRuntimeThemePayload(candidate).ok, true, `${type} must be a supported visual pattern.`);
}

const invalidSet = structuredClone(set);
invalidSet.appearance.diceSet.defaultStyle.pattern.type = 'physics-rig';
assert.equal(validateDiceSet(invalidSet).ok, false, 'Unknown pattern presets must fail closed.');
const invalidRuntime = structuredClone(payload);
invalidRuntime.p[0] = 'physics-rig';
assert.equal(validateRuntimeThemePayload(invalidRuntime).ok, false, 'Unknown runtime pattern presets must fail closed.');

console.log('Surface pattern contract passed: five bounded patterns, set/per-die inheritance, deterministic runtime artwork, legacy compatibility, mechanics isolation, and fail-closed validation are protected.');
