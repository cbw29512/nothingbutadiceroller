import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

try {
  const [pkgSource, buildSource, studioHtml] = await Promise.all([
    read('package.json'),
    read('scripts/build.mjs'),
    read('customize.html'),
  ]);
  const pkg = JSON.parse(pkgSource);
  const buildCommand = pkg.scripts?.build || '';

  assert.ok(buildCommand.includes('node scripts/build.mjs'), 'Production build must run the integrated browser bundler.');
  assert.equal(buildCommand.includes('bundle-studio.mjs'), false, 'Production must not run a duplicate Dice Studio bundle pass.');
  assert.ok(buildSource.includes("entryPoints: [resolve(root, 'js/appearance/studio.js')]"), 'Integrated build must use the audited Dice Studio source entry.');
  assert.ok(buildSource.includes("outfile: resolve(dist, 'js/appearance/studio.js')"), 'Integrated build must overwrite the copied Studio entry with its bundle in place.');
  assert.ok(buildSource.includes('bundle: true'), 'Dice Studio production entry must be bundled.');
  assert.ok(buildSource.includes("readFile(resolve(dist, 'js/appearance/studio.js'), 'utf8')"), 'Build validation must inspect the produced Dice Studio bundle.');
  assert.ok(buildSource.includes('Production Dice Studio bundle contains unresolved relative imports.'), 'Build validation must reject unresolved relative imports.');
  assert.ok(studioHtml.includes('src="/js/appearance/studio.js"'), 'Dice Studio page must preserve its established production entry URL.');

  console.log('Dice Studio bundle contract passed: the main build bundles the audited Studio source in place, preserves its public URL, and validates the produced artifact.');
} catch (error) {
  console.error('Dice Studio bundle contract failed:', error);
  process.exitCode = 1;
}
