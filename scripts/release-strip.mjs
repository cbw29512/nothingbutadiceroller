import { access, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');
const diagnostics = [
  'appearance-harness.html',
  'appearance-harness.css',
  'shortcut-harness.html',
  'shortcut-harness.css',
  'js/shortcut-harness.js',
  'js/appearance/dicebox-proof-harness.js',
  'js/theme-community.js',
];

for (const path of diagnostics) await rm(resolve(dist, path), { force: true });

const survivors = [];
for (const path of diagnostics) {
  try {
    await access(resolve(dist, path));
    survivors.push(path);
  } catch {
    // Expected: internal/retired artifact is absent from the release bundle.
  }
}

if (survivors.length) {
  throw new Error(`Release bundle still contains internal or retired artifacts: ${survivors.join(', ')}`);
}

console.log(`Release surface stripped of ${diagnostics.length} internal/retired artifacts.`);
