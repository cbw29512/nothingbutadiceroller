import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const desktop = { width: 1440, height: 900, mobile: false };

async function run() {
  await access(resolve(dist, 'customize.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    const client = browser.client;
    await navigate(client, `${server.origin}/customize.html`, desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
    await client.evaluate('localStorage.clear()');
    await navigate(client, `${server.origin}/customize.html`, desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");

    const initial = await client.evaluate(`(() => ({
      picker: Boolean(document.querySelector('#face-symbol-picker')),
      options: document.querySelectorAll('[data-face-symbol]').length,
      disabled: [...document.querySelectorAll('[data-face-symbol]')].every((button) => button.disabled),
    }))()`);
    assert.equal(initial.picker, true, 'Face symbol picker must be present in Dice Studio.');
    assert.ok(initial.options >= 30, `Expected at least 30 curated face symbols; received ${initial.options}.`);
    assert.equal(initial.disabled, true, 'Immutable Default Dice must disable symbol insertion.');

    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] [data-preview-face=\"20\"]')?.click()");
    await waitFor(client, "document.querySelector('#face-value')?.value === '20' && !document.querySelector('#face-value')?.disabled");
    await waitFor(client, "[...document.querySelectorAll('[data-face-symbol]')].every((button) => !button.disabled)");

    await client.evaluate(`(() => {
      const picker = document.querySelector('#face-symbol-picker');
      picker.open = true;
      document.querySelector('[data-face-symbol="☠"]')?.click();
    })()`);
    await waitFor(client, "document.querySelector('#face-value')?.value === '☠'");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('skull selected for this face')");
    assert.equal(await client.evaluate("document.querySelector('#face-value')?.value"), '☠', 'Choosing a symbol should replace the selected face label, not append to it.');

    await client.evaluate("document.querySelector('#apply-face')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 20 updated visually.')");
    assert.equal(await client.evaluate("document.querySelector('#face-map .face-node.active')?.textContent"), '☠');

    await client.evaluate("document.querySelector('#save-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
    await client.evaluate("document.querySelector('#use-set')?.click()");
    await waitFor(client, "location.pathname === '/'", 10000);
    await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);

    await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);

    const roll = await client.evaluate(`(() => ({
      total: Number(document.querySelector('#total-result')?.textContent),
      diffuse: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
      snapshot: JSON.parse(localStorage.getItem('ndr.appearance.activeSnapshot.v2') || 'null'),
    }))()`);
    assert.ok(roll.total >= 1 && roll.total <= 20, `Symbol-themed d20 must remain mechanically 1-20; received ${roll.total}.`);
    assert.equal(roll.snapshot?.appearance?.diceSet?.dice?.d20?.faces?.['20']?.value, '☠', 'Active snapshot must preserve the picked skull symbol.');
    assert.ok(roll.diffuse.length >= 1, 'Symbol-themed d20 must request a generated diffuse texture.');

    let skullTexture = false;
    for (const url of roll.diffuse) {
      const svg = await (await fetch(url)).text();
      if (svg.includes('☠')) skullTexture = true;
    }
    assert.equal(skullTexture, true, 'Generated physical d20 texture must contain the selected skull symbol.');
    console.log('Face symbol picker passed: curated touch picker, immutable-default protection, one-tap skull replacement, Save/Use persistence, generated texture, and physical d20 mechanics are all wired.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Face symbol picker failed:', error);
  process.exitCode = 1;
});
