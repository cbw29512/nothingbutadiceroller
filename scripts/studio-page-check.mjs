import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createUserDiceSet, cloneDiceSet } from '../js/appearance/schema.mjs';
import { validSetsFromRecords } from '../js/appearance/studio-cloud.mjs';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) { if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`); }

try {
  const [html, index, app, drawers, studio, persistence, render, validation, cloud, visualControls, bindings, communityReport] = await Promise.all([
    read('customize.html'), read('index.html'), read('js/app.js'), read('js/drawer-controls.js'),
    read('js/appearance/studio.js'), read('js/appearance/studio-persistence.mjs'), read('js/appearance/studio-render.mjs'),
    read('js/appearance/validation.mjs'), read('js/appearance/studio-cloud.mjs'), read('js/appearance/studio-visual-controls.mjs'),
    read('js/appearance/studio-bindings.mjs'), read('js/appearance/studio-community-report.mjs'),
  ]);
  [
    'DICE STUDIO', 'id="studio-library"', 'id="studio-preview-tray"', 'id="storage-mode"',
    'id="community-library"', 'id="publish-set"', 'id="reset-default"', 'id="lock-set"',
    'id="die-style-enabled"', 'id="die-glow-enabled"', 'Enable number glow for this die', 'id="face-mode"',
    'RAW — standard numbers', 'id="face-map"', 'id="logical-result-label"', 'short word',
    'id="tray-image"', 'id="remove-tray-image"', 'image/png,image/jpeg,image/webp',
    'Guest browser sets: up to 512 KB', 'Signed-in cloud sets: up to 4 MB', 'src="/js/appearance/studio.js"',
  ].forEach((text) => requireText(html, text, 'studio contract'));
  if (html.includes('Words and multi-character labels are not allowed.') || /id="logical-face"[^>]*type="number"/.test(html)) {
    throw new Error('Studio must support short visual labels without editable logical results.');
  }
  if (index.includes('studio-preview-tray') || index.includes('DICE STUDIO')) throw new Error('Advanced studio must not be embedded in the landing page.');
  requireText(drawers, "window.location.assign('/customize.html')", 'roller-to-studio navigation');
  if (app.includes('initThemeCommunity()')) throw new Error('Landing app must not inject the advanced Theme Studio.');
  requireText(studio, 'if (activeId === draft.id) setActiveDiceSet(draft);', 'active appearance snapshot refresh after save');
  ['SYSTEM_DEFAULT_DICE_SET_ID', 'loadSavedDiceSets', 'saveDiceSetLocal', 'resetActiveToDefault'].forEach((text) => requireText(persistence, text, 'studio persistence contract'));
  ['loadCloudDiceSets', 'loadCommunityDiceSets', 'saveCloudDiceSet', 'validSetsFromRecords'].forEach((text) => requireText(cloud, text, 'cloud/community contract'));
  requireText(render, 'getSupportedFaceEditorDice', 'shape-based die selection');
  requireText(render, 'renderFaceMap', 'shape-based face map');
  requireText(render, 'safeTrayImageUrl', 'validated tray-image preview');
  requireText(render, 'numberGlowShadow', 'Studio number-glow preview');
  requireText(validation, 'short visible label', 'short-label validation');
  requireText(visualControls, 'MAX_BROWSER_TRAY_IMAGE_BYTES', 'browser tray-image size limit');
  requireText(visualControls, 'MAX_TRAY_IMAGE_BYTES', 'cloud tray-image size limit');
  requireText(visualControls, "kind: 'text'", 'visual-only face storage');
  requireText(visualControls, "q('die-glow-enabled').addEventListener('change'", 'selected-die glow handler');

  const expectedButtonIds = [
    'new-set', 'import-browser-sets', 'reset-default', 'refresh-community', 'load-more-community',
    'apply-face', 'remove-face', 'remove-tray-image', 'save-set', 'use-set', 'lock-set',
    'publish-set', 'delete-set', 'community-report-cancel', 'community-report-submit',
  ].sort();
  const htmlButtonIds = [...html.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(htmlButtonIds, expectedButtonIds, 'Every explicit Dice Studio button must be accounted for by the wiring audit.');

  const directBindings = new Map([
    ['new-set', "q('new-set').addEventListener('click', actions.newSet)"],
    ['import-browser-sets', "q('import-browser-sets').addEventListener('click', actions.importBrowserCollection)"],
    ['reset-default', "q('reset-default').addEventListener('click', actions.resetDefault)"],
    ['refresh-community', "q('refresh-community').addEventListener('click', actions.reloadCommunity)"],
    ['load-more-community', "q('load-more-community').addEventListener('click', actions.loadMoreCommunity)"],
    ['save-set', "q('save-set').addEventListener('click', actions.saveDraft)"],
    ['use-set', "q('use-set').addEventListener('click', actions.activateDraft)"],
    ['lock-set', "q('lock-set').addEventListener('click', actions.toggleLock)"],
    ['publish-set', "q('publish-set').addEventListener('click', actions.togglePublish)"],
    ['delete-set', "q('delete-set').addEventListener('click', actions.deleteDraft)"],
  ]);
  for (const [id, signature] of directBindings) requireText(bindings, signature, `${id} click binding`);
  for (const id of ['apply-face', 'remove-face', 'remove-tray-image']) {
    requireText(visualControls, `q('${id}').addEventListener('click'`, `${id} click binding`);
  }
  requireText(communityReport, "q('community-report-cancel').addEventListener('click', close)", 'community report cancel binding');
  requireText(communityReport, "q('community-report-form').addEventListener('submit', submit)", 'community report submit path');
  requireText(communityReport, "q('community-report-submit')", 'community report submit button state');
  requireText(html, 'href="/how-to.html"', 'How To navigation path');
  requireText(html, 'href="/">Back to Roller</a>', 'Back to Roller navigation path');

  const valid = createUserDiceSet({ id: 'cloud_valid', ownerId: 'owner_valid', name: 'Valid Cloud Set' });
  const invalid = cloneDiceSet(valid); invalid.id = 'cloud_invalid'; invalid.appearance.extra = true;
  assert.deepEqual(validSetsFromRecords([{ set: valid }, { set: invalid }, null, {}]).map((set) => set.id), ['cloud_valid']);
  assert.deepEqual(validSetsFromRecords(null), []);
  console.log('Studio page contract passed: every explicit button is handler-audited; glow, face, tray, library, navigation, cloud/community, save/use/lock/delete, and default fallback paths are protected.');
} catch (error) {
  console.error('Studio page contract failed:', error);
  process.exitCode = 1;
}