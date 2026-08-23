import assert from 'node:assert/strict';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { buildAppearanceRenderPlan } from '../js/appearance/render-plan.mjs';
import { buildDiceBoxThemePlan } from '../js/appearance/dicebox-theme-plan.mjs';
import { buildDiceBoxRuntimeTheme } from '../js/appearance/dicebox-runtime-theme.mjs';
import { RUNTIME_THEME_VERSION, decodeRuntimeThemePayload, validateRuntimeThemePayload } from '../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeSvg } from '../js/appearance/runtime-theme-response.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';

const set = createUserDiceSet({ id: 'surface_contract', ownerId: 'owner', name: 'Surface Contract' });
set.appearance.diceSet.defaultStyle.finish = { type: 'metallic', accentColor: '#f59e0b', intensity: 0.8 };
set.appearance.diceSet.dice.d6.styleOverrides.finish = { type: 'pearl', accentColor: '#22d3ee', intensity: 0.65 };
assert.equal(validateDiceSet(set).ok, true);

const renderPlan = buildAppearanceRenderPlan(set);
assert.equal(renderPlan.dice.d20.style.finish.type, 'metallic');
assert.equal(renderPlan.dice.d6.style.finish.type, 'pearl');
assert.equal(renderPlan.dice.d6.style.finish.accentColor, '#22d3ee');

const themePlan = buildDiceBoxThemePlan(renderPlan);
assert.equal(themePlan.dice.d20.material.finish.type, 'metallic');
assert.equal(themePlan.dice.d6.material.finish.type, 'pearl');

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
assert.deepEqual(payload.f, ['metallic', '#f59e0b', 0.8]);
assert.equal(validateRuntimeThemePayload(payload).ok, true);
const svg = buildRuntimeThemeSvg(payload);
assert.match(svg, /surfaceMetallic/);
assert.match(svg.toLowerCase(), /#f59e0b/);

const legacyCompatible = createUserDiceSet({ id: 'legacy_finishless', ownerId: 'owner', name: 'Legacy Finishless' });
delete legacyCompatible.appearance.diceSet.defaultStyle.finish;
assert.equal(validateDiceSet(legacyCompatible).ok, true, 'Previously saved sets without finish fields must remain valid.');
assert.equal(buildAppearanceRenderPlan(legacyCompatible).dice.d20.style.finish.type, 'standard');

for (const type of ['standard', 'matte', 'satin', 'gloss', 'metallic', 'pearl']) {
  const candidate = structuredClone(payload);
  candidate.f = [type, '#ffffff', 0.5];
  assert.equal(validateRuntimeThemePayload(candidate).ok, true, `${type} must be a supported visual finish.`);
}

const invalidSet = structuredClone(set);
invalidSet.appearance.diceSet.defaultStyle.finish.type = 'mechanics-changing';
assert.equal(validateDiceSet(invalidSet).ok, false, 'Unknown finish presets must fail closed.');
const invalidRuntime = structuredClone(payload);
invalidRuntime.f[0] = 'mechanics-changing';
assert.equal(validateRuntimeThemePayload(invalidRuntime).ok, false, 'Unknown runtime finish presets must fail closed.');

console.log('Surface finish contract passed: six bounded finishes, set/per-die inheritance, runtime texture encoding, legacy compatibility, and fail-closed validation are protected.');
