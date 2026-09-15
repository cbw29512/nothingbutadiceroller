import { state, savePreferences } from './state.js';
import { addDie } from './roller.js';
import { initHistoryActions } from './history-actions.js';
import { setStatus } from './ui.js';
import { closeCustomDieControls, initCustomDieControls } from './custom-controls.js';
import { closeDrawers, initDrawerControls } from './drawer-controls.js';
import { initMobileHeaderMenu } from './mobile-header-menu.js';
import { initTrayControls } from './tray-controls.js';
import { isShortcutPrepared, syncShortcutRuntimeUI } from './shortcuts/runtime.js';
import {
  canRollActiveFromTray,
  clearActiveRoll,
  performActiveRoll,
  rerollHistoryDescriptor,
} from './roll-orchestrator.js';

export function syncAppControls() {
  try {
    const shortcutPrepared = isShortcutPrepared();
    document.querySelectorAll('[data-quick-roll]').forEach(button => {
      const active = state.rolling
        && button.dataset.quickRoll !== 'normal'
        && button.dataset.quickRoll === state.d20Mode;
      button.classList.toggle('active', active);
      button.disabled = state.rolling || shortcutPrepared;
    });
    document.querySelectorAll(
      '.die-btn, .mobile-die-btn, .pool-chip, #desktop-custom-die-roll-btn, #custom-die-roll-btn, [data-roll-modifier], [data-modifier-step]',
    ).forEach(button => {
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
  try {
    document.querySelectorAll(selector).forEach(button => {
      if (button.dataset.type) button.addEventListener('click', () => addDie(button.dataset.type));
    });
  } catch (error) {
    console.error(`Failed to bind dice buttons for ${selector}:`, error);
  }
}

function bindQuickRollButtons() {
  try {
    document.querySelectorAll('[data-quick-roll]').forEach(button => {
      button.addEventListener('click', () => performActiveRoll(button.dataset.quickRoll, { quickD20: true }));
    });
  } catch (error) {
    console.error('Failed to bind quick-roll buttons:', error);
  }
}

export function initAppInteractions() {
  try {
    bindDiceButtons('.die-btn');
    bindDiceButtons('.mobile-die-btn[data-type]');
    bindQuickRollButtons();
    initCustomDieControls();
    initMobileHeaderMenu();
    initDrawerControls();
    initHistoryActions({ reroll: rerollHistoryDescriptor, setStatus });
    initTrayControls(performActiveRoll, canRollActiveFromTray);
    document.addEventListener('rollstatechange', syncAppControls);
    document.addEventListener('shortcutstatechange', syncAppControls);
    document.addEventListener('configurationloaded', syncAppControls);

    document.getElementById('keep-btn')?.addEventListener('click', () => {
      state.keepDice = !state.keepDice;
      savePreferences();
      syncAppControls();
    });
    document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      savePreferences();
      syncAppControls();
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
    console.error('Failed to initialize application interactions:', error);
  }
}
