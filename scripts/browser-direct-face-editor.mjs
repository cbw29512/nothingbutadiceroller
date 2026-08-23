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
const mobile = { width: 390, height: 844, mobile: true };
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
      font: document.querySelector('#face-font')?.value || '',
      fontDisabled: Boolean(document.querySelector('#face-font')?.disabled),
      fontOptions: [...document.querySelectorAll('#face-font option')].map((option) => [option.value, option.textContent]),
      defaultCard: document.querySelector('#studio-library .studio-set-card')?.textContent || '',
    }))()`);
    assert.equal(defaultState.name, 'Default Dice', 'The regression must begin from immutable Default Dice.');
    assert.equal(defaultState.applyDisabled, true, 'Default Dice face editing must remain immutable until user intent creates a copy.');
    assert.equal(defaultState.font, 'default', 'RAW faces must present the safe default typography.');
    assert.equal(defaultState.fontDisabled, true, 'Immutable Default Dice typography must be read-only.');
    assert.deepEqual(defaultState.fontOptions.map(([value]) => value), ['default', 'fantasy', 'mono']);
    assert.match(defaultState.defaultCard, /Immutable Default/);

    const visibleFace = await client.evaluate(`(() => {
      const face = document.querySelector('.studio-preview-die[data-die="d20"] span[data-preview-face="20"]');
      return { exists: Boolean(face), text: face?.textContent || '', title: face?.title || '', font: face?.style.fontFamily || '' };
    })()`);
    assert.equal(visibleFace.exists, true, 'The visible d20 face must be an explicit face-edit target.');
    assert.equal(visibleFace.text, '20'); assert.match(visibleFace.title, /Edit face 20/i); assert.match(visibleFace.font, /Arial|sans-serif/i);

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
      font: document.querySelector('#face-font')?.value || '',
      fontDisabled: Boolean(document.querySelector('#face-font')?.disabled),
      applyDisabled: Boolean(document.querySelector('#apply-face')?.disabled),
      focused: document.activeElement === document.querySelector('#face-value'),
      defaultStillPresent: [...document.querySelectorAll('#studio-library .studio-set-card')].some((card) => /Default Dice/.test(card.textContent) && /Immutable Default/.test(card.textContent)),
    }))()`);
    assert.equal(selected.die, 'D20'); assert.equal(selected.setName, 'New Dice Set'); assert.equal(selected.setNameDisabled, false);
    assert.equal(selected.logicalFace, '20'); assert.match(selected.faceLabel, /Face 20/); assert.match(selected.resultLabel, /Always reports 20/);
    assert.equal(selected.value, '20'); assert.equal(selected.valueDisabled, false); assert.equal(selected.colorDisabled, false);
    assert.equal(selected.font, 'default'); assert.equal(selected.fontDisabled, false, 'Editable copy must expose the face typography control.');
    assert.equal(selected.applyDisabled, false); assert.equal(selected.focused, true); assert.equal(selected.defaultStillPresent, true);

    await client.evaluate(`(() => {
      const value = document.querySelector('#face-value'); value.value = 'CRIT'; value.dispatchEvent(new Event('input', { bubbles: true }));
      const color = document.querySelector('#custom-face-color'); color.value = '#ff00ff'; color.dispatchEvent(new Event('input', { bubbles: true }));
      const font = document.querySelector('#face-font'); font.value = 'fantasy'; font.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#apply-face')?.click();
      const tray = document.querySelector('#tray-color'); tray.value = '${CUSTOM_TRAY_COLOR}'; tray.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"] span')?.textContent === 'CRIT'");
    const edited = await client.evaluate(`(() => ({
      mode: document.querySelector('#face-mode')?.value || '',
      preview: document.querySelector('.studio-preview-die[data-die="d20"] span')?.textContent || '',
      previewFont: document.querySelector('.studio-preview-die[data-die="d20"] span')?.style.fontFamily || '',
      map: document.querySelector('#face-map .face-node.active')?.textContent || '',
      mapFont: document.querySelector('#face-map .face-node.active')?.style.fontFamily || '',
      result: document.querySelector('#logical-result-label')?.textContent || '',
      color: document.querySelector('#custom-face-color')?.value || '',
      font: document.querySelector('#face-font')?.value || '',
      trayColor: document.querySelector('#tray-color')?.value || '',
      useLabel: document.querySelector('#use-set')?.textContent || '',
    }))()`);
    assert.equal(edited.mode, 'custom'); assert.equal(edited.preview, 'CRIT'); assert.equal(edited.map, 'CRIT');
    assert.match(edited.previewFont, /Georgia|serif/i); assert.match(edited.mapFont, /Georgia|serif/i);
    assert.match(edited.result, /Always reports 20/); assert.equal(edited.color.toLowerCase(), '#ff00ff'); assert.equal(edited.font, 'fantasy');
    assert.equal(edited.trayColor.toLowerCase(), CUSTOM_TRAY_COLOR); assert.match(edited.useLabel, /Use This Set.*Back to Roller/i);

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
    assert.equal(handoff.activeClass, true); assert.match(handoff.trayVar.toLowerCase(), /#005577/); assert.notEqual(handoff.activeId, 'system_default');
    assert.match(handoff.snapshot, /CRIT/); assert.match(handoff.snapshot, /fantasy/, 'Active roller snapshot must retain the selected face typography.');

    await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
    const roll = await client.evaluate(`(() => ({
      total: Number(document.querySelector('#total-result')?.textContent),
      diffuse: performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
    }))()`);
    assert.ok(roll.total >= 1 && roll.total <= 20, `Directly customized d20 must remain mechanically 1-20; received ${roll.total}.`);
    assert.ok(roll.diffuse.length >= 1, 'Typography customization must still use a generated physical texture.');
    let typographyTexture = false;
    for (const url of roll.diffuse) {
      const response = await fetch(url); if (!response.ok) continue;
      const text = await response.text();
      if (text.includes('CRIT') && text.includes('font-family="Georgia, serif"')) typographyTexture = true;
    }
    assert.equal(typographyTexture, true, 'Generated physical d20 texture must contain CRIT in the selected Fantasy typography.');

    await navigate(client, `${server.origin}/customize.html`, mobile);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
    const mobileState = await client.evaluate(`(() => ({
      fontHeight: document.querySelector('#face-font')?.getBoundingClientRect().height || 0,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      options: [...document.querySelectorAll('#face-font option')].map((option) => option.value),
    }))()`);
    assert.ok(mobileState.fontHeight >= 40, 'Mobile face font selector must remain comfortably tappable.');
    assert.equal(mobileState.overflow, false, 'Face typography controls must not introduce mobile horizontal overflow.');
    assert.deepEqual(mobileState.options, ['default', 'fantasy', 'mono']);

    console.log('Studio-to-roller typography handoff passed: immutable Default, Fantasy CRIT face, custom tray color, Save/Use, generated serif texture, mobile usability, and physical d20 mechanics all persist.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => { console.error('Direct face editor failed:', error); process.exitCode = 1; });
