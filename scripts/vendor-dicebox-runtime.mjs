import { access, cp, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const packageDist = resolve(root, 'node_modules/@3d-dice/dice-box/dist');
const destination = resolve(root, 'dist/vendor/dice-box-1.1.4');

try {
  const workerSource = resolve(packageDist, 'world.offscreen.min.js');
  const ammoSource = resolve(packageDist, 'assets/ammo');
  await access(workerSource);
  await access(resolve(ammoSource, 'ammo.wasm.wasm'));

  await mkdir(destination, { recursive: true });
  await copyFile(workerSource, resolve(destination, 'world.offscreen.min.js'));
  await cp(ammoSource, resolve(destination, 'assets/ammo'), { recursive: true, force: true });

  await access(resolve(destination, 'world.offscreen.min.js'));
  await access(resolve(destination, 'assets/ammo/ammo.wasm.wasm'));
  console.log('Vendored required DiceBox offscreen worker and Ammo WASM into the release build.');
} catch (error) {
  console.error('DiceBox runtime asset vendoring failed:', error);
  process.exitCode = 1;
}
