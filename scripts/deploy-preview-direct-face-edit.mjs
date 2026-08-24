import assert from 'node:assert/strict';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';

const origin = String(process.env.DEPLOY_PREVIEW_ORIGIN || '').trim().replace(/\/$/, '');
if (!/^https:\/\/deploy-preview-\d+--nothingbutattrpgdiceroller\.netlify\.app$/.test(origin)) {
  throw new Error('DEPLOY_PREVIEW_ORIGIN must be the Nothing But A Dice Roller Netlify PR preview origin.');
}
const desktop = { width: 1440, height: 900, mobile: false };
const mobile = { width: 390, height: 844, mobile: true };
const CUSTOM_TRAY_COLOR = '#005577';
function previewPage(pathname = '/') {
  const url = new URL(pathname, `${origin}/`); url.searchParams.set('ntl-drawer-state', 'hidden'); return url.href;
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

    const defaultState = await client.evaluate(`(() => ({
      name: document.querySelector('#set-name')?.value || '', applyDisabled: Boolean(document.querySelector('#apply-face')?.disabled),
      batchDisabled: Boolean(document.querySelector('#apply-face-style-all')?.disabled), batchLabel: document.querySelector('#apply-face-style-all')?.textContent || '',
      font: document.querySelector('#face-font')?.value || '', fontDisabled: Boolean(document.querySelector('#face-font')?.disabled),
      scale: document.querySelector('#face-scale')?.value || '', scaleDisabled: Boolean(document.querySelector('#face-scale')?.disabled),
      position: document.querySelector('#face-position')?.value || '', positionDisabled: Boolean(document.querySelector('#face-position')?.disabled),
      options: [...document.querySelectorAll('#face-font option')].map((option) => option.value),
    }))()`);
    assert.equal(defaultState.name, 'Default Dice'); assert.equal(defaultState.applyDisabled, true);
    assert.equal(defaultState.batchDisabled, true); assert.equal(defaultState.batchLabel, 'Style All D20 Faces');
    assert.equal(defaultState.font, 'default'); assert.equal(defaultState.fontDisabled, true);
    assert.equal(defaultState.scale, '100'); assert.equal(defaultState.scaleDisabled, true);
    assert.equal(defaultState.position, 'center'); assert.equal(defaultState.positionDisabled, true);
    assert.deepEqual(defaultState.options, ['default', 'fantasy', 'mono']);

    await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')");
    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Editable copy created.')");
    const selected = await client.evaluate(`(() => ({
      setName: document.querySelector('#set-name')?.value || '', logicalFace: document.querySelector('#logical-face')?.value || '',
      value: document.querySelector('#face-value')?.value || '', font: document.querySelector('#face-font')?.value || '', scale: document.querySelector('#face-scale')?.value || '',
      position: document.querySelector('#face-position')?.value || '', batchDisabled: Boolean(document.querySelector('#apply-face-style-all')?.disabled),
      batchLabel: document.querySelector('#apply-face-style-all')?.textContent || '',
      editable: !document.querySelector('#set-name')?.disabled && !document.querySelector('#face-value')?.disabled && !document.querySelector('#custom-face-color')?.disabled && !document.querySelector('#face-font')?.disabled && !document.querySelector('#face-scale')?.disabled && !document.querySelector('#face-position')?.disabled && !document.querySelector('#apply-face')?.disabled,
      focused: document.activeElement === document.querySelector('#face-value'), result: document.querySelector('#logical-result-label')?.textContent || '',
      defaultStillPresent: [...document.querySelectorAll('#studio-library .studio-set-card')].some((card) => /Default Dice/.test(card.textContent) && /Immutable Default/.test(card.textContent)),
    }))()`);
    assert.equal(selected.setName, 'New Dice Set'); assert.equal(selected.logicalFace, '20'); assert.equal(selected.value, '20');
    assert.equal(selected.font, 'default'); assert.equal(selected.scale, '100'); assert.equal(selected.position, 'center'); assert.equal(selected.editable, true); assert.equal(selected.focused, true);
    assert.equal(selected.batchDisabled, false); assert.equal(selected.batchLabel, 'Style All D20 Faces');
    assert.match(selected.result, /Always reports 20/); assert.equal(selected.defaultStillPresent, true);

    await client.evaluate(`(() => {
      const value = document.querySelector('#face-value'); value.value = 'CRIT'; value.dispatchEvent(new Event('input', { bubbles: true }));
      const color = document.querySelector('#custom-face-color'); color.value = '#ff00ff'; color.dispatchEvent(new Event('input', { bubbles: true }));
      const font = document.querySelector('#face-font'); font.value = 'fantasy'; font.dispatchEvent(new Event('change', { bubbles: true }));
      const scale = document.querySelector('#face-scale'); scale.value = '120'; scale.dispatchEvent(new Event('input', { bubbles: true }));
      const position = document.querySelector('#face-position'); position.value = 'top-right'; position.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#apply-face')?.click();
      const tray = document.querySelector('#tray-color'); tray.value = '${CUSTOM_TRAY_COLOR}'; tray.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('.studio-preview-die[data-die=\"d20\"] span')?.textContent === 'CRIT'");
    const preview = await client.evaluate(`(() => ({
      mode: document.querySelector('#face-mode')?.value || '', font: document.querySelector('#face-font')?.value || '', scale: document.querySelector('#face-scale')?.value || '',
      scaleOutput: document.querySelector('#face-scale-output')?.textContent || '', position: document.querySelector('#face-position')?.value || '',
      previewFont: document.querySelector('.studio-preview-die[data-die="d20"] span')?.style.fontFamily || '', previewSize: document.querySelector('.studio-preview-die[data-die="d20"] span')?.style.fontSize || '',
      previewTransform: document.querySelector('.studio-preview-die[data-die="d20"] span')?.style.transform || '', mapFont: document.querySelector('#face-map .face-node.active')?.style.fontFamily || '',
      mapSize: document.querySelector('#face-map .face-node.active')?.style.fontSize || '', mapTransform: document.querySelector('#face-map .face-node.active [data-face-glyph]')?.style.transform || '',
      useLabel: document.querySelector('#use-set')?.textContent || '',
    }))()`);
    assert.equal(preview.mode, 'custom'); assert.equal(preview.font, 'fantasy'); assert.equal(preview.scale, '120'); assert.equal(preview.scaleOutput, '120%'); assert.equal(preview.position, 'top-right');
    assert.match(preview.previewFont, /Georgia|serif/i); assert.match(preview.mapFont, /Georgia|serif/i); assert.equal(preview.previewSize, '1.2em');
    assert.equal(preview.previewTransform, 'translate(0.24em, -0.24em)'); assert.equal(preview.mapTransform, 'translate(0.24em, -0.24em)');
    assert.ok(parseFloat(preview.mapSize) > 0.72); assert.match(preview.useLabel, /Use.*Back to Roller/i);

    await client.evaluate(`(() => { window.confirm = () => false; document.querySelector('#apply-face-style-all')?.click(); })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Style All cancelled.')", 15000);
    const cancelled = await client.evaluate(`(() => {
      const one = document.querySelector('#face-map .face-node[data-face="1"]');
      return { text: one?.textContent || '', font: one?.style.fontFamily || '', transform: one?.querySelector('[data-face-glyph]')?.style.transform || '' };
    })()`);
    assert.equal(cancelled.text, '1'); assert.match(cancelled.font, /Arial|sans-serif/i); assert.equal(cancelled.transform, 'translate(0em, 0em)');

    await client.evaluate(`(() => { window.confirm = () => true; document.querySelector('#apply-face-style-all')?.click(); })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Applied this visual style to all 20 D20 faces.')", 15000);
    const batch = await client.evaluate(`(() => {
      const one = document.querySelector('#face-map .face-node[data-face="1"]');
      const twenty = document.querySelector('#face-map .face-node[data-face="20"]');
      const read = (node) => ({ text: node?.textContent || '', font: node?.style.fontFamily || '', size: node?.style.fontSize || '', transform: node?.querySelector('[data-face-glyph]')?.style.transform || '', color: node?.style.color || '' });
      return { count: document.querySelectorAll('#face-map .face-node').length, one: read(one), twenty: read(twenty) };
    })()`);
    assert.equal(batch.count, 20); assert.equal(batch.one.text, '1'); assert.equal(batch.twenty.text, 'CRIT');
    for (const face of [batch.one, batch.twenty]) {
      assert.match(face.font, /Georgia|serif/i); assert.ok(parseFloat(face.size) > 0.72); assert.equal(face.transform, 'translate(0.24em, -0.24em)'); assert.equal(face.color.replace(/\s+/g, ''), 'rgb(255,0,255)');
    }

    await client.evaluate("document.querySelector('#save-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
    await client.evaluate("document.querySelector('#use-set')?.click()");
    await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
    const handoff = await client.evaluate(`(() => {
      const text = localStorage.getItem('ndr.appearance.activeSnapshot.v2') || ''; let snapshot = null; try { snapshot = JSON.parse(text); } catch {}
      return {
        activeClass: document.body.classList.contains('appearance-v2-active'), trayVar: document.body.style.getPropertyValue('--appearance-v2-tray-bg'),
        activeId: localStorage.getItem('ndr.appearance.activeSet.v2') || '',
        face1: snapshot?.appearance?.diceSet?.dice?.d20?.faces?.['1'] || null,
        face20: snapshot?.appearance?.diceSet?.dice?.d20?.faces?.['20'] || null,
      };
    })()`);
    assert.equal(handoff.activeClass, true); assert.match(handoff.trayVar.toLowerCase(), /#005577/); assert.notEqual(handoff.activeId, 'system_default');
    assert.equal(handoff.face1?.value, '1'); assert.equal(handoff.face20?.value, 'CRIT');
    for (const face of [handoff.face1, handoff.face20]) {
      assert.equal(face?.fontId, 'fantasy'); assert.equal(face?.scale, 1.2); assert.equal(face?.position, 'top-right'); assert.equal(face?.color, '#ff00ff');
    }

    await client.evaluate("document.querySelector('.die-btn[data-type=\"d20\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d20')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);
    const roll = await client.evaluate(`(() => ({
      total: Number(document.querySelector('#total-result')?.textContent),
      diffuse: performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
    }))()`);
    assert.ok(roll.total >= 1 && roll.total <= 20, `Live batch-styled d20 must remain 1-20; received ${roll.total}.`);
    assert.ok(roll.diffuse.length >= 1);
    let customizedTexture = false;
    for (const url of roll.diffuse) {
      const response = await fetch(url); if (!response.ok) continue;
      const text = await response.text();
      if (/<text[^>]*x="[0-9.]+"[^>]*y="[0-9.]+"[^>]*font-family="Georgia, serif"[^>]*font-size="[0-9.]+"[^>]*>CRIT<\/text>/.test(text)) customizedTexture = true;
    }
    assert.equal(customizedTexture, true, 'Live generated d20 texture must contain batch-styled positioned Fantasy CRIT artwork.');

    await navigate(client, previewPage('/customize.html'), mobile);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);
    const mobileState = await client.evaluate(`(() => ({
      fontHeight: document.querySelector('#face-font')?.getBoundingClientRect().height || 0,
      scaleHeight: document.querySelector('#face-scale')?.getBoundingClientRect().height || 0,
      positionHeight: document.querySelector('#face-position')?.getBoundingClientRect().height || 0,
      batchHeight: document.querySelector('#apply-face-style-all')?.getBoundingClientRect().height || 0,
      batchLabel: document.querySelector('#apply-face-style-all')?.textContent || '',
      scale: document.querySelector('#face-scale')?.value || '', scaleOutput: document.querySelector('#face-scale-output')?.textContent || '',
      position: document.querySelector('#face-position')?.value || '', overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    }))()`);
    assert.ok(mobileState.fontHeight >= 40, 'Live mobile typography selector must remain comfortably tappable.');
    assert.ok(mobileState.scaleHeight >= 40, 'Live mobile face-size slider must expose a comfortable touch target.');
    assert.ok(mobileState.positionHeight >= 40, 'Live mobile face-position selector must remain comfortably tappable.');
    assert.ok(mobileState.batchHeight >= 40, 'Live mobile Style All Faces control must remain comfortably tappable.');
    assert.equal(mobileState.batchLabel, 'Style All D20 Faces');
    assert.equal(mobileState.scale, '120'); assert.equal(mobileState.scaleOutput, '120%'); assert.equal(mobileState.position, 'top-right');
    assert.equal(mobileState.overflow, false, 'Live typography/scale/position/batch controls must not create horizontal overflow.');

    console.log('Live Studio face-art handoff passed: immutable Default auto-copy, Fantasy CRIT at 120% Top Right, safe Style All cancellation/approval, label-preserving batch styling, Save/Use persistence, generated texture, mobile usability, and canonical d20 mechanics all persist.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
  }
}

run().catch((error) => { console.error('Live direct face edit failed:', error); process.exitCode = 1; });
