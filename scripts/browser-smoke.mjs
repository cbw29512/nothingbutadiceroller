import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import {
  assertDesktopRollInteraction,
  assertDrawerAccessibility,
  assertMobileCustomInteraction,
  assertReducedMotion,
} from './browser/main-interactions.mjs';
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
    assert.equal(snapshot.studio, 'Dice Studio');
    assert.match(snapshot.accountCopy, /save dice configurations to your account/i);
    assert.doesNotMatch(snapshot.accountCopy, /permanent/i);
    assert.equal(snapshot.desktopDice, 7);
    assert.equal(snapshot.mobileDice, 7);
    assert.equal(snapshot.customButtons, true);

    if (viewport.mobile) {
      const sizes = await client.evaluate(`(() => ({
        roll: document.querySelector('#mobile-roll-btn')?.getBoundingClientRect().height || 0,
        die: document.querySelector('.mobile-die-btn[data-type="d20"]')?.getBoundingClientRect().height || 0,
        mode: document.querySelector('.mobile-mode-btn[data-quick-roll="advantage"]')?.getBoundingClientRect().height || 0,
      }))()`);
      assert.ok(sizes.roll >= 44, `Mobile Roll target is ${sizes.roll}px.`);
      assert.ok(sizes.die >= 44, `Mobile d20 target is ${sizes.die}px.`);
      assert.ok(sizes.mode >= 44, `Mobile ADV target is ${sizes.mode}px.`);
      await assertMobileCustomInteraction(client);
    } else {
      await assertDesktopRollInteraction(client);
      await assertDrawerAccessibility(client);
      await assertReducedMotion(client);
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
  assert.equal(await client.evaluate('location.href'), `${origin}${path}`);
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
        assertPageAudit(await browser.client.evaluate(PAGE_AUDIT_EXPRESSION), `${viewport.name} ${path}`);
        completed.push(`${viewport.name}:${path}`);
      }
    }
    console.log(`Browser smoke passed in ${browser.command}: ${completed.join(', ')}`);
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Browser smoke failed:', error);
  process.exitCode = 1;
});
