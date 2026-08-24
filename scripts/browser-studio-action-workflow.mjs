import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIO_USE_ACTION_LABEL } from '../js/appearance/studio-action-workflow.mjs';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const viewports = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

async function runViewport(client, origin, viewport) {
  await navigate(client, `${origin}/customize.html`, viewport);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
  await waitFor(client, "document.querySelector('.studio-primary-action-bar') && document.querySelector('.studio-secondary-actions')");

  const initial = await client.evaluate(`(() => {
    const bar = document.querySelector('.studio-primary-action-bar');
    const more = document.querySelector('.studio-secondary-actions');
    const summary = more?.querySelector(':scope > summary');
    const detail = bar.querySelector('.studio-primary-action-state small');
    return {
      primaryIds: [...bar.querySelectorAll('button')].map((button) => button.id),
      secondaryIds: [...more.querySelectorAll('button')].map((button) => button.id),
      moreOpen: more.open,
      summaryHeight: summary?.getBoundingClientRect().height || 0,
      position: getComputedStyle(bar).position,
      state: bar.querySelector('.studio-primary-action-state strong')?.textContent.trim() || '',
      savedDetailVisible: Boolean(detail?.getClientRects().length) && getComputedStyle(detail).display !== 'none',
      useText: document.querySelector('#use-set')?.textContent.trim() || '',
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assert.deepEqual(initial.primaryIds, ['save-set', 'use-set'], `${viewport.name}: primary action bar must contain only Save and Use.`);
  assert.deepEqual(initial.secondaryIds, ['lock-set', 'publish-set', 'delete-set'], `${viewport.name}: Lock/Publish/Delete must be secondary actions.`);
  assert.equal(initial.moreOpen, false, `${viewport.name}: secondary actions must be collapsed initially.`);
  assert.equal(initial.position, 'sticky', `${viewport.name}: Save/Use bar must remain sticky.`);
  assert.equal(initial.state, 'Saved', `${viewport.name}: initial immutable/default state should be clean.`);
  assert.equal(initial.useText, STUDIO_USE_ACTION_LABEL);
  assert.ok(initial.overflow <= 1, `${viewport.name}: action workflow introduced ${initial.overflow}px horizontal overflow.`);
  if (viewport.mobile) {
    assert.ok(initial.summaryHeight >= 44, `Mobile More actions target is ${initial.summaryHeight}px.`);
    assert.equal(initial.savedDetailVisible, false, 'Mobile saved state should stay compact instead of repeating the saved-state explanation.');
  }

  if (viewport.mobile) {
    await client.evaluate("document.querySelector('[data-studio-mobile-target=\"sets\"]')?.click()");
    await waitFor(client, "document.body.dataset.studioMobileView === 'sets'");
  }
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#set-name')?.value === 'New Dice Set'");
  await waitFor(client, "document.querySelector('.studio-primary-action-state strong')?.textContent === 'Unsaved changes'");
  assert.equal(await client.evaluate("document.querySelector('#save-set')?.disabled"), false, `${viewport.name}: new set must be saveable from sticky bar.`);
  if (viewport.mobile) {
    const dirtyDetailVisible = await client.evaluate(`(() => {
      const detail = document.querySelector('.studio-primary-action-state small');
      return Boolean(detail?.getClientRects().length) && getComputedStyle(detail).display !== 'none';
    })()`);
    assert.equal(dirtyDetailVisible, true, 'Mobile unsaved state must keep its save-before-use guidance visible.');
  }

  await client.evaluate(`(() => {
    const name = document.querySelector('#set-name');
    name.value = 'Sticky Action Audit';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    name.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(client, "document.querySelector('.studio-primary-action-state strong')?.textContent === 'Unsaved changes'");
  await client.evaluate("document.querySelector('#save-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
  await waitFor(client, "document.querySelector('.studio-primary-action-state strong')?.textContent === 'Saved'");
  if (viewport.mobile) {
    const savedDetailVisible = await client.evaluate(`(() => {
      const detail = document.querySelector('.studio-primary-action-state small');
      return Boolean(detail?.getClientRects().length) && getComputedStyle(detail).display !== 'none';
    })()`);
    assert.equal(savedDetailVisible, false, 'Mobile saved state should collapse its redundant detail again after saving.');
  }

  await client.evaluate("document.querySelector('.studio-secondary-actions > summary')?.click()");
  await waitFor(client, "document.querySelector('.studio-secondary-actions')?.open === true");
  const secondaryVisible = await client.evaluate(`(() => ['lock-set','publish-set','delete-set'].every((id) => {
    const element = document.getElementById(id);
    return Boolean(element?.getClientRects().length) && getComputedStyle(element).display !== 'none';
  }))()`);
  assert.equal(secondaryVisible, true, `${viewport.name}: secondary action disclosure must reveal Lock/Publish/Delete.`);

  if (viewport.mobile) {
    await client.evaluate(`(() => {
      document.querySelector('[data-studio-section="tray"]').open = true;
      const input = document.querySelector('#tray-image');
      input.focus();
    })()`);
    await waitFor(client, "document.activeElement?.id === 'tray-image'");
    const focusGeometry = await client.evaluate(`(() => {
      const focus = document.activeElement.getBoundingClientRect();
      const bar = document.querySelector('.studio-primary-action-bar').getBoundingClientRect();
      return { focusTop: focus.top, focusBottom: focus.bottom, barTop: bar.top, barBottom: bar.bottom };
    })()`);
    assert.ok(focusGeometry.focusBottom <= focusGeometry.barTop + 1 || focusGeometry.focusTop >= focusGeometry.barBottom - 1,
      `Mobile sticky action bar obscured focused Tray Image control: ${JSON.stringify(focusGeometry)}.`);
  }

  console.log(`${viewport.name} Studio sticky Save/Use workflow passed.`);
}

async function run() {
  await access(resolve(dist, 'customize.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    for (const viewport of viewports) await runViewport(browser.client, server.origin, viewport);
    console.log('Dice Studio Save/Use workflow passed: sticky primary actions, explicit Use This Set wording, compact saved state, visible unsaved guidance, secondary destructive/publishing actions, save recovery, mobile target sizing, focus visibility, and no horizontal overflow.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Dice Studio Save/Use workflow failed:', error);
  process.exitCode = 1;
});
