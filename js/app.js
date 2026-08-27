import { state, loadPreferences, savePreferences } from './state.js';
import { getSkinColor } from './utils.js';
import { initDicePhysics } from './physics.js';
import { addDie, clearPool, performRoll } from './roller.js';
import { performCustomRoll } from './custom-roll.js';
import { initHistoryActions } from './history-actions.js';
import { initOfflineSupport } from './offline-support.js';
import { detectOfflineMode } from './connectivity.js';
import { renderHistory, renderPool, setStatus } from './ui.js';
import { assertStylesLoaded } from './deployment.js';
import { initAccount } from './account.js';
import { closeCustomDieControls, initCustomDieControls } from './custom-controls.js';
import { closeDrawers, initDrawerControls } from './drawer-controls.js';
import { initMobileHeaderMenu } from './mobile-header-menu.js';
import { shouldHandleGlobalRollShortcut } from './keyboard-shortcuts.js';
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

async function rerollHistoryDescriptor(descriptor) {
  if (state.rolling) return false;
  closeDrawers();
  closeCustomDieControls();
  if (isShortcutPrepared()) await clearPreparedShortcut();

  if (descriptor.kind === 'standard') {
    const poolOverride = descriptor.dice.map((type) => ({ type }));
    return performRoll(descriptor.mode, {
      quickD20: descriptor.quickD20,
      poolOverride,
      preserveSelection: true,
    });
  }
  if (descriptor.kind === 'custom') {
    return performCustomRoll(String(descriptor.sides));
  }
  throw new Error('This history entry cannot be rerolled safely.');
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
    initMobileHeaderMenu();
    initDrawerControls();
    initHistoryActions({ reroll: rerollHistoryDescriptor, setStatus });
    initTrayControls(performActiveRoll, canRollActiveFromTray);
    document.addEventListener('rollstatechange', syncControls);
    document.addEventListener('shortcutstatechange', syncControls);
    document.addEventListener('configurationloaded', syncControls);

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
      if (shouldHandleGlobalRollShortcut(event)) {
        event.preventDefault();
        performActiveRoll('normal');
      }
    });
  } catch (error) {
    console.error('Failed to bind application events:', error);
  }
}

async function boot() {
  try {
    assertStylesLoaded();
    initOfflineSupport();
    ensureStylesheet('shortcut-toolbar-styles', '/shortcut-toolbar.css');
    ensureShortcutRuntimeMarkup();
    loadPreferences();
    syncControls();
    renderPool();
    renderHistory();
    bindEvents();
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
      offlineMode
        ? '3D physics ready. Offline mode uses Default Dice.'
        : '3D physics ready.',
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
