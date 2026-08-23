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

    await client.evaluate("document.querySelector('#new-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
    assert.equal(await client.evaluate("document.querySelector('#face-mode')?.value"), 'raw', 'A new d20 should begin with standard RAW face labels.');
    assert.equal(await client.evaluate("document.querySelector('#apply-face')?.disabled"), false, 'Editable RAW faces must not block direct customization.');

    const visibleFace = await client.evaluate(`(() => {
      const face = document.querySelector('.studio-preview-die[data-die="d20"] span[data-preview-face="20"]');
      return { exists: Boolean(face), text: face?.textContent || '', title: face?.title || '' };
    })()`);
    assert.equal(visibleFace.exists, true, 'The visible d20 face must be an explicit face-edit target.');
    assert.equal(visibleFace.text, '20');
    assert.match(visibleFace.title, /Edit face 20/i);

    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 20 selected.')");
    const selected = await client.evaluate(`(() => ({
      die: document.querySelector('#selected-die-label')?.textContent || '',
      logicalFace: document.querySelector('#logical-face')?.value || '',
      faceLabel: document.querySelector('#logical-face-label')?.textContent || '',
      resultLabel: document.querySelector('#logical-result-label')?.textContent || '',
      value: document.querySelector('#face-value')?.value || '',
      valueDisabled: Boolean(document.querySelector('#face-value')?.disabled),
      colorDisabled: Boolean(document.querySelector('#custom-face-color')?.disabled),
      applyDisabled: Boolean(document.querySelector('#apply-face')?.disabled),
      focused: document.activeElement === document.querySelector('#face-value'),
    }))()`);
    assert.equal(selected.die, 'D20');
    assert.equal(selected.logicalFace, '20');
    assert.match(selected.faceLabel, /Face 20/);
    assert.match(selected.resultLabel, /Always reports 20/);
    assert.equal(selected.value, '20');
    assert.equal(selected.valueDisabled, false, 'Clicking visible 20 must expose its display editor.');
    assert.equal(selected.colorDisabled, false, 'Clicking visible 20 must expose its face color control.');
    assert.equal(selected.applyDisabled, false, 'Clicking visible 20 must enable Apply Face.');
    assert.equal(selected.focused, true, 'Clicking visible 20 must focus the face display editor.');

    await client.evaluate(`(() => {
      const value = document.querySelector('#face-value');
      value.value = 'CRIT';
      value.dispatchEvent(new Event('input', { bubbles: true }));
      const color = document.querySelector('#custom-face-color');
      color.value = '#ff00ff';
      color.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#apply-face')?.click();
    })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 20 updated visually.')");
    const edited = await client.evaluate(`(() => ({
      mode: document.querySelector('#face-mode')?.value || '',
      preview: document.querySelector('.studio-preview-die[data-die="d20"] span')?.textContent || '',
      map: document.querySelector('#face-map .face-node.active')?.textContent || '',
      result: document.querySelector('#logical-result-label')?.textContent || '',
      color: document.querySelector('#custom-face-color')?.value || '',
    }))()`);
    assert.equal(edited.mode, 'custom', 'Applying a direct face edit must enter custom appearance mode automatically.');
    assert.equal(edited.preview, 'CRIT', 'The visible d20 face must update immediately after Apply Face.');
    assert.equal(edited.map, 'CRIT');
    assert.match(edited.result, /Always reports 20/);
    assert.equal(edited.color.toLowerCase(), '#ff00ff');

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
    const total = await client.evaluate("Number(document.querySelector('#total-result')?.textContent)");
    assert.ok(total >= 1 && total <= 20, `Directly customized d20 must remain mechanically 1-20; received ${total}.`);

    console.log('Direct face editor passed: clicking the visible d20 20 selects Face 20, exposes its text/color controls, CRIT applies immediately, and the physical d20 remains 1-20.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Direct face editor failed:', error);
  process.exitCode = 1;
});