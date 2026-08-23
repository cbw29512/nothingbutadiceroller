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
  assert.equal(buildCommand.includes('bundle-studio.mjs'), false, 'Production must not run a second Dice Studio bundle pass.');
  assert.ok(buildSource.includes("studio: resolve(root, 'js/appearance/studio.js')"), 'Integrated build must use the audited Dice Studio source entry.');
  assert.ok(buildSource.includes("outdir: resolve(dist, 'js')"), 'Integrated build must emit browser entries under dist/js.');
  assert.ok(buildSource.includes('bundle: true'), 'Integrated browser entries must be bundled.');
  assert.ok(buildSource.includes("readFile(resolve(dist, 'js/studio.js'), 'utf8')"), 'Build validation must inspect the produced Dice Studio bundle.');
  assert.ok(studioHtml.includes('src="/js/studio.js"'), 'Dice Studio page must load the single production bundle.');
  assert.equal(studioHtml.includes('src="/js/appearance/studio.js"'), false, 'Dice Studio page must not load the source module graph in production.');

  console.log('Dice Studio bundle contract passed: one integrated esbuild pass produces /js/studio.js from the audited modular source entry.');
} catch (error) {
  console.error('Dice Studio bundle contract failed:', error);
  process.exitCode = 1;
}
