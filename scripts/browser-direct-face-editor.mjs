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
const CUSTOM_TRAY_COLOR = '#005577';

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

    const defaultState = await client.evaluate(`(() => ({
      name: document.querySelector('#set-name')?.value || '',
      applyDisabled: Boolean(document.querySelector('#apply-face')?.disabled),
      defaultCard: document.querySelector('#studio-library .studio-set-card')?.textContent || '',
    }))()`);
    assert.equal(defaultState.name, 'Default Dice', 'The regression must begin from immutable Default Dice.');
    assert.equal(defaultState.applyDisabled, true, 'Default Dice face editing must remain immutable until user intent creates a copy.');
    assert.match(defaultState.defaultCard, /Immutable Default/);

    const visibleFace = await client.evaluate(`(() => {
      const face = document.querySelector('.studio-preview-die[data-die="d20"] span[data-preview-face="20"]');
      return { exists: Boolean(face), text: face?.textContent || '', title: face?.title || '' };
    })()`);
    assert.equal(visibleFace.exists, true, 'The visible d20 face must be an explicit face-edit target.');
    assert.equal(visibleFace.text, '20');
    assert.match(visibleFace.title, /Edit face 20/i);

    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Editable copy created.')");
    const selected = await client.evaluate(`(() => ({
      die: document.querySelector('#selected-die-label')?.textContent || '',
      setName: document.querySelector('#set-name')?.value || '',
      setNameDisabled: Boolean(document.querySelector('#set-name')?.disabled),
      logicalFace: document.querySelector('#logical-face')?.value || '',
      faceLabel: document.querySelector('#logical-face-label')?.textContent || '',
      resultLabel: document.querySelector('#logical-result-label')?.textContent || '',
      value: document.querySelector('#face-value')?.value || '',
      valueDisabled: Boolean(document.querySelector('#face-value')?.disabled),
      colorDisabled: Boolean(document.querySelector('#custom-face-color')?.disabled),
      applyDisabled: Boolean(document.querySelector('#apply-face')?.disabled),
      focused: document.activeElement === document.querySelector('#face-value'),
      defaultStillPresent: [...document.querySelectorAll('#studio-library .studio-set-card')].some((card) => /Default Dice/.test(card.textContent) && /Immutable Default/.test(card.textContent)),
    }))()`);
    assert.equal(selected.die, 'D20');
    assert.equal(selected.setName, 'New Dice Set', 'Clicking a Default face must create a separate editable set automatically.');
    assert.equal(selected.setNameDisabled, false, 'The automatic copy must be editable.');
    assert.equal(selected.logicalFace, '20');
    assert.match(selected.faceLabel, /Face 20/);
    assert.match(selected.resultLabel, /Always reports 20/);
    assert.equal(selected.value, '20');
    assert.equal(selected.valueDisabled, false, 'Clicking visible 20 from Default must expose its display editor.');
    assert.equal(selected.colorDisabled, false, 'Clicking visible 20 from Default must expose its face color control.');
    assert.equal(selected.applyDisabled, false, 'Clicking visible 20 from Default must enable Apply Face.');
    assert.equal(selected.focused, true, 'Clicking visible 20 must focus the face display editor.');
    assert.equal(selected.defaultStillPresent, true, 'Automatic customization must never mutate or remove immutable Default Dice.');

    await client.evaluate(`(() => {
      const value = document.querySelector('#face-value');
      value.value = 'CRIT';
      value.dispatchEvent(new Event('input', { bubbles: true }));
      const color = document.querySelector('#custom-face-color');
      color.value = '#ff00ff';
      color.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#apply-face')?.click();
      const tray = document.querySelector('#tray-color');
      tray.value = '${CUSTOM_TRAY_COLOR}';
      tray.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"] span')?.textContent === 'CRIT'");
    const edited = await client.evaluate(`(() => ({
      mode: document.querySelector('#face-mode')?.value || '',
      preview: document.querySelector('.studio-preview-die[data-die="d20"] span')?.textContent || '',
      map: document.querySelector('#face-map .face-node.active')?.textContent || '',
      result: document.querySelector('#logical-result-label')?.textContent || '',
      color: document.querySelector('#custom-face-color')?.value || '',
      trayColor: document.querySelector('#tray-color')?.value || '',
      useLabel: document.querySelector('#use-set')?.textContent || '',
    }))()`);
    assert.equal(edited.mode, 'custom', 'Applying a direct face edit must enter custom appearance mode automatically.');
    assert.equal(edited.preview, 'CRIT', 'The visible d20 face must update immediately after Apply Face.');
    assert.equal(edited.map, 'CRIT');
    assert.match(edited.result, /Always reports 20/);
    assert.equal(edited.color.toLowerCase(), '#ff00ff');
    assert.equal(edited.trayColor.toLowerCase(), CUSTOM_TRAY_COLOR);
    assert.match(edited.useLabel, /Use This Set.*Back to Roller/i, 'Activation control must make the roller handoff explicit.');

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
    assert.equal(handoff.activeClass, true, 'Main roller must enable the active appearance class after Studio handoff.');
    assert.match(handoff.trayVar.toLowerCase(), /#005577/, 'Main roller tray must visibly use the customized tray color.');
    assert.notEqual(handoff.activeId, 'system_default', 'Main roller must keep the customized set active.');
    assert.match(handoff.snapshot, /CRIT/, 'Active roller snapshot must contain the customized face.');

    await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
    const total = await client.evaluate("Number(document.querySelector('#total-result')?.textContent)");
    assert.ok(total >= 1 && total <= 20, `Directly customized d20 must remain mechanically 1-20; received ${total}.`);

    console.log('Studio-to-roller handoff passed: Default face auto-copy, CRIT face, custom tray color, Save, one-click Use+Back, visible roller tray application, active snapshot, and physical d20 mechanics all persist.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Direct face editor failed:', error);
  process.exitCode = 1;
});