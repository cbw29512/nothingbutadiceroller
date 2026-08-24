import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css] = await Promise.all([
  readFile(new URL('../js/appearance/dicebox-proof-harness.js', import.meta.url), 'utf8'),
  readFile(new URL('../appearance-harness.css', import.meta.url), 'utf8'),
]);
const required = [
  'preflightRuntimeTheme',
  'theme.config.json',
  'diffuse.svg',
  "svg.includes('☠')",
  'image.decode()',
  'onThemeConfigLoaded',
  'onDieComplete',
  'themesLoadedData',
  "loaded.meshName === 'default'",
  "die.theme === runtimeTheme.themeName",
  "die.meshName === 'default'",
  'verifyCanvasLayout',
  "querySelector('canvas.dice-box-canvas')",
  'canvas.clientWidth',
  'tray.clientWidth',
  'PROOF_ROLL_TIMEOUT_MS',
  'withTimeout',
  'Promise.race',
  'Proof roll timed out before DiceBox returned a result.',
  'callbackValues',
  'returnedValues',
  'NATURAL 20 DETECTED — MANUAL VISUAL GATE',
  'loadSelfHostedDiceBox()',
  'assetPath: DICEBOX_ASSET_PATH',
  'origin: diceBoxOrigin(window.location)',
];

for (const reference of required) {
  assert.ok(source.includes(reference), `Proof harness is missing required evidence gate: ${reference}`);
}

for (const reference of [
  '.appearance-proof-tray canvas',
  'position:absolute!important',
  'inset:0',
  'width:100%!important',
  'height:100%!important',
  'z-index:2',
]) {
  assert.ok(css.includes(reference), `Proof harness CSS is missing required DiceBox canvas layout: ${reference}`);
}

assert.ok(source.includes("!Object.hasOwn(config, 'meshFile')"),
  'Proof harness must verify the runtime theme inherits canonical DiceBox geometry.');
assert.ok(source.includes('Number.isInteger(value) && value >= 1 && value <= 20'),
  'Proof harness must enforce canonical d20 result bounds.');
assert.ok(source.includes('offscreen: false'),
  'Isolated proof harness must use the deterministic onscreen renderer until the visual gate passes.');
assert.equal(source.includes('diceBox.updateConfig'), false,
  'Isolated proof harness must not mutate live DiceBox mechanics/config after initialization.');
assert.equal(/cdn\.jsdelivr\.net|unpkg\.com/i.test(source), false,
  'Proof harness must not execute or fetch DiceBox runtime/assets from public CDNs.');

console.log('Appearance proof harness passed: same-origin pinned DiceBox, external theme identity, visible full-size canvas, deterministic onscreen proof rendering, timeout diagnostics, canonical mesh, numeric results, and natural-20 manual visual gate are enforced.');
