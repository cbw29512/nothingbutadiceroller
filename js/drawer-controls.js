import { state, savePreferences } from './state.js';
import { renderHistory } from './ui.js';

function getDrawers() {
  return [
    ['styles', document.getElementById('styles-drawer')],
    ['history', document.getElementById('history-drawer')],
    ['account', document.getElementById('account-drawer')],
  ];
}

function setDrawer(drawer, open) {
  try {
    if (!drawer) return;
    drawer.classList.toggle('hidden', !open);
    drawer.setAttribute('aria-hidden', String(!open));
  } catch (error) {
    console.error('Failed to update drawer state:', error);
  }
}

export function closeDrawers() {
  getDrawers().forEach(([, drawer]) => setDrawer(drawer, false));
}

export function initDrawerControls() {
  try {
    getDrawers().forEach(([name, drawer]) => {
      document.getElementById(`open-${name}-btn`)?.addEventListener('click', () => {
        if (name === 'styles') {
          window.location.assign('/customize.html');
          return;
        }
        setDrawer(drawer, true);
      });
      document.getElementById(`close-${name}-btn`)?.addEventListener('click', () => {
        setDrawer(drawer, false);
      });
    });

    document.querySelectorAll('.drawer-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', closeDrawers);
    });

    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
      state.history = [];
      savePreferences();
      renderHistory();
    });
  } catch (error) {
    console.error('Failed to initialize drawer controls:', error);
  }
}
