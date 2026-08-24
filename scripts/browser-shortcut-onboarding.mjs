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
const STORAGE_KEY = 'nothingbutadiceroller.shortcuts.v2';

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
    await waitFor(client, "document.querySelector('#mobile-shortcut-settings-btn') && !document.querySelector('#mobile-shortcut-settings-btn').hidden");
    await waitFor(client, "document.querySelector('#mobile-shortcut-hint') && !document.querySelector('#mobile-shortcut-hint').hidden");

    const empty = await client.evaluate(`(() => ({
      hint: document.querySelector('#mobile-shortcut-hint')?.textContent.trim() || '',
      title: document.querySelector('#shortcut-toolbar-title')?.textContent.trim() || '',
      gearLabel: document.querySelector('#mobile-shortcut-settings-btn')?.getAttribute('aria-label') || '',
      toolbarHidden: Boolean(document.querySelector('#shortcut-toolbar')?.hidden),
      mobileMountHidden: Boolean(document.querySelector('#mobile-shortcut-toolbar-mount')?.hidden),
      buttonCount: document.querySelectorAll('#shortcut-toolbar .shortcut-icon-btn').length,
    }))()`);
    assert.equal(empty.hint, 'Customize roll shortcuts → ⚙');
    assert.equal(empty.title, 'Customize roll shortcuts → ⚙');
    assert.equal(empty.gearLabel, 'Manage roll shortcuts');
    assert.equal(empty.toolbarHidden, true);
    assert.equal(empty.mobileMountHidden, true, 'Empty mobile shortcut mount must not consume dock space.');
    assert.equal(empty.buttonCount, 0);

    await client.evaluate(`localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify({
      schemaVersion: 2,
      revision: 1,
      updatedAt: new Date().toISOString(),
      shortcuts: [{
        id: 'onboarding-fireball',
        source: 'raw',
        ruleset: 'dnd5e-2024',
        spellId: 'fireball',
        baseVariantId: 'slot-3',
        inputs: {},
      }],
      options: { criticalMode: 'raw', preferredRuleset: 'dnd5e-2024' },
    }))`);
    await navigate(client, `${server.origin}/`, mobile);
    await waitFor(client, "document.querySelectorAll('#shortcut-toolbar .shortcut-icon-btn').length === 1");
    await waitFor(client, "document.querySelector('#mobile-shortcut-hint')?.hidden === true");
    await waitFor(client, "document.querySelector('#mobile-shortcut-toolbar-mount')?.hidden === false");

    const configured = await client.evaluate(`(() => {
      const button = document.querySelector('#shortcut-toolbar .shortcut-icon-btn');
      const rect = button?.getBoundingClientRect();
      return {
        title: document.querySelector('#shortcut-toolbar-title')?.textContent.trim() || '',
        note: document.querySelector('#shortcut-toolbar-section .shortcut-toolbar-note')?.textContent.trim() || '',
        noteHidden: Boolean(document.querySelector('#shortcut-toolbar-section .shortcut-toolbar-note')?.hidden),
        hintHidden: Boolean(document.querySelector('#mobile-shortcut-hint')?.hidden),
        rows: document.querySelector('#shortcut-toolbar')?.dataset.rowCount || '',
        mountedMobile: Boolean(document.querySelector('#mobile-shortcut-toolbar-mount')?.contains(document.querySelector('#shortcut-toolbar-section'))),
        buttonVisible: Boolean(rect?.width && rect?.height) && getComputedStyle(button).visibility !== 'hidden' && getComputedStyle(button).display !== 'none',
        buttonDisabled: Boolean(button?.disabled),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    })()`);
    assert.equal(configured.title, 'My shortcuts');
    assert.equal(configured.note, 'Hold or focus for details');
    assert.equal(configured.noteHidden, false);
    assert.equal(configured.hintHidden, true, 'First-use setup hint must disappear after shortcuts exist.');
    assert.equal(configured.rows, '1');
    assert.equal(configured.mountedMobile, true, 'Configured shortcut toolbar must move into the visible mobile play dock.');
    assert.equal(configured.buttonVisible, true, 'Configured mobile shortcut button must be rendered and visible.');
    assert.equal(configured.buttonDisabled, false, 'Configured shortcut must be keyboard-focusable before activation.');
    assert.ok(configured.overflow <= 1, `Mobile shortcut toolbar introduced ${configured.overflow}px horizontal overflow.`);

    await client.evaluate("document.querySelector('#shortcut-toolbar .shortcut-icon-btn')?.focus()");
    await waitFor(client, "document.activeElement?.classList.contains('shortcut-icon-btn') === true");
    await waitFor(client, "document.querySelector('#shortcut-tooltip')?.hidden === false");
    assert.match(await client.evaluate("document.querySelector('#shortcut-tooltip')?.textContent || ''"), /Fireball/i);

    console.log('Shortcut onboarding passed: first-use copy stays compact, configured shortcuts move into the visible mobile dock, keyboard focus exposes details, and shortcut mechanics/storage remain unchanged.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Shortcut onboarding audit failed:', error);
  process.exitCode = 1;
});
