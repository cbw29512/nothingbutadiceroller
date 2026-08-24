import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const desktop = { width: 1440, height: 900, mobile: false };
const mobile = { width: 390, height: 844, mobile: true };
const CUSTOM_TRAY_COLOR = '#005577';

async function run() {
  await access(resolve(dist, 'customize.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    const client = browser.client;
    await navigate(client, `${server.origin}/customize.html`, desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
    await client.evaluate('localStorage.clear()');
    await navigate(client, `${server.origin}/customize.html`, desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");

    const defaultState = await client.evaluate(`(() => ({
      name: document.querySelector('#set-name')?.value || '',
      applyDisabled: Boolean(document.querySelector('#apply-face')?.disabled),
      batchDisabled: Boolean(document.querySelector('#apply-face-style-all')?.disabled),
      batchLabel: document.querySelector('#apply-face-style-all')?.textContent || '',
      font: document.querySelector('#face-font')?.value || '',
      fontDisabled: Boolean(document.querySelector('#face-font')?.disabled),
      scale: document.querySelector('#face-scale')?.value || '',
      scaleDisabled: Boolean(document.querySelector('#face-scale')?.disabled),
      scaleOutput: document.querySelector('#face-scale-output')?.textContent || '',
      position: document.querySelector('#face-position')?.value || '',
      positionDisabled: Boolean(document.querySelector('#face-position')?.disabled),
      positionOptions: [...document.querySelectorAll('#face-position option')].map((option) => option.value),
      fontOptions: [...document.querySelectorAll('#face-font option')].map((option) => [option.value, option.textContent]),
      defaultCard: document.querySelector('#studio-library .studio-set-card')?.textContent || '',
    }))()`);
    assert.equal(defaultState.name, 'Default Dice', 'The regression must begin from immutable Default Dice.');
    assert.equal(defaultState.applyDisabled, true, 'Default Dice face editing must remain immutable until user intent creates a copy.');
    assert.equal(defaultState.batchDisabled, true, 'Default Dice batch face styling must remain immutable until an editable copy exists.');
    assert.equal(defaultState.batchLabel, 'Style All D20 Faces');
    assert.equal(defaultState.font, 'default'); assert.equal(defaultState.fontDisabled, true);
    assert.equal(defaultState.scale, '100'); assert.equal(defaultState.scaleDisabled, true); assert.equal(defaultState.scaleOutput, '100%');
    assert.equal(defaultState.position, 'center'); assert.equal(defaultState.positionDisabled, true);
    assert.deepEqual(defaultState.positionOptions, ['center', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left']);
    assert.deepEqual(defaultState.fontOptions.map(([value]) => value), ['default', 'fantasy', 'mono']);
    assert.match(defaultState.defaultCard, /Immutable Default/);

    const visibleFace = await client.evaluate(`(() => {
      const face = document.querySelector('.studio-preview-die[data-die="d20"] span[data-preview-face="20"]');
      return { exists: Boolean(face), text: face?.textContent || '', title: face?.title || '', font: face?.style.fontFamily || '', size: face?.style.fontSize || '', transform: face?.style.transform || '' };
    })()`);
    assert.equal(visibleFace.exists, true); assert.equal(visibleFace.text, '20'); assert.match(visibleFace.title, /Edit face 20/i);
    assert.match(visibleFace.font, /Arial|sans-serif/i); assert.equal(visibleFace.size, '1em'); assert.equal(visibleFace.transform, 'translate(0em, 0em)');

    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d20\"] span[data-preview-face=\"20\"]')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Editable copy created.')");
    const selected = await client.evaluate(`(() => ({
      die: document.querySelector('#selected-die-label')?.textContent || '', setName: document.querySelector('#set-name')?.value || '',
      setNameDisabled: Boolean(document.querySelector('#set-name')?.disabled), logicalFace: document.querySelector('#logical-face')?.value || '',
      faceLabel: document.querySelector('#logical-face-label')?.textContent || '', resultLabel: document.querySelector('#logical-result-label')?.textContent || '',
      value: document.querySelector('#face-value')?.value || '', valueDisabled: Boolean(document.querySelector('#face-value')?.disabled),
      colorDisabled: Boolean(document.querySelector('#custom-face-color')?.disabled), font: document.querySelector('#face-font')?.value || '',
      fontDisabled: Boolean(document.querySelector('#face-font')?.disabled), scale: document.querySelector('#face-scale')?.value || '',
      scaleDisabled: Boolean(document.querySelector('#face-scale')?.disabled), position: document.querySelector('#face-position')?.value || '',
      positionDisabled: Boolean(document.querySelector('#face-position')?.disabled), applyDisabled: Boolean(document.querySelector('#apply-face')?.disabled),
      batchDisabled: Boolean(document.querySelector('#apply-face-style-all')?.disabled), batchLabel: document.querySelector('#apply-face-style-all')?.textContent || '',
      focused: document.activeElement === document.querySelector('#face-value'),
      defaultStillPresent: [...document.querySelectorAll('#studio-library .studio-set-card')].some((card) => /Default Dice/.test(card.textContent) && /Immutable Default/.test(card.textContent)),
    }))()`);
    assert.equal(selected.die, 'D20'); assert.equal(selected.setName, 'New Dice Set'); assert.equal(selected.setNameDisabled, false);
    assert.equal(selected.logicalFace, '20'); assert.match(selected.faceLabel, /Face 20/); assert.match(selected.resultLabel, /Always reports 20/);
    assert.equal(selected.value, '20'); assert.equal(selected.valueDisabled, false); assert.equal(selected.colorDisabled, false);
    assert.equal(selected.font, 'default'); assert.equal(selected.fontDisabled, false); assert.equal(selected.scale, '100'); assert.equal(selected.scaleDisabled, false);
    assert.equal(selected.position, 'center'); assert.equal(selected.positionDisabled, false);
    assert.equal(selected.applyDisabled, false); assert.equal(selected.batchDisabled, false); assert.equal(selected.batchLabel, 'Style All D20 Faces');
    assert.equal(selected.focused, true); assert.equal(selected.defaultStillPresent, true);

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
    const edited = await client.evaluate(`(() => ({
      mode: document.querySelector('#face-mode')?.value || '', preview: document.querySelector('.studio-preview-die[data-die="d20"] span')?.textContent || '',
      previewFont: document.querySelector('.studio-preview-die[data-die="d20"] span')?.style.fontFamily || '',
      previewSize: document.querySelector('.studio-preview-die[data-die="d20"] span')?.style.fontSize || '',
      previewTransform: document.querySelector('.studio-preview-die[data-die="d20"] span')?.style.transform || '',
      map: document.querySelector('#face-map .face-node.active')?.textContent || '', mapFont: document.querySelector('#face-map .face-node.active')?.style.fontFamily || '',
      mapSize: document.querySelector('#face-map .face-node.active')?.style.fontSize || '', mapTransform: document.querySelector('#face-map .face-node.active [data-face-glyph]')?.style.transform || '',
      result: document.querySelector('#logical-result-label')?.textContent || '', color: document.querySelector('#custom-face-color')?.value || '',
      font: document.querySelector('#face-font')?.value || '', scale: document.querySelector('#face-scale')?.value || '',
      scaleOutput: document.querySelector('#face-scale-output')?.textContent || '', position: document.querySelector('#face-position')?.value || '',
      trayColor: document.querySelector('#tray-color')?.value || '', useLabel: document.querySelector('#use-set')?.textContent || '',
    }))()`);
    assert.equal(edited.mode, 'custom'); assert.equal(edited.preview, 'CRIT'); assert.equal(edited.map, 'CRIT');
    assert.match(edited.previewFont, /Georgia|serif/i); assert.match(edited.mapFont, /Georgia|serif/i);
    assert.equal(edited.previewSize, '1.2em'); assert.ok(parseFloat(edited.mapSize) > 0.72, `Scaled d20 face-map glyph must exceed its 100% 0.72rem baseline; received ${edited.mapSize}.`);
    assert.equal(edited.previewTransform, 'translate(0.24em, -0.24em)'); assert.equal(edited.mapTransform, 'translate(0.24em, -0.24em)');
    assert.match(edited.result, /Always reports 20/); assert.equal(edited.color.toLowerCase(), '#ff00ff'); assert.equal(edited.font, 'fantasy');
    assert.equal(edited.scale, '120'); assert.equal(edited.scaleOutput, '120%'); assert.equal(edited.position, 'top-right'); assert.equal(edited.trayColor.toLowerCase(), CUSTOM_TRAY_COLOR);
    assert.match(edited.useLabel, /Use This Set.*Back to Roller/i);

    await client.evaluate(`(() => { window.confirm = () => false; document.querySelector('#apply-face-style-all')?.click(); })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Style All cancelled.')");
    const cancelledBatch = await client.evaluate(`(() => {
      const one = document.querySelector('#face-map .face-node[data-face="1"]');
      return { text: one?.textContent || '', font: one?.style.fontFamily || '', size: one?.style.fontSize || '', transform: one?.querySelector('[data-face-glyph]')?.style.transform || '', color: one?.style.color || '' };
    })()`);
    assert.equal(cancelledBatch.text, '1'); assert.match(cancelledBatch.font, /Arial|sans-serif/i); assert.equal(cancelledBatch.transform, 'translate(0em, 0em)');
    assert.equal(parseFloat(cancelledBatch.size), 0.72, 'Cancelling Style All must leave untouched d20 faces at the 100% map size.');

    await client.evaluate(`(() => { window.confirm = () => true; document.querySelector('#apply-face-style-all')?.click(); })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Applied this visual style to all 20 D20 faces.')");
    const batch = await client.evaluate(`(() => {
      const sample = [...document.querySelectorAll('#face-map .face-node')].map((node) => ({
        face: node.dataset.face, text: node.textContent, font: node.style.fontFamily, size: node.style.fontSize,
        transform: node.querySelector('[data-face-glyph]')?.style.transform || '', color: node.style.color,
      }));
      return { count: sample.length, one: sample.find((item) => item.face === '1'), twenty: sample.find((item) => item.face === '20') };
    })()`);
    assert.equal(batch.count, 20, 'Style All must preserve all 20 physical d20 face entries.');
    assert.equal(batch.one.text, '1', 'Style All must preserve untouched canonical face labels.');
    assert.equal(batch.twenty.text, 'CRIT', 'Style All must preserve the selected custom face display.');
    for (const face of [batch.one, batch.twenty]) {
      assert.match(face.font, /Georgia|serif/i); assert.ok(parseFloat(face.size) > 0.72); assert.equal(face.transform, 'translate(0.24em, -0.24em)');
      assert.equal(face.color.replace(/\s+/g, ''), 'rgb(255,0,255)');
    }

    await client.evaluate("document.querySelector('#save-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
    await client.evaluate("document.querySelector('#use-set')?.click()");
    await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);
    const handoff = await client.evaluate(`(() => {
      const snapshotText = localStorage.getItem('ndr.appearance.activeSnapshot.v2') || '';
      let snapshot = null; try { snapshot = JSON.parse(snapshotText); } catch {}
      return {
        activeClass: document.body.classList.contains('appearance-v2-active'), trayVar: document.body.style.getPropertyValue('--appearance-v2-tray-bg'),
        activeId: localStorage.getItem('ndr.appearance.activeSet.v2') || '', snapshotText,
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
    assert.ok(roll.total >= 1 && roll.total <= 20, `Batch-styled d20 must remain mechanically 1-20; received ${roll.total}.`);
    assert.ok(roll.diffuse.length >= 1, 'Batch face styling must still use a generated physical texture.');
    let customizedTexture = false;
    for (const url of roll.diffuse) {
      const response = await fetch(url); if (!response.ok) continue;
      const text = await response.text();
      const crit = text.match(/<text[^>]*font-family="Georgia, serif"[^>]*font-size="([0-9.]+)"[^>]*x="([0-9.]+)"[^>]*y="([0-9.]+)"[^>]*>CRIT<\/text>/)
        || text.match(/<text[^>]*x="([0-9.]+)"[^>]*y="([0-9.]+)"[^>]*font-family="Georgia, serif"[^>]*font-size="([0-9.]+)"[^>]*>CRIT<\/text>/);
      if (crit) customizedTexture = true;
    }
    assert.equal(customizedTexture, true, 'Generated physical d20 texture must contain batch-styled positioned Fantasy CRIT artwork.');

    await navigate(client, `${server.origin}/customize.html`, mobile);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')");
    const mobileState = await client.evaluate(`(() => ({
      fontHeight: document.querySelector('#face-font')?.getBoundingClientRect().height || 0,
      scaleHeight: document.querySelector('#face-scale')?.getBoundingClientRect().height || 0,
      positionHeight: document.querySelector('#face-position')?.getBoundingClientRect().height || 0,
      batchHeight: document.querySelector('#apply-face-style-all')?.getBoundingClientRect().height || 0,
      batchLabel: document.querySelector('#apply-face-style-all')?.textContent || '',
      scale: document.querySelector('#face-scale')?.value || '', scaleOutput: document.querySelector('#face-scale-output')?.textContent || '',
      position: document.querySelector('#face-position')?.value || '', overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      options: [...document.querySelectorAll('#face-font option')].map((option) => option.value),
    }))()`);
    assert.ok(mobileState.fontHeight >= 40, 'Mobile face font selector must remain comfortably tappable.');
    assert.ok(mobileState.scaleHeight >= 40, 'Mobile face-size slider must expose a comfortable touch target.');
    assert.ok(mobileState.positionHeight >= 40, 'Mobile face-position selector must remain comfortably tappable.');
    assert.ok(mobileState.batchHeight >= 40, 'Mobile Style All Faces control must remain comfortably tappable.');
    assert.equal(mobileState.batchLabel, 'Style All D20 Faces');
    assert.equal(mobileState.scale, '120'); assert.equal(mobileState.scaleOutput, '120%'); assert.equal(mobileState.position, 'top-right');
    assert.equal(mobileState.overflow, false, 'Face typography/scale/position/batch controls must not introduce mobile horizontal overflow.');
    assert.deepEqual(mobileState.options, ['default', 'fantasy', 'mono']);

    console.log('Studio-to-roller face-art handoff passed: immutable Default, Fantasy CRIT at 120% Top Right, safe Style All cancellation/approval, label-preserving batch styling, custom tray, Save/Use, physical texture, mobile usability, and canonical d20 mechanics all persist.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => { console.error('Direct face editor failed:', error); process.exitCode = 1; });
