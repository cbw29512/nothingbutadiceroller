import { state, savePreferences } from './state.js';
import { renderHistory } from './ui.js';

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let activeDrawer = null;
let returnFocus = null;

function getDrawers() {
  return [
    ['styles', document.getElementById('styles-drawer')],
    ['history', document.getElementById('history-drawer')],
    ['account', document.getElementById('account-drawer')],
  ];
}

function setDrawerVisible(drawer, open) {
  if (!drawer) return;
  drawer.classList.toggle('hidden', !open);
  drawer.setAttribute('aria-hidden', String(!open));
}

function setBackgroundInert(openDrawer) {
  document.querySelectorAll('#app > *').forEach((element) => {
    element.inert = Boolean(openDrawer && element !== openDrawer);
  });
}

function focusableIn(drawer) {
  return [...(drawer?.querySelectorAll(FOCUSABLE) || [])].filter((element) => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  });
}

function focusDrawer(drawer) {
  queueMicrotask(() => {
    const preferred = drawer?.querySelector('.close-btn');
    (preferred || focusableIn(drawer)[0])?.focus();
  });
}

function openDrawer(drawer, opener) {
  if (!drawer) return;
  getDrawers().forEach(([, candidate]) => setDrawerVisible(candidate, candidate === drawer));
  activeDrawer = drawer;
  returnFocus = opener instanceof HTMLElement ? opener : document.activeElement;
  setBackgroundInert(drawer);
  focusDrawer(drawer);
}

export function closeDrawers() {
  const target = returnFocus;
  getDrawers().forEach(([, drawer]) => setDrawerVisible(drawer, false));
  activeDrawer = null;
  returnFocus = null;
  setBackgroundInert(null);
  queueMicrotask(() => {
    if (target instanceof HTMLElement && target.isConnected) target.focus();
  });
}

function trapDrawerFocus(event) {
  if (event.key !== 'Tab' || !activeDrawer) return;
  const focusable = focusableIn(activeDrawer);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  const current = document.activeElement;
  if (!activeDrawer.contains(current)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && current === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

export function initDrawerControls() {
  try {
    getDrawers().forEach(([name, drawer]) => {
      const opener = document.getElementById(`open-${name}-btn`);
      opener?.addEventListener('click', () => {
        if (name === 'styles') {
          window.location.assign('/customize.html');
          return;
        }
        openDrawer(drawer, opener);
      });
      document.getElementById(`close-${name}-btn`)?.addEventListener('click', closeDrawers);
    });

    document.querySelectorAll('.drawer-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', closeDrawers);
    });
    document.addEventListener('keydown', trapDrawerFocus);

    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
      state.history = [];
      savePreferences();
      renderHistory();
    });
  } catch (error) {
    console.error('Failed to initialize drawer controls:', error);
  }
}
