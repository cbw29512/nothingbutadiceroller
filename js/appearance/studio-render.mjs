import { CANONICAL_DICE, RAW_FACE_MODE, SYSTEM_DEFAULT_DICE_SET_ID } from './defaults.mjs';
import { getSupportedFaceEditorDice } from './face-layouts.mjs';
import { getVisualFace } from './face-customization.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';
import { renderFaceMap } from './studio-face-map.mjs';

const LEGACY_ICONS = { skull: '☠', star: '★', flame: '🔥', shield: '◆', heart: '♥', sword: '⚔' };
const FACE_EDITOR_DICE = new Set(getSupportedFaceEditorDice());
function q(id) { return document.getElementById(id); }
function visualText(face) { return face.kind === 'icon' ? (LEGACY_ICONS[face.value] || String(face.value || '◆')) : String(face.value); }
function makeSetCard(set, selectedId, onSelect, subtitle) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `studio-set-card${set.id === selectedId ? ' active' : ''}`;
  button.innerHTML = '<strong></strong><span></span>';
  button.querySelector('strong').textContent = set.name;
  button.querySelector('span').textContent = subtitle;
  button.addEventListener('click', () => onSelect(set));
  return button;
}

export function renderLibrary(sets, selectedId, onSelect) {
  const host = q('studio-library');
  if (!host) return;
  host.replaceChildren(...sets.map((set) => makeSetCard(
    set, selectedId, onSelect,
    set.systemOwned ? 'Immutable Default' : `${set.locked ? 'Locked' : 'Editable'} • ${set.visibility}`,
  )));
}
export function renderCommunity(sets, selectedId, onSelect) {
  const host = q('community-library');
  if (!host) return;
  if (!sets.length) {
    const empty = document.createElement('p'); empty.className = 'studio-note';
    empty.textContent = 'No public locked dice sets yet.'; host.replaceChildren(empty); return;
  }
  host.replaceChildren(...sets.map((set) => makeSetCard(set, selectedId, onSelect, 'Public • Locked • Read only')));
}
export function renderPreview(set, selectedDie) {
  const plan = buildAppearanceRenderPlan(set);
  const tray = q('studio-preview-tray');
  tray.style.background = plan.tray.color;
  tray.style.boxShadow = plan.tray.glow.enabled ? `inset 0 0 70px #0008, 0 0 28px ${plan.tray.glow.color}` : 'inset 0 0 70px #0008';
  q('studio-preview-dice').replaceChildren(...Object.keys(CANONICAL_DICE).map((type) => {
    const die = document.createElement('button');
    const style = plan.dice[type].style;
    die.type = 'button'; die.className = `studio-preview-die${type === selectedDie ? ' active' : ''}`;
    if (FACE_EDITOR_DICE.has(type)) die.dataset.die = type;
    else { die.disabled = true; die.title = 'Percentile face editing needs a dedicated two-d10 editor.'; }
    die.style.background = style.bodyColor; die.style.color = style.faceColor; die.style.opacity = String(style.opacity);
    die.style.boxShadow = style.glow.enabled ? `0 0 18px ${style.glow.color}` : 'none';
    const face = getVisualFace(set, type, type === 'd100' ? 100 : CANONICAL_DICE[type]);
    die.innerHTML = `<span></span><small>${type}</small>`; die.querySelector('span').textContent = visualText(face);
    return die;
  }));
}

export function fillEditor(set, selectedDie, activeId, ownerId, cloudEnabled) {
  const system = set.id === SYSTEM_DEFAULT_DICE_SET_ID;
  const owner = !system && set.ownerId === ownerId;
  const locked = set.locked;
  const style = set.appearance.diceSet.defaultStyle;
  const die = set.appearance.diceSet.dice[selectedDie];
  const dieStyle = buildAppearanceRenderPlan(set).dice[selectedDie].style;
  const hasDieOverride = Object.keys(die.styleOverrides || {}).length > 0;
  const logicalFace = q('logical-face');
  const maxFace = CANONICAL_DICE[selectedDie];
  const dieChanged = q('face-map').dataset.die && q('face-map').dataset.die !== selectedDie;
  let selectedFace = Number(logicalFace.value);
  if (dieChanged || !Number.isInteger(selectedFace) || selectedFace < 1 || selectedFace > maxFace) selectedFace = maxFace;
  q('set-name').value = set.name; q('dice-body-color').value = style.bodyColor; q('dice-face-color').value = style.faceColor;
  q('dice-glow-enabled').checked = style.glow.enabled; q('dice-glow-color').value = style.glow.color;
  q('die-style-enabled').checked = hasDieOverride; q('die-body-color').value = dieStyle.bodyColor; q('die-face-color').value = dieStyle.faceColor;
  q('die-glow-enabled').checked = dieStyle.glow.enabled; q('die-glow-color').value = dieStyle.glow.color;
  q('tray-color').value = set.appearance.tray.color; q('tray-glow-enabled').checked = set.appearance.tray.glow.enabled; q('tray-glow-color').value = set.appearance.tray.glow.color;
  q('face-mode').value = die.faceMode; q('selected-die-label').textContent = selectedDie.toUpperCase(); q('active-badge').textContent = set.id === activeId ? 'ACTIVE' : '';
  document.querySelectorAll('[data-edit-control]').forEach((el) => { el.disabled = system || locked || !owner; });
  if (!system && !locked && owner && !hasDieOverride) document.querySelectorAll('[data-die-style-control]').forEach((el) => { el.disabled = true; });
  q('save-set').disabled = system || locked || !owner; q('delete-set').disabled = system || !owner; q('lock-set').disabled = system || !owner;
  q('lock-set').textContent = locked ? 'Unlock Set' : 'Lock Set'; q('publish-set').disabled = system || !owner || !locked || !cloudEnabled;
  q('publish-set').textContent = set.visibility === 'public' ? 'Make Private' : 'Publish Set';

  const selectFace = (faceNumber) => {
    selectedFace = faceNumber; logicalFace.value = String(faceNumber);
    const face = getVisualFace(set, selectedDie, faceNumber);
    q('logical-face-label').textContent = `Face ${faceNumber}`; q('logical-result-label').textContent = `Always rolls ${faceNumber}`;
    q('face-value').value = visualText(face); q('custom-face-color').value = face.color || dieStyle.faceColor;
    const disabled = system || locked || !owner || die.faceMode === RAW_FACE_MODE;
    document.querySelectorAll('[data-face-edit-control]').forEach((el) => { el.disabled = disabled; });
    renderFaceMap(set, selectedDie, faceNumber, selectFace);
  };
  selectFace(selectedFace);
}
export function setStatus(message, kind = '') {
  const el = q('studio-status'); if (!el) return; el.textContent = message; el.dataset.kind = kind;
}
