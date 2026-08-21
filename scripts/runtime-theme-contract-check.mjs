import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CANONICAL_DICE } from '../js/appearance/defaults.mjs';
import { RUNTIME_THEME_VERSION, decodeRuntimeThemePayload, encodeRuntimeThemePayload, validateRuntimeThemePayload } from '../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeIdentity } from '../js/appearance/runtime-theme-identity.mjs';
import { buildRuntimeThemeConfig, buildRuntimeThemeSvg } from '../js/appearance/runtime-theme-response.mjs';

const operation = (text) => [[text, '#ffffff', '', 10, 10, 20]];
const payload = { v: RUNTIME_THEME_VERSION, d: 'd20', s: 1024, o: [['<', '#a855f7', 'fantasy', 512, 512, 64]] };
const token = encodeRuntimeThemePayload(payload);
assert.match(token, /^[A-Za-z0-9_-]+$/);
assert.deepEqual(decodeRuntimeThemePayload(token), payload);
assert.equal(encodeRuntimeThemePayload(decodeRuntimeThemePayload(token)), token);
assert.ok(token.length < 6000);
const config = buildRuntimeThemeConfig(payload);
assert.deepEqual(config.diceAvailable, ['d20']);
assert.equal(config.systemName, buildRuntimeThemeIdentity('d20', token));
assert.equal(config.material.type, 'color');
assert.equal(config.material.diffuseTexture.light, 'diffuse.svg');
assert.equal('meshFile' in config, false);
assert.equal('bumpTexture' in config.material, false);
for (const dieType of Object.keys(CANONICAL_DICE)) {
  const diePayload = { v: RUNTIME_THEME_VERSION, d: dieType, s: 1024, o: operation('1') };
  const dieToken = encodeRuntimeThemePayload(diePayload); const dieConfig = buildRuntimeThemeConfig(diePayload);
  assert.equal(dieConfig.systemName, buildRuntimeThemeIdentity(dieType, dieToken));
  assert.deepEqual(dieConfig.diceAvailable, [dieType]);
}
const changedPayload = { ...payload, o: operation('★') };
assert.notEqual(buildRuntimeThemeConfig(changedPayload).systemName, config.systemName);
const svg = buildRuntimeThemeSvg(payload);
assert.ok(svg.includes('&lt;')); assert.equal(svg.includes('> < </text>'), false); assert.equal(svg.includes('<script'), false); assert.ok(svg.startsWith('<svg'));
for (const text of ['20', '100', 'A', '☠', '☠️', 'CRIT', 'FIRE', 'AB', '🔥🔥', 'ROLL AGAIN']) {
  assert.equal(validateRuntimeThemePayload({ ...payload, o: operation(text) }).ok, true, `Short runtime label ${text} must be valid.`);
}
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('THIS LABEL IS FAR TOO LONG') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('BAD\nLABEL') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, gravity: 9 }).ok, false, 'Unexpected/mechanics fields must be rejected.');
assert.equal(validateRuntimeThemePayload({ ...payload, d: 'd30' }).ok, false);
const functionSource = await readFile(new URL('../netlify/functions/dice-theme-assets.mjs', import.meta.url), 'utf8');
assert.ok(functionSource.includes("path: '/api/dice-theme/:token/:asset'"));
assert.ok(functionSource.includes("asset === 'theme.config.json'"));
assert.ok(functionSource.includes("asset === 'diffuse.svg'"));
assert.ok(functionSource.includes("'X-Content-Type-Options': 'nosniff'"));
console.log('Runtime theme contract passed: short labels, path-safe tokens, canonical mesh reuse, safe SVG, and mechanics-field rejection are protected.');
