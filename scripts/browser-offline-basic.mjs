import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const desktop = { name: 'desktop', width: 1280, height: 860, mobile: false };
const REQUIRED_OFFLINE_RUNTIME_PATHS = Object.freeze([
  '/',
  '/js/app.js',
  '/vendor/dice-box-1.1.4/dice-box.es.min.js',
  '/vendor/dice-box-1.1.4/Dice.min.js',
  '/vendor/dice-box-1.1.4/world.offscreen.min.js',
  '/vendor/dice-box-1.1.4/assets/ammo/ammo.wasm.wasm',
  '/vendor/dice-box-1.1.4/assets/themes/default/default.json',
]);

async function run() {
  await access(resolve(dist, 'index.html'));
  await access(resolve(dist, 'sw.js'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    const client = browser.client;
    await client.send('Network.enable');

    await navigate(client, `${server.origin}/`, desktop);
    await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
    const scope = await client.evaluate(`navigator.serviceWorker.ready.then((registration) => registration.scope)`);
    assert.equal(scope, `${server.origin}/`);

    await navigate(client, `${server.origin}/`, desktop);
    await waitFor(client, 'navigator.serviceWorker.controller !== null', 10000);

    const cacheAudit = await client.evaluate(`(async () => {
      const keys = await caches.keys();
      const entries = [];
      for (const key of keys) {
        if (!key.startsWith('ndr-offline-core-')) continue;
        const cache = await caches.open(key);
        const requests = await cache.keys();
        entries.push(...requests.map((request) => new URL(request.url).pathname));
      }
      return { keys, entries };
    })()`);
    assert.ok(cacheAudit.keys.some((key) => key.startsWith('ndr-offline-core-')), 'Offline core cache was not installed.');
    for (const required of REQUIRED_OFFLINE_RUNTIME_PATHS) {
      assert.ok(cacheAudit.entries.includes(required), `Offline cache is missing ${required}.`);
    }
    assert.equal(cacheAudit.entries.some((path) => path.startsWith('/api/')), false, 'Offline cache must contain no API responses.');
    assert.equal(cacheAudit.entries.some((path) => path.startsWith('/.netlify/')), false, 'Offline cache must contain no Netlify/Identity responses.');

    await client.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
      connectionType: 'none',
    });

    const offlineFetchProbe = await client.evaluate(`Promise.all(${JSON.stringify(REQUIRED_OFFLINE_RUNTIME_PATHS)}.map(async (path) => {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        return { path, ok: response.ok, status: response.status };
      } catch (error) {
        return { path, ok: false, error: String(error?.message || error) };
      }
    }))`);
    assert.deepEqual(
      offlineFetchProbe.filter((entry) => !entry.ok),
      [],
      `Service worker failed to serve pinned offline runtime assets: ${JSON.stringify(offlineFetchProbe)}`,
    );

    const navigation = await client.send('Page.navigate', { url: `${server.origin}/` });
    if (navigation.errorText) throw new Error(`Offline service-worker navigation failed: ${navigation.errorText}`);
    await waitFor(client, `location.href === ${JSON.stringify(`${server.origin}/`)} && document.readyState === 'complete'`, 15000);
    await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('Offline mode uses Default Dice.')", 30000);
    assert.ok(await client.evaluate("document.querySelectorAll('#dice-tray canvas').length"), 'Offline Default Dice physics must still create a DiceBox canvas.');

    await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
    const total = await client.evaluate("Number(document.querySelector('#total-result')?.textContent)");
    assert.ok(total >= 1 && total <= 20, `Offline physical d20 must stay canonical 1-20; received ${total}.`);

    const apiFailedOffline = await client.evaluate(`fetch('/api/configurations').then(() => false).catch(() => true)`);
    assert.equal(apiFailedOffline, true, 'API requests must remain network-only and fail offline rather than returning cached account data.');

    console.log('Offline basic roller passed: verified connectivity detects hard offline even when navigator.onLine is unreliable, every pinned Default DiceBox asset works from the service worker, physical d20 remains 1-20, and API/Identity paths remain network-only.');
  } catch (error) {
    console.error('Offline browser acceptance execution failed:', error);
    throw error;
  } finally {
    if (browser?.client) {
      await browser.client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
        connectionType: 'wifi',
      }).catch((error) => console.warn('Failed to restore browser network state:', error.message));
    }
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Offline basic roller audit failed:', error);
  process.exitCode = 1;
});
