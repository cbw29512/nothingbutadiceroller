import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

try {
  const [html, index, app, drawers, persistence, studio, visualControls] = await Promise.all([
    read('customize.html'), read('index.html'), read('js/app.js'), read('js/drawer-controls.js'),
    read('js/appearance/studio-persistence.mjs'), read('js/appearance/studio.js'),
    read('js/appearance/studio-visual-controls.mjs'),
  ]);
  [
    'DICE & TRAY STUDIO', 'id="studio-library"', 'id="community-library"', 'id="studio-preview-tray"',
    'id="reset-default"', 'id="lock-set"', 'id="publish-set"', 'id="die-style-enabled"',
    'id="face-mode"', 'RAW — standard numbers', 'src="/js/appearance/studio.js"',
  ].forEach((text) => requireText(html, text, 'studio contract'));
  if (index.includes('studio-preview-tray') || index.includes('DICE & TRAY STUDIO')) {
    throw new Error('Advanced studio must not be embedded in the landing page.');
  }
  requireText(drawers, "window.location.assign('/customize.html')", 'roller-to-studio navigation');
  if (app.includes('initThemeCommunity()')) throw new Error('Landing app must not inject the advanced Theme Studio.');
  ['SYSTEM_DEFAULT_DICE_SET_ID', 'loadSavedDiceSets', 'saveDiceSetLocal', 'setActiveDiceSet', 'resetActiveToDefault']
    .forEach((text) => requireText(persistence, text, 'studio persistence contract'));
  ['loadCloudDiceSets', 'loadCommunityDiceSets', 'bindStudioVisualControls']
    .forEach((text) => requireText(studio, text, 'studio integration contract'));
  ['die-style-enabled', 'replaceVisualFace', 'buildAppearanceRenderPlan']
    .forEach((text) => requireText(visualControls, text, 'visual controls contract'));
  console.log('Studio page contract passed: separate page, cloud/community sets, per-die visuals, reset fallback, and no landing-page editor injection.');
} catch (error) {
  console.error('Studio page contract failed:', error);
  process.exitCode = 1;
}
