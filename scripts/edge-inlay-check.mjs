import assert from 'node:assert/strict';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { buildAppearanceRenderPlan } from '../js/appearance/render-plan.mjs';
import { buildDiceBoxThemePlan } from '../js/appearance/dicebox-theme-plan.mjs';
import { buildDiceBoxRuntimeTheme } from '../js/appearance/dicebox-runtime-theme.mjs';
import { RUNTIME_THEME_VERSION, decodeRuntimeThemePayload, validateRuntimeThemePayload } from '../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeSvg } from '../js/appearance/runtime-theme-response.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';

function d20GlyphPlan() {
  return {
    commands: Array.from({ length: 20 }, (_, index) => {
      const col = index % 5; const row = Math.floor(index / 5);
      const u = 0.02 + col * 0.19; const v = 0.05 + row * 0.22;
      const outline = [[u, v], [u + 0.15, v], [u + 0.075, v + 0.16]];
      return {
        dieType: 'd20', logicalResult: index + 1, strategy: 'centered-region', text: String(index + 1), color: '#ffffff', fontId: null,
        region: { minU: u, minV: v, maxU: u + 0.15, maxV: v + 0.16, centerU: u + 0.075, centerV: v + (0.16 / 3), outline },
      };
    }),
  };
}

const set = createUserDiceSet({ id: 'inlay_contract', ownerId: 'owner', name: 'Inlay Contract' });
set.appearance.diceSet.defaultStyle.inlay = { type: 'fine', color: '#f59e0b', intensity: 0.85, width: 0.6 };
set.appearance.diceSet.dice.d6.styleOverrides.inlay = { type: 'dotted', color: '#22d3ee', intensity: 0.7, width: 0.45 };
assert.equal(validateDiceSet(set).ok, true);

const renderPlan = buildAppearanceRenderPlan(set);
assert.equal(renderPlan.dice.d20.style.inlay.type, 'fine');
assert.equal(renderPlan.dice.d6.style.inlay.type, 'dotted');
assert.equal(renderPlan.dice.d6.style.inlay.color, '#22d3ee');
const themePlan = buildDiceBoxThemePlan(renderPlan);
assert.equal(themePlan.dice.d20.material.inlay.type, 'fine');
assert.equal(themePlan.dice.d6.material.inlay.type, 'dotted');
assert.equal('gravity' in themePlan.dice.d20.material, false);

const runtime = buildDiceBoxRuntimeTheme(d20GlyphPlan(), themePlan, 'd20');
const payload = decodeRuntimeThemePayload(runtime.token);
assert.equal(payload.v, RUNTIME_THEME_VERSION);
assert.equal(payload.i[0], 'fine');
assert.equal(payload.i[1], '#f59e0b');
assert.equal(payload.i[4].length, 20, 'Enabled d20 inlay must carry exactly twenty physical face perimeters.');
assert.ok(runtime.token.length < 6000, `Edge-inlay runtime token must remain route-safe; received ${runtime.token.length}.`);
assert.equal(validateRuntimeThemePayload(payload).ok, true);
const svg = buildRuntimeThemeSvg(payload);
assert.match(svg, /id="edgeInlay"/);
assert.match(svg.toLowerCase(), /#f59e0b/);
assert.equal((svg.match(/<path /g) || []).length, 40, 'Each face perimeter should render a depth stroke plus the inlay stroke.');

for (const type of ['fine', 'bold', 'dashed', 'dotted']) {
  const candidate = structuredClone(payload); candidate.i[0] = type;
  assert.equal(validateRuntimeThemePayload(candidate).ok, true, `${type} must be a supported edge-inlay style.`);
  assert.ok(buildRuntimeThemeSvg(candidate).includes('edgeInlay'));
}
const disabled = structuredClone(payload); disabled.i = ['none', '#ffffff', 0.8, 0.5];
assert.equal(validateRuntimeThemePayload(disabled).ok, true);
assert.equal(buildRuntimeThemeSvg(disabled).includes('edgeInlay'), false);

const legacyCompatible = createUserDiceSet({ id: 'legacy_inlayless', ownerId: 'owner', name: 'Legacy Inlayless' });
delete legacyCompatible.appearance.diceSet.defaultStyle.inlay;
assert.equal(validateDiceSet(legacyCompatible).ok, true, 'Previously saved sets without inlay fields must remain valid.');
assert.equal(buildAppearanceRenderPlan(legacyCompatible).dice.d20.style.inlay.type, 'none');

const invalidSet = structuredClone(set); invalidSet.appearance.diceSet.defaultStyle.inlay.type = 'weighted';
assert.equal(validateDiceSet(invalidSet).ok, false, 'Unknown inlay presets must fail closed.');
const invalidRuntime = structuredClone(payload); invalidRuntime.i[0] = 'weighted';
assert.equal(validateRuntimeThemePayload(invalidRuntime).ok, false);
const malformedBoundary = structuredClone(payload); malformedBoundary.i[4][0] = [10, 10, 20];
assert.equal(validateRuntimeThemePayload(malformedBoundary).ok, false, 'Malformed face boundaries must fail closed.');

console.log('Edge inlay contract passed: four bounded styles, set/per-die inheritance, exact physical-face UV boundaries, v6 runtime encoding, legacy saved-set compatibility, mechanics isolation, and fail-closed validation are protected.');
