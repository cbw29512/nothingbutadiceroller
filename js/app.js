import { state, loadPreferences, savePreferences } from './state.js';
import { getSkinColor } from './utils.js';
import { initDicePhysics } from './physics.js';
import { addDie, clearPool, performRoll } from './roller.js';
import { renderHistory, renderPool, setStatus } from './ui.js';
import { initStylePicker } from './style-picker.js';
import { assertStylesLoaded } from './deployment.js';
import { initAccount } from './account.js';
import { closeCustomDieControls, initCustomDieControls } from './custom-controls.js';
import { closeDrawers, initDrawerControls } from './drawer-controls.js';
import { canRollFromTray, initTrayControls } from './tray-controls.js';
import { prepareActiveDiceAppearance } from './appearance/appearance-runtime.mjs';
import { applyLiveTrayAppearance } from './appearance/live-integration.mjs';
import { ensureShortcutRuntimeMarkup } from './shortcuts/runtime-markup.js';
import {
  canRollPreparedShortcutFromTray,
  clearPreparedShortcut,
  initShortcutRuntime,
  isShortcutPrepared,
  performPreparedShortcutRoll,
  syncShortcutRuntimeUI,
} from './shortcuts/runtime.js';

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

async function performActiveRoll(requestedMode = 'normal', options = {}) {
  const shortcutEligible = requestedMode === 'normal' && !options.quickD20 && isShortcutPrepared();
  if (shortcutEligible) return performPreparedShortcutRoll();
  return performRoll(requestedMode, options);
}

async function clearActiveRoll() {
  closeCustomDieControls();
  if (isShortcutPrepared()) await clearPreparedShortcut();
  return clearPool();
}

function canRollActiveFromTray() {
  return isShortcutPrepared() ? canRollPreparedShortcutFromTray() : canRollFromTray();
}

function syncControls() {
  try {
    const shortcutPrepared = isShortcutPrepared();
    document.querySelectorAll('[data-quick-roll]').forEach(button => {
      const active = state.rolling && button.dataset.quickRoll === state.d20Mode;
      button.classList.toggle('active', active);
      button.disabled = state.rolling || shortcutPrepared;
    });
    document.querySelectorAll('.die-btn, .mobile-die-btn, .pool-chip, #desktop-custom-die-roll-btn, #custom-die-roll-btn').forEach(button => {
      button.disabled = state.rolling || shortcutPrepared;
    });
    ['roll-btn', 'mobile-roll-btn', 'clear-btn', 'mobile-clear-btn', 'keep-btn'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = state.rolling;
    });

    const keepBtn = document.getElementById('keep-btn');
    keepBtn?.classList.toggle('active', state.keepDice);
    keepBtn?.setAttribute('aria-pressed', String(state.keepDice));

    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.textContent = `🔊 ${state.soundEnabled ? 'ON' : 'OFF'}`;
      soundBtn.setAttribute('aria-pressed', String(state.soundEnabled));
    }
    syncShortcutRuntimeUI();
  } catch (error) {
    console.error('Failed to synchronize controls:', error);
  }
}

function bindDiceButtons(selector) {
  document.querySelectorAll(selector).forEach(button => {
    if (button.dataset.type) button.addEventListener('click', () => addDie(button.dataset.type));
  });
}

function bindQuickRollButtons() {
  document.querySelectorAll('[data-quick-roll]').forEach(button => {
    button.addEventListener('click', () => performActiveRoll(button.dataset.quickRoll, { quickD20: true }));
  });
}

function bindEvents() {
  try {
    bindDiceButtons('.die-btn');
    bindDiceButtons('.mobile-die-btn[data-type]');
    bindQuickRollButtons();
    initCustomDieControls();
    initDrawerControls();
    initTrayControls(performActiveRoll, canRollActiveFromTray);
    document.addEventListener('rollstatechange', syncControls);
    document.addEventListener('shortcutstatechange', syncControls);
    document.addEventListener('configurationloaded', () => {
      syncControls();
      initStylePicker();
    });

    document.getElementById('keep-btn')?.addEventListener('click', () => {
      state.keepDice = !state.keepDice;
      savePreferences();
      syncControls();
    });
    document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      savePreferences();
      syncControls();
    });
    document.getElementById('roll-btn')?.addEventListener('click', () => performActiveRoll('normal'));
    document.getElementById('mobile-roll-btn')?.addEventListener('click', () => performActiveRoll('normal'));
    document.getElementById('clear-btn')?.addEventListener('click', clearActiveRoll);
    document.getElementById('mobile-clear-btn')?.addEventListener('click', clearActiveRoll);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeDrawers();
        closeCustomDieControls();
      }
      if (event.key === 'Enter' && event.ctrlKey) performActiveRoll('normal');
    });
  } catch (error) {
    console.error('Failed to bind application events:', error);
  }
}

async function boot() {
  try {
    assertStylesLoaded();
    ensureStylesheet('community-styles', '/community.css');
    ensureStylesheet('custom-controls-styles', '/custom.css');
    ensureStylesheet('shortcut-toolbar-styles', '/shortcut-toolbar.css');
    ensureShortcutRuntimeMarkup();
    loadPreferences();
    syncControls();
    renderPool();
    renderHistory();
    bindEvents();
    initStylePicker();
    initAccount();
    initShortcutRuntime();

    const stylesButton = document.getElementById('open-styles-btn');
    if (stylesButton) stylesButton.textContent = 'Customize';
    const stylesTitle = document.getElementById('styles-title');
    if (stylesTitle) stylesTitle.textContent = 'Customize Dice & Tray';

    setStatus('Loading 3D physics…');
    const appearanceRuntime = await prepareActiveDiceAppearance();
    applyLiveTrayAppearance(appearanceRuntime);
    await initDicePhysics(
      getSkinColor(state.dieSkin, state.customAppearance?.diceColor),
      appearanceRuntime,
    );
    state.physicsReady = true;
    document.dispatchEvent(new Event('rollstatechange'));
    setStatus('3D physics ready.', 'ready');
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
