import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const viewport = { name: 'desktop', width: 1440, height: 900, mobile: false };
const EXPECTED_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

async function run() {
  await access(resolve(dist, 'customize.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    await navigate(browser.client, `${server.origin}/customize.html`, viewport);
    await waitFor(browser.client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
    await waitFor(browser.client, "document.querySelectorAll('#studio-preview-dice [data-preview-geometry]').length === 7");

    const snapshot = await browser.client.evaluate(`(() => {
      const dice = [...document.querySelectorAll('#studio-preview-dice .studio-preview-die')];
      return {
        label: document.querySelector('.studio-preview-panel .section-label')?.textContent.trim() || '',
        note: document.querySelector('.studio-preview-panel .studio-note')?.textContent.trim() || '',
        canvasCount: document.querySelectorAll('#studio-preview-tray canvas').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        dice: dice.map((die) => ({
          type: die.dataset.previewGeometry || '',
          clipPath: getComputedStyle(die).clipPath,
          svgCount: die.querySelectorAll('[data-preview-geometry-art]').length,
          lineCount: die.querySelectorAll('[data-preview-geometry-art] polyline, [data-preview-geometry-art] ellipse').length,
          surfaceFinish: die.dataset.surfaceFinish || '',
          surfacePattern: die.dataset.surfacePattern || '',
          edgeInlay: die.dataset.edgeInlay || '',
        })),
      };
    })()`);

    assert.equal(snapshot.label, 'Physical Shape Preview');
    assert.match(snapshot.note, /authoritative 3D physics view/i);
    assert.equal(snapshot.canvasCount, 0, 'Dice Studio preview must not load a second physics canvas.');
    assert.ok(snapshot.overflow <= 1, `Geometry preview introduced ${snapshot.overflow}px horizontal overflow.`);
    assert.deepEqual(snapshot.dice.map((die) => die.type), EXPECTED_TYPES);
    assert.ok(snapshot.dice.every((die) => die.svgCount === 1), 'Every standard die preview must have exactly one facet overlay.');
    assert.ok(snapshot.dice.every((die) => die.lineCount >= 3), 'Every standard die preview must include visible facet geometry.');
    assert.equal(new Set(snapshot.dice.map((die) => die.clipPath)).size, EXPECTED_TYPES.length,
      'Each standard die must have a distinct physical preview silhouette.');
    assert.ok(snapshot.dice.every((die) => die.surfaceFinish && die.surfacePattern && die.edgeInlay),
      'Geometry decoration must preserve the existing appearance-plan data attributes.');

    await browser.client.evaluate("document.querySelector('#studio-preview-dice [data-preview-geometry=\"d6\"]')?.click()");
    await waitFor(browser.client, "document.querySelector('#selected-die-label')?.textContent === 'D6'");
    assert.equal(await browser.client.evaluate("document.querySelectorAll('#studio-preview-dice [data-preview-geometry]').length"), 7,
      'Selecting a die must preserve all seven decorated preview geometries after rerender.');

    console.log('Dice Studio physical preview passed: seven distinct standard-die silhouettes, facet overlays, appearance-plan preservation, no second physics canvas, selection rerender, and no horizontal overflow.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Dice Studio physical preview failed:', error);
  process.exitCode = 1;
});
