import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { assertDesktopRollInteraction, assertMobileCustomInteraction } from './browser/main-interactions.mjs';
import { PAGE_AUDIT_EXPRESSION, assertPageAudit } from './browser/page-audit.mjs';

const origin = String(process.env.DEPLOY_PREVIEW_ORIGIN || '').trim().replace(/\/$/, '');
if (!/^https:\/\/deploy-preview-\d+--nothingbutattrpgdiceroller\.netlify\.app$/.test(origin)) {
  throw new Error('DEPLOY_PREVIEW_ORIGIN must be the Nothing But A Dice Roller Netlify PR preview origin.');
}

const screenshotsDir = resolve('artifacts', 'deploy-preview-acceptance');
const desktop = { width: 1440, height: 900, mobile: false };
const mobile = { width: 390, height: 844, mobile: true };
const retryableStatuses = new Set([502, 503, 504]);
const retryableNavigation = /ERR_(?:CONNECTION_CLOSED|CONNECTION_RESET|HTTP2_PROTOCOL_ERROR|NETWORK_CHANGED|TIMED_OUT|CERT_VERIFIER_CHANGED)/;

function previewPage(pathname = '/') {
  const url = new URL(pathname, `${origin}/`);
  url.searchParams.set('ntl-drawer-state', 'hidden');
  return url.href;
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function fetchWithRetry(url, options = {}, label = 'Deploy Preview request') {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!retryableStatuses.has(response.status) || attempt === 4) return response;
      lastError = new Error(`${label} returned transient HTTP ${response.status}.`);
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      lastError = error;
      if (attempt === 4) throw error;
    }
    await sleep(attempt * 500);
  }
  throw lastError || new Error(`${label} failed without a response.`);
}

async function navigateWithRetry(client, url, viewport, label = 'Deploy Preview page') {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await navigate(client, url, viewport);
    } catch (error) {
      lastError = error;
      if (!retryableNavigation.test(String(error?.message || '')) || attempt === 4) throw error;
    }
    await sleep(attempt * 500);
  }
  throw lastError || new Error(`${label} navigation failed without an error.`);
}

async function screenshot(client, name) {
  await mkdir(screenshotsDir, { recursive: true });
  const capture = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(resolve(screenshotsDir, `${name}.png`), Buffer.from(capture.data, 'base64'));
}

async function assertHostedSurface() {
  const homepage = await fetchWithRetry(`${origin}/`, { redirect: 'error' }, 'homepage');
  assert.equal(homepage.status, 200, 'Deploy Preview homepage must return 200.');
  const html = await homepage.text();
  assert.match(html, /Nothing But A Dice Roller/);
  assert.match(html, /src="\/js\/app\.js"/);

  const csp = homepage.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-src 'self' https:\/\/app\.netlify\.com/);
  assert.match(csp, /frame-ancestors 'self' https:\/\/app\.netlify\.com/);
  assert.equal(homepage.headers.get('x-content-type-options'), 'nosniff');

  const runtime = await fetchWithRetry(`${origin}/vendor/dice-box-1.1.4/dice-box.es.min.js`, { redirect: 'error' }, 'DiceBox runtime');
  assert.equal(runtime.status, 200, 'Pinned DiceBox runtime must be available on the Deploy Preview.');
  assert.match(runtime.headers.get('content-type') || '', /javascript/);

  const onscreenRuntime = await fetchWithRetry(`${origin}/vendor/dice-box-1.1.4/Dice.min.js`, { redirect: 'error' }, 'DiceBox onscreen runtime');
  assert.equal(onscreenRuntime.status, 200, 'DiceBox onscreen runtime required by custom themes must be deployed.');
  assert.match(onscreenRuntime.headers.get('content-type') || '', /javascript/);

  const community = await fetchWithRetry(`${origin}/api/dice-sets?scope=community&page=1&pageSize=1`, { redirect: 'error' }, 'Community API');
  assert.equal(community.status, 200, 'Deploy Preview Community endpoint must be healthy.');
  const communityJson = await community.json();
  assert.ok(Array.isArray(communityJson.records), 'Community response must contain a records array.');

  const account = await fetchWithRetry(`${origin}/api/account-data`, { redirect: 'error' }, 'account auth boundary');
  assert.equal(account.status, 401, 'Account export must require authentication on the Deploy Preview.');
  const accountJson = await account.json();
  assert.equal(accountJson.code, 'authentication-required');
}

