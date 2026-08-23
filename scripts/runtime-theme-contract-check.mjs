import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CANONICAL_DICE } from '../js/appearance/defaults.mjs';
import { getCanonicalFaceResults } from '../js/appearance/face-values.mjs';
import { RUNTIME_THEME_VERSION, decodeRuntimeThemePayload, encodeRuntimeThemePayload, validateRuntimeThemePayload } from '../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeIdentity } from '../js/appearance/runtime-theme-identity.mjs';
import { buildRuntimeThemeConfig, buildRuntimeThemeSvg } from '../js/appearance/runtime-theme-response.mjs';

const operation = (text) => [[text, '#ffffff', '', 10, 10, 20]];
const standardFinish = ['standard', '#ffffff', 0.55];
const standardPattern = ['none', '#f8fafc', '#64748b', 0.55, 0.5];
const standardInlay = ['none', '#f8fafc', 0.8, 0.5];
const boundariesFor = (dieType) => getCanonicalFaceResults(dieType).map((_, index) => {
  const offset = 20 + (index * 3);
  return [offset, 20, offset + 18, 20, offset + 9, 38];
});
const payload = {
  v: RUNTIME_THEME_VERSION,
  d: 'd20',
  s: 1024,
  o: [['<', '#a855f7', 'fantasy', 512, 512, 64]],
  g: [true, '#00ffcc', 0.75],
  f: standardFinish,
  p: standardPattern,
  i: standardInlay,
};
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
  const diePayload = {
    v: RUNTIME_THEME_VERSION, d: dieType, s: 1024, o: operation('1'),
    g: [false, '#ffffff', 0], f: standardFinish, p: standardPattern, i: standardInlay,
  };
  const dieToken = encodeRuntimeThemePayload(diePayload); const dieConfig = buildRuntimeThemeConfig(diePayload);
  assert.equal(dieConfig.systemName, buildRuntimeThemeIdentity(dieType, dieToken));
  assert.deepEqual(dieConfig.diceAvailable, [dieType]);
}
const changedPayload = { ...payload, o: operation('★') };
assert.notEqual(buildRuntimeThemeConfig(changedPayload).systemName, config.systemName);
const changedGlow = { ...payload, g: [true, '#ff00ff', 0.75] };
assert.notEqual(buildRuntimeThemeConfig(changedGlow).systemName, config.systemName, 'Glow changes must produce a new runtime theme identity.');
const changedFinish = { ...payload, f: ['metallic', '#f59e0b', 0.8] };
assert.notEqual(buildRuntimeThemeConfig(changedFinish).systemName, config.systemName, 'Surface finish changes must produce a new runtime theme identity.');
const changedPattern = { ...payload, p: ['marble', '#f8fafc', '#7c3aed', 0.7, 0.6] };
assert.notEqual(buildRuntimeThemeConfig(changedPattern).systemName, config.systemName, 'Surface pattern changes must produce a new runtime theme identity.');
const changedInlay = { ...payload, i: ['dashed', '#22d3ee', 0.75, 0.55, boundariesFor('d20')] };
assert.notEqual(buildRuntimeThemeConfig(changedInlay).systemName, config.systemName, 'Edge inlay changes must produce a new runtime theme identity.');
const svg = buildRuntimeThemeSvg(payload);
assert.ok(svg.includes('&lt;')); assert.equal(svg.includes('> < </text>'), false); assert.equal(svg.includes('<script'), false); assert.ok(svg.startsWith('<svg'));
assert.ok(svg.includes('id="numberGlow"'), 'Enabled runtime glow must render into the generated diffuse texture.');
assert.ok(svg.includes('#00ffcc'), 'Runtime glow color must be present in the generated diffuse texture.');
assert.ok(svg.includes('filter="url(#numberGlow)"'), 'Runtime face text must use the glow filter when enabled.');
const noGlowSvg = buildRuntimeThemeSvg({ ...payload, g: [false, '#00ffcc', 0.75] });
assert.equal(noGlowSvg.includes('id="numberGlow"'), false, 'Disabled number glow must not emit a glow filter.');
const finishSvg = buildRuntimeThemeSvg(changedFinish);
assert.ok(finishSvg.includes('surfaceMetallic'), 'Metallic finish must render into the generated diffuse texture.');
assert.ok(finishSvg.toLowerCase().includes('#f59e0b'));
const patternSvg = buildRuntimeThemeSvg(changedPattern);
assert.ok(patternSvg.includes('patternMarble'), 'Marble pattern must render into the generated diffuse texture.');
assert.ok(patternSvg.toLowerCase().includes('#7c3aed'));
const inlaySvg = buildRuntimeThemeSvg(changedInlay);
assert.ok(inlaySvg.includes('id="edgeInlay"'), 'Enabled edge inlays must render into the generated diffuse texture.');
assert.ok(inlaySvg.toLowerCase().includes('#22d3ee'));
assert.match(inlaySvg, /stroke-dasharray=/);

