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

function defaultCanRoll() {
  return canRollFromTray();
}

export function initTrayControls(onRoll, canRoll = defaultCanRoll) {
  try {
    const tray = document.getElementById('dice-tray');
    if (!tray || typeof onRoll !== 'function' || typeof canRoll !== 'function') return;

    moveTrayInfoOutOfRollingSurface();

    const syncTrayState = () => {
      const ready = Boolean(canRoll());
      tray.classList.toggle('tray-roll-ready', ready);
      tray.setAttribute('aria-disabled', String(!ready));
    };

    const activate = () => {
      if (!canRoll()) return;
      onRoll('normal');
    };

    tray.addEventListener('click', activate);
    tray.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key) || !canRoll()) return;
      event.preventDefault();
      activate();
    });

    document.addEventListener('rollstatechange', syncTrayState);
    document.addEventListener('shortcutstatechange', syncTrayState);
    document.addEventListener('configurationloaded', syncTrayState);
    syncTrayState();
  } catch (error) {
    console.error('Failed to initialize tray roll controls:', error);
  }
}
