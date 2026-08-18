import { state, loadPreferences, savePreferences } from './state.js';
import { getSkinColor } from './utils.js';
import { initDicePhysics } from './physics.js';
import { addDie, clearPool, performRoll } from './roller.js';
import { initStylePicker, renderHistory, renderPool, setStatus } from './ui.js';
import { assertStylesLoaded } from './deployment.js';

function setDrawer(drawer, open) {
  try {
    if (!drawer) return;
    drawer.classList.toggle('hidden', !open);
    drawer.setAttribute('aria-hidden', String(!open));
  } catch (err) {
    console.error('Failed to update drawer state:', err);
  }
}

function syncControls() {
  try {
    document.querySelectorAll('[data-quick-roll]').forEach(button => {
      const isActive = state.rolling && button.dataset.quickRoll === state.d20Mode;
      button.classList.toggle('active', isActive);
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
  } catch (err) {
    console.error('Failed to synchronize controls:', err);
  }
}

function bindDiceButtons(selector) {
  document.querySelectorAll(selector).forEach(button => {
    button.addEventListener('click', () => addDie(button.dataset.type));
  });
}

function bindQuickRollButtons() {
  document.querySelectorAll('[data-quick-roll]').forEach(button => {
    button.addEventListener('click', () => performRoll(button.dataset.quickRoll));
  });
}

function bindEvents() {
  try {
    bindDiceButtons('.die-btn');
    bindDiceButtons('.mobile-die-btn');
    bindQuickRollButtons();
    document.addEventListener('rollstatechange', syncControls);

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

    const stylesDrawer = document.getElementById('styles-drawer');
    const historyDrawer = document.getElementById('history-drawer');
    document.getElementById('open-styles-btn')?.addEventListener('click', () => setDrawer(stylesDrawer, true));
    document.getElementById('close-styles-btn')?.addEventListener('click', () => setDrawer(stylesDrawer, false));
    document.getElementById('open-history-btn')?.addEventListener('click', () => setDrawer(historyDrawer, true));
    document.getElementById('close-history-btn')?.addEventListener('click', () => setDrawer(historyDrawer, false));

    document.querySelectorAll('.drawer-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        setDrawer(stylesDrawer, false);
        setDrawer(historyDrawer, false);
      });
    });

    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
      state.history = [];
      savePreferences();
      renderHistory();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        setDrawer(stylesDrawer, false);
        setDrawer(historyDrawer, false);
      }
      if (event.key === 'Enter' && event.ctrlKey) performRoll('normal');
    });
  } catch (err) {
    console.error('Failed to bind application events:', err);
  }
}

async function boot() {
  try {
    assertStylesLoaded();
    loadPreferences();
    syncControls();
    renderPool();
    renderHistory();
    bindEvents();
    initStylePicker();

    setStatus('Loading 3D physics…');
    await initDicePhysics(getSkinColor(state.dieSkin));
    state.physicsReady = true;
    setStatus('3D physics ready.', 'ready');
  } catch (err) {
    state.physicsReady = false;
    console.error('Application startup failed:', err);
    setStatus('3D physics failed to load. Refresh to retry.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
