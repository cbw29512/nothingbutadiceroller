import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));

const declared = packageJson.dependencies || {};
const lockedRoot = packageLock.packages?.['']?.dependencies || {};

assert.deepEqual(
  lockedRoot,
  declared,
  'package-lock root dependencies must exactly match package.json dependencies.',
);

for (const dependency of Object.keys(declared)) {
  assert.ok(
    packageLock.packages?.[`node_modules/${dependency}`],
    `package-lock is missing the package entry for ${dependency}.`,
  );
}

console.log(`Dependency lock check passed for ${Object.keys(declared).length} production dependencies.`);
