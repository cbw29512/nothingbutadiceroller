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

async function run() {
  await access(resolve(dist, 'index.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    const client = browser.client;
    await navigate(client, `${server.origin}/`, desktop);
    await client.evaluate('localStorage.clear()');
    await navigate(client, `${server.origin}/`, desktop);
    await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);

    await client.evaluate(`(() => {
      document.querySelector('.die-btn[data-type="d6"]')?.click();
      document.querySelector('.die-btn[data-type="d6"]')?.click();
      document.querySelector('.die-btn[data-type="d8"]')?.click();
    })()`);
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent === '2d6 + 1d8'");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "document.querySelector('#open-history-btn')?.textContent.includes('(1)') && !document.querySelector('#roll-btn')?.disabled", 30000);

    await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent === '1d20'");

    await client.evaluate("document.querySelector('#open-history-btn')?.click()");
    await waitFor(client, "document.querySelector('#history-drawer')?.getAttribute('aria-hidden') === 'false'");
    const first = await client.evaluate(`(() => ({
      formula: document.querySelector('#history-list .history-item .history-formula')?.textContent || '',
      rerollDisabled: Boolean(document.querySelector('#history-list .history-reroll-btn')?.disabled),
      copyPresent: Boolean(document.querySelector('#history-list .history-copy-btn')),
    }))()`);
    assert.equal(first.formula, '2d6 + 1d8');
    assert.equal(first.rerollDisabled, false, 'New standard history entries must expose exact reroll.');
    assert.equal(first.copyPresent, true, 'Every history entry must expose Copy.');

    await client.evaluate("document.querySelector('#history-list .history-reroll-btn')?.click()");
    await waitFor(client, "document.querySelector('#history-drawer')?.getAttribute('aria-hidden') === 'true'");
    await waitFor(client, "document.querySelector('#open-history-btn')?.textContent.includes('(2)') && !document.querySelector('#roll-btn')?.disabled", 30000);
    assert.equal(await client.evaluate("document.querySelector('#pool-summary')?.textContent"), '1d20', 'History reroll must preserve the user’s current selected pool.');

    await client.evaluate("document.querySelector('#open-history-btn')?.click()");
    await waitFor(client, "document.querySelector('#history-drawer')?.getAttribute('aria-hidden') === 'false'");
    const formulas = await client.evaluate(`[...document.querySelectorAll('#history-list .history-formula')].map((el) => el.textContent)`);
    assert.deepEqual(formulas.slice(0, 2), ['2d6 + 1d8', '2d6 + 1d8'], 'Exact reroll must replay the stored request rather than the current pool.');

    await client.evaluate(`(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text) => { window.__copiedHistory = text; } },
      });
    })()`);
    await client.evaluate("document.querySelector('#history-list .history-copy-btn')?.click()");
    await waitFor(client, "typeof window.__copiedHistory === 'string' && window.__copiedHistory.includes('2d6 + 1d8')");
    const copied = await client.evaluate('window.__copiedHistory');
    assert.match(copied, /^2d6 \+ 1d8 → \d+/);
    assert.match(copied, /Breakdown:/);
    assert.match(copied, /Time:/);
    await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('History roll copied.')");

    console.log('History actions passed: standard rolls carry validated exact-replay descriptors, reroll preserves the current selected pool, and Copy produces stable plain text without changing history.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('History action audit failed:', error);
  process.exitCode = 1;
});
