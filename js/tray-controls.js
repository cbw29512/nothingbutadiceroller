import { state } from './state.js';

export function canRollFromTray(snapshot = state) {
  return Boolean(
    snapshot?.physicsReady
      && !snapshot?.rolling
      && Array.isArray(snapshot?.selectedDice)
      && snapshot.selectedDice.length > 0,
  );
}

function moveTrayInfoOutOfRollingSurface() {
  const tray = document.getElementById('dice-tray');
  const badge = tray?.querySelector('.roll-trust-badge');
  const stylesDrawer = document.querySelector('#styles-drawer .drawer-content');

  if (badge && stylesDrawer) {
    badge.classList.remove('roll-trust-badge');
    badge.classList.add('results-copy');
    badge.hidden = false;
    stylesDrawer.appendChild(badge);
  }

  document.getElementById('tray-roll-hint')?.remove();
  tray?.removeAttribute('aria-describedby');
}

function syncTrayState() {
  const tray = document.getElementById('dice-tray');
  if (!tray) return;

  const ready = canRollFromTray();
  tray.classList.toggle('tray-roll-ready', ready);
  tray.setAttribute('aria-disabled', String(!ready));
}

export function initTrayControls(onRoll) {
  try {
    const tray = document.getElementById('dice-tray');
    if (!tray || typeof onRoll !== 'function') return;

    moveTrayInfoOutOfRollingSurface();

    const activate = () => {
      if (!canRollFromTray()) return;
      onRoll('normal');
    };

    tray.addEventListener('click', activate);
    tray.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key) || !canRollFromTray()) return;
      event.preventDefault();
      activate();
    });

    document.addEventListener('rollstatechange', syncTrayState);
    document.addEventListener('configurationloaded', syncTrayState);
    syncTrayState();
  } catch (error) {
    console.error('Failed to initialize tray roll controls:', error);
  }
}