async function assertGuestPersistence(client) {
  const root = previewPage('/');
  await navigateWithRetry(client, root, desktop, 'desktop homepage');
  await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
  await client.evaluate('localStorage.clear()');
  await navigateWithRetry(client, root, desktop, 'desktop homepage reload');
  await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);

  await client.evaluate(`(() => {
    document.querySelector('#keep-btn')?.click();
    document.querySelector('#sound-toggle-btn')?.click();
  })()`);
  await waitFor(client, "document.querySelector('#keep-btn')?.getAttribute('aria-pressed') === 'true'");
  await waitFor(client, "document.querySelector('#sound-toggle-btn')?.getAttribute('aria-pressed') === 'false'");
  await assertDesktopRollInteraction(client);

  const stored = await client.evaluate(`(() => ({
    keepDice: localStorage.getItem('keepDice'),
    soundEnabled: localStorage.getItem('soundEnabled'),
    history: JSON.parse(localStorage.getItem('rollHistory') || '[]'),
  }))()`);
  assert.equal(stored.keepDice, 'true');
  assert.equal(stored.soundEnabled, 'false');
  assert.ok(Array.isArray(stored.history) && stored.history.length >= 1, 'Guest roll history must persist in browser storage.');

  await navigateWithRetry(client, previewPage('/how-to.html'), desktop, 'How To');
  await navigateWithRetry(client, root, desktop, 'desktop homepage restore');
  await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
  const restored = await client.evaluate(`(() => ({
    keepPressed: document.querySelector('#keep-btn')?.getAttribute('aria-pressed'),
    soundPressed: document.querySelector('#sound-toggle-btn')?.getAttribute('aria-pressed'),
    historyCount: document.querySelectorAll('#history-list .history-item').length,
  }))()`);
  assert.equal(restored.keepPressed, 'true', 'Keep Dice must restore after navigation/reload.');
  assert.equal(restored.soundPressed, 'false', 'Sound preference must restore after navigation/reload.');
  assert.ok(restored.historyCount >= 1, 'Roll history must restore into the UI after navigation/reload.');
  assertPageAudit(await client.evaluate(PAGE_AUDIT_EXPRESSION), 'live desktop /');
  await screenshot(client, 'desktop-home');
}

