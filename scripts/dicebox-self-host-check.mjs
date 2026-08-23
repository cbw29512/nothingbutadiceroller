import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPEARANCE_DICEBOX_VERSION,
  DICEBOX_ASSET_PATH,
  DICEBOX_DEFAULT_MODEL_URL,
  DICEBOX_MODULE_URL,
  DICEBOX_VENDOR_BASE,
} from '../js/appearance/dicebox-self-host.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const vendorRoot = resolve(root, `vendor/dice-box-${APPEARANCE_DICEBOX_VERSION}`);
const remotePatterns = [
  'cdn.jsdelivr.net/npm/@3d-dice/dice-box',
  'unpkg.com/@3d-dice/dice-box',
];

async function source(path) { return readFile(resolve(root, path), 'utf8'); }
function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

try {
  assert.equal(APPEARANCE_DICEBOX_VERSION, '1.1.4');
  assert.equal(DICEBOX_VENDOR_BASE, '/vendor/dice-box-1.1.4/');
  assert.equal(DICEBOX_MODULE_URL, '/vendor/dice-box-1.1.4/dice-box.es.min.js');
  assert.equal(DICEBOX_ASSET_PATH, '/vendor/dice-box-1.1.4/assets/');
  assert.equal(DICEBOX_DEFAULT_MODEL_URL, '/vendor/dice-box-1.1.4/assets/themes/default/default.json');

  const packageJson = JSON.parse(await source('package.json'));
  const lockJson = JSON.parse(await source('package-lock.json'));
  assert.equal(packageJson.dependencies?.['@3d-dice/dice-box'], APPEARANCE_DICEBOX_VERSION, 'DiceBox build source must be pinned exactly.');
  assert.equal(lockJson.packages?.['node_modules/@3d-dice/dice-box']?.version, APPEARANCE_DICEBOX_VERSION, 'Lockfile must pin the exact DiceBox build source.');

  const upstream = JSON.parse(await readFile(resolve(vendorRoot, 'upstream-package.json'), 'utf8'));
  assert.equal(upstream.name, '@3d-dice/dice-box');
  assert.equal(upstream.version, APPEARANCE_DICEBOX_VERSION);

  const manifest = await readFile(resolve(vendorRoot, 'VENDOR_MANIFEST.sha256'), 'utf8');
  const manifestLines = manifest.trim().split(/\r?\n/).filter(Boolean);
  assert.ok(manifestLines.length >= 8, 'DiceBox vendor manifest must cover runtime, provenance, license, and default theme assets.');
  for (const line of manifestLines) {
    const match = line.match(/^([a-f0-9]{64})\s+\*?(\.\/.*)$/i);
    assert.ok(match, `Invalid DiceBox vendor manifest line: ${line}`);
    const relative = match[2].replace(/^\.\//, '');
    const path = resolve(vendorRoot, relative);
    assert.ok(path.startsWith(`${vendorRoot}/`) || path === vendorRoot, 'Vendor manifest path escaped its root.');
    assert.equal(sha256(await readFile(path)), match[1].toLowerCase(), `Vendored DiceBox hash mismatch: ${relative}`);
  }

  const requiredVendorFiles = [
    'dice-box.es.min.js', 'LICENSE', 'upstream-package.json',
    'assets/themes/default/default.json', 'assets/themes/default/theme.config.json',
    'assets/themes/default/diffuse-dark.png', 'assets/themes/default/diffuse-light.png',
    'assets/themes/default/normal.png', 'assets/themes/default/specular.jpg',
  ];
  await Promise.all(requiredVendorFiles.map((path) => readFile(resolve(vendorRoot, path))));

  const [physics, loader, selfHost, build, runtimeVendor, netlify, privacy] = await Promise.all([
    source('js/physics.js'),
    source('js/appearance/dicebox-model-loader.mjs'),
    source('js/appearance/dicebox-self-host.mjs'),
    source('scripts/build.mjs'),
    source('scripts/vendor-dicebox-runtime.mjs'),
    source('netlify.toml'),
    source('privacy.html'),
  ]);
  for (const [label, text] of [['physics', physics], ['model loader', loader], ['self-host module', selfHost]]) {
    for (const remote of remotePatterns) assert.equal(text.includes(remote), false, `${label} must not execute DiceBox from ${remote}.`);
  }
  assert.ok(physics.includes('loadSelfHostedDiceBox()'));
  assert.ok(physics.includes('assetPath: DICEBOX_ASSET_PATH'));
  assert.ok(physics.includes('origin: diceBoxOrigin(window.location)'));
  assert.ok(loader.includes('DICEBOX_DEFAULT_MODEL_URL'));
  assert.ok(build.includes("const directories = ['js', 'vendor'];"));
  assert.ok(build.includes('vendor/dice-box-1.1.4/dice-box.es.min.js'));
  assert.ok(build.includes('Vendored DiceBox provenance does not match pinned @3d-dice/dice-box 1.1.4.'));
  assert.ok(packageJson.scripts?.build?.includes('scripts/vendor-dicebox-runtime.mjs'), 'Release build must copy required DiceBox worker/WASM assets.');
  assert.ok(runtimeVendor.includes("node_modules/@3d-dice/dice-box/dist"), 'Runtime assets must come from the exact locked DiceBox package.');
  assert.ok(runtimeVendor.includes("world.offscreen.min.js"), 'Release must include DiceBox offscreen worker.');
  assert.ok(runtimeVendor.includes("assets/ammo"), 'Release must include DiceBox Ammo runtime directory.');
  assert.ok(runtimeVendor.includes("ammo.wasm.wasm"), 'Release must verify Ammo WASM exists.');

  for (const policy of [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self' https://app.netlify.com",
  ]) assert.ok(netlify.includes(policy), `Missing hardened CSP directive: ${policy}`);
  assert.ok(netlify.includes('for = "/vendor/dice-box-1.1.4/*"'));
  assert.equal(privacy.includes('DiceBox distribution CDNs'), false, 'Privacy page must not claim runtime CDN dependence after self-hosting.');

  console.log('DiceBox self-host contract passed: pinned 1.1.4 vendor provenance, same-origin runtime/model paths, required offscreen worker + Ammo WASM release copying, and hardened CSP/frame protections are enforced.');
} catch (error) {
  console.error('DiceBox self-host contract failed:', error);
  process.exitCode = 1;
}
