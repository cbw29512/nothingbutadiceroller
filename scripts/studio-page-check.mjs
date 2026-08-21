import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) { if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`); }

try {
  const [html, index, app, drawers, studio, persistence, render, validation, cloud, visualControls] = await Promise.all([
    read('customize.html'), read('index.html'), read('js/app.js'), read('js/drawer-controls.js'),
    read('js/appearance/studio.js'), read('js/appearance/studio-persistence.mjs'), read('js/appearance/studio-render.mjs'),
    read('js/appearance/validation.mjs'), read('js/appearance/studio-cloud.mjs'), read('js/appearance/studio-visual-controls.mjs'),
  ]);
  [
    'DICE & TRAY STUDIO', 'id="studio-library"', 'id="studio-preview-tray"', 'id="storage-mode"',
    'id="community-library"', 'id="publish-set"', 'id="reset-default"', 'id="lock-set"',
    'id="die-style-enabled"', 'id="face-mode"', 'RAW — standard numbers', 'id="face-map"',
    'id="logical-result-label"', 'short word', 'id="tray-image"', 'id="remove-tray-image"',
    'image/png,image/jpeg,image/webp', 'src="/js/appearance/studio.js"',
  ].forEach((text) => requireText(html, text, 'studio contract'));
  if (html.includes('Words and multi-character labels are not allowed.') || /id="logical-face"[^>]*type="number"/.test(html)) {
    throw new Error('Studio must support short visual labels without editable logical results.');
  }
  if (index.includes('studio-preview-tray') || index.includes('DICE & TRAY STUDIO')) throw new Error('Advanced studio must not be embedded in the landing page.');
  requireText(drawers, "window.location.assign('/customize.html')", 'roller-to-studio navigation');
  if (app.includes('initThemeCommunity()')) throw new Error('Landing app must not inject the advanced Theme Studio.');
  requireText(studio, 'if (activeId === draft.id) setActiveDiceSet(draft);', 'active appearance snapshot refresh after save');
  requireText(studio, 'cloudUnavailable = Boolean(cloud.error);', 'cloud failure classification');
  requireText(studio, 'renderStorageMode(cloudEnabled, importableBrowserSets.length, cloudUnavailable);', 'cloud failure storage-mode rendering');
  requireText(render, 'Cloud unavailable • browser-only mode; cloud sets are not shown', 'explicit browser-only cloud outage status');
  ['SYSTEM_DEFAULT_DICE_SET_ID', 'loadSavedDiceSets', 'saveDiceSetLocal', 'resetActiveToDefault'].forEach((text) => requireText(persistence, text, 'studio persistence contract'));
  ['loadCloudDiceSets', 'loadCommunityDiceSets', 'saveCloudDiceSet'].forEach((text) => requireText(cloud, text, 'cloud/community contract'));
  requireText(render, 'getSupportedFaceEditorDice', 'shape-based die selection');
  requireText(render, 'renderFaceMap', 'shape-based face map');
  requireText(render, 'safeTrayImageUrl', 'validated tray-image preview');
  requireText(validation, 'short visible label', 'short-label validation');
  requireText(visualControls, 'MAX_TRAY_IMAGE_BYTES', 'tray-image size limit');
  requireText(visualControls, "kind: 'text'", 'visual-only face storage');
  console.log('Studio page contract passed: short face labels, tray images, cloud/community libraries, explicit cloud-outage browser mode, active-set save sync, saved sets, and default fallback are protected.');
} catch (error) {
  console.error('Studio page contract failed:', error);
  process.exitCode = 1;
}