async function assertLiveCustomDiceFlow(client) {
  await navigateWithRetry(client, previewPage('/customize.html'), desktop, 'live custom Dice Studio');
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);

  const initial = await client.evaluate(`(() => ({
    defaultImmutable: Boolean(document.querySelector('#set-name')?.disabled),
    newEnabled: !document.querySelector('#new-set')?.disabled,
  }))()`);
  assert.equal(initial.defaultImmutable, true, 'Default Dice must remain immutable on the live preview.');
  assert.equal(initial.newEnabled, true, 'New Set must be available on the live preview.');

  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
  await client.evaluate(`(() => {
    const mode = document.querySelector('#face-mode');
    mode.value = 'custom';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    const value = document.querySelector('#face-value');
    value.value = 'CRIT';
    value.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#apply-face')?.click();
  })()`);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 20 updated visually.')");
  await client.evaluate("document.querySelector('#save-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
  await client.evaluate("document.querySelector('#use-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Set marked active for the roller.')");
  await waitFor(client, "document.querySelector('#active-badge')?.textContent === 'ACTIVE'");

  await client.evaluate("document.querySelector('.studio-header a[href=\"/\"]')?.click()");
  await waitFor(client, "location.pathname === '/'");
  await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
  await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
  await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
  await client.evaluate("document.querySelector('#roll-btn')?.click()");
  try {
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
  } catch (error) {
    const diagnostic = await client.evaluate(`(() => ({
      physicsStatus: document.querySelector('#physics-status')?.textContent || '',
      total: document.querySelector('#total-result')?.textContent || '',
      breakdown: document.querySelector('#breakdown-text')?.textContent || '',
      rollDisabled: Boolean(document.querySelector('#roll-btn')?.disabled),
      resources: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((url) => url.includes('/api/dice-theme/') || url.includes('/vendor/dice-box-1.1.4/'))
        .slice(-40),
    }))()`);
    throw new Error(`Live custom-themed d20 did not settle: ${JSON.stringify(diagnostic)}. ${error.message}`);
  }

  const result = await client.evaluate(`(() => ({
    total: Number(document.querySelector('#total-result')?.textContent),
    breakdown: document.querySelector('#breakdown-text')?.textContent || '',
    resources: performance.getEntriesByType('resource').map((entry) => entry.name),
  }))()`);
  assert.ok(result.total >= 1 && result.total <= 20, `Live custom d20 result must remain 1-20; received ${result.total}.`);
  assert.match(result.breakdown, /d20/i);
  assert.ok(result.resources.some((url) => /\/api\/dice-theme\/[^/]+\/theme\.config\.json/.test(url)), 'Live custom roll must load its runtime theme config.');
  assert.ok(result.resources.some((url) => /\/api\/dice-theme\/[^/]+\/diffuse\.svg/.test(url)), 'Live custom roll must load its runtime theme texture.');
  assert.ok(result.resources.some((url) => url.includes('/vendor/dice-box-1.1.4/Dice.min.js')), 'Live custom roll must load the self-hosted DiceBox onscreen runtime.');

  await client.evaluate(`(() => {
    localStorage.removeItem('ndr.appearance.activeSet.v2');
    localStorage.removeItem('ndr.appearance.activeSnapshot.v2');
  })()`);
  console.log('Live custom Dice Studio flow passed: New Set, custom d20 face, Save, Use, return to roller, runtime theme assets, and physical d20 result.');
}

async function assertStudio(client, viewport, name) {
  const url = previewPage('/customize.html');
  await navigateWithRetry(client, url, viewport, `${name} Dice Studio`);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
  assertPageAudit(await client.evaluate(PAGE_AUDIT_EXPRESSION), `live ${name} /customize.html`);
  const scripts = await client.evaluate(`performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname).filter((path) => path.endsWith('.js') || path.endsWith('.mjs'))`);
  assert.equal(scripts.filter((path) => path === '/js/appearance/studio.js').length, 1, 'Deploy Preview must load the bundled Dice Studio entry exactly once.');
  assert.deepEqual(scripts.filter((path) => path.startsWith('/js/appearance/')), ['/js/appearance/studio.js'], 'Deploy Preview must not fan out the Dice Studio source module graph.');
  await screenshot(client, `${name}-studio`);
}

async function assertMobileRoll(client) {
  const root = previewPage('/');
  await navigateWithRetry(client, root, mobile, 'mobile homepage');
  await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
  await assertMobileCustomInteraction(client);
  assertPageAudit(await client.evaluate(PAGE_AUDIT_EXPRESSION), 'live mobile /');
  await screenshot(client, 'mobile-home');
}

async function run() {
  await assertHostedSurface();
  let browser;
  try {
    browser = await launchBrowser();
    await assertGuestPersistence(browser.client);
    await assertLiveCustomDiceFlow(browser.client);
    await assertStudio(browser.client, desktop, 'desktop');
    await assertMobileRoll(browser.client);
    await assertStudio(browser.client, mobile, 'mobile');
    console.log(`Deploy Preview acceptance passed in ${browser.command}: live physical d20, custom Dice Studio d20, mobile custom d37, guest persistence, bundled Studio, security headers, Community health, auth boundary, and unobstructed visual captures.`);
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Deploy Preview browser cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Deploy Preview acceptance failed:', error);
  process.exitCode = 1;
});
