import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RUNTIME_THEME_VERSION,
  decodeRuntimeThemePayload,
  encodeRuntimeThemePayload,
  validateRuntimeThemePayload,
} from '../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeConfig, buildRuntimeThemeSvg } from '../js/appearance/runtime-theme-response.mjs';

const payload = {
  v: RUNTIME_THEME_VERSION,
  d: 'd20',
  s: 1024,
  o: [['<', '#a855f7', 'fantasy', 512, 512, 64]],
};
const token = encodeRuntimeThemePayload(payload);
assert.match(token, /^[A-Za-z0-9_-]+$/, 'Theme token must remain URL-path safe.');
assert.deepEqual(decodeRuntimeThemePayload(token), payload);
assert.ok(token.length < 6000);

const config = buildRuntimeThemeConfig(payload);
assert.deepEqual(config.diceAvailable, ['d20']);
assert.equal(config.material.type, 'color');
assert.equal(config.material.diffuseTexture.light, 'diffuse.svg');
assert.equal('meshFile' in config, false, 'Runtime theme must reuse DiceBox default mesh/collider automatically.');
assert.equal('bumpTexture' in config.material, false, 'Old numeric bump maps must not ghost through custom faces.');

const svg = buildRuntimeThemeSvg(payload);
assert.ok(svg.includes('&lt;'), 'User face symbols must be XML escaped.');
assert.equal(svg.includes('> < </text>'), false);
assert.equal(svg.includes('<script'), false);
assert.ok(svg.startsWith('<svg'));

const operation = (text) => [[text, '#ffffff', '', 10, 10, 20]];
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('20') }).ok, true);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('100') }).ok, true);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('A') }).ok, true);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('☠') }).ok, true);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('☠️') }).ok, true);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('CRIT') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('FIRE') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('AB') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('🔥🔥') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, gravity: 9 }).ok, false, 'Unexpected/mechanics fields must be rejected.');
assert.equal(validateRuntimeThemePayload({ ...payload, d: 'd30' }).ok, false);

const functionSource = await readFile(new URL('../netlify/functions/dice-theme-assets.mjs', import.meta.url), 'utf8');
assert.ok(functionSource.includes("path: '/api/dice-theme/:token/:asset'"));
assert.ok(functionSource.includes("asset === 'theme.config.json'"));
assert.ok(functionSource.includes("asset === 'diffuse.svg'"));
assert.ok(functionSource.includes("'X-Content-Type-Options': 'nosniff'"));
console.log('Runtime theme contract passed: strict face labels, path-safe visual tokens, canonical mesh reuse, safe SVG, and no mechanics fields.');
