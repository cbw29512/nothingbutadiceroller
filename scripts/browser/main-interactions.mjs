import assert from 'node:assert/strict';
import { waitFor } from './chromium.mjs';

async function physicalRollDiagnostic(client) {
  return client.evaluate(`(() => ({
    status: document.querySelector('#physics-status')?.textContent || '',
    rollDisabled: Boolean(document.querySelector('#roll-btn')?.disabled),
    total: document.querySelector('#total-result')?.textContent || '',
    breakdown: document.querySelector('#breakdown-text')?.textContent || '',
    pool: document.querySelector('#pool-summary')?.textContent || '',
    canvasCount: document.querySelectorAll('#dice-tray canvas').length,
  }))()`);
}

async function assertSelfHostedDiceBoxResources(client) {
  const resources = await client.evaluate(`performance.getEntriesByType('resource').map((entry) => entry.name)`);
  assert.ok(resources.some((url) => url.includes('/vendor/dice-box-1.1.4/')),
    `Physical DiceBox path did not load the pinned same-origin vendor files. Resources: ${JSON.stringify(resources.slice(-20))}`);
  const remoteDiceBox = resources.filter((url) => /cdn\.jsdelivr\.net|unpkg\.com/i.test(url));
  assert.deepEqual(remoteDiceBox, [], `Physical DiceBox path fetched forbidden CDN resources: ${remoteDiceBox.join(', ')}`);
}

export async function assertDesktopRollInteraction(client) {
  await waitFor(client, "document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
  await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
  await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
  await client.evaluate("document.querySelector('#roll-btn')?.click()");
  try {
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
  } catch (error) {
    throw new Error(`Physical d20 browser roll did not settle: ${JSON.stringify(await physicalRollDiagnostic(client))}. ${error.message}`);
  }

  const result = await client.evaluate(`(() => ({
    total: Number(document.querySelector('#total-result')?.textContent),
    breakdown: document.querySelector('#breakdown-text')?.textContent || '',
    historyFormula: document.querySelector('.history-item .history-formula')?.textContent || '',
  }))()`);
  assert.ok(result.total >= 1 && result.total <= 20, `Physical d20 result must be 1-20; received ${result.total}.`);
  assert.match(result.breakdown, /d20/i);
  assert.match(result.historyFormula, /1d20/i);
  await assertSelfHostedDiceBoxResources(client);
}

export async function assertMobileCustomInteraction(client) {
  await client.evaluate("document.querySelector('#mobile-custom-die-btn')?.click()");
  await waitFor(client, "document.querySelector('#mobile-custom-die-btn')?.getAttribute('aria-expanded') === 'true'");
  await client.evaluate(`(() => {
    const input = document.querySelector('#custom-die-sides');
    input.value = 'd37';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#custom-die-roll-btn')?.click();
  })()`);
  await waitFor(client, "document.querySelector('#breakdown-text')?.textContent.includes('Custom d37')", 10000);
  const result = await client.evaluate(`(() => ({
    total: Number(document.querySelector('#total-result')?.textContent),
    breakdown: document.querySelector('#breakdown-text')?.textContent || '',
    display: document.querySelector('.custom-roll-display')?.getAttribute('aria-label') || '',
  }))()`);
  assert.ok(result.total >= 1 && result.total <= 37, `Custom d37 result must be 1-37; received ${result.total}.`);
  assert.match(result.breakdown, /Web Crypto CSPRNG/i);
  assert.match(result.display, /Custom d37 result/i);
}

export async function assertDrawerAccessibility(client) {
  await client.evaluate("document.querySelector('#open-history-btn')?.click()");
  await waitFor(client, "document.querySelector('#history-drawer')?.getAttribute('aria-hidden') === 'false'");
  await waitFor(client, "document.activeElement?.id === 'close-history-btn'");

  const openState = await client.evaluate(`(() => ({
    mainInert: document.querySelector('main')?.inert === true,
    headerInert: document.querySelector('.app-header')?.inert === true,
    drawerInert: document.querySelector('#history-drawer')?.inert === true,
  }))()`);
  assert.equal(openState.mainInert, true, 'Main roller must be inert while a modal drawer is open.');
  assert.equal(openState.headerInert, true, 'Header must be inert while a modal drawer is open.');
  assert.equal(openState.drawerInert, false, 'Active drawer itself must remain interactive.');

  const trapped = await client.evaluate(`(() => {
    document.querySelector('#clear-history-btn').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    return document.activeElement?.id;
  })()`);
  assert.equal(trapped, 'close-history-btn', 'Tab from the last drawer control must wrap to the first control.');

  await client.evaluate("document.querySelector('#close-history-btn')?.click()");
  await waitFor(client, "document.querySelector('#history-drawer')?.getAttribute('aria-hidden') === 'true'");
  await waitFor(client, "document.activeElement?.id === 'open-history-btn'");
  assert.equal(await client.evaluate("document.querySelector('main')?.inert === false"), true);
}

export async function assertAccountDataControls(client) {
  await waitFor(client, "document.querySelector('#export-cloud-data-btn') && document.querySelector('#delete-cloud-data-btn') && document.querySelector('#delete-cloud-data-dialog')");
  await client.evaluate(`(() => {
    document.querySelector('#account-signed-in')?.classList.remove('hidden');
    document.querySelector('#delete-cloud-data-btn')?.click();
  })()`);
  await waitFor(client, "document.querySelector('#delete-cloud-data-dialog')?.open === true && document.activeElement?.id === 'delete-cloud-data-confirmation'");

  await client.evaluate(`(() => {
    const input = document.querySelector('#delete-cloud-data-confirmation');
    input.value = 'DELETE';
    document.querySelector('#delete-cloud-data-form')?.requestSubmit();
  })()`);
  await waitFor(client, "document.querySelector('#delete-cloud-data-status')?.textContent.includes('DELETE MY CLOUD DATA exactly')");
  assert.equal(await client.evaluate("document.querySelector('#delete-cloud-data-dialog')?.open === true"), true, 'Invalid confirmation must not close the destructive dialog.');

  await client.evaluate(`(() => {
    document.querySelector('#cancel-delete-cloud-data')?.click();
    document.querySelector('#account-signed-in')?.classList.add('hidden');
  })()`);
  await waitFor(client, "document.querySelector('#delete-cloud-data-dialog')?.open === false");
}

export async function assertReducedMotion(client) {
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  const animation = await client.evaluate(`(() => {
    const banner = document.createElement('div');
    banner.className = 'crit-banner nat20';
    document.body.appendChild(banner);
    const value = getComputedStyle(banner).animationName;
    banner.remove();
    return value;
  })()`);
  assert.equal(animation, 'none', 'Critical feedback animation must stop when reduced motion is requested.');
  await client.send('Emulation.setEmulatedMedia', { features: [] });
}
