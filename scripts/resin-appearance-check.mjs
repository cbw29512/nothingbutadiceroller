import assert from 'node:assert/strict';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { buildAppearanceRenderPlan } from '../js/appearance/render-plan.mjs';
import { buildDiceBoxThemePlan } from '../js/appearance/dicebox-theme-plan.mjs';
import { RUNTIME_THEME_VERSION, encodeRuntimeThemePayload, validateRuntimeThemePayload } from '../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeConfig, buildRuntimeThemeSvg } from '../js/appearance/runtime-theme-response.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';

const set = createUserDiceSet({ id: 'resin_contract', ownerId: 'owner', name: 'Resin Contract' });
set.appearance.diceSet.defaultStyle.translucency = { enabled: true, opacity: 0.65, frost: 0.1, tintColor: '#8b5cf6' };
set.appearance.diceSet.defaultStyle.interior = {
  enabled: true, type: 'nebula', primaryColor: '#7c3aed', secondaryColor: '#22d3ee', density: 0.7, intensity: 0.8,
};
set.appearance.diceSet.dice.d6.styleOverrides = {
  ...structuredClone(set.appearance.diceSet.defaultStyle),
  bodyColor: '#14532d',
  translucency: { enabled: true, opacity: 0.55, frost: 0, tintColor: '#16a34a' },
  interior: { enabled: true, type: 'bubbles', primaryColor: '#dcfce7', secondaryColor: '#4ade80', density: 0.5, intensity: 0.65 },
};
assert.equal(validateDiceSet(set).ok, true);
const renderPlan = buildAppearanceRenderPlan(set);
assert.equal(renderPlan.dice.d20.style.translucency.enabled, true);
assert.equal(renderPlan.dice.d20.style.interior.type, 'nebula');
assert.equal(renderPlan.dice.d6.style.interior.type, 'bubbles');
assert.equal(renderPlan.dice.d6.style.translucency.opacity, 0.55);
const themePlan = buildDiceBoxThemePlan(renderPlan);
assert.equal(themePlan.dice.d20.material.interior.type, 'nebula');
assert.equal(themePlan.dice.d6.material.translucency.tintColor, '#16a34a');

const legacyCompatible = createUserDiceSet({ id: 'legacy_resinless', ownerId: 'owner', name: 'Legacy Resinless' });
delete legacyCompatible.appearance.diceSet.defaultStyle.translucency;
delete legacyCompatible.appearance.diceSet.defaultStyle.interior;
assert.equal(validateDiceSet(legacyCompatible).ok, true, 'Previously saved sets without resin fields must remain valid.');
const normalizedLegacy = buildAppearanceRenderPlan(legacyCompatible).dice.d20.style;
assert.equal(normalizedLegacy.translucency.enabled, false);
assert.equal(normalizedLegacy.interior.type, 'none');

const payload = {
  v: RUNTIME_THEME_VERSION,
  d: 'd20',
  s: 1024,
  o: [['20', '#ffffff', '', 512, 512, 64]],
  g: [false, '#ffffff', 0],
  r: [true, 0.65, 0.1, '#8b5cf6', true, 'nebula', '#7c3aed', '#22d3ee', 0.7, 0.8],
  f: ['standard', '#ffffff', 0.55],
};
assert.equal(validateRuntimeThemePayload(payload).ok, true);
assert.ok(encodeRuntimeThemePayload(payload).length < 6000);
const svgA = buildRuntimeThemeSvg(payload);
const svgB = buildRuntimeThemeSvg(payload);
assert.equal(svgA, svgB, 'Interior artwork must be deterministic for the same visual settings.');
assert.ok(svgA.includes('resinSheen'));
assert.ok(svgA.includes('interiorBlur'));
assert.ok(svgA.includes('#7c3aed') && svgA.includes('#22d3ee'));
assert.ok(buildRuntimeThemeConfig(payload).material.diffuseLevel < 1);

const legacyV3Payload = { ...payload, v: 3 };
delete legacyV3Payload.f;
assert.equal(validateRuntimeThemePayload(legacyV3Payload).ok, true, 'Existing v3 resin tokens must remain readable.');
assert.ok(buildRuntimeThemeSvg(legacyV3Payload).includes('resinSheen'));

const invalidSet = structuredClone(set);
invalidSet.appearance.diceSet.defaultStyle.interior.type = 'unsupported-effect';
assert.equal(validateDiceSet(invalidSet).ok, false, 'Unknown interior presets must fail closed.');
const invalidRuntime = { ...payload, r: [...payload.r] };
invalidRuntime.r[5] = 'unsupported-effect';
assert.equal(validateRuntimeThemePayload(invalidRuntime).ok, false);
console.log('Resin appearance contract passed: clear resin, five bounded interior presets, per-die overrides, deterministic texture generation, legacy saved-set/runtime compatibility, and fail-closed validation are protected.');
