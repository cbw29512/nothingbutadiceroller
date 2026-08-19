import { state, loadPreferences, savePreferences } from './state.js';
import { getSkinColor } from './utils.js';
import { initDicePhysics } from './physics.js';
import { addDie, clearPool, performRoll } from './roller.js';
import { renderHistory, renderPool, setStatus } from './ui.js';
import { initStylePicker } from './style-picker.js';
import { initThemeCommunity } from './theme-community.js';
import { assertStylesLoaded } from './deployment.js';
import { initAccount } from './account.js';
import { closeCustomDieControls, initCustomDieControls } from './custom-controls.js';
import { closeDrawers, initDrawerControls } from './drawer-controls.js';

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

function syncControls() {
  try {
    document.querySelectorAll('[data-quick-roll]').forEach(button => {
      const active = state.rolling && button.dataset.quickRoll === state.d20Mode;
      button.classList.toggle('active', active);
      button.disabled = state.rolling;
    });
    document.querySelectorAll('.die-btn, .mobile-die-btn, .pool-chip').forEach(button => {
      button.disabled = state.rolling;
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
  } catch (error) {
    console.error('Failed to synchronize controls:', error);
  }
}

function bindDiceButtons(selector) {
  document.querySelectorAll(selector).forEach(button => {
    if (button.dataset.type) {
      button.addEventListener('click', () => addDie(button.dataset.type));
    }
  });
}

function bindQuickRollButtons() {
  document.querySelectorAll('[data-quick-roll]').forEach(button => {
    button.addEventListener('click', () => {
      performRoll(button.dataset.quickRoll, { quickD20: true });
    });
  });
}

function bindEvents() {
  try {
    bindDiceButtons('.die-btn');
    bindDiceButtons('.mobile-die-btn[data-type]');
    bindQuickRollButtons();
    initCustomDieControls();
    initDrawerControls();
    document.addEventListener('rollstatechange', syncControls);
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
    document.getElementById('roll-btn')?.addEventListener('click', () => performRoll('normal'));
    document.getElementById('mobile-roll-btn')?.addEventListener('click', () => performRoll('normal'));
    document.getElementById('clear-btn')?.addEventListener('click', clearPool);
    document.getElementById('mobile-clear-btn')?.addEventListener('click', clearPool);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeDrawers();
        closeCustomDieControls();
      }
      if (event.key === 'Enter' && event.ctrlKey) performRoll('normal');
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
    loadPreferences();
    syncControls();
    renderPool();
    renderHistory();
    bindEvents();
    initStylePicker();
    initAccount();
    initThemeCommunity();

    const stylesButton = document.getElementById('open-styles-btn');
    if (stylesButton) stylesButton.textContent = 'Customize';
    const stylesTitle = document.getElementById('styles-title');
    if (stylesTitle) stylesTitle.textContent = 'Customize Dice & Tray';

    setStatus('Loading 3D physics…');
    await initDicePhysics(getSkinColor(state.dieSkin, state.customAppearance?.diceColor));
    state.physicsReady = true;
    setStatus('3D physics ready.', 'ready');
  } catch (error) {
    state.physicsReady = false;
    console.error('Application startup failed:', error);
    setStatus('3D physics failed to load. Refresh to retry.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
