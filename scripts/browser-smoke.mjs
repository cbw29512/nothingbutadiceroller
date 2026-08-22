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

async function physicalRollDiagnostic(client) {
  return client.evaluate(`(() => {
    const canvas = document.querySelector('#dice-tray canvas');
    let webgl = false;
    try {
      webgl = Boolean(canvas?.getContext('webgl2') || canvas?.getContext('webgl'));
    } catch {}
    return {
      status: document.querySelector('#physics-status')?.textContent || '',
      statusClass: document.querySelector('#physics-status')?.className || '',
      rollDisabled: Boolean(document.querySelector('#roll-btn')?.disabled),
      total: document.querySelector('#total-result')?.textContent || '',
      breakdown: document.querySelector('#breakdown-text')?.textContent || '',
      pool: document.querySelector('#pool-summary')?.textContent || '',
      canvasCount: document.querySelectorAll('#dice-tray canvas').length,
      webgl,
    };
  })()`);
}

async function assertDesktopRollInteraction(client) {
  await waitFor(
    client,
    "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')",
    30000,
  );
  await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
  await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
  await client.evaluate("document.querySelector('#roll-btn')?.click()");

  try {
    await waitFor(
      client,
      "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled",
      30000,
    );
  } catch (error) {
    const diagnostic = await physicalRollDiagnostic(client);
    throw new Error(`Physical d20 browser roll did not settle: ${JSON.stringify(diagnostic)}. ${error.message}`);
  }

  const result = await client.evaluate(`(() => ({
    total: Number(document.querySelector('#total-result')?.textContent),
    breakdown: document.querySelector('#breakdown-text')?.textContent || '',
    historyFormula: document.querySelector('.history-item .history-formula')?.textContent || '',
  }))()`);
  assert.ok(result.total >= 1 && result.total <= 20, `Physical d20 result must be 1-20; received ${result.total}.`);
  assert.match(result.breakdown, /d20/i, 'Physical d20 breakdown must identify the rolled d20.');
  assert.match(result.historyFormula, /1d20/i, 'Physical d20 roll must be saved to history.');
}

async function assertMobileCustomInteraction(client) {
  await client.evaluate("document.querySelector('#mobile-custom-die-btn')?.click()");
  await waitFor(client, "document.querySelector('#mobile-custom-die-btn')?.getAttribute('aria-expanded') === 'true'");
  await client.evaluate(`(() => {
    const input = document.querySelector('#custom-die-sides');
    input.value = 'd37';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#custom-die-roll-btn')?.click();
  })()`);
  await waitFor(
    client,
    "document.querySelector('#breakdown-text')?.textContent.includes('Custom d37')",
    10000,
  );

  const result = await client.evaluate(`(() => ({
    total: Number(document.querySelector('#total-result')?.textContent),
    breakdown: document.querySelector('#breakdown-text')?.textContent || '',
    display: document.querySelector('.custom-roll-display')?.getAttribute('aria-label') || '',
  }))()`);
  assert.ok(result.total >= 1 && result.total <= 37, `Custom d37 result must be 1-37; received ${result.total}.`);
  assert.match(result.breakdown, /Web Crypto CSPRNG/i, 'Custom d37 must identify its secure random source.');
  assert.match(result.display, /Custom d37 result/i, 'Custom result graphic must have an accessible result label.');
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
    assert.equal(snapshot.studio, 'Dice Studio', 'Post-boot main UI must keep the Dice Studio name.');
    assert.match(snapshot.accountCopy, /save dice configurations to your account/i);
    assert.doesNotMatch(snapshot.accountCopy, /permanent/i);
    assert.equal(snapshot.desktopDice, 7, 'Desktop must expose all seven standard RPG dice.');
    assert.equal(snapshot.mobileDice, 7, 'Mobile must expose all seven standard RPG dice.');
    assert.equal(snapshot.customButtons, true, 'Custom dN entry must remain available.');

    if (viewport.mobile) {
      const sizes = await client.evaluate(`(() => ({
        roll: document.querySelector('#mobile-roll-btn')?.getBoundingClientRect().height || 0,
        die: document.querySelector('.mobile-die-btn[data-type="d20"]')?.getBoundingClientRect().height || 0,
        mode: document.querySelector('.mobile-mode-btn[data-quick-roll="advantage"]')?.getBoundingClientRect().height || 0,
      }))()`);
      assert.ok(sizes.roll >= 44, `Primary mobile Roll button must remain at least 44px tall; received ${sizes.roll}.`);
      assert.ok(sizes.die >= 44, `Primary mobile dice controls must remain at least 44px tall; received ${sizes.die}.`);
      assert.ok(sizes.mode >= 44, `Mobile ADV/DIS controls must remain at least 44px tall; received ${sizes.mode}.`);
      await assertMobileCustomInteraction(client);
    } else {
      await assertDesktopRollInteraction(client);
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
