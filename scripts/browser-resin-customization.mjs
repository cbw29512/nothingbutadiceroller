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
  await client.evaluate(`(() => {
    const control = document.querySelector(${JSON.stringify(selector)});
    if (!control) throw new Error('Missing control: ${selector}');
    if (control.type === 'checkbox') control.checked = ${Boolean(value)};
    else control.value = ${JSON.stringify(String(value))};
    control.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
  })()`);
}

async function runDesktop(client, origin) {
  await navigate(client, `${origin}/customize.html`, desktop);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
  await client.evaluate('localStorage.clear()');
  await navigate(client, `${origin}/customize.html`, desktop);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");

  await setControl(client, '#resin-scope', 'set', 'change');
  await setControl(client, '#clear-die-enabled', true, 'change');
  await setControl(client, '#clear-die-opacity', 0.55);
  await setControl(client, '#interior-effect', 'nebula', 'change');
  await setControl(client, '#interior-primary-color', '#7c3aed');
  await setControl(client, '#interior-secondary-color', '#22d3ee');
  await setControl(client, '#interior-density', 0.75);
  await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"]')?.dataset.clearResin === 'true' && document.querySelector('.studio-preview-die[data-die=\"d20\"]')?.dataset.interiorEffect === 'nebula'");

  const preview = await client.evaluate(`(() => ({
    clear: document.querySelector('.studio-preview-die[data-die="d20"]')?.dataset.clearResin,
    effect: document.querySelector('.studio-preview-die[data-die="d20"]')?.dataset.interiorEffect,
    background: document.querySelector('.studio-preview-die[data-die="d20"]')?.style.background || '',
    opacityLabel: document.querySelector('#clear-opacity-output')?.textContent || '',
    densityLabel: document.querySelector('#interior-density-output')?.textContent || '',
  }))()`);
  assert.equal(preview.clear, 'true');
  assert.equal(preview.effect, 'nebula');
  assert.match(preview.background, /gradient/i);
  assert.equal(preview.opacityLabel, '55%');
  assert.equal(preview.densityLabel, '75%');

  await client.evaluate(`(() => {
    const name = document.querySelector('#set-name');
    name.value = 'Nebula Resin Browser Test';
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
  assert.match(handoff.snapshot, /nebula/);
  assert.match(handoff.snapshot.toLowerCase(), /#7c3aed/);
  assert.match(handoff.snapshot.toLowerCase(), /#22d3ee/);

  await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
  await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
  await client.evaluate("document.querySelector('#roll-btn')?.click()");
  await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
  const roll = await client.evaluate(`(() => ({
    total: Number(document.querySelector('#total-result')?.textContent),
    diffuse: performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
  }))()`);
  assert.ok(roll.total >= 1 && roll.total <= 20, `Nebula resin d20 must remain 1-20; received ${roll.total}.`);
  assert.ok(roll.diffuse.length >= 1, 'Resin d20 must request a generated diffuse texture.');
  let resinTextureFound = false;
  for (const url of roll.diffuse) {
    const text = await (await fetch(url)).text();
    if (text.includes('resinSheen') && text.includes('interiorBlur') && text.toLowerCase().includes('#7c3aed') && text.toLowerCase().includes('#22d3ee')) resinTextureFound = true;
  }
  assert.equal(resinTextureFound, true, 'Physical d20 texture must contain the selected nebula resin artwork.');
}

async function runMobile(client, origin) {
  await navigate(client, `${origin}/customize.html`, mobile);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
  await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d6\"]')?.click()");
  await waitFor(client, "document.querySelector('#selected-die-label')?.textContent === 'D6'");
  await setControl(client, '#resin-scope', 'selected', 'change');
  await setControl(client, '#clear-die-enabled', true, 'change');
  await setControl(client, '#interior-effect', 'bubbles', 'change');
  await setControl(client, '#interior-primary-color', '#dcfce7');
  await setControl(client, '#interior-secondary-color', '#4ade80');
  await setControl(client, '#interior-density', 0.6);
  await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d6\"]')?.dataset.interiorEffect === 'bubbles'");
  const state = await client.evaluate(`(() => ({
    d6: document.querySelector('.studio-preview-die[data-die="d6"]')?.dataset.interiorEffect,
    d20: document.querySelector('.studio-preview-die[data-die="d20"]')?.dataset.interiorEffect,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    groupRight: document.querySelector('#resin-editor-group')?.getBoundingClientRect().right || 0,
    viewport: window.innerWidth,
    selectHeight: document.querySelector('#interior-effect')?.getBoundingClientRect().height || 0,
  }))()`);
  assert.equal(state.d6, 'bubbles');
  assert.equal(state.d20, 'none', 'Selected-die resin scope must not leak onto the rest of the set.');
  assert.equal(state.horizontalOverflow, false, 'Mobile Resin Studio must not cause horizontal overflow.');
  assert.ok(state.groupRight <= state.viewport + 2, 'Mobile resin controls must stay inside the viewport.');
  assert.ok(state.selectHeight >= 40, 'Mobile interior picker must remain comfortably tappable.');
}

async function run() {
  await access(resolve(dist, 'customize.html'));
  let server; let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    await runDesktop(browser.client, server.origin);
    await runMobile(browser.client, server.origin);
    console.log('Resin Studio browser flow passed: desktop clear-nebula Save/Use/physical d20 and mobile selected-d6 bubbles remain simple, scoped, responsive, and mechanically canonical.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Resin Studio browser flow failed:', error);
  process.exitCode = 1;
});
