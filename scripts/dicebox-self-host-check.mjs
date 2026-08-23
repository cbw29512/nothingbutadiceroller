import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

try {
  const [pkg, lock, physics, modelLoader, proof, vendor] = await Promise.all([
    read('package.json'),
    read('package-lock.json'),
    read('js/physics.js'),
    read('js/appearance/dicebox-model-loader.mjs'),
    read('js/appearance/dicebox-proof-harness.js'),
    read('scripts/vendor-dicebox.mjs'),
  ]);

  const packageJson = JSON.parse(pkg);
  const lockJson = JSON.parse(lock);
  assert.equal(packageJson.dependencies?.['@3d-dice/dice-box'], '1.1.4', 'DiceBox must be pinned exactly to 1.1.4.');
  assert.equal(lockJson.packages?.['node_modules/@3d-dice/dice-box']?.version, '1.1.4', 'Lockfile must pin DiceBox 1.1.4.');

  for (const [label, source] of [['physics', physics], ['model loader', modelLoader], ['proof harness', proof]]) {
    assert.ok(!/cdn\.jsdelivr\.net|unpkg\.com/i.test(source), `${label} must not depend on jsDelivr or unpkg.`);
    assert.ok(!/https?:\/\/[^'"`\s]*3d-dice/i.test(source), `${label} must not execute or fetch DiceBox from a remote origin.`);
    assert.match(source, /\/vendor\/dice-box\//, `${label} must use the same-origin vendored DiceBox path.`);
  }

  assert.match(vendor, /node_modules\/@3d-dice\/dice-box\/dist/, 'Vendor step must copy from the locked npm package.');
  assert.match(vendor, /dist\/vendor\/dice-box/, 'Vendor step must publish DiceBox under the same-origin vendor path.');
  assert.match(vendor, /assets\/themes\/default\/default\.json/, 'Vendor step must verify canonical DiceBox assets are present.');

  console.log('DiceBox self-host contract passed: exact package pin, same-origin module/model paths, and deterministic dist vendoring are enforced.');
} catch (error) {
  console.error('DiceBox self-host contract failed:', error);
  process.exitCode = 1;
}
