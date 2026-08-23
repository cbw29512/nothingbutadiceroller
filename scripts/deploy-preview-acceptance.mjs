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
  const homepage = await fetch(`${origin}/`, { redirect: 'error' });
  assert.equal(homepage.status, 200, 'Deploy Preview homepage must return 200.');
  const html = await homepage.text();
  assert.match(html, /Nothing But A Dice Roller/);
  assert.match(html, /src="\/js\/app\.js"/);

  const csp = homepage.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'self' https:\/\/app\.netlify\.com/);
  assert.equal(homepage.headers.get('x-content-type-options'), 'nosniff');

  const runtime = await fetch(`${origin}/vendor/dice-box-1.1.4/dice-box.es.min.js`, { redirect: 'error' });
  assert.equal(runtime.status, 200, 'Pinned DiceBox runtime must be available on the Deploy Preview.');
  assert.match(runtime.headers.get('content-type') || '', /javascript/);

  const community = await fetch(`${origin}/api/dice-sets?scope=community&page=1&pageSize=1`, { redirect: 'error' });
  assert.equal(community.status, 200, 'Deploy Preview Community endpoint must be healthy.');
  const communityJson = await community.json();
  assert.ok(Array.isArray(communityJson.records), 'Community response must contain a records array.');

  const account = await fetch(`${origin}/api/account-data`, { redirect: 'error' });
  assert.equal(account.status, 401, 'Account export must require authentication on the Deploy Preview.');
  const accountJson = await account.json();
  assert.equal(accountJson.code, 'authentication-required');
}

async function assertGuestPersistence(client) {
  const root = `${origin}/`;
  await navigate(client, root, desktop);
  await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
  await client.evaluate('localStorage.clear()');
  await navigate(client, root, desktop);
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

  await navigate(client, `${origin}/how-to.html`, desktop);
  await navigate(client, root, desktop);
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

async function assertStudio(client, viewport, name) {
  const url = `${origin}/customize.html`;
  await navigate(client, url, viewport);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
  assertPageAudit(await client.evaluate(PAGE_AUDIT_EXPRESSION), `live ${name} /customize.html`);
  const scripts = await client.evaluate(`performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname).filter((path) => path.endsWith('.js') || path.endsWith('.mjs'))`);
  assert.equal(scripts.filter((path) => path === '/js/appearance/studio.js').length, 1, 'Deploy Preview must load the bundled Dice Studio entry exactly once.');
  assert.deepEqual(scripts.filter((path) => path.startsWith('/js/appearance/')), ['/js/appearance/studio.js'], 'Deploy Preview must not fan out the Dice Studio source module graph.');
  await screenshot(client, `${name}-studio`);
}

async function assertMobileRoll(client) {
  const root = `${origin}/`;
  await navigate(client, root, mobile);
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
    await assertStudio(browser.client, desktop, 'desktop');
    await assertMobileRoll(browser.client);
    await assertStudio(browser.client, mobile, 'mobile');
    console.log(`Deploy Preview acceptance passed in ${browser.command}: live physical d20, mobile custom d37, guest persistence, bundled Studio, security headers, Community health, and auth boundary.`);
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Deploy Preview browser cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Deploy Preview acceptance failed:', error);
  process.exitCode = 1;
});
