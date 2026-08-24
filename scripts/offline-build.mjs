import { access, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const source = resolve(root, 'sw.js');
const target = resolve(dist, 'sw.js');

await access(source);
await access(dist);
await copyFile(source, target);
await access(target);

console.log('Offline core service worker copied to dist/sw.js.');
