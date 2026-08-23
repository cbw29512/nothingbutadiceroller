import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outfile = resolve(root, 'dist/js/appearance/studio.js');

try {
  await build({
    entryPoints: [resolve(root, 'js/appearance/studio.js')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    outfile,
    logLevel: 'warning',
  });

  const source = await readFile(outfile, 'utf8');
  if (/\bfrom\s*['"]\.\.?\//.test(source)) {
    throw new Error('Dice Studio bundle still contains unresolved relative imports.');
  }
  if (!source.includes('Dice Studio ready.')) {
    throw new Error('Dice Studio bundle is missing its initialization marker.');
  }

  const bytes = (await stat(outfile)).size;
  console.log(`Dice Studio production bundle ready: ${(bytes / 1024).toFixed(1)} KiB raw.`);
} catch (error) {
  console.error('Dice Studio production bundling failed:', error);
  process.exitCode = 1;
}
