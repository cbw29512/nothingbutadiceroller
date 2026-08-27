import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');

async function dispatchCtrlEnter(client, selector) {
  await client.evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    target?.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
  })()`);
}

async function run() {
  await access(resolve(dist, 'index.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    await navigate(browser.client, `${server.origin}/`, { width: 1440, height: 900, mobile: false });
    await waitFor(browser.client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);

    await browser.client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(browser.client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");

    await browser.client.evaluate("document.querySelector('#sound-toggle-btn')?.focus()");
    await dispatchCtrlEnter(browser.client, '#sound-toggle-btn');
    const focusedControlState = await browser.client.evaluate(`(() => ({
      activeId: document.activeElement?.id || '',
      rollDisabled: Boolean(document.querySelector('#roll-btn')?.disabled),
      historyCount: document.querySelectorAll('.history-item').length,
      total: document.querySelector('#total-result')?.textContent || '',
    }))()`);
    assert.equal(focusedControlState.activeId, 'sound-toggle-btn');
    assert.equal(focusedControlState.rollDisabled, false, 'Ctrl+Enter on a focused control must not start a background roll.');
    assert.equal(focusedControlState.historyCount, 0, 'Ctrl+Enter on a focused control must leave history untouched.');
    assert.equal(focusedControlState.total, '0', 'Ctrl+Enter on a focused control must leave the result untouched.');

    await browser.client.evaluate("document.querySelector('#desktop-custom-die-btn')?.click()");
    await waitFor(browser.client, "document.querySelector('#desktop-custom-die-btn')?.getAttribute('aria-expanded') === 'true'");

    await browser.client.evaluate(`(() => {
      const input = document.querySelector('#desktop-custom-die-sides');
      input.value = 'd1';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    })()`);
    await dispatchCtrlEnter(browser.client, '#desktop-custom-die-sides');
    await waitFor(browser.client, "document.querySelector('#desktop-custom-die-sides')?.validationMessage.length > 0 && !document.querySelector('#roll-btn')?.disabled", 10000);

    const invalidState = await browser.client.evaluate(`(() => ({
      historyCount: document.querySelectorAll('.history-item').length,
      total: document.querySelector('#total-result')?.textContent || '',
      breakdown: document.querySelector('#breakdown-text')?.textContent || '',
      pool: document.querySelector('#pool-summary')?.textContent || '',
    }))()`);
    assert.equal(invalidState.historyCount, 0, 'Invalid custom Ctrl+Enter must not fall through into a normal roll.');
    assert.equal(invalidState.total, '0', 'Invalid custom Ctrl+Enter must leave the roll total untouched.');
    assert.equal(invalidState.breakdown, 'No active roll', 'Invalid custom Ctrl+Enter must leave the result breakdown untouched.');
    assert.match(invalidState.pool, /d20/i, 'Blocked global shortcut must preserve the selected normal dice pool.');

    await browser.client.evaluate(`(() => {
      const input = document.querySelector('#desktop-custom-die-sides');
      input.value = 'd37';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    })()`);
    await dispatchCtrlEnter(browser.client, '#desktop-custom-die-sides');
    await waitFor(browser.client, "document.querySelector('#breakdown-text')?.textContent.includes('Custom d37')", 10000);

    const validState = await browser.client.evaluate(`(() => ({
      historyCount: document.querySelectorAll('.history-item').length,
      formula: document.querySelector('.history-item .history-formula')?.textContent || '',
      pool: document.querySelector('#pool-summary')?.textContent || '',
    }))()`);
    assert.equal(validState.historyCount, 1, 'Valid custom Ctrl+Enter must create exactly one custom-roll history entry.');
    assert.match(validState.formula, /1d37 custom/i);
    assert.match(validState.pool, /d20/i, 'Custom Ctrl+Enter must not consume or roll the selected normal dice pool.');

    console.log('Keyboard shortcut browser safety passed: Ctrl+Enter never hijacks focused controls and custom-die Ctrl+Enter cannot leak into a background normal roll, including the invalid-input edge case.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Keyboard shortcut browser safety failed:', error);
  process.exitCode = 1;
});
