import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const mobile = { name: 'mobile', width: 390, height: 844, mobile: true };

async function run() {
  await access(resolve(dist, 'index.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    const client = browser.client;
    await navigate(client, `${server.origin}/`, mobile);
    await client.evaluate('localStorage.clear()');
    await navigate(client, `${server.origin}/`, mobile);
    await waitFor(client, "document.querySelector('.mobile-die-btn[data-type=\"d6\"]') && document.querySelector('#mobile-clear-btn')");

    await client.evaluate(`(() => {
      document.querySelector('.mobile-die-btn[data-type="d6"]')?.click();
      document.querySelector('.mobile-die-btn[data-type="d6"]')?.click();
      document.querySelector('.mobile-die-btn[data-type="d8"]')?.click();
    })()`);
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent === '2d6 + 1d8'");

    const selected = await client.evaluate(`(() => {
      const d6 = document.querySelector('.mobile-die-btn[data-type="d6"]');
      const d8 = document.querySelector('.mobile-die-btn[data-type="d8"]');
      const d20 = document.querySelector('.mobile-die-btn[data-type="d20"]');
      const row = document.querySelector('.mobile-dice-row');
      return {
        d6Count: d6?.dataset.count || '',
        d8Count: d8?.dataset.count || '',
        d20Count: d20?.dataset.count || '',
        d6Class: Boolean(d6?.classList.contains('has-quantity')),
        d8Class: Boolean(d8?.classList.contains('has-quantity')),
        d20Class: Boolean(d20?.classList.contains('has-quantity')),
        d6Label: d6?.getAttribute('aria-label') || '',
        d8Label: d8?.getAttribute('aria-label') || '',
        rowOverflow: row ? row.scrollWidth > row.clientWidth : true,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        buttonMinHeight: d6 ? d6.getBoundingClientRect().height : 0,
      };
    })()`);
    assert.equal(selected.d6Count, '2');
    assert.equal(selected.d8Count, '1');
    assert.equal(selected.d20Count, '');
    assert.equal(selected.d6Class, true);
    assert.equal(selected.d8Class, true);
    assert.equal(selected.d20Class, false);
    assert.match(selected.d6Label, /d6, 2 selected/i);
    assert.match(selected.d8Label, /d8, 1 selected/i);
    assert.equal(selected.rowOverflow, false, 'Quantity badges must not expand the seven-button mobile dice row.');
    assert.equal(selected.pageOverflow, false, 'Quantity badges must not introduce page-level horizontal overflow.');
    assert.ok(selected.buttonMinHeight >= 40, `Protected mobile die target shrank below its existing minimum: ${selected.buttonMinHeight}px.`);

    await client.evaluate(`(() => {
      const d6Chip = [...document.querySelectorAll('.pool-chip')].find((button) => button.textContent.startsWith('2d6'));
      d6Chip?.click();
    })()`);
    await waitFor(client, "document.querySelector('.mobile-die-btn[data-type=\"d6\"]')?.dataset.count === '1'");
    assert.match(await client.evaluate("document.querySelector('.mobile-die-btn[data-type=\"d6\"]')?.getAttribute('aria-label') || ''"), /1 selected/i);

    await client.evaluate("document.querySelector('#mobile-clear-btn')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent === 'No dice selected'");
    const cleared = await client.evaluate(`(() => ({
      remaining: [...document.querySelectorAll('.mobile-die-btn[data-type]')].filter((button) => button.dataset.count || button.classList.contains('has-quantity')).length,
      d6Label: document.querySelector('.mobile-die-btn[data-type="d6"]')?.getAttribute('aria-label') || '',
    }))()`);
    assert.equal(cleared.remaining, 0, 'Clear must remove all mobile quantity badges.');
    assert.match(cleared.d6Label, /none selected/i);

    console.log('Mobile dice quantity feedback passed: compact per-die counts track selection/removal/clear state, improve accessible labels, and preserve the protected seven-button row without overflow.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Mobile dice quantity audit failed:', error);
  process.exitCode = 1;
});
