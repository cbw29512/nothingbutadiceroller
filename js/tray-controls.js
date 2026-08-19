import { state } from './state.js';

export function canRollFromTray(snapshot = state) {
  return Boolean(
    snapshot?.physicsReady
      && !snapshot?.rolling
      && Array.isArray(snapshot?.selectedDice)
      && snapshot.selectedDice.length > 0,
  );
}

function syncTrayState() {
  const tray = document.getElementById('dice-tray');
  const hint = document.getElementById('tray-roll-hint');
  if (!tray || !hint) return;

  const ready = canRollFromTray();
  tray.classList.toggle('tray-roll-ready', ready);
  tray.setAttribute('aria-disabled', String(!ready));

  if (state.rolling) {
    hint.textContent = 'ROLLING…';
  } else if (!state.selectedDice.length) {
    hint.textContent = 'SELECT DICE • CLICK / TAP TRAY TO ROLL';
  } else if (!state.physicsReady) {
    hint.textContent = 'LOADING 3D PHYSICS…';
  } else {
    hint.textContent = 'CLICK / TAP TRAY TO ROLL • ENTER / SPACE';
  }
}

export function initTrayControls(onRoll) {
  try {
    const tray = document.getElementById('dice-tray');
    if (!tray || typeof onRoll !== 'function') return;

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
