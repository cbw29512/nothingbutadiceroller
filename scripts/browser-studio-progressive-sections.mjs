import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const viewports = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const EXPECTED = ['dice', 'material', 'surface', 'faces', 'tray'];

async function sectionSnapshot(client) {
  return client.evaluate(`(() => [...document.querySelectorAll('.studio-editor-section')].map((section) => ({
    key: section.dataset.studioSection,
    open: section.open,
    title: section.querySelector('summary strong')?.textContent.trim() || '',
    summaryHeight: section.querySelector('summary')?.getBoundingClientRect().height || 0,
    legends: [...section.querySelectorAll('fieldset.studio-group > legend')].map((legend) => legend.textContent.trim()),
  })))()`);
}

async function runViewport(client, origin, viewport) {
  await navigate(client, `${origin}/customize.html`, viewport);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
  await waitFor(client, "document.querySelectorAll('.studio-editor-section').length === 5");

  const sections = await sectionSnapshot(client);
  assert.deepEqual(sections.map((section) => section.key), EXPECTED, `${viewport.name}: progressive section order changed.`);
  assert.deepEqual(sections.map((section) => section.title), ['Dice', 'Material', 'Surface', 'Faces', 'Tray']);
  assert.deepEqual(sections.filter((section) => section.open).map((section) => section.key), ['dice'],
    `${viewport.name}: only Dice should be expanded on first entry.`);
  assert.deepEqual(sections.find((section) => section.key === 'dice')?.legends, ['Set-wide dice look', 'Selected die look']);
  assert.deepEqual(sections.find((section) => section.key === 'material')?.legends, ['Clear resin & inside']);
  assert.deepEqual(sections.find((section) => section.key === 'surface')?.legends, ['Surface finish', 'Surface pattern', 'Face-edge inlay']);
  assert.deepEqual(sections.find((section) => section.key === 'faces')?.legends, ['Selected die faces']);
  assert.deepEqual(sections.find((section) => section.key === 'tray')?.legends, ['Tray']);

  const structure = await client.evaluate(`(() => ({
    groups: document.querySelectorAll('.editor-panel fieldset.studio-group').length,
    grouped: document.querySelectorAll('.studio-editor-section fieldset.studio-group').length,
    directGroups: document.querySelectorAll('.editor-panel > fieldset.studio-group').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))()`);
  assert.ok(structure.groups >= 8, `${viewport.name}: expected all advanced Studio groups to remain present.`);
  assert.equal(structure.grouped, structure.groups, `${viewport.name}: every Studio fieldset must live inside a progressive section.`);
  assert.equal(structure.directGroups, 0, `${viewport.name}: ungrouped advanced fieldsets remain in the editor.`);
  assert.ok(structure.overflow <= 1, `${viewport.name}: progressive sections introduced ${structure.overflow}px horizontal overflow.`);
  if (viewport.mobile) assert.ok(sections.every((section) => section.summaryHeight >= 44),
    `Mobile progressive section targets must be at least 44px: ${sections.map((section) => section.summaryHeight).join(', ')}.`);

  await client.evaluate("document.querySelector('[data-studio-section=\"surface\"] > summary')?.click()");
  await waitFor(client, "document.querySelector('[data-studio-section=\"surface\"]')?.open === true");
  assert.equal(await client.evaluate("document.querySelector('#edge-inlay-group')?.closest('[data-studio-section]')?.dataset.studioSection"), 'surface');

  if (viewport.mobile) {
    await client.evaluate("document.querySelector('[data-studio-mobile-target=\"sets\"]')?.click()");
    await waitFor(client, "document.body.dataset.studioMobileView === 'sets'");
  }
  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#set-name')?.value === 'New Dice Set'");
  await waitFor(client, "document.querySelector('[data-studio-section=\"dice\"]')?.open === true");
  if (viewport.mobile) await waitFor(client, "document.body.dataset.studioMobileView === 'edit'");

  if (viewport.mobile) {
    await client.evaluate("document.querySelector('[data-studio-mobile-target=\"preview\"]')?.click()");
    await waitFor(client, "document.body.dataset.studioMobileView === 'preview'");
  }
  await waitFor(client, "document.querySelector('#studio-preview-dice [data-preview-face]')");
  await client.evaluate("document.querySelector('#studio-preview-dice [data-preview-face]')?.click()");
  await waitFor(client, "document.querySelector('[data-studio-section=\"faces\"]')?.open === true");
  await waitFor(client, "document.activeElement?.id === 'face-value'");
  if (viewport.mobile) await waitFor(client, "document.body.dataset.studioMobileView === 'edit'");

  console.log(`${viewport.name} Studio progressive controls passed.`);
}

async function run() {
  await access(resolve(dist, 'customize.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    for (const viewport of viewports) await runViewport(browser.client, server.origin, viewport);
    console.log('Dice Studio progressive sections passed: five clear groups, every advanced control preserved, accessible mobile targets, New Set handoff, face-edit handoff, and no horizontal overflow.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Dice Studio progressive sections failed:', error);
  process.exitCode = 1;
});
