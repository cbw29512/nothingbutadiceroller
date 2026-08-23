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
  const expression = `(() => { const control = document.querySelector(${JSON.stringify(selector)}); if (!control) throw new Error('Missing control: ${selector}'); control.value = ${JSON.stringify(String(value))}; control.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true })); })()`;
  await client.evaluate(expression);
}
async function hostedInlayDiagnostic(client) {
  return client.evaluate(`(async () => {
    const allResources = performance.getEntriesByType('resource').map((entry) => entry.name);
    const resources = [...new Set(allResources.filter((url) => url.includes('/api/dice-theme/')))].slice(-20);
    const diceBoxResources = [...new Set(allResources.filter((url) => url.includes('/vendor/dice-box-')))].slice(-20);
    const checks = [];
    for (const url of resources) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        const body = await response.text();
        checks.push({
          url,
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get('content-type') || '',
          contentLength: response.headers.get('content-length') || '',
          bodyPrefix: body.slice(0, 240),
        });
      } catch (error) {
        checks.push({ url, error: String(error?.message || error) });
      }
    }
    const themeUrl = resources.find((url) => url.includes('/theme.config.json')) || resources[0] || '';
    let tokenLength = 0;
    let themePathLength = 0;
    try {
      const parsed = new URL(themeUrl);
      themePathLength = parsed.pathname.length;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const themeIndex = parts.indexOf('dice-theme');
      tokenLength = themeIndex >= 0 ? String(parts[themeIndex + 1] || '').length : 0;
    } catch {}
    return {
      location: location.href,
      physicsStatus: document.querySelector('#physics-status')?.textContent || '',
      rollDisabled: Boolean(document.querySelector('#roll-btn')?.disabled),
      totalText: document.querySelector('#total-result')?.textContent || '',
      poolSummary: document.querySelector('#pool-summary')?.textContent || '',
      breakdown: document.querySelector('#breakdown-text')?.textContent || '',
      activeClass: document.body.classList.contains('appearance-v2-active'),
      activeSnapshotLength: (localStorage.getItem('ndr.appearance.activeSnapshot.v2') || '').length,
      themeResourceCount: resources.length,
      tokenLength,
      themePathLength,
      resources,
      diceBoxResources,
      checks,
    };
  })()`);
}

async function configureDesktop(client) {
  await navigate(client, previewPage('/customize.html'), desktop);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
  await client.evaluate('localStorage.clear()');
  await navigate(client, previewPage('/customize.html'), desktop);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
  await waitFor(client, "document.querySelector('#edge-inlay-group')");
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
  await setControl(client, '#inlay-scope', 'set', 'change');
  await setControl(client, '#edge-inlay', 'bold', 'change');
  await setControl(client, '#inlay-color', '#f59e0b');
  await setControl(client, '#inlay-intensity', 0.85);
  await setControl(client, '#inlay-width', 0.6);
  await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"]')?.dataset.edgeInlay === 'bold'");
  const preview = await client.evaluate(`(() => ({
    shadow: document.querySelector('.studio-preview-die[data-die="d20"]')?.style.boxShadow || '',
    intensity: document.querySelector('#inlay-intensity-output')?.textContent || '',
    width: document.querySelector('#inlay-width-output')?.textContent || '',
  }))()`);
  assert.match(preview.shadow, /inset/i); assert.equal(preview.intensity, '85%'); assert.equal(preview.width, '60%');
  await client.evaluate(`(() => { const name = document.querySelector('#set-name'); name.value = 'Live Gold Edge Inlay'; name.dispatchEvent(new Event('input', { bubbles: true })); name.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await client.evaluate("document.querySelector('#save-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
  await client.evaluate("document.querySelector('#use-set')?.click()");
  await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
}

async function verifyDesktopRoll(client) {
  const handoff = await client.evaluate(`(() => ({ activeClass: document.body.classList.contains('appearance-v2-active'), snapshot: localStorage.getItem('ndr.appearance.activeSnapshot.v2') || '' }))()`);
  assert.equal(handoff.activeClass, true); assert.match(handoff.snapshot, /bold/); assert.match(handoff.snapshot.toLowerCase(), /#f59e0b/);
  await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
  await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
  await client.evaluate("document.querySelector('#roll-btn')?.click()");
  try {
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
  } catch (error) {
    throw new Error(`Live edge-inlay d20 did not settle: ${JSON.stringify(await hostedInlayDiagnostic(client))}. ${error.message}`);
  }
  const roll = await client.evaluate(`(() => ({ total: Number(document.querySelector('#total-result')?.textContent), diffuse: performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')) }))()`);
  assert.ok(roll.total >= 1 && roll.total <= 20, `Live edge-inlay d20 must remain 1-20; received ${roll.total}.`);
  assert.ok(roll.diffuse.length >= 1, 'Live edge-inlay d20 must request a generated diffuse texture.');
  let found = false;
  for (const url of roll.diffuse) {
    const response = await fetch(url); if (!response.ok) continue;
    const text = await response.text();
    if (text.includes('id="edgeInlay"') && text.toLowerCase().includes('#f59e0b')) found = true;
  }
  assert.equal(found, true, 'Live physical d20 texture must contain the selected UV-backed edge-inlay artwork.');
}

async function verifyMobileScope(client) {
  await navigate(client, previewPage('/customize.html'), mobile);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
  await waitFor(client, "document.querySelector('#edge-inlay-group')");
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
  await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d6\"]')?.click()");
  await waitFor(client, "document.querySelector('#selected-die-label')?.textContent === 'D6'");
  await setControl(client, '#inlay-scope', 'selected', 'change');
  await setControl(client, '#edge-inlay', 'dotted', 'change');
  await setControl(client, '#inlay-color', '#22d3ee');
  await setControl(client, '#inlay-intensity', 0.7);
  await setControl(client, '#inlay-width', 0.45);
  await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d6\"]')?.dataset.edgeInlay === 'dotted'");
  const state = await client.evaluate(`(() => ({
    d6: document.querySelector('.studio-preview-die[data-die="d6"]')?.dataset.edgeInlay,
    d20: document.querySelector('.studio-preview-die[data-die="d20"]')?.dataset.edgeInlay,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    selectHeight: document.querySelector('#edge-inlay')?.getBoundingClientRect().height || 0,
  }))()`);
  assert.equal(state.d6, 'dotted'); assert.equal(state.d20, 'none'); assert.equal(state.overflow, false);
  assert.ok(state.selectHeight >= 40, 'Live mobile edge-inlay picker must remain comfortably tappable.');
}

async function run() {
  let browser;
  try {
    browser = await launchBrowser();
    await configureDesktop(browser.client); await verifyDesktopRoll(browser.client); await verifyMobileScope(browser.client);
    console.log('Live edge inlay passed: UV-backed Bold Save/Use, hosted generated texture, physical d20 mechanics, and mobile selected-d6 Dotted are protected.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
  }
}
run().catch((error) => { console.error('Live edge inlay failed:', error); process.exitCode = 1; });
