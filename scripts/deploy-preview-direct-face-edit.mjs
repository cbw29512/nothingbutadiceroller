import assert from 'node:assert/strict';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';

const origin = String(process.env.DEPLOY_PREVIEW_ORIGIN || '').trim().replace(/\/$/, '');
if (!/^https:\/\/deploy-preview-\d+--nothingbutattrpgdiceroller\.netlify\.app$/.test(origin)) {
  throw new Error('DEPLOY_PREVIEW_ORIGIN must be the Nothing But A Dice Roller Netlify PR preview origin.');
}
const desktop = { width: 1440, height: 900, mobile: false };
function previewPage(pathname = '/') {
  const url = new URL(pathname, `${origin}/`); url.searchParams.set('ntl-drawer-state', 'hidden'); return url.href;
}

async function run() {
  let browser;
  try {
    browser = await launchBrowser();
    const client = browser.client;
    await navigate(client, previewPage('/customize.html'), desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
    await client.evaluate('localStorage.clear()');
    await navigate(client, previewPage('/customize.html'), desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);

    await client.evaluate("document.querySelector('#new-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
    await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')");
    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 20 selected.')");

    const selected = await client.evaluate(`(() => ({
      logicalFace: document.querySelector('#logical-face')?.value || '',
      value: document.querySelector('#face-value')?.value || '',
      editable: !document.querySelector('#face-value')?.disabled && !document.querySelector('#custom-face-color')?.disabled && !document.querySelector('#apply-face')?.disabled,
      focused: document.activeElement === document.querySelector('#face-value'),
      result: document.querySelector('#logical-result-label')?.textContent || '',
    }))()`);
    assert.equal(selected.logicalFace, '20');
    assert.equal(selected.value, '20');
    assert.equal(selected.editable, true, 'Live visible face 20 must immediately expose editable text/color controls.');
    assert.equal(selected.focused, true, 'Live visible face 20 must focus its display editor.');
    assert.match(selected.result, /Always reports 20/);

    await client.evaluate(`(() => {
      const value = document.querySelector('#face-value');
      value.value = 'CRIT'; value.dispatchEvent(new Event('input', { bubbles: true }));
      const color = document.querySelector('#custom-face-color');
      color.value = '#ff00ff'; color.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#apply-face')?.click();
    })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 20 updated visually.')");
    assert.equal(await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] span')?.textContent"), 'CRIT');
    assert.equal(await client.evaluate("document.querySelector('#face-mode')?.value"), 'custom');

    await client.evaluate("document.querySelector('#save-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
    await client.evaluate("document.querySelector('#use-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Set marked active for the roller.')");
    await client.evaluate("document.querySelector('.studio-header a[href=\"/\"]')?.click()");
    await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
    await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);

    const roll = await client.evaluate(`(() => ({
      total: Number(document.querySelector('#total-result')?.textContent),
      diffuse: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
    }))()`);
    assert.ok(roll.total >= 1 && roll.total <= 20, `Live directly customized d20 must remain 1-20; received ${roll.total}.`);
    assert.ok(roll.diffuse.length >= 1, 'Live direct face edit must generate a custom d20 diffuse texture.');
    let critTexture = false;
    for (const url of roll.diffuse) {
      const response = await fetch(url); if (!response.ok) continue;
      const text = await response.text(); if (text.includes('CRIT')) critTexture = true;
    }
    assert.equal(critTexture, true, 'Live generated d20 texture must contain the direct CRIT face edit.');

    console.log('Live direct face edit passed: clicking visible d20 20 exposes text/color controls, CRIT reaches the generated texture, Save/Use work, and the physical d20 remains 1-20.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Live direct face edit failed:', error);
  process.exitCode = 1;
});