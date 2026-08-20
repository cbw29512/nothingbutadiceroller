import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/appearance/dicebox-proof-harness.js', import.meta.url), 'utf8');
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
  'callbackValues',
  'returnedValues',
  'NATURAL 20 DETECTED — MANUAL VISUAL GATE',
];

for (const reference of required) {
  assert.ok(source.includes(reference), `Proof harness is missing required evidence gate: ${reference}`);
}

assert.ok(source.includes("!Object.hasOwn(config, 'meshFile')"),
  'Proof harness must verify the runtime theme inherits canonical DiceBox geometry.');
assert.ok(source.includes('Number.isInteger(value) && value >= 1 && value <= 20'),
  'Proof harness must enforce canonical d20 result bounds.');
assert.equal(source.includes('diceBox.updateConfig'), false,
  'Isolated proof harness must not mutate live DiceBox mechanics/config after initialization.');

console.log('Appearance proof harness passed: external theme identity, SVG availability, canonical mesh, numeric results, and natural-20 manual visual gate are enforced.');
