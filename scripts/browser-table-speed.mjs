import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const desktop = { name: 'desktop', width: 1280, height: 860, mobile: false };
const mobile = { name: 'mobile', width: 390, height: 844, mobile: true };

async function waitForPhysics(client) {
  try {
    await waitFor(
      client,
      "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')",
      30000,
    );
  } catch (error) {
    console.error('Table-speed browser test could not reach physics-ready state:', error);
    throw error;
  }
}

async function testDesktop(client, origin) {
  try {
    await navigate(client, `${origin}/`, desktop);
    await client.evaluate('localStorage.clear()');
    await navigate(client, `${origin}/`, desktop);
    await waitForPhysics(client);

    const controls = await client.evaluate(`(() => ({
      normalD20: Boolean(document.querySelector('.quick-roll-group [data-quick-roll="normal"]')),
      modifier: Boolean(document.querySelector('#desktop-roll-modifier')),
    }))()`);
    assert.equal(controls.normalD20, true, 'Desktop must expose one-tap normal D20.');
    assert.equal(controls.modifier, true, 'Desktop must expose a roll modifier control.');

    await client.evaluate(`(() => {
      const input = document.querySelector('#desktop-roll-modifier');
      input.value = '7';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('.quick-roll-group [data-quick-roll="normal"]')?.click();
    })()`);
    await waitFor(
      client,
      "document.querySelector('#open-history-btn')?.textContent.includes('(1)') && !document.querySelector('#roll-btn')?.disabled",
      30000,
    );

    const result = await client.evaluate(`(() => ({
      total: Number(document.querySelector('#total-result')?.textContent),
      breakdown: document.querySelector('#breakdown-text')?.textContent || '',
    }))()`);
    assert.ok(result.total >= 8 && result.total <= 27, `d20 + 7 total must be 8-27; received ${result.total}.`);
    assert.match(result.breakdown, /Modifier \+7/);

    await client.evaluate("document.querySelector('#open-history-btn')?.click()");
    await waitFor(client, "document.querySelector('#history-drawer')?.getAttribute('aria-hidden') === 'false'");
    const formula = await client.evaluate("document.querySelector('#history-list .history-formula')?.textContent || ''");
    assert.equal(formula, '1d20 + 7', 'Quick D20 history must preserve the applied modifier.');
  } catch (error) {
    console.error('Desktop table-speed browser verification failed:', error);
    throw error;
  }
}

async function testMobile(client, origin) {
  try {
    await navigate(client, `${origin}/`, mobile);
    await waitForPhysics(client);
    const snapshot = await client.evaluate(`(() => {
      const row = document.querySelector('.mobile-dice-row');
      const tracks = getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean);
      return {
        columns: tracks.length,
        normalD20: Boolean(document.querySelector('.mobile-mode-row [data-quick-roll="normal"]')),
        modifier: Boolean(document.querySelector('#mobile-roll-modifier')),
      };
    })()`);
    assert.equal(snapshot.columns, 4, '390px mobile layout must use four dice columns.');
    assert.equal(snapshot.normalD20, true, 'Mobile must expose one-tap normal D20.');
    assert.equal(snapshot.modifier, true, 'Mobile must expose a roll modifier control.');
  } catch (error) {
    console.error('Mobile table-speed browser verification failed:', error);
    throw error;
  }
}

async function run() {
  await access(resolve(dist, 'index.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    await testDesktop(browser.client, server.origin);
    await testMobile(browser.client, server.origin);
    console.log('Table-speed browser checks passed: one-tap D20, +modifier execution/history, and four-column narrow mobile dice layout.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Table-speed browser audit failed:', error);
  process.exitCode = 1;
});
