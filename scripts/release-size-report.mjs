import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseSizeBudget, RELEASE_SIZE_BUDGETS } from './release-size-budget.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');

async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

function kib(bytes) { return `${(bytes / 1024).toFixed(1)} KiB`; }

try {
  const paths = await filesUnder(dist);
  const records = [];
  for (const path of paths) {
    const bytes = await readFile(path);
    records.push({
      path: relative(dist, path).replaceAll('\\', '/'),
      raw: bytes.byteLength,
      gzip: gzipSync(bytes, { level: 9 }).byteLength,
    });
  }

  records.sort((a, b) => b.raw - a.raw);
  const totalRaw = records.reduce((sum, item) => sum + item.raw, 0);
  const totalGzip = records.reduce((sum, item) => sum + item.gzip, 0);
  const appearance = records.filter((item) => item.path.startsWith('js/appearance/'));
  const appearanceRaw = appearance.reduce((sum, item) => sum + item.raw, 0);
  const appearanceGzip = appearance.reduce((sum, item) => sum + item.gzip, 0);
  const assetGzip = Object.fromEntries(Object.keys(RELEASE_SIZE_BUDGETS.assetGzip).map((path) => [
    path,
    records.find((item) => item.path === path)?.gzip,
  ]));

  console.log('Release size baseline');
  console.log(`files: ${records.length}`);
  console.log(`total: ${kib(totalRaw)} raw / ${kib(totalGzip)} gzip`);
  console.log(`Dice Studio appearance modules: ${appearance.length} files, ${kib(appearanceRaw)} raw / ${kib(appearanceGzip)} gzip`);
  console.log('largest assets:');
  for (const item of records.slice(0, 12)) {
    console.log(`- ${item.path}: ${kib(item.raw)} raw / ${kib(item.gzip)} gzip`);
  }

  assertReleaseSizeBudget({ files: records.length, totalGzip, appearanceGzip, assetGzip });
  console.log(
    `Release size budgets passed: <=${RELEASE_SIZE_BUDGETS.maxFiles} files, <=${kib(RELEASE_SIZE_BUDGETS.maxTotalGzip)} total gzip, `
    + `<=${kib(RELEASE_SIZE_BUDGETS.maxAppearanceGzip)} Dice Studio appearance gzip.`,
  );
} catch (error) {
  console.error('Release size measurement/budget failed:', error);
  process.exitCode = 1;
}
