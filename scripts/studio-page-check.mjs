import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createUserDiceSet, cloneDiceSet } from '../js/appearance/schema.mjs';
import { validSetsFromRecords } from '../js/appearance/studio-cloud.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}
function requireAll(source, markers, label) { markers.forEach((marker) => requireText(source, marker, label)); }

try {
  const [
    html, index, app, drawers, studio, persistence, render, validation, cloud, visualControls,
    bindings, communityReport, surfaceControls, patternControls, patternStyle, inlayControls, inlayStyle,
  ] = await Promise.all([
    read('customize.html'), read('index.html'), read('js/app.js'), read('js/drawer-controls.js'), read('js/appearance/studio.js'),
    read('js/appearance/studio-persistence.mjs'), read('js/appearance/studio-render.mjs'), read('js/appearance/validation.mjs'),
    read('js/appearance/studio-cloud.mjs'), read('js/appearance/studio-visual-controls.mjs'), read('js/appearance/studio-bindings.mjs'),
    read('js/appearance/studio-community-report.mjs'), read('js/appearance/studio-surface-controls.mjs'),
    read('js/appearance/studio-pattern-controls.mjs'), read('js/appearance/pattern-style.mjs'),
    read('js/appearance/studio-inlay-controls.mjs'), read('js/appearance/inlay-style.mjs'),
  ]);

  requireAll(html, [
    'DICE STUDIO', 'id="studio-library"', 'id="studio-preview-tray"', 'id="storage-mode"', 'id="community-library"',
    'id="publish-set"', 'id="reset-default"', 'id="lock-set"', 'id="die-style-enabled"', 'id="die-glow-enabled"',
    'RAW — standard numbers', 'id="face-map"', 'id="logical-result-label"', 'short word',
    'id="surface-finish-group"', 'id="surface-pattern-group"', 'value="metallic"', 'value="pearl"', 'value="marble"',
    'value="swirl"', 'value="speckle"', 'value="split"', 'deterministic visual textures',
    'id="tray-image"', 'id="remove-tray-image"', 'image/png,image/jpeg,image/webp',
    'Guest browser sets: up to 512 KB', 'Signed-in cloud sets: up to 4 MB', 'src="/js/appearance/studio.js"',
  ], 'static Studio contract');
  requireAll(inlayControls, [
    "group.id = 'edge-inlay-group'", "group.className = 'studio-group'", 'id="inlay-scope"', 'id="edge-inlay"',
    'value="fine"', 'value="bold"', 'value="dashed"', 'value="dotted"', 'id="inlay-color"',
    'id="inlay-intensity"', 'id="inlay-width"', 'real UV perimeter', "anchor.insertAdjacentElement('afterend', group)",
  ], 'dynamic edge-inlay Studio contract');
  if (html.includes('Words and multi-character labels are not allowed.') || /id="logical-face"[^>]*type="number"/.test(html)) {
    throw new Error('Studio must support short visual labels without editable logical results.');
  }
  if (index.includes('studio-preview-tray') || index.includes('DICE STUDIO')) throw new Error('Advanced Studio must not be embedded in the landing page.');
  requireText(drawers, "window.location.assign('/customize.html')", 'roller-to-Studio navigation');
  if (app.includes('initThemeCommunity()')) throw new Error('Landing app must not inject the advanced Theme Studio.');

  requireAll(studio, ['if (activeId === draft.id) setActiveDiceSet(draft);'], 'Studio save/use contract');
  requireAll(persistence, ['SYSTEM_DEFAULT_DICE_SET_ID', 'loadSavedDiceSets', 'saveDiceSetLocal', 'resetActiveToDefault'], 'Studio persistence contract');
  requireAll(cloud, ['loadCloudDiceSets', 'loadCommunityDiceSets', 'saveCloudDiceSet', 'validSetsFromRecords'], 'cloud/community contract');
  requireAll(render, [
    'getSupportedFaceEditorDice', 'renderFaceMap', 'safeTrayImageUrl', 'numberGlowShadow', 'buildSurfacePreviewBackground',
    'fillStudioSurfaceControls', 'fillStudioPatternControls', 'fillStudioInlayControls', 'die.dataset.surfacePattern',
    'die.dataset.edgeInlay', 'faceText.dataset.previewFace',
  ], 'Studio render contract');
  requireAll(bindings, [
    "event.target.closest('[data-preview-face]')", "q('logical-face').value = logicalFace", 'editor.focus(); editor.select();',
    'ensureStudioInlayControls', 'bindStudioSurfaceControls', 'bindStudioPatternControls', 'bindStudioInlayControls',
  ], 'Studio binding contract');
  if (render.includes('die.faceMode === RAW_FACE_MODE')) throw new Error('Editable RAW labels must not disable direct face customization.');

  requireAll(validation, ['short visible label', 'SURFACE_FINISH_TYPES', 'validateSurfacePattern', 'validateEdgeInlay'], 'validation contract');
  requireText(patternStyle, 'SURFACE_PATTERN_TYPES', 'surface-pattern allowlist');
  requireText(inlayStyle, 'EDGE_INLAY_TYPES', 'edge-inlay allowlist');
  requireAll(visualControls, ['MAX_BROWSER_TRAY_IMAGE_BYTES', 'MAX_TRAY_IMAGE_BYTES', "kind: 'text'", "q('die-glow-enabled').addEventListener('change'"], 'visual control contract');
  requireAll(surfaceControls, ["q('surface-finish').addEventListener('change'", "q('finish-accent-color').addEventListener('input'", "q('finish-intensity').addEventListener('input'"], 'surface-finish handlers');
  requireAll(patternControls, ["q('surface-pattern').addEventListener('change'", "q('pattern-primary-color').addEventListener('input'", "q('pattern-secondary-color').addEventListener('input'", "'pattern-intensity'", "'pattern-scale'"], 'surface-pattern handlers');
  requireAll(inlayControls, ["q('edge-inlay').addEventListener('change'", "q('inlay-color').addEventListener('input'", "'inlay-intensity'", "'inlay-width'"], 'edge-inlay handlers');

  const expectedButtonIds = [
    'new-set', 'import-browser-sets', 'reset-default', 'refresh-community', 'load-more-community',
    'apply-face', 'remove-face', 'remove-tray-image', 'save-set', 'use-set', 'lock-set', 'publish-set', 'delete-set',
    'community-report-cancel', 'community-report-submit',
  ].sort();
  const htmlButtonIds = [...html.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(htmlButtonIds, expectedButtonIds, 'Every explicit Dice Studio button must be accounted for by the wiring audit.');
  const directBindings = [
    ['new-set', 'newSet'], ['import-browser-sets', 'importBrowserCollection'], ['reset-default', 'resetDefault'],
    ['refresh-community', 'reloadCommunity'], ['load-more-community', 'loadMoreCommunity'], ['save-set', 'saveDraft'],
    ['use-set', 'activateDraft'], ['lock-set', 'toggleLock'], ['publish-set', 'togglePublish'], ['delete-set', 'deleteDraft'],
  ];
  for (const [id, action] of directBindings) requireText(bindings, `q('${id}').addEventListener('click', actions.${action})`, `${id} click binding`);
  for (const id of ['apply-face', 'remove-face', 'remove-tray-image']) requireText(visualControls, `q('${id}').addEventListener('click'`, `${id} click binding`);
  requireAll(communityReport, ["q('community-report-cancel').addEventListener('click', close)", "q('community-report-form').addEventListener('submit', submit)", "q('community-report-submit')"], 'community-report wiring');
  requireAll(html, ['href="/how-to.html"', 'href="/">Back to Roller</a>'], 'Studio navigation links');

  const valid = createUserDiceSet({ id: 'cloud_valid', ownerId: 'owner_valid', name: 'Valid Cloud Set' });
  const invalid = cloneDiceSet(valid); invalid.id = 'cloud_invalid'; invalid.appearance.extra = true;
  assert.deepEqual(validSetsFromRecords([{ set: valid }, { set: invalid }, null, {}]).map((set) => set.id), ['cloud_valid']);
  assert.deepEqual(validSetsFromRecords(null), []);
  console.log('Studio page contract passed: all buttons and visual layers including UV edge inlays are handler-audited without weakening existing persistence, face, cloud, tray, or navigation protections.');
} catch (error) {
  console.error('Studio page contract failed:', error);
  process.exitCode = 1;
}
