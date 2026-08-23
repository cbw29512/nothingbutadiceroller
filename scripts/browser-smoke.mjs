import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import {
  assertAccountDataControls,
  assertDesktopRollInteraction,
  assertDrawerAccessibility,
  assertMobileCustomInteraction,
  assertReducedMotion,
} from './browser/main-interactions.mjs';
import { PAGE_AUDIT_EXPRESSION, assertPageAudit } from './browser/page-audit.mjs';
import { PERFORMANCE_EXPRESSION, formatPerformance } from './browser/performance-report.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const viewports = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const pages = ['/', '/customize.html', '/rolls.html', '/how-to.html', '/privacy.html', '/legal.html', '/moderation.html'];

async function customRollDiagnostic(client) {
  return client.evaluate(`(() => ({
    physicsStatus: document.querySelector('#physics-status')?.textContent || '',
    rollDisabled: Boolean(document.querySelector('#roll-btn')?.disabled),
    total: document.querySelector('#total-result')?.textContent || '',
    breakdown: document.querySelector('#breakdown-text')?.textContent || '',
    pool: document.querySelector('#pool-summary')?.textContent || '',
    canvasCount: document.querySelectorAll('#dice-tray canvas').length,
    activeId: localStorage.getItem('ndr.appearance.activeSet.v2'),
    resources: performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.includes('/api/dice-theme/') || url.includes('/vendor/dice-box-1.1.4/'))
      .slice(-40),
  }))()`);
}

