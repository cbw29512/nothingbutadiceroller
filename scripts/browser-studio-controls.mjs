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
      buttons: ['new-set','import-browser-sets','reset-default','refresh-community','load-more-community','apply-face','remove-face','remove-tray-image','save-set','use-set','lock-set','publish-set','delete-set','community-report-cancel','community-report-submit']
        .every((id) => Boolean(document.getElementById(id))),
      publishDisabled: Boolean(document.querySelector('#publish-set')?.disabled),
      importHidden: Boolean(document.querySelector('#import-browser-sets')?.hidden),
      loadMoreHidden: Boolean(document.querySelector('#load-more-community')?.hidden),
      removeImageDisabled: Boolean(document.querySelector('#remove-tray-image')?.disabled),
      howToHref: document.querySelector('.studio-header a[href="/how-to.html"]')?.getAttribute('href'),
      rollerHref: document.querySelector('.studio-header a[href="/"]')?.getAttribute('href'),
    }))()`);
    assert.equal(initial.buttons, true, 'Dice Studio is missing one or more explicit button controls.');
    assert.equal(initial.publishDisabled, true, 'Guest Publish must be disabled until cloud ownership is available.');
    assert.equal(initial.importHidden, true, 'Guest browser import must stay hidden until sign-in.');
    assert.equal(initial.loadMoreHidden, true, 'Load More must stay hidden when Community has no next page.');
    assert.equal(initial.removeImageDisabled, true, 'Remove Tray Image must be disabled without an image.');
    assert.equal(initial.howToHref, '/how-to.html');
    assert.equal(initial.rollerHref, '/');

    const communityBefore = await client.evaluate(`performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/api/dice-sets?scope=community')).length`);
    await client.evaluate("document.querySelector('#refresh-community')?.click()");
    await waitFor(client, `performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/api/dice-sets?scope=community')).length > ${communityBefore}`);

    await client.evaluate("document.querySelector('#new-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");

    await client.evaluate(`(() => {
      const glow = document.querySelector('#dice-glow-enabled');
      glow.checked = true;
      glow.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Number glow enabled for every die.')");
    const setWideShadow = await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] span')?.style.textShadow || ''");
    assert.ok(setWideShadow && setWideShadow !== 'none', 'Set-wide Glow On must be immediately visible even when the new set started at zero intensity.');
    await client.evaluate(`(() => {
      const glow = document.querySelector('#dice-glow-enabled');
      glow.checked = false;
      glow.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Set-wide number glow disabled.')");

    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d4\"]')?.click()");
    await waitFor(client, "document.querySelector('#selected-die-label')?.textContent === 'D4' && document.querySelector('#logical-face')?.value === '4'");
    const d4Selected = await client.evaluate(`(() => ({
      face: document.querySelector('#logical-face-label')?.textContent || '',
      result: document.querySelector('#logical-result-label')?.textContent || '',
      preview: document.querySelector('.studio-preview-die[data-die="d4"] span')?.textContent || '',
    }))()`);
    assert.match(d4Selected.face, /Face 4/);
    assert.match(d4Selected.result, /Always reports 4/);
    assert.equal(d4Selected.preview, '4');

    await client.evaluate(`(() => {
      const separate = document.querySelector('#die-style-enabled');
      separate.checked = true;
      separate.dispatchEvent(new Event('change', { bubbles: true }));
      const glow = document.querySelector('#die-glow-enabled');
      glow.checked = true;
      glow.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('D4 number glow enabled')");
    const zeroIntensityToggle = await client.evaluate(`(() => ({
      shadow: document.querySelector('.studio-preview-die[data-die="d4"] span')?.style.textShadow || '',
      mapShadow: document.querySelector('#face-map [data-face="4"] [data-face-glyph]')?.style.textShadow || '',
    }))()`);
    assert.ok(zeroIntensityToggle.shadow && zeroIntensityToggle.shadow !== 'none', 'Per-die Glow On must be immediately visible from a zero-intensity inherited style.');
    assert.ok(zeroIntensityToggle.mapShadow && zeroIntensityToggle.mapShadow !== 'none', 'Face-map glow must be immediately visible from a zero-intensity inherited style.');

    await client.evaluate(`(() => {
      const color = document.querySelector('#die-glow-color');
      color.value = '#00ffcc';
      color.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    const glowPreview = await client.evaluate(`(() => ({
      text: document.querySelector('.studio-preview-die[data-die="d4"] span')?.textContent || '',
      shadow: document.querySelector('.studio-preview-die[data-die="d4"] span')?.style.textShadow || '',
      checked: Boolean(document.querySelector('#die-glow-enabled')?.checked),
      color: document.querySelector('#die-glow-color')?.value || '',
    }))()`);
    assert.equal(glowPreview.text, '4', 'D4 preview must still show the canonical 4.');
    assert.equal(glowPreview.checked, true, 'D4 number-glow checkbox must stay enabled after refresh.');
    assert.equal(glowPreview.color.toLowerCase(), '#00ffcc');
    assert.notEqual(glowPreview.shadow, 'none', 'D4 number 4 must visibly glow in the Studio preview.');
    assert.ok(glowPreview.shadow.length > 0, 'D4 number glow must produce a preview text shadow.');

    await client.evaluate(`(() => {
      const glow = document.querySelector('#die-glow-enabled');
      glow.checked = false;
      glow.dispatchEvent(new Event('change', { bubbles: true }));
      glow.checked = true;
      glow.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('D4 number glow enabled')");
    const reenabledShadow = await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d4\"] span')?.style.textShadow || ''");
    assert.ok(reenabledShadow && reenabledShadow !== 'none', 'Per-die glow must stay visible after disable/re-enable.');

    await client.evaluate(`(() => {
      const input = document.querySelector('#tray-image');
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'audit.png', { type: 'image/png' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Tray image added visually.')");
    await waitFor(client, "!document.querySelector('#remove-tray-image')?.disabled");
    await client.evaluate("document.querySelector('#remove-tray-image')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Tray image removed from this draft.')");
    await waitFor(client, "document.querySelector('#remove-tray-image')?.disabled");

    await client.evaluate(`(() => {
      const mode = document.querySelector('#face-mode');
      mode.value = 'custom';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('#face-mode')?.value === 'custom' && !document.querySelector('#apply-face')?.disabled");
    await client.evaluate(`(() => {
      const value = document.querySelector('#face-value');
      value.value = '★';
      const color = document.querySelector('#custom-face-color');
      color.value = '#ff00ff';
      document.querySelector('#apply-face')?.click();
    })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 4 updated visually.')");
    assert.equal(await client.evaluate("document.querySelector('#face-map .face-node.active')?.textContent"), '★');
    await client.evaluate("document.querySelector('#remove-face')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 4 restored to its standard number.')");
    assert.equal(await client.evaluate("document.querySelector('#face-value')?.value"), '4');

    await client.evaluate(`(() => {
      const name = document.querySelector('#set-name');
      name.value = 'D4 Glow Button Audit';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      name.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await client.evaluate("document.querySelector('#save-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");

    await client.evaluate("document.querySelector('#lock-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Set locked.') && document.querySelector('#lock-set')?.textContent === 'Unlock Set'");
    assert.equal(await client.evaluate("document.querySelector('#die-glow-enabled')?.disabled"), true, 'Locked set must disable glow editing.');
    await client.evaluate("document.querySelector('#lock-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Set unlocked and private.') && document.querySelector('#lock-set')?.textContent === 'Lock Set'");

    await client.evaluate("document.querySelector('#use-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Set marked active for the roller.')");
    await client.evaluate("document.querySelector('.studio-header a[href=\"/\"]')?.click()");
    await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
    await client.evaluate("document.querySelector('.die-btn[data-type=\"d4\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d4')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
    const roll = await client.evaluate(`(() => ({
      total: Number(document.querySelector('#total-result')?.textContent),
      breakdown: document.querySelector('#breakdown-text')?.textContent || '',
      diffuse: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
    }))()`);
    assert.ok(roll.total >= 1 && roll.total <= 4, `Custom glowing d4 must still roll 1-4; received ${roll.total}.`);
    assert.match(roll.breakdown, /d4/i);
    assert.ok(roll.diffuse.length >= 1, 'Custom glowing d4 must request a generated diffuse texture.');
    let glowSvgFound = false;
    for (const url of roll.diffuse) {
      const text = await (await fetch(url)).text();
      if (text.includes('id="numberGlow"') && text.toLowerCase().includes('#00ffcc')) glowSvgFound = true;
    }
    assert.equal(glowSvgFound, true, 'The live d4 texture must contain the selected #00ffcc number glow.');

    await navigate(client, `${server.origin}/customize.html`, desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
    await client.evaluate("document.querySelector('#new-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
    await client.evaluate("document.querySelector('#delete-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Unsaved dice set discarded.')");

    await client.evaluate("document.querySelector('#reset-default')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Default Dice restored.')");
    const defaultState = await client.evaluate(`(() => ({
      activeId: localStorage.getItem('ndr.appearance.activeSet.v2'),
      activeBadge: document.querySelector('#active-badge')?.textContent || '',
      selectedName: document.querySelector('#set-name')?.value || '',
    }))()`);
    assert.equal(defaultState.selectedName, 'Default Dice');
    assert.equal(defaultState.activeBadge, 'ACTIVE');

    await client.evaluate(`(() => {
      const dialog = document.querySelector('#community-report-dialog');
      dialog.showModal();
      document.querySelector('#community-report-cancel')?.click();
    })()`);
    await waitFor(client, "!document.querySelector('#community-report-dialog')?.open");
    await client.evaluate(`(() => {
      const dialog = document.querySelector('#community-report-dialog');
      dialog.showModal();
      document.querySelector('#community-report-form')?.requestSubmit();
    })()`);
    await waitFor(client, "document.querySelector('#community-report-status')?.textContent.includes('Choose a Community dice set before reporting it.')");
    assert.equal(await client.evaluate("document.querySelector('#community-report-submit')?.disabled"), false, 'Report submit button must recover after a handled failure.');
    await client.evaluate("document.querySelector('#community-report-cancel')?.click()");

    console.log('Dice Studio control audit passed: all explicit guest buttons/paths are present; set-wide and per-die Glow On are visible from zero intensity, disable/re-enable preserves glow, and all existing Studio controls still execute.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Dice Studio control audit failed:', error);
  process.exitCode = 1;
});