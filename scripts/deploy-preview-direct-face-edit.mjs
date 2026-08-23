import assert from 'node:assert/strict';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';

const origin = String(process.env.DEPLOY_PREVIEW_ORIGIN || '').trim().replace(/\/$/, '');
if (!/^https:\/\/deploy-preview-\d+--nothingbutattrpgdiceroller\.netlify\.app$/.test(origin)) {
  throw new Error('DEPLOY_PREVIEW_ORIGIN must be the Nothing But A Dice Roller Netlify PR preview origin.');
}
const desktop = { width: 1440, height: 900, mobile: false };
const CUSTOM_TRAY_COLOR = '#005577';
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

    const defaultState = await client.evaluate(`(() => ({
      name: document.querySelector('#set-name')?.value || '',
      applyDisabled: Boolean(document.querySelector('#apply-face')?.disabled),
    }))()`);
    assert.equal(defaultState.name, 'Default Dice', 'Live regression must begin from immutable Default Dice.');
    assert.equal(defaultState.applyDisabled, true, 'Live Default Dice must remain immutable before customization intent.');

    await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')");
    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Editable copy created.')");

    const selected = await client.evaluate(`(() => ({
      setName: document.querySelector('#set-name')?.value || '',
      logicalFace: document.querySelector('#logical-face')?.value || '',
      value: document.querySelector('#face-value')?.value || '',
      editable: !document.querySelector('#set-name')?.disabled && !document.querySelector('#face-value')?.disabled && !document.querySelector('#custom-face-color')?.disabled && !document.querySelector('#apply-face')?.disabled,
      focused: document.activeElement === document.querySelector('#face-value'),
      result: document.querySelector('#logical-result-label')?.textContent || '',
      defaultStillPresent: [...document.querySelectorAll('#studio-library .studio-set-card')].some((card) => /Default Dice/.test(card.textContent) && /Immutable Default/.test(card.textContent)),
    }))()`);
    assert.equal(selected.setName, 'New Dice Set', 'Clicking live Default face 20 must automatically create an editable copy.');
    assert.equal(selected.logicalFace, '20');
    assert.equal(selected.value, '20');
    assert.equal(selected.editable, true, 'Live Default face 20 must immediately expose editable text/color controls on the new copy.');
    assert.equal(selected.focused, true, 'Live visible face 20 must focus its display editor.');
    assert.match(selected.result, /Always reports 20/);
    assert.equal(selected.defaultStillPresent, true, 'Live automatic copy must leave immutable Default Dice present and untouched.');

    await client.evaluate(`(() => {
      const value = document.querySelector('#face-value');
      value.value = 'CRIT'; value.dispatchEvent(new Event('input', { bubbles: true }));
      const color = document.querySelector('#custom-face-color');
      color.value = '#ff00ff'; color.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#apply-face')?.click();
      const tray = document.querySelector('#tray-color');
      tray.value = '${CUSTOM_TRAY_COLOR}'; tray.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"] span')?.textContent === 'CRIT'");
    assert.equal(await client.evaluate("document.querySelector('#face-mode')?.value"), 'custom');
    assert.match(await client.evaluate("document.querySelector('#use-set')?.textContent || ''"), /Use This Set.*Back to Roller/i);

    await client.evaluate("document.querySelector('#save-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
    await client.evaluate("document.querySelector('#use-set')?.click()");
    await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);

    const handoff = await client.evaluate(`(() => ({
      activeClass: document.body.classList.contains('appearance-v2-active'),
      trayVar: document.body.style.getPropertyValue('--appearance-v2-tray-bg'),
      activeId: localStorage.getItem('ndr.appearance.activeSet.v2') || '',
      snapshot: localStorage.getItem('ndr.appearance.activeSnapshot.v2') || '',
    }))()`);
    assert.equal(handoff.activeClass, true, 'Live roller must enable custom appearance after Studio activation.');
    assert.match(handoff.trayVar.toLowerCase(), /#005577/, 'Live roller must visibly apply the customized tray color.');
    assert.notEqual(handoff.activeId, 'system_default', 'Live roller must retain the customized set as active.');
    assert.match(handoff.snapshot, /CRIT/, 'Live active snapshot must contain the customized d20 face.');

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
    assert.ok(roll.diffuse.length >= 1, 'Live Studio handoff must generate a custom d20 diffuse texture.');
    let critTexture = false;
    for (const url of roll.diffuse) {
      const response = await fetch(url); if (!response.ok) continue;
      const text = await response.text(); if (text.includes('CRIT')) critTexture = true;
    }
    assert.equal(critTexture, true, 'Live generated d20 texture must contain the CRIT face after Studio handoff.');

    console.log('Live Studio-to-roller handoff passed: immutable Default auto-copy, CRIT face, custom tray color, Save, one-click Use+Back, visible roller tray application, active snapshot, generated texture, and physical d20 all persist.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Live direct face edit failed:', error);
  process.exitCode = 1;
});