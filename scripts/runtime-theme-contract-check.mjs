import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CANONICAL_DICE } from '../js/appearance/defaults.mjs';
import {
  RUNTIME_THEME_VERSION,
  decodeRuntimeThemePayload,
  encodeRuntimeThemePayload,
  validateRuntimeThemePayload,
} from '../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeIdentity } from '../js/appearance/runtime-theme-identity.mjs';
import { buildRuntimeThemeConfig, buildRuntimeThemeSvg } from '../js/appearance/runtime-theme-response.mjs';

const operation = (text) => [[text, '#ffffff', '', 10, 10, 20]];
const payload = {
  v: RUNTIME_THEME_VERSION,
  d: 'd20',
  s: 1024,
  o: [['<', '#a855f7', 'fantasy', 512, 512, 64]],
};
const token = encodeRuntimeThemePayload(payload);
assert.match(token, /^[A-Za-z0-9_-]+$/, 'Theme token must remain URL-path safe.');
assert.deepEqual(decodeRuntimeThemePayload(token), payload);
assert.equal(encodeRuntimeThemePayload(decodeRuntimeThemePayload(token)), token, 'Runtime theme tokens must round-trip canonically.');
assert.ok(token.length < 6000);

const config = buildRuntimeThemeConfig(payload);
assert.deepEqual(config.diceAvailable, ['d20']);
assert.equal(config.systemName, buildRuntimeThemeIdentity('d20', token), 'External theme key and config systemName must share one identity.');
assert.equal(config.material.type, 'color');
assert.equal(config.material.diffuseTexture.light, 'diffuse.svg');
assert.equal('meshFile' in config, false, 'Runtime theme must reuse DiceBox default mesh/collider automatically.');
assert.equal('bumpTexture' in config.material, false, 'Old numeric bump maps must not ghost through custom faces.');

for (const dieType of Object.keys(CANONICAL_DICE)) {
  const diePayload = { v: RUNTIME_THEME_VERSION, d: dieType, s: 1024, o: operation('1') };
  const dieToken = encodeRuntimeThemePayload(diePayload);
  const dieConfig = buildRuntimeThemeConfig(diePayload);
  assert.equal(
    dieConfig.systemName,
    buildRuntimeThemeIdentity(dieType, dieToken),
    `${dieType} runtime theme config must match its registered external theme identity.`,
  );
  assert.deepEqual(dieConfig.diceAvailable, [dieType]);
}
const changedPayload = { ...payload, o: operation('★') };
assert.notEqual(
  buildRuntimeThemeConfig(changedPayload).systemName,
  config.systemName,
  'Different visual payloads must receive different runtime theme identities.',
);

const svg = buildRuntimeThemeSvg(payload);
assert.ok(svg.includes('&lt;'), 'User face symbols must be XML escaped.');
assert.equal(svg.includes('> < </text>'), false);
assert.equal(svg.includes('<script'), false);
assert.ok(svg.startsWith('<svg'));

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
console.log('Runtime theme contract passed: shared theme identity, strict face labels, path-safe tokens, canonical mesh reuse, safe SVG, and no mechanics fields.');
