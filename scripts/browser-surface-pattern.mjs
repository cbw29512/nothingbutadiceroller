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

async function setControl(client, selector, value, eventName = 'input') {
  try {
    await client.evaluate(`(() => {
      const control = document.querySelector(${JSON.stringify(selector)});
      if (!control) throw new Error('Missing control: ${selector}');
      control.value = ${JSON.stringify(String(value))};
      control.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
    })()`);
  } catch (error) {
    console.error('Failed to set surface-pattern browser control:', selector, error);
    throw error;
  }
}

async function runDesktop(client, origin) {
  await navigate(client, `${origin}/customize.html`, desktop);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
  await client.evaluate('localStorage.clear()');
  await navigate(client, `${origin}/customize.html`, desktop);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");

  await setControl(client, '#pattern-scope', 'set', 'change');
  await setControl(client, '#surface-pattern', 'marble', 'change');
  await setControl(client, '#pattern-primary-color', '#f8fafc');
  await setControl(client, '#pattern-secondary-color', '#7c3aed');
  await setControl(client, '#pattern-intensity', 0.7);
  await setControl(client, '#pattern-scale', 0.6);
  await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"]')?.dataset.surfacePattern === 'marble'");

  const preview = await client.evaluate(`(() => ({
    pattern: document.querySelector('.studio-preview-die[data-die="d20"]')?.dataset.surfacePattern,
    background: document.querySelector('.studio-preview-die[data-die="d20"]')?.style.background || '',
    intensity: document.querySelector('#pattern-intensity-output')?.textContent || '',
    scale: document.querySelector('#pattern-scale-output')?.textContent || '',
  }))()`);
  assert.equal(preview.pattern, 'marble');
  assert.match(preview.background, /gradient/i);
  assert.equal(preview.intensity, '70%');
  assert.equal(preview.scale, '60%');

  await client.evaluate(`(() => {
    const name = document.querySelector('#set-name');
    name.value = 'Marble Browser Test';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    name.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await client.evaluate("document.querySelector('#save-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
  await client.evaluate("document.querySelector('#use-set')?.click()");
  await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);

  const handoff = await client.evaluate(`(() => ({
    activeClass: document.body.classList.contains('appearance-v2-active'),
    snapshot: localStorage.getItem('ndr.appearance.activeSnapshot.v2') || '',
  }))()`);
  assert.equal(handoff.activeClass, true);
  assert.match(handoff.snapshot, /marble/);
  assert.match(handoff.snapshot.toLowerCase(), /#7c3aed/);

  await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
  await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
  await client.evaluate("document.querySelector('#roll-btn')?.click()");
  await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
  const roll = await client.evaluate(`(() => ({
    total: Number(document.querySelector('#total-result')?.textContent),
    diffuse: performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
  }))()`);
  assert.ok(roll.total >= 1 && roll.total <= 20, `Marble d20 must remain 1-20; received ${roll.total}.`);
  assert.ok(roll.diffuse.length >= 1, 'Marble d20 must request a generated diffuse texture.');
  let patternTextureFound = false;
  for (const url of roll.diffuse) {
    const text = await (await fetch(url)).text();
    if (text.includes('patternMarble') && text.toLowerCase().includes('#7c3aed')) patternTextureFound = true;
  }
  assert.equal(patternTextureFound, true, 'Physical d20 texture must contain the selected marble pattern artwork.');
}

async function runMobile(client, origin) {
  await navigate(client, `${origin}/customize.html`, mobile);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
  await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d6\"]')?.click()");
  await waitFor(client, "document.querySelector('#selected-die-label')?.textContent === 'D6'");
  await setControl(client, '#pattern-scope', 'selected', 'change');
  await setControl(client, '#surface-pattern', 'speckle', 'change');
  await setControl(client, '#pattern-primary-color', '#22d3ee');
  await setControl(client, '#pattern-secondary-color', '#0f172a');
  await setControl(client, '#pattern-intensity', 0.65);
  await setControl(client, '#pattern-scale', 0.4);
  await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d6\"]')?.dataset.surfacePattern === 'speckle'");

  const state = await client.evaluate(`(() => ({
    d6: document.querySelector('.studio-preview-die[data-die="d6"]')?.dataset.surfacePattern,
    d20: document.querySelector('.studio-preview-die[data-die="d20"]')?.dataset.surfacePattern,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    groupRight: document.querySelector('#surface-pattern-group')?.getBoundingClientRect().right || 0,
    viewport: window.innerWidth,
    selectHeight: document.querySelector('#surface-pattern')?.getBoundingClientRect().height || 0,
  }))()`);
  assert.equal(state.d6, 'speckle');
  assert.equal(state.d20, 'none', 'Selected-die pattern must not leak onto the rest of the set.');
  assert.equal(state.horizontalOverflow, false, 'Mobile surface-pattern controls must not cause horizontal overflow.');
  assert.ok(state.groupRight <= state.viewport + 2, 'Mobile surface-pattern controls must stay inside the viewport.');
  assert.ok(state.selectHeight >= 40, 'Mobile surface-pattern picker must remain comfortably tappable.');
}

async function run() {
  await access(resolve(dist, 'customize.html'));
  let server; let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    await runDesktop(browser.client, server.origin);
    await runMobile(browser.client, server.origin);
    console.log('Surface pattern browser flow passed: desktop marble Save/Use/physical d20 and mobile selected-d6 speckle remain scoped, responsive, and mechanically canonical.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Surface pattern browser flow failed:', error);
  process.exitCode = 1;
});