const legacyPayload = { v: 1, d: 'd20', s: 1024, o: operation('20') };
assert.equal(validateRuntimeThemePayload(legacyPayload).ok, true, 'Version 1 runtime tokens must remain readable for already-open clients.');
assert.equal(buildRuntimeThemeSvg(legacyPayload).includes('id="numberGlow"'), false);
const legacyV3Payload = { v: 3, d: 'd20', s: 1024, o: operation('20'), g: [false, '#ffffff', 0] };
assert.equal(validateRuntimeThemePayload(legacyV3Payload).ok, true, 'Version 3 runtime tokens without resin fields must remain readable.');
const legacyV4Payload = {
  v: 4, d: 'd20', s: 1024, o: operation('20'), g: [false, '#ffffff', 0],
  f: ['metallic', '#f59e0b', 0.8],
};
assert.equal(validateRuntimeThemePayload(legacyV4Payload).ok, true, 'Version 4 finish tokens must remain readable after later visual layers ship.');
assert.ok(buildRuntimeThemeSvg(legacyV4Payload).includes('surfaceMetallic'), 'Version 4 metallic artwork must remain visually intact, not merely validate.');
const legacyV5Payload = {
  v: 5, d: 'd20', s: 1024, o: operation('20'), g: [false, '#ffffff', 0],
  f: standardFinish, p: ['marble', '#f8fafc', '#7c3aed', 0.7, 0.6],
};
assert.equal(validateRuntimeThemePayload(legacyV5Payload).ok, true, 'Version 5 pattern tokens must remain readable after inlays ship.');
assert.ok(buildRuntimeThemeSvg(legacyV5Payload).includes('patternMarble'), 'Version 5 marble artwork must remain visually intact.');

for (const text of ['20', '100', 'A', '☠', '☠️', 'CRIT', 'FIRE', 'AB', '🔥🔥', 'ROLL AGAIN']) {
  assert.equal(validateRuntimeThemePayload({ ...payload, o: operation(text) }).ok, true, `Short runtime label ${text} must be valid.`);
}
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('THIS LABEL IS FAR TOO LONG') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, o: operation('BAD\nLABEL') }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, gravity: 9 }).ok, false, 'Unexpected/mechanics fields must be rejected.');
assert.equal(validateRuntimeThemePayload({ ...payload, d: 'd30' }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, g: [true, 'red', 0.75] }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, g: [true, '#00ffcc', 2] }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, f: ['unknown', '#ffffff', 0.5] }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, p: ['unknown', '#ffffff', '#000000', 0.5, 0.5] }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, i: ['unknown', '#ffffff', 0.8, 0.5] }).ok, false);
assert.equal(validateRuntimeThemePayload({ ...payload, i: ['fine', '#ffffff', 0.8, 0.5] }).ok, false, 'Enabled inlays cannot omit physical face boundaries.');
const functionSource = await readFile(new URL('../netlify/functions/dice-theme-assets.mjs', import.meta.url), 'utf8');
assert.ok(functionSource.includes("path: '/api/dice-theme/:token/:asset'"));
assert.ok(functionSource.includes("asset === 'theme.config.json'"));
assert.ok(functionSource.includes("asset === 'diffuse.svg'"));
assert.ok(functionSource.includes("'X-Content-Type-Options': 'nosniff'"));
console.log('Runtime theme contract passed: short labels, path-safe v6 tokens, glow/finish/pattern/inlay textures, v1-v5 compatibility including visual preservation, canonical mesh reuse, safe SVG, and mechanics-field rejection are protected.');
