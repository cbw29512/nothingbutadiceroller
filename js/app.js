import { state, loadPreferences, savePreferences } from './state.js';
import { getSkinColor } from './utils.js';
import { initDicePhysics } from './physics.js';
import { addDie, clearPool, performRoll } from './roller.js';
import { performCustomRoll } from './custom-roll.js';
import { renderHistory, renderPool, setStatus } from './ui.js';
import { initStylePicker } from './style-picker.js';
import { initThemeCommunity } from './theme-community.js';
import { assertStylesLoaded } from './deployment.js';
import { initAccount } from './account.js';

function setDrawer(drawer, open) {
  try {
    if (!drawer) return;
    drawer.classList.toggle('hidden', !open);
    drawer.setAttribute('aria-hidden', String(!open));
  } catch (err) {
    console.error('Failed to update drawer state:', err);
  }
}

function setCustomDiePopover(open) {
  try {
    const popover = document.getElementById('custom-die-popover');
    const button = document.getElementById('mobile-custom-die-btn');
    if (!popover || !button) return;
    popover.classList.toggle('hidden', !open);
    popover.setAttribute('aria-hidden', String(!open));
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle('active', open);
    if (open) document.getElementById('custom-die-sides')?.focus();
  } catch (err) {
    console.error('Failed to update custom die popover:', err);
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

    ['roll-btn', 'mobile-roll-btn', 'clear-btn', 'mobile-clear-btn', 'keep-btn', 'custom-die-roll-btn'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = state.rolling;
    });

    const customInput = document.getElementById('custom-die-sides');
    if (customInput) customInput.disabled = state.rolling;

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

function bindCustomDie() {
  const toggle = document.getElementById('mobile-custom-die-btn');
  const input = document.getElementById('custom-die-sides');
  const rollButton = document.getElementById('custom-die-roll-btn');

  toggle?.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setCustomDiePopover(!isOpen);
  });

  const rollCustom = () => {
    if (!input) return;
    input.setCustomValidity('');
    performCustomRoll(input.value);
  };

  rollButton?.addEventListener('click', rollCustom);
  input?.addEventListener('input', () => input.setCustomValidity(''));
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter') rollCustom();
  });

  document.addEventListener('customrollcomplete', () => setCustomDiePopover(false));
  document.addEventListener('customrollerror', event => {
    if (!input) return;
    input.setCustomValidity(event.detail?.message || 'Custom roll failed.');
    input.reportValidity();
  });
}

function bindEvents() {
  try {
    bindDiceButtons('.die-btn');
    bindDiceButtons('.mobile-die-btn[data-type]');
    bindQuickRollButtons();
    bindCustomDie();
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
    document.getElementById('mobile-clear-btn')?.addEventListener('click', () => {
      setCustomDiePopover(false);
      clearPool();
    });

    const stylesDrawer = document.getElementById('styles-drawer');
    const historyDrawer = document.getElementById('history-drawer');
    const accountDrawer = document.getElementById('account-drawer');
    document.getElementById('open-styles-btn')?.addEventListener('click', () => setDrawer(stylesDrawer, true));
    document.getElementById('close-styles-btn')?.addEventListener('click', () => setDrawer(stylesDrawer, false));
    document.getElementById('open-history-btn')?.addEventListener('click', () => setDrawer(historyDrawer, true));
    document.getElementById('close-history-btn')?.addEventListener('click', () => setDrawer(historyDrawer, false));
    document.getElementById('open-account-btn')?.addEventListener('click', () => setDrawer(accountDrawer, true));
    document.getElementById('close-account-btn')?.addEventListener('click', () => setDrawer(accountDrawer, false));

    document.querySelectorAll('.drawer-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        setDrawer(stylesDrawer, false);
        setDrawer(historyDrawer, false);
        setDrawer(accountDrawer, false);
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
        setDrawer(accountDrawer, false);
        setCustomDiePopover(false);
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
    initAccount();
    initThemeCommunity();

    setStatus('Loading 3D physics…');
    await initDicePhysics(getSkinColor(state.dieSkin, state.customAppearance?.diceColor));
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
