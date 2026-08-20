import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

try {
  const [html, index, app, drawers, persistence, render, validation, cloud, visualControls] = await Promise.all([
    read('customize.html'), read('index.html'), read('js/app.js'),
    read('js/drawer-controls.js'), read('js/appearance/studio-persistence.mjs'),
    read('js/appearance/studio-render.mjs'), read('js/appearance/validation.mjs'),
    read('js/appearance/studio-cloud.mjs'), read('js/appearance/studio-visual-controls.mjs'),
  ]);
  [
    'DICE & TRAY STUDIO', 'id="studio-library"', 'id="studio-preview-tray"',
    'id="storage-mode"', 'id="community-library"', 'id="publish-set"',
    'id="reset-default"', 'id="lock-set"', 'id="die-style-enabled"', 'id="face-mode"',
    'RAW — standard numbers', 'id="face-map"', 'id="logical-result-label"',
    'Words and multi-character labels are not allowed.', 'src="/js/appearance/studio.js"',
  ].forEach((text) => requireText(html, text, 'studio contract'));
  if (html.includes('FIRE') || html.includes('id="face-kind"') || /id="logical-face"[^>]*type="number"/.test(html)) {
    throw new Error('Face editor must use the visual face map, not word labels or editable logical results.');
  }
  if (index.includes('studio-preview-tray') || index.includes('DICE & TRAY STUDIO')) {
    throw new Error('Advanced studio must not be embedded in the landing page.');
  }
  requireText(drawers, "window.location.assign('/customize.html')", 'roller-to-studio navigation');
  if (app.includes('initThemeCommunity()')) throw new Error('Landing app must not inject the advanced Theme Studio.');
  ['SYSTEM_DEFAULT_DICE_SET_ID', 'loadSavedDiceSets', 'saveDiceSetLocal', 'resetActiveToDefault']
    .forEach((text) => requireText(persistence, text, 'studio persistence contract'));
  ['loadCloudDiceSets', 'loadCommunityDiceSets', 'saveCloudDiceSet']
    .forEach((text) => requireText(cloud, text, 'cloud/community contract'));
  requireText(render, 'getSupportedFaceEditorDice', 'shape-based die selection');
  requireText(render, 'renderFaceMap', 'shape-based face map');
  requireText(render, 'logical-face', 'face-map selection contract');
  requireText(validation, 'one visible character/symbol', 'single-glyph validation');
  requireText(visualControls, 'die-style-enabled', 'per-die visual controls');
  requireText(visualControls, "kind: 'text'", 'visual-only face storage');
  console.log('Studio page contract passed: visual face map, cloud/community libraries, saved sets, and default fallback are protected.');
} catch (error) {
  console.error('Studio page contract failed:', error);
  process.exitCode = 1;
}
