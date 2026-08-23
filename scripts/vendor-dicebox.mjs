import { access, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = resolve(root, 'node_modules/@3d-dice/dice-box/dist');
const destination = resolve(root, 'dist/vendor/dice-box');

try {
  await access(resolve(source, 'dice-box.es.min.js'));
  await access(resolve(source, 'assets/themes/default/default.json'));
  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
  await access(resolve(destination, 'dice-box.es.min.js'));
  await access(resolve(destination, 'assets/themes/default/default.json'));
  console.log('Vendored locked DiceBox distribution into dist/vendor/dice-box.');
} catch (error) {
  console.error('DiceBox vendoring failed:', error);
  process.exitCode = 1;
}
