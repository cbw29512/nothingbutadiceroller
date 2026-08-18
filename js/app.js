import { state, loadPreferences, savePreferences } from './state.js';
import { getSkinColor } from './utils.js';
import { initDicePhysics } from './physics.js';
import { addDie, clearPool, performRoll } from './roller.js';
import { initStylePicker, renderHistory, renderPool, setStatus } from './ui.js';

function assertStylesLoaded() {
  try {
    const hasStyles = [...document.styleSheets].some(sheet =>
      sheet.href?.includes('/styles.css')
    );

    if (hasStyles) return true;

    const warning = document.createElement('div');
    warning.textContent = 'Deployment error: styles.css did not load.';
    Object.assign(warning.style, {
      position: 'fixed',
      inset: '0 0 auto 0',
      zIndex: '99999',
      padding: '12px 16px',
      background: '#7f1d1d',
      color: '#fff',
      font: '700 14px system-ui, sans-serif',
      textAlign: 'center',
    });
    document.body.prepend(warning);
    console.error('Deployment validation failed: styles.css is unavailable.');
    return false;
  } catch (err) {
    console.error('Stylesheet validation failed:', err);
    return false;
  }
}

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
    document.querySelectorAll('.adv-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.adv === state.d20Mode);
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

function bindEvents() {
  try {
    document.querySelectorAll('.die-btn').forEach(button => {
      button.addEventListener('click', () => addDie(button.dataset.type));
    });

    document.querySelectorAll('.adv-btn').forEach(button => {
      button.addEventListener('click', () => {
        state.d20Mode = button.dataset.adv || 'normal';
        savePreferences();
        syncControls();
      });
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

    document.getElementById('roll-btn')?.addEventListener('click', performRoll);
    document.getElementById('clear-btn')?.addEventListener('click', clearPool);

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
      if (event.key === 'Enter' && event.ctrlKey) performRoll();
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
