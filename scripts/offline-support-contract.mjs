import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

const [sw, support, app, appearance, pkgSource, manifestSource] = await Promise.all([
  read('sw.js'),
  read('js/offline-support.js'),
  read('js/app.js'),
  read('js/appearance/appearance-runtime.mjs'),
  read('package.json'),
  read('site.webmanifest'),
]);
const pkg = JSON.parse(pkgSource);
const manifest = JSON.parse(manifestSource);

for (const path of [
  "'/js/app.js'",
  "'/vendor/dice-box-1.1.4/dice-box.es.min.js'",
  "'/vendor/dice-box-1.1.4/Dice.min.js'",
  "'/vendor/dice-box-1.1.4/world.none.min.js'",
  "'/vendor/dice-box-1.1.4/world.offscreen.min.js'",
  "'/vendor/dice-box-1.1.4/world.onscreen.min.js'",
  "'/vendor/dice-box-1.1.4/assets/ammo/ammo.wasm.wasm'",
  "'/vendor/dice-box-1.1.4/assets/themes/default/default.json'",
]) {
  assert.ok(sw.includes(path), `Offline core is missing required Default Dice asset ${path}.`);
}

assert.ok(sw.includes("const NETWORK_ONLY_PREFIXES = Object.freeze(['/api/', '/.netlify/']);"), 'API and Netlify paths must be explicitly network-only.');
assert.ok(sw.includes('if (isNetworkOnly(url.pathname)) return;'), 'Service worker must bypass caching for API/Netlify paths.');
assert.ok(sw.includes("if (url.pathname === '/' || url.pathname === '/index.html')"), 'Only the root navigation may use the offline shell fallback.');
assert.equal(sw.includes("'/customize.html'"), false, 'Dice Studio must not be precached into anonymous offline mode.');
assert.equal(sw.includes("'/rolls.html'"), false, 'Shortcut manager must not be precached into anonymous offline mode.');
assert.equal(sw.includes("'/api/" + "dice"), false, 'No API endpoint may appear in the precache allowlist.');
assert.equal(sw.includes("'/.netlify/" + "identity"), false, 'No Netlify Identity endpoint may appear in the precache allowlist.');
assert.equal(sw.includes('caches.match(event.request)'), false, 'Service worker must not runtime-cache arbitrary requests.');

assert.ok(support.includes("serviceWorker.register('/sw.js'"), 'Offline support must register the root service worker.');
assert.ok(support.includes("updateViaCache: 'none'"), 'Service worker updates must bypass HTTP cache.');
assert.ok(support.includes("addEventListener('load'"), 'Service worker registration must wait until page load and not block first paint/roll startup.');

assert.ok(app.includes('initOfflineSupport();'), 'Main roller must initialize offline support.');
assert.ok(app.includes('const offlineMode = navigator.onLine === false;'), 'Main roller must explicitly detect browser offline state.');
assert.ok(app.includes('prepareActiveDiceAppearance({ allowCustom: !offlineMode })'), 'Offline startup must disable custom appearance loading.');
assert.ok(app.includes('Offline mode uses Default Dice.'), 'Offline mode must tell the user Default Dice are in use.');
assert.ok(appearance.includes("if (!allowCustom) return defaultRuntime('Offline mode uses immutable Default Dice.');"), 'Appearance runtime must fail closed to immutable Default Dice offline.');

assert.ok(pkg.scripts?.build?.includes('node scripts/offline-build.mjs'), 'Production build must copy sw.js only after the main dist build exists.');
assert.ok(pkg.scripts?.build?.includes('node scripts/vendor-dicebox-runtime.mjs'), 'Production build must stage the locked DiceBox runtime required by the offline core.');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');

console.log('Offline support contract passed: installable shell includes every pinned Default Dice runtime asset, APIs/Identity/custom cloud data are network-only, registration is post-load, and offline appearance fails closed to immutable Default Dice.');
