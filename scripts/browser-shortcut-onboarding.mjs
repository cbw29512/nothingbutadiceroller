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
      buttonCount: document.querySelectorAll('#shortcut-toolbar .shortcut-icon-btn').length,
    }))()`);
    assert.equal(empty.hint, 'Customize roll shortcuts → ⚙');
    assert.equal(empty.title, 'Customize roll shortcuts → ⚙');
    assert.equal(empty.gearLabel, 'Manage roll shortcuts');
    assert.equal(empty.toolbarHidden, true);
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

    const configured = await client.evaluate(`(() => ({
      title: document.querySelector('#shortcut-toolbar-title')?.textContent.trim() || '',
      note: document.querySelector('#shortcut-toolbar-section .shortcut-toolbar-note')?.textContent.trim() || '',
      noteHidden: Boolean(document.querySelector('#shortcut-toolbar-section .shortcut-toolbar-note')?.hidden),
      hintHidden: Boolean(document.querySelector('#mobile-shortcut-hint')?.hidden),
      rows: document.querySelector('#shortcut-toolbar')?.dataset.rowCount || '',
    }))()`);
    assert.equal(configured.title, 'My shortcuts');
    assert.equal(configured.note, 'Hold or focus for details');
    assert.equal(configured.noteHidden, false);
    assert.equal(configured.hintHidden, true, 'First-use setup hint must disappear after shortcuts exist.');
    assert.equal(configured.rows, '1');

    await client.evaluate("document.querySelector('#shortcut-toolbar .shortcut-icon-btn')?.focus()");
    await waitFor(client, "document.activeElement?.classList.contains('shortcut-icon-btn') === true");
    await waitFor(client, "document.querySelector('#shortcut-tooltip')?.hidden === false");
    assert.match(await client.evaluate("document.querySelector('#shortcut-tooltip')?.textContent || ''"), /Fireball/i);

    console.log('Shortcut onboarding passed: clear first-use copy, gear remains available, hint disappears once configured, and keyboard focus exposes shortcut details without changing shortcut mechanics.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Shortcut onboarding audit failed:', error);
  process.exitCode = 1;
});
