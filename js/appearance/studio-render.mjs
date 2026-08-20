import { CANONICAL_DICE, SYSTEM_DEFAULT_DICE_SET_ID } from './defaults.mjs';
import { getVisualFace } from './face-customization.mjs';

const ICONS = { skull: '☠', star: '★', flame: '🔥', shield: '◆', heart: '♥', sword: '⚔' };

function q(id) { return document.getElementById(id); }
function visualText(face) {
  if (face.kind === 'icon') return ICONS[face.value] || '◆';
  return face.value;
}

export function renderLibrary(sets, selectedId, onSelect) {
  const host = q('studio-library');
  if (!host) return;
  host.replaceChildren();
  sets.forEach((set) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `studio-set-card${set.id === selectedId ? ' active' : ''}`;
    button.innerHTML = `<strong></strong><span></span>`;
    button.querySelector('strong').textContent = set.name;
    button.querySelector('span').textContent = set.systemOwned ? 'Immutable Default' : `${set.locked ? 'Locked' : 'Editable'} • ${set.visibility}`;
    button.addEventListener('click', () => onSelect(set.id));
    host.appendChild(button);
  });
}

export function renderPreview(set, selectedDie) {
  const tray = q('studio-preview-tray');
  const style = set.appearance.diceSet.defaultStyle;
  tray.style.background = set.appearance.tray.color;
  tray.style.boxShadow = set.appearance.tray.glow.enabled
    ? `inset 0 0 70px #0008, 0 0 28px ${set.appearance.tray.glow.color}`
    : 'inset 0 0 70px #0008';
  q('studio-preview-dice').replaceChildren(...Object.keys(CANONICAL_DICE).map((type) => {
    const die = document.createElement('button');
    die.type = 'button';
    die.className = `studio-preview-die${type === selectedDie ? ' active' : ''}`;
    die.dataset.die = type;
    die.style.background = style.bodyColor;
    die.style.color = style.faceColor;
    die.style.boxShadow = style.glow.enabled ? `0 0 18px ${style.glow.color}` : 'none';
    const face = getVisualFace(set, type, type === 'd100' ? 100 : CANONICAL_DICE[type]);
    die.innerHTML = `<span>${visualText(face)}</span><small>${type}</small>`;
    return die;
  }));
}

export function fillEditor(set, selectedDie, activeId) {
  const system = set.id === SYSTEM_DEFAULT_DICE_SET_ID;
  const locked = set.locked;
  const style = set.appearance.diceSet.defaultStyle;
  const die = set.appearance.diceSet.dice[selectedDie];
  q('set-name').value = set.name;
  q('dice-body-color').value = style.bodyColor;
  q('dice-face-color').value = style.faceColor;
  q('dice-glow-enabled').checked = style.glow.enabled;
  q('dice-glow-color').value = style.glow.color;
  q('tray-color').value = set.appearance.tray.color;
  q('tray-glow-enabled').checked = set.appearance.tray.glow.enabled;
  q('tray-glow-color').value = set.appearance.tray.glow.color;
  q('face-mode').value = die.faceMode;
  q('logical-face').max = String(CANONICAL_DICE[selectedDie]);
  q('selected-die-label').textContent = selectedDie.toUpperCase();
  q('active-badge').textContent = set.id === activeId ? 'ACTIVE' : '';
  document.querySelectorAll('[data-edit-control]').forEach((el) => { el.disabled = system || locked; });
  q('save-set').disabled = system || locked;
  q('delete-set').disabled = system;
  q('lock-set').disabled = system;
  q('lock-set').textContent = locked ? 'Unlock Set' : 'Lock Set';
}

export function setStatus(message, kind = '') {
  const el = q('studio-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
}
