import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { PAGE_AUDIT_EXPRESSION, assertPageAudit } from './browser/page-audit.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const viewports = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const pages = ['/', '/customize.html', '/rolls.html', '/how-to.html', '/privacy.html', '/legal.html'];

async function assertRuntimeSurfaces(client, origin, path, viewport) {
  if (path === '/') {
    await waitFor(client, "document.querySelector('#account-auth-email') && document.querySelector('#open-styles-btn')");
    const snapshot = await client.evaluate(`(() => ({
      studio: document.querySelector('#open-styles-btn')?.textContent.trim(),
      accountCopy: document.querySelector('#account-signed-out p')?.textContent.trim(),
      desktopDice: document.querySelectorAll('.die-btn[data-type]').length,
      mobileDice: document.querySelectorAll('.mobile-die-btn[data-type]').length,
      customButtons: Boolean(document.querySelector('#desktop-custom-die-btn') && document.querySelector('#mobile-custom-die-btn')),
    }))()`);
    assert.equal(snapshot.studio, 'Dice Studio', 'Post-boot main UI must keep the Dice Studio name.');
    assert.match(snapshot.accountCopy, /save dice configurations to your account/i);
    assert.doesNotMatch(snapshot.accountCopy, /permanent/i);
    assert.equal(snapshot.desktopDice, 7, 'Desktop must expose all seven standard RPG dice.');
    assert.equal(snapshot.mobileDice, 7, 'Mobile must expose all seven standard RPG dice.');
    assert.equal(snapshot.customButtons, true, 'Custom dN entry must remain available.');
    if (viewport.mobile) {
      const height = await client.evaluate("document.querySelector('#mobile-roll-btn')?.getBoundingClientRect().height || 0");
      assert.ok(height >= 44, `Primary mobile Roll button must remain at least 44px tall; received ${height}.`);
    }
    return;
  }
  if (path === '/customize.html') {
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
    return;
  }
  if (path === '/rolls.html') {
    await waitFor(client, "document.querySelector('#manager-status')?.textContent.includes('Guest shortcuts are saved in this browser.')");
  }
  const current = await client.evaluate('location.href');
  assert.equal(current, `${origin}${path}`);
}

async function run() {
  await access(resolve(dist, 'index.html'));
  let server;
  let browser;
  const completed = [];

  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();

    for (const viewport of viewports) {
      for (const path of pages) {
        const url = `${server.origin}${path}`;
        await navigate(browser.client, url, viewport);
        await assertRuntimeSurfaces(browser.client, server.origin, path, viewport);
        const audit = await browser.client.evaluate(PAGE_AUDIT_EXPRESSION);
        assertPageAudit(audit, `${viewport.name} ${path}`);
        completed.push(`${viewport.name}:${path}`);
      }
    }
    console.log(`Browser smoke passed in ${browser.command}: ${completed.join(', ')}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.warn('Browser cleanup failed:', error.message);
      }
    }
    if (server) {
      try {
        await server.close();
      } catch (error) {
        console.warn('Static server cleanup failed:', error.message);
      }
    }
  }
}

run().catch((error) => {
  console.error('Browser smoke failed:', error);
  process.exitCode = 1;
});
