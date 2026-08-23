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

    const defaultPicker = await client.evaluate(`(() => ({
      exists: Boolean(document.querySelector('#face-symbol-picker')),
      count: document.querySelectorAll('[data-face-symbol]').length,
      disabled: [...document.querySelectorAll('[data-face-symbol]')].every((button) => button.disabled),
    }))()`);
    assert.equal(defaultPicker.exists, true, 'Live Dice Studio must expose the face symbol picker.');
    assert.ok(defaultPicker.count >= 30, `Live picker must expose at least 30 curated symbols; received ${defaultPicker.count}.`);
    assert.equal(defaultPicker.disabled, true, 'Live immutable Default Dice must disable symbol insertion.');

    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Editable copy created.')");
    await waitFor(client, "document.querySelector('#face-value')?.value === '20' && !document.querySelector('[data-face-symbol=\"☠\"]')?.disabled");

    await client.evaluate(`(() => {
      document.querySelector('#face-symbol-picker').open = true;
      document.querySelector('[data-face-symbol="☠"]')?.click();
    })()`);
    await waitFor(client, "document.querySelector('#face-value')?.value === '☠'");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('skull selected for this face')");
    await client.evaluate("document.querySelector('#apply-face')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 20 updated visually.')");

    await client.evaluate("document.querySelector('#save-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
    await client.evaluate("document.querySelector('#use-set')?.click()");
    await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);

    const snapshot = await client.evaluate("JSON.parse(localStorage.getItem('ndr.appearance.activeSnapshot.v2') || 'null')");
    assert.equal(snapshot?.appearance?.diceSet?.dice?.d20?.faces?.['20']?.value, '☠', 'Live active snapshot must preserve the picked skull symbol.');

    await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);

    const roll = await client.evaluate(`(() => ({
      total: Number(document.querySelector('#total-result')?.textContent),
      diffuse: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
    }))()`);
    assert.ok(roll.total >= 1 && roll.total <= 20, `Live symbol-themed d20 must remain mechanically 1-20; received ${roll.total}.`);
    let skullTexture = false;
    for (const url of roll.diffuse) {
      const response = await fetch(url); if (!response.ok) continue;
      const svg = await response.text(); if (svg.includes('☠')) skullTexture = true;
    }
    assert.equal(skullTexture, true, 'Live generated physical d20 texture must contain the selected skull symbol.');
    console.log('Live face symbol picker passed: one-tap skull selection, immutable-default protection, Save/Use persistence, generated texture, and physical d20 mechanics all persist.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Live face symbol picker failed:', error);
  process.exitCode = 1;
});
