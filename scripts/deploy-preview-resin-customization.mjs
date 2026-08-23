import assert from 'node:assert/strict';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';

const origin = String(process.env.DEPLOY_PREVIEW_ORIGIN || '').trim().replace(/\/$/, '');
if (!/^https:\/\/deploy-preview-\d+--nothingbutattrpgdiceroller\.netlify\.app$/.test(origin)) {
  throw new Error('DEPLOY_PREVIEW_ORIGIN must be the Nothing But A Dice Roller Netlify PR preview origin.');
}
const desktop = { width: 1440, height: 900, mobile: false };
function previewPage(pathname = '/') {
  const url = new URL(pathname, `${origin}/`);
  url.searchParams.set('ntl-drawer-state', 'hidden');
  return url.href;
}
async function setControl(client, selector, value, eventName = 'input') {
  await client.evaluate(`(() => {
    const control = document.querySelector(${JSON.stringify(selector)});
    if (!control) throw new Error('Missing control: ${selector}');
    if (control.type === 'checkbox') control.checked = ${Boolean(value)};
    else control.value = ${JSON.stringify(String(value))};
    control.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
  })()`);
}

async function run() {
  let browser;
  try {
    browser = await launchBrowser();
    const client = browser.client;
    await navigate(client, previewPage('/customize.html'), desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
    await client.evaluate('localStorage.clear()');
    await navigate(client, previewPage('/customize.html'), desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);

    await client.evaluate("document.querySelector('#new-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
    await setControl(client, '#resin-scope', 'set', 'change');
    await setControl(client, '#clear-die-enabled', true, 'change');
    await setControl(client, '#clear-die-opacity', 0.55);
    await setControl(client, '#interior-effect', 'nebula', 'change');
    await setControl(client, '#interior-primary-color', '#7c3aed');
    await setControl(client, '#interior-secondary-color', '#22d3ee');
    await setControl(client, '#interior-density', 0.75);
    await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"]')?.dataset.clearResin === 'true' && document.querySelector('.studio-preview-die[data-die=\"d20\"]')?.dataset.interiorEffect === 'nebula'");

    const preview = await client.evaluate(`(() => ({
      background: document.querySelector('.studio-preview-die[data-die="d20"]')?.style.background || '',
      opacity: document.querySelector('#clear-opacity-output')?.textContent || '',
      density: document.querySelector('#interior-density-output')?.textContent || '',
      scope: document.querySelector('#resin-scope')?.value || '',
    }))()`);
    assert.match(preview.background, /gradient/i);
    assert.equal(preview.opacity, '55%');
    assert.equal(preview.density, '75%');
    assert.equal(preview.scope, 'set');

    await client.evaluate(`(() => {
      const name = document.querySelector('#set-name');
      name.value = 'Live Nebula Resin';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      name.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await client.evaluate("document.querySelector('#save-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
    await client.evaluate("document.querySelector('#use-set')?.click()");
    await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);

    const handoff = await client.evaluate(`(() => ({
      activeClass: document.body.classList.contains('appearance-v2-active'),
      activeId: localStorage.getItem('ndr.appearance.activeSet.v2') || '',
      snapshot: localStorage.getItem('ndr.appearance.activeSnapshot.v2') || '',
    }))()`);
    assert.equal(handoff.activeClass, true, 'Live roller must activate the clear resin set.');
    assert.notEqual(handoff.activeId, 'system_default', 'Live roller must retain the customized set as active.');
    assert.match(handoff.snapshot, /nebula/);
    assert.match(handoff.snapshot.toLowerCase(), /#7c3aed/);
    assert.match(handoff.snapshot.toLowerCase(), /#22d3ee/);

    await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
    const roll = await client.evaluate(`(() => ({
      total: Number(document.querySelector('#total-result')?.textContent),
      diffuse: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
    }))()`);
    assert.ok(roll.total >= 1 && roll.total <= 20, `Live clear resin d20 must remain 1-20; received ${roll.total}.`);
    assert.ok(roll.diffuse.length >= 1, 'Live clear resin d20 must request a generated diffuse texture.');
    let resinTextureFound = false;
    for (const url of roll.diffuse) {
      const response = await fetch(url);
      if (!response.ok) continue;
      const text = await response.text();
      if (text.includes('resinSheen') && text.includes('interiorBlur') && text.toLowerCase().includes('#7c3aed') && text.toLowerCase().includes('#22d3ee')) resinTextureFound = true;
    }
    assert.equal(resinTextureFound, true, 'Live physical d20 texture must contain the selected nebula resin artwork.');
    console.log('Live resin customization passed: clear nebula preview, Save/Use handoff, generated Netlify resin texture, and physical d20 mechanics all persist.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Live resin customization failed:', error);
  process.exitCode = 1;
});
