import assert from 'node:assert/strict';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';

const origin = String(process.env.DEPLOY_PREVIEW_ORIGIN || '').trim().replace(/\/$/, '');
if (!/^https:\/\/deploy-preview-\d+--nothingbutattrpgdiceroller\.netlify\.app$/.test(origin)) {
  throw new Error('DEPLOY_PREVIEW_ORIGIN must be the Nothing But A Dice Roller Netlify PR preview origin.');
}
const desktop = { width: 1440, height: 900, mobile: false };
const mobile = { width: 390, height: 844, mobile: true };
function previewPage(pathname = '/') {
  const url = new URL(pathname, `${origin}/`);
  url.searchParams.set('ntl-drawer-state', 'hidden');
  return url.href;
}
async function setControl(client, selector, value, eventName = 'input') {
  try {
    await client.evaluate(`(() => {
      const control = document.querySelector(${JSON.stringify(selector)});
      if (!control) throw new Error('Missing control: ${selector}');
      control.value = ${JSON.stringify(String(value))};
      control.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
    })()`);
  } catch (error) {
    console.error('Failed to set live surface-finish control:', selector, error);
    throw error;
  }
}

async function configureDesktop(client) {
  await navigate(client, previewPage('/customize.html'), desktop);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
  await client.evaluate('localStorage.clear()');
  await navigate(client, previewPage('/customize.html'), desktop);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");

  await setControl(client, '#finish-scope', 'set', 'change');
  await setControl(client, '#surface-finish', 'metallic', 'change');
  await setControl(client, '#finish-accent-color', '#f59e0b');
  await setControl(client, '#finish-intensity', 0.8);
  await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"]')?.dataset.surfaceFinish === 'metallic'");
  const preview = await client.evaluate(`(() => ({
    background: document.querySelector('.studio-preview-die[data-die="d20"]')?.style.background || '',
    intensity: document.querySelector('#finish-intensity-output')?.textContent || '',
  }))()`);
  assert.match(preview.background, /gradient/i);
  assert.equal(preview.intensity, '80%');

  await client.evaluate(`(() => {
    const name = document.querySelector('#set-name');
    name.value = 'Live Metallic Finish';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    name.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await client.evaluate("document.querySelector('#save-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
  await client.evaluate("document.querySelector('#use-set')?.click()");
  await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
}

async function verifyDesktopRoll(client) {
  const handoff = await client.evaluate(`(() => ({
    activeClass: document.body.classList.contains('appearance-v2-active'),
    snapshot: localStorage.getItem('ndr.appearance.activeSnapshot.v2') || '',
  }))()`);
  assert.equal(handoff.activeClass, true);
  assert.match(handoff.snapshot, /metallic/);
  assert.match(handoff.snapshot.toLowerCase(), /#f59e0b/);

  await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
  await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
  await client.evaluate("document.querySelector('#roll-btn')?.click()");
  await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
  const roll = await client.evaluate(`(() => ({
    total: Number(document.querySelector('#total-result')?.textContent),
    diffuse: performance.getEntriesByType('resource').map((entry) => entry.name)
      .filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
  }))()`);
  assert.ok(roll.total >= 1 && roll.total <= 20, `Live metallic d20 must remain 1-20; received ${roll.total}.`);
  assert.ok(roll.diffuse.length >= 1, 'Live metallic d20 must request a generated diffuse texture.');
  let found = false;
  for (const url of roll.diffuse) {
    const response = await fetch(url);
    if (!response.ok) continue;
    const text = await response.text();
    if (text.includes('surfaceMetallic') && text.toLowerCase().includes('#f59e0b')) found = true;
  }
  assert.equal(found, true, 'Live physical d20 texture must contain the selected metallic finish artwork.');
}

async function verifyMobileScope(client) {
  await navigate(client, previewPage('/customize.html'), mobile);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
  await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d6\"]')?.click()");
  await waitFor(client, "document.querySelector('#selected-die-label')?.textContent === 'D6'");
  await setControl(client, '#finish-scope', 'selected', 'change');
  await setControl(client, '#surface-finish', 'pearl', 'change');
  await setControl(client, '#finish-accent-color', '#22d3ee');
  await setControl(client, '#finish-intensity', 0.65);
  await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d6\"]')?.dataset.surfaceFinish === 'pearl'");
  const state = await client.evaluate(`(() => ({
    d6: document.querySelector('.studio-preview-die[data-die="d6"]')?.dataset.surfaceFinish,
    d20: document.querySelector('.studio-preview-die[data-die="d20"]')?.dataset.surfaceFinish,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    selectHeight: document.querySelector('#surface-finish')?.getBoundingClientRect().height || 0,
  }))()`);
  assert.equal(state.d6, 'pearl');
  assert.equal(state.d20, 'standard');
  assert.equal(state.overflow, false);
  assert.ok(state.selectHeight >= 40, 'Live mobile surface-finish picker must remain comfortably tappable.');
}

async function run() {
  let browser;
  try {
    browser = await launchBrowser();
    await configureDesktop(browser.client);
    await verifyDesktopRoll(browser.client);
    await verifyMobileScope(browser.client);
    console.log('Live surface finish passed: metallic Save/Use, hosted generated texture, physical d20 mechanics, and mobile selected-d6 pearl are protected.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
  }
}
run().catch((error) => { console.error('Live surface finish failed:', error); process.exitCode = 1; });