async function assertStudioCreationFlow(client, origin) {
  const viewport = viewports[0];
  await navigate(client, `${origin}/`, viewport);
  await waitFor(client, "document.querySelector('#open-styles-btn') && document.querySelector('#account-auth-email')");
  await client.evaluate("document.querySelector('#open-styles-btn')?.click()");
  await waitFor(client, "location.pathname === '/customize.html'");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");

  const defaultState = await client.evaluate(`(() => ({
    setNameDisabled: Boolean(document.querySelector('#set-name')?.disabled),
    saveDisabled: Boolean(document.querySelector('#save-set')?.disabled),
    newDisabled: Boolean(document.querySelector('#new-set')?.disabled),
    actionButtons: ['new-set','save-set','use-set','lock-set','publish-set','delete-set','reset-default','refresh-community','load-more-community','import-browser-sets']
      .every((id) => Boolean(document.getElementById(id))),
  }))()`);
  assert.equal(defaultState.setNameDisabled, true, 'Immutable Default Dice must not expose editable fields.');
  assert.equal(defaultState.saveDisabled, true, 'Immutable Default Dice must not be saveable as an edited system set.');
  assert.equal(defaultState.newDisabled, false, 'New Set must remain available from the immutable default.');
  assert.equal(defaultState.actionButtons, true, 'Dice Studio action surface is incomplete.');

  await client.evaluate("document.querySelector('#new-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
  const newState = await client.evaluate(`(() => ({
    name: document.querySelector('#set-name')?.value || '',
    setNameDisabled: Boolean(document.querySelector('#set-name')?.disabled),
    saveDisabled: Boolean(document.querySelector('#save-set')?.disabled),
    faceModeDisabled: Boolean(document.querySelector('#face-mode')?.disabled),
    faceNodes: document.querySelectorAll('#face-map .face-node').length,
  }))()`);
  assert.equal(newState.name, 'New Dice Set');
  assert.equal(newState.setNameDisabled, false, 'New custom set name must be editable.');
  assert.equal(newState.saveDisabled, false, 'New custom set must be saveable.');
  assert.equal(newState.faceModeDisabled, false, 'New custom set face mode must be editable.');
  assert.ok(newState.faceNodes >= 20, `Expected an editable d20 face map; received ${newState.faceNodes} nodes.`);

  await client.evaluate(`(() => {
    const mode = document.querySelector('#face-mode');
    mode.value = 'custom';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(client, "document.querySelector('#face-mode')?.value === 'custom' && !document.querySelector('#apply-face')?.disabled");

  await client.evaluate(`(() => {
    const value = document.querySelector('#face-value');
    value.value = 'CRIT';
    value.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#apply-face')?.click();
  })()`);
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Face 20 updated visually.')");
  const faceState = await client.evaluate(`(() => ({
    value: document.querySelector('#face-value')?.value || '',
    selectedText: document.querySelector('#face-map .face-node.active')?.textContent || '',
    logicalResult: document.querySelector('#logical-result-label')?.textContent || '',
  }))()`);
  assert.equal(faceState.value, 'CRIT');
  assert.equal(faceState.selectedText, 'CRIT');
  assert.match(faceState.logicalResult, /Always reports 20/i);

  await client.evaluate("document.querySelector('#save-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
  const saved = await client.evaluate(`(() => ({
    libraryNames: [...document.querySelectorAll('#studio-library .studio-set-card strong')].map((el) => el.textContent),
    activeId: localStorage.getItem('ndr.appearance.activeSet.v2'),
  }))()`);
  assert.ok(saved.libraryNames.includes('New Dice Set'), 'Saved custom set did not appear in My Collection.');

  await client.evaluate("document.querySelector('#use-set')?.click()");
  await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Set marked active for the roller.')");
  await waitFor(client, "document.querySelector('#active-badge')?.textContent === 'ACTIVE'");
  const active = await client.evaluate(`(() => {
    const id = localStorage.getItem('ndr.appearance.activeSet.v2');
    const snapshot = JSON.parse(localStorage.getItem('ndr.appearance.activeSnapshot.v2') || 'null');
    return { id, snapshotId: snapshot?.id || null, snapshotName: snapshot?.name || null };
  })()`);
  assert.ok(active.id, 'Using a custom set must persist an active set id.');
  assert.equal(active.snapshotId, active.id, 'Active custom set snapshot must match its active id.');
  assert.equal(active.snapshotName, 'New Dice Set');

  await client.evaluate("document.querySelector('.studio-header a[href=\"/\"]')?.click()");
  await waitFor(client, "location.pathname === '/'");
  await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
  const restored = await client.evaluate(`(() => {
    const id = localStorage.getItem('ndr.appearance.activeSet.v2');
    const snapshot = JSON.parse(localStorage.getItem('ndr.appearance.activeSnapshot.v2') || 'null');
    return { id, snapshotId: snapshot?.id || null, snapshotName: snapshot?.name || null };
  })()`);
  assert.equal(restored.snapshotId, restored.id, 'Custom set must stay active after returning to the roller.');
  assert.equal(restored.snapshotName, 'New Dice Set');

  await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
  await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
  await client.evaluate("document.querySelector('#roll-btn')?.click()");
  try {
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
  } catch (error) {
    throw new Error(`Custom-themed physical d20 did not settle: ${JSON.stringify(await customRollDiagnostic(client))}. ${error.message}`);
  }

  const customResult = await client.evaluate(`(() => ({
    total: Number(document.querySelector('#total-result')?.textContent),
    breakdown: document.querySelector('#breakdown-text')?.textContent || '',
    resources: performance.getEntriesByType('resource').map((entry) => entry.name),
  }))()`);
  assert.ok(customResult.total >= 1 && customResult.total <= 20, `Custom-themed d20 result must remain 1-20; received ${customResult.total}.`);
  assert.match(customResult.breakdown, /d20/i);
  assert.ok(customResult.resources.some((url) => /\/api\/dice-theme\/[^/]+\/theme\.config\.json/.test(url)),
    'Custom-themed roll must load its same-origin runtime theme config.');
  assert.ok(customResult.resources.some((url) => /\/api\/dice-theme\/[^/]+\/diffuse\.svg/.test(url)),
    'Custom-themed roll must load its same-origin runtime theme texture.');
  assert.ok(customResult.resources.some((url) => url.includes('/vendor/dice-box-1.1.4/Dice.min.js')),
    'Custom-themed roll must use the self-hosted DiceBox onscreen runtime.');

  await client.evaluate(`(() => {
    localStorage.removeItem('ndr.appearance.activeSet.v2');
    localStorage.removeItem('ndr.appearance.activeSnapshot.v2');
  })()`);
  console.log('Dice Studio creation flow passed: navigation, New Set, custom d20 face, Save, Use, return-to-roller persistence, and a physical custom-themed d20 roll are wired.');
}

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

    await assertAccountDataControls(client);
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
  if (path === '/moderation.html') {
    await waitFor(client, "document.querySelector('#moderation-status') && document.querySelector('#moderation-reports')");
  }
  assert.equal(await client.evaluate('location.href'), `${origin}${path}`);
}

async function run() {
  await access(resolve(dist, 'index.html'));
  let server;
  let browser;
  const completed = [];
  const performanceRecords = [];
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    await assertStudioCreationFlow(browser.client, server.origin);
    for (const viewport of viewports) {
      for (const path of pages) {
        const url = `${server.origin}${path}`;
        await navigate(browser.client, url, viewport);
        await assertRuntimeSurfaces(browser.client, server.origin, path, viewport);
        assertPageAudit(await browser.client.evaluate(PAGE_AUDIT_EXPRESSION), `${viewport.name} ${path}`);
        const metrics = await browser.client.evaluate(PERFORMANCE_EXPRESSION);
        if (path === '/customize.html') {
          const studioEntry = '/js/appearance/studio.js';
          assert.equal(metrics.scriptPaths.filter((item) => item === studioEntry).length, 1, 'Dice Studio production bundle must load exactly once.');
          assert.deepEqual([...new Set(metrics.appearanceScripts)], [studioEntry], 'Dice Studio must load one bundled appearance entry and no source module graph.');
        }
        performanceRecords.push(formatPerformance(`${viewport.name}:${path}`, metrics));
        completed.push(`${viewport.name}:${path}`);
      }
    }
    console.log(`Browser smoke passed in ${browser.command}: ${completed.join(', ')}`);
    console.log(`Browser performance baseline:\n${performanceRecords.map((item) => `- ${item}`).join('\n')}`);
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Browser smoke failed:', error);
  process.exitCode = 1;
});
