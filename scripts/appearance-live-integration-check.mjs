import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyLiveTrayAppearance, buildLivePhysicsConfig, buildLiveTrayVisual, LIVE_TRAY_CSS } from '../js/appearance/live-integration.mjs';

const defaultConfig = buildLivePhysicsConfig({ mode: 'default' }, '#c026d3');
assert.equal(defaultConfig.mode, 'default');
assert.equal(defaultConfig.themeColor, '#c026d3');
assert.equal(defaultConfig.runtimeThemes, null);
assert.deepEqual(defaultConfig.diceBoxOptions, {}, 'System Default must not override DiceBox renderer or external themes.');

const runtimeThemes = {
  d20: { themeName: 'ndr_d20_live', basePath: '/api/dice-theme/t20', themeColor: '#ef4444' },
  d8: { themeName: 'ndr_d8_live', basePath: '/api/dice-theme/t8', themeColor: '#22c55e' },
  d6: { themeName: 'ndr_d6_live', basePath: '/api/dice-theme/t6', themeColor: '#3b82f6' },
};
const externalThemes = Object.fromEntries(Object.values(runtimeThemes).map((theme) => [theme.themeName, theme.basePath]));
const imageUrl = '/api/dice-set-image?owner=user1&set=set1&token=abc123';
const customRuntime = {
  mode: 'custom', defaultThemeColor: '#123456', runtimeThemes, externalThemes,
  tray: { color: '#102030', image: { kind: 'blob', url: imageUrl }, glow: { enabled: true, color: '#abcdef', intensity: 0.5 } },
};
const customConfig = buildLivePhysicsConfig(customRuntime, '#c026d3');
assert.equal(customConfig.mode, 'custom');
assert.equal(customConfig.themeColor, '#123456');
assert.equal(customConfig.diceBoxOptions.offscreen, false);
assert.deepEqual(customConfig.diceBoxOptions.externalThemes, externalThemes);
assert.deepEqual(customConfig.runtimeThemes, runtimeThemes);

const malformedCustom = buildLivePhysicsConfig({ mode: 'custom', runtimeThemes: {}, externalThemes: {} }, '#c026d3');
assert.equal(malformedCustom.mode, 'default');
assert.deepEqual(malformedCustom.diceBoxOptions, {});

const tray = buildLiveTrayVisual(customRuntime);
assert.equal(tray.active, true); assert.equal(tray.imageUrl, imageUrl); assert.match(tray.background, /dice-set-image/);
assert.match(tray.background, /#102030/); assert.match(tray.shadow, /#abcdef/);
const unsafe = buildLiveTrayVisual({ ...customRuntime, tray: { ...customRuntime.tray, image: { url: 'javascript:never' } } });
assert.equal(unsafe.imageUrl, null); assert.doesNotMatch(JSON.stringify(unsafe), /javascript:/);
assert.match(LIVE_TRAY_CSS, /!important/); assert.equal(buildLiveTrayVisual({ mode: 'default' }).active, false);

function fakeDocument() {
  const classes = new Set(); const values = new Map(); const ids = new Map();
  const body = { classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } },
    style: { setProperty(name, value) { values.set(name, value); }, removeProperty(name) { values.delete(name); }, getPropertyValue(name) { return values.get(name) || ''; } } };
  const head = { appendChild(node) { if (node?.id) ids.set(node.id, node); } };
  return { body, head, createElement() { return { id: '', textContent: '' }; }, getElementById(id) { return ids.get(id) || null; } };
}
const doc = fakeDocument();
applyLiveTrayAppearance(customRuntime, { documentRef: doc });
assert.equal(doc.body.classList.contains('appearance-v2-active'), true);
assert.match(doc.body.style.getPropertyValue('--appearance-v2-tray-bg'), /dice-set-image/);
assert.match(doc.body.style.getPropertyValue('--appearance-v2-tray-shadow'), /#abcdef/);
assert.equal(doc.getElementById('appearance-v2-live-style').textContent, LIVE_TRAY_CSS);
applyLiveTrayAppearance({ mode: 'default' }, { documentRef: doc });
assert.equal(doc.body.classList.contains('appearance-v2-active'), false);
assert.equal(doc.body.style.getPropertyValue('--appearance-v2-tray-bg'), '');

const physicsSource = fs.readFileSync(new URL('../js/physics.js', import.meta.url), 'utf8');
assert.match(physicsSource, /decorateDiceBoxNotation\(notation, liveRuntimeThemes\)/);
assert.match(physicsSource, /\.\.\.liveAppearance\.diceBoxOptions/);
assert.match(physicsSource, /usesCustomAppearance\s*\?\s*decorateDiceBoxNotation/);
assert.match(physicsSource, /rollDefaultFallback\(notation, themeColor, err\)/);
assert.match(physicsSource, /diceBox\.roll\(notation\)/, 'Appearance failure must retry the original notation unchanged.');
assert.match(physicsSource, /theme:\s*'default'/);
assert.match(physicsSource, /liveRuntimeThemes\s*=\s*null/);
for (const reference of [/gravity:\s*1/, /mass:\s*1/, /friction:\s*0\.8/, /restitution:\s*0\.15/, /startingHeight:\s*8/, /spinForce:\s*5/, /throwForce:\s*5/]) assert.match(physicsSource, reference);

const appSource = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
assert.match(appSource, /prepareActiveDiceAppearance/);
assert.match(appSource, /applyLiveTrayAppearance\(appearanceRuntime\)/);
assert.match(appSource, /initDicePhysics\([\s\S]*?appearanceRuntime,[\s\S]*?\);/);
console.log('Appearance live integration passed: Default stays unchanged, custom visuals cannot block a roll, validated tray images render, and mechanics remain canonical.');
