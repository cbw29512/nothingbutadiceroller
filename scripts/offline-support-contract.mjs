import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONNECTIVITY_PROBE, detectOfflineMode } from '../js/connectivity.js';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

const [sw, support, app, appearance, connectivity, iconBuild, pkgSource, manifestSource] = await Promise.all([
  read('sw.js'),
  read('js/offline-support.js'),
  read('js/app.js'),
  read('js/appearance/appearance-runtime.mjs'),
  read('js/connectivity.js'),
  read('scripts/pwa-icons-build.mjs'),
  read('package.json'),
  read('site.webmanifest'),
]);
const pkg = JSON.parse(pkgSource);
const manifest = JSON.parse(manifestSource);

for (const path of [
  "'/js/app.js'",
  "'/pwa-icon-192.png'",
  "'/pwa-icon-512.png'",
  "'/vendor/dice-box-1.1.4/dice-box.es.min.js'",
  "'/vendor/dice-box-1.1.4/Dice.min.js'",
  "'/vendor/dice-box-1.1.4/world.none.min.js'",
  "'/vendor/dice-box-1.1.4/world.offscreen.min.js'",
  "'/vendor/dice-box-1.1.4/world.onscreen.min.js'",
  "'/vendor/dice-box-1.1.4/assets/ammo/ammo.wasm.wasm'",
  "'/vendor/dice-box-1.1.4/assets/themes/default/default.json'",
]) {
  assert.ok(sw.includes(path), `Offline core is missing required Default Dice/PWA asset ${path}.`);
}

assert.ok(sw.includes("const NETWORK_ONLY_PREFIXES = Object.freeze(['/api/', '/.netlify/']);"), 'API and Netlify paths must be explicitly network-only.');
assert.ok(sw.includes('if (isNetworkOnly(url.pathname)) return;'), 'Service worker must bypass caching for API/Netlify paths.');
assert.ok(sw.includes("if (url.pathname === '/' || url.pathname === '/index.html')"), 'Only the root navigation may use the offline shell fallback.');
assert.equal(sw.includes("'/customize.html'"), false, 'Dice Studio must not be precached into anonymous offline mode.');
assert.equal(sw.includes("'/rolls.html'"), false, 'Shortcut manager must not be precached into anonymous offline mode.');
assert.equal(sw.includes("'/robots.txt'"), false, 'Connectivity probe must remain outside the offline core cache.');
assert.equal(sw.includes("'/api/" + "dice"), false, 'No API endpoint may appear in the precache allowlist.');
assert.equal(sw.includes("'/.netlify/" + "identity"), false, 'No Netlify Identity endpoint may appear in the precache allowlist.');
assert.equal(sw.includes('caches.match(event.request)'), false, 'Service worker must not runtime-cache arbitrary requests.');

assert.ok(support.includes("serviceWorker.register('/sw.js'"), 'Offline support must register the root service worker.');
assert.ok(support.includes("updateViaCache: 'none'"), 'Service worker updates must bypass HTTP cache.');
assert.ok(support.includes("addEventListener('load'"), 'Service worker registration must wait until page load and not block first paint/roll startup.');

assert.equal(CONNECTIVITY_PROBE.path, '/robots.txt');
assert.ok(connectivity.includes("cache: 'no-store'"), 'Connectivity probe must bypass browser HTTP cache.');
assert.equal(await detectOfflineMode({ navigatorRef: { onLine: false }, fetchImpl: async () => { throw new Error('must not fetch'); } }), true);
let onlineProbePath = '';
assert.equal(await detectOfflineMode({
  navigatorRef: { onLine: true },
  fetchImpl: async (path) => {
    onlineProbePath = path;
    return { ok: true, status: 200 };
  },
  timeoutMs: 50,
  now: () => 12345,
}), false);
assert.ok(onlineProbePath.startsWith('/robots.txt?ndr-connectivity='));
assert.equal(await detectOfflineMode({
  navigatorRef: { onLine: true },
  fetchImpl: async () => { throw new TypeError('network unavailable'); },
  timeoutMs: 50,
}), true);

assert.ok(app.includes('initOfflineSupport();'), 'Main roller must initialize offline support.');
assert.ok(app.includes('const offlineMode = await detectOfflineMode();'), 'Main roller must verify real origin connectivity instead of trusting navigator.onLine alone.');
assert.ok(app.includes('prepareActiveDiceAppearance({ allowCustom: !offlineMode })'), 'Offline startup must disable custom appearance loading.');
assert.ok(app.includes('Offline mode uses Default Dice.'), 'Offline mode must tell the user Default Dice are in use.');
assert.ok(appearance.includes("if (!allowCustom) return defaultRuntime('Offline mode uses immutable Default Dice.');"), 'Appearance runtime must fail closed to immutable Default Dice offline.');

assert.ok(iconBuild.includes('const ICON_SIZES = Object.freeze([192, 512]);'), 'PWA icon build must generate the two launcher sizes.');
assert.ok(iconBuild.includes(".flatten({ background: MASKABLE_BACKGROUND })"), 'PWA launcher PNGs must flatten transparency onto the maskable background.');
assert.ok(iconBuild.includes("info.channels !== 3"), 'PWA icon build must reject output that still contains alpha.');
assert.ok(pkg.scripts?.build?.includes('node scripts/pwa-icons-build.mjs'), 'Production build must generate PWA launcher icons after dist exists.');
assert.ok(pkg.scripts?.build?.indexOf('node scripts/build.mjs') < pkg.scripts?.build?.indexOf('node scripts/pwa-icons-build.mjs'), 'PWA icons must be generated after the dist build.');
assert.ok(pkg.scripts?.build?.includes('node scripts/offline-build.mjs'), 'Production build must copy sw.js only after the main dist build exists.');
assert.ok(pkg.scripts?.build?.includes('node scripts/vendor-dicebox-runtime.mjs'), 'Production build must stage the locked DiceBox runtime required by the offline core.');

for (const [src, sizes] of [['/pwa-icon-192.png', '192x192'], ['/pwa-icon-512.png', '512x512']]) {
  const icon = manifest.icons?.find((candidate) => candidate.src === src);
  assert.ok(icon, `Manifest is missing ${src}.`);
  assert.equal(icon.sizes, sizes);
  assert.equal(icon.type, 'image/png');
  assert.ok(icon.purpose?.split(/\s+/).includes('maskable'), `${src} must be maskable.`);
  assert.ok(icon.purpose?.split(/\s+/).includes('any'), `${src} must remain usable as a general launcher icon.`);
}
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');

console.log('Offline/PWA contract passed: installable shell includes opaque 192/512 maskable launcher icons and every pinned Default Dice runtime asset, verified origin connectivity overrides unreliable browser online hints, APIs/Identity/custom cloud data are network-only, and offline appearance fails closed to immutable Default Dice.');
