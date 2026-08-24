import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const viewport = { name: 'mobile', width: 390, height: 844, mobile: true };

async function visible(client, selector) {
  return client.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const style = getComputedStyle(element);
    return Boolean(element.getClientRects().length) && style.display !== 'none' && style.visibility !== 'hidden';
  })()`);
}

async function clickView(client, view) {
  await client.evaluate(`document.querySelector('[data-studio-mobile-target="${view}"]')?.click()`);
  await waitFor(client, `document.body.dataset.studioMobileView === '${view}'`);
}

async function run() {
  await access(resolve(dist, 'customize.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    await navigate(browser.client, `${server.origin}/customize.html`, viewport);
    await waitFor(browser.client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
    await waitFor(browser.client, "document.querySelectorAll('.studio-mobile-nav-btn').length === 4");

    const initial = await browser.client.evaluate(`(() => ({
      view: document.body.dataset.studioMobileView,
      labels: [...document.querySelectorAll('.studio-mobile-nav-btn')].map((button) => button.textContent.trim()),
      heights: [...document.querySelectorAll('.studio-mobile-nav-btn')].map((button) => button.getBoundingClientRect().height),
      selected: [...document.querySelectorAll('.studio-mobile-nav-btn')].filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.dataset.studioMobileTarget),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))()`);
    assert.equal(initial.view, 'edit', 'Mobile Dice Studio must open directly in Edit.');
    assert.deepEqual(initial.labels, ['Edit', 'Preview', 'Sets', 'Community']);
    assert.deepEqual(initial.selected, ['edit']);
    assert.ok(initial.heights.every((height) => height >= 44), `Every mobile Studio section target must be at least 44px; received ${initial.heights.join(', ')}.`);
    assert.ok(initial.overflow <= 1, `Mobile Studio navigation introduced ${initial.overflow}px horizontal overflow.`);
    assert.equal(await visible(browser.client, '.editor-panel'), true, 'Edit panel must be the initial visible mobile view.');
    assert.equal(await visible(browser.client, '.studio-preview-panel'), false, 'Preview must not block the initial Edit view.');
    assert.equal(await visible(browser.client, '.library-panel'), false, 'Sets/Community must not block the initial Edit view.');

    await clickView(browser.client, 'preview');
    assert.equal(await visible(browser.client, '.studio-preview-panel'), true, 'Preview button must reveal the preview.');
    assert.equal(await visible(browser.client, '.editor-panel'), false, 'Preview view must not leave the long editor underneath it.');

    await clickView(browser.client, 'sets');
    assert.equal(await visible(browser.client, '.library-panel'), true, 'Sets button must reveal My Collection.');
    assert.equal(await visible(browser.client, '#studio-library'), true, 'My Collection must remain visible in Sets.');
    assert.equal(await visible(browser.client, '#community-library'), false, 'Community list must stay out of the Sets view.');

    await browser.client.evaluate("document.querySelector('#new-set')?.click()");
    await waitFor(browser.client, "document.body.dataset.studioMobileView === 'edit'");
    await waitFor(browser.client, "document.querySelector('#set-name')?.value === 'New Dice Set'");
    assert.equal(await visible(browser.client, '.editor-panel'), true, 'New Set must take the user straight to Edit.');

    await clickView(browser.client, 'community');
    assert.equal(await visible(browser.client, '.library-panel'), true, 'Community button must reveal the library panel.');
    assert.equal(await visible(browser.client, '#studio-library'), false, 'My Collection must stay out of Community.');
    assert.equal(await visible(browser.client, '#community-library'), true, 'Community list must be visible in Community.');

    await clickView(browser.client, 'preview');
    const previewFace = await browser.client.evaluate("document.querySelector('[data-preview-face]')?.dataset.previewFace || ''");
    if (previewFace) {
      await browser.client.evaluate("document.querySelector('[data-preview-face]')?.click()");
      await waitFor(browser.client, "document.body.dataset.studioMobileView === 'edit'");
      assert.equal(await visible(browser.client, '.editor-panel'), true, 'Selecting a preview face must return to Edit so the face editor is visible.');
    }

    console.log('Mobile Dice Studio navigation passed: Edit-first flow, 44px section controls, isolated Preview/Sets/Community views, New Set handoff, preview-face handoff, and no horizontal overflow.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Mobile Dice Studio navigation failed:', error);
  process.exitCode = 1;
});
