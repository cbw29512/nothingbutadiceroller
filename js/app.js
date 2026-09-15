import { state, loadPreferences } from './state.js';
import { getSkinColor } from './utils.js';
import { initDicePhysics } from './physics.js';
import { initOfflineSupport } from './offline-support.js';
import { detectOfflineMode } from './connectivity.js';
import { renderHistory, renderPool, setStatus } from './ui.js';
import { assertStylesLoaded } from './deployment.js';
import { initAccount } from './account.js';
import { prepareActiveDiceAppearance } from './appearance/appearance-runtime.mjs';
import { applyLiveTrayAppearance } from './appearance/live-integration.mjs';
import { ensureShortcutRuntimeMarkup } from './shortcuts/runtime-markup.js';
import { initShortcutRuntime } from './shortcuts/runtime.js';
import { initTableSpeedControls } from './table-speed-controls.js';
import { initAppInteractions, syncAppControls } from './app-interactions.js';

function ensureStylesheet(id, href) {
  try {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  } catch (error) {
    console.error(`Failed to load stylesheet ${href}:`, error);
  }
}

async function boot() {
  try {
    assertStylesLoaded();
    initOfflineSupport();
    ensureStylesheet('shortcut-toolbar-styles', '/shortcut-toolbar.css');
    ensureStylesheet('table-speed-styles', '/js/table-speed.css');
    ensureShortcutRuntimeMarkup();
    loadPreferences();
    initTableSpeedControls();
    syncAppControls();
    renderPool();
    renderHistory();
    initAppInteractions();
    initAccount();
    initShortcutRuntime();

    setStatus('Loading 3D physics…');
    const offlineMode = await detectOfflineMode();
    const appearanceRuntime = await prepareActiveDiceAppearance({ allowCustom: !offlineMode });
    applyLiveTrayAppearance(appearanceRuntime);
    await initDicePhysics(
      getSkinColor(state.dieSkin, state.customAppearance?.diceColor),
      appearanceRuntime,
    );
    state.physicsReady = true;
    document.dispatchEvent(new Event('rollstatechange'));
    setStatus(
      offlineMode ? '3D physics ready. Offline mode uses Default Dice.' : '3D physics ready.',
      'ready',
    );
  } catch (error) {
    state.physicsReady = false;
    document.dispatchEvent(new Event('rollstatechange'));
    console.error('Application startup failed:', error);
    setStatus('3D physics failed to load. Refresh to retry.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
