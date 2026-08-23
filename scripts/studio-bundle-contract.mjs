import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

try {
  const [pkgSource, bundler, studioHtml] = await Promise.all([
    read('package.json'),
    read('scripts/bundle-studio.mjs'),
    read('customize.html'),
  ]);
  const pkg = JSON.parse(pkgSource);
  const build = pkg.scripts?.build || '';

  assert.ok(build.includes('node scripts/build.mjs'), 'Main static build must run before Dice Studio bundling.');
  assert.ok(build.includes('node scripts/bundle-studio.mjs'), 'Production build must bundle Dice Studio.');
  assert.ok(build.indexOf('node scripts/build.mjs') < build.indexOf('node scripts/bundle-studio.mjs'), 'Dice Studio bundling must run after the static copy build.');
  assert.ok(build.indexOf('node scripts/bundle-studio.mjs') < build.indexOf('node scripts/release-strip.mjs'), 'Dice Studio bundling must finish before release stripping.');
  assert.ok(bundler.includes("entryPoints: [resolve(root, 'js/appearance/studio.js')]"), 'Bundler must use the audited Dice Studio entry point.');
  assert.ok(bundler.includes("outfile = resolve(root, 'dist/js/appearance/studio.js')"), 'Bundler must overwrite the production Dice Studio entry path.');
  assert.ok(bundler.includes('bundle: true'), 'Dice Studio entry must be bundled, not copied as a module graph.');
  assert.ok(studioHtml.includes('src="/js/appearance/studio.js"'), 'Dice Studio page must load the bundled production entry path.');

  console.log('Dice Studio bundle contract passed: the audited entry is bundled into the existing production URL before release stripping.');
} catch (error) {
  console.error('Dice Studio bundle contract failed:', error);
  process.exitCode = 1;
}
