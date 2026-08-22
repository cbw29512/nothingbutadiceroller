import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../netlify/functions/dice-theme-assets.mjs', import.meta.url), 'utf8');

assert.match(source, /path:\s*['"]\/api\/dice-theme\/:token\/:asset['"]/);
assert.match(source, /method:\s*['"]GET['"]/);
assert.match(source, /theme\.config\.json/);
assert.match(source, /diffuse\.svg/);
assert.match(source, /Cross-Origin-Resource-Policy/);
assert.match(source, /X-Content-Type-Options/);
assert.doesNotMatch(source, /meshFile\s*:/, 'Runtime asset endpoint must not provide custom geometry.');

console.log('Dice theme route contract passed: same-origin GET assets, no custom mesh path.');
