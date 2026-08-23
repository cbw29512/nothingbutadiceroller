import { CANONICAL_DICE, SYSTEM_DEFAULT_DICE_SET_ID } from './defaults.mjs';
import { getCanonicalFaceLabel, getCanonicalFaceResults } from './face-values.mjs';
import { getSupportedFaceEditorDice } from './face-layouts.mjs';
import { getVisualFace } from './face-customization.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';
import { renderFaceMap } from './studio-face-map.mjs';
import { fillStudioPatternControls } from './studio-pattern-controls.mjs';
import { fillStudioResinControls } from './studio-resin-controls.mjs';
import { fillStudioSurfaceControls } from './studio-surface-controls.mjs';
import { buildSurfacePreviewBackground, buildSurfacePreviewShadow } from './surface-preview.mjs';
import { safeTrayImageUrl } from './tray-image.mjs';

const LEGACY_ICONS = { skull: '☠', star: '★', flame: '🔥', shield: '◆', heart: '♥', sword: '⚔' };
const FACE_EDITOR_DICE = new Set(getSupportedFaceEditorDice());
function q(id) { return document.getElementById(id); }
function visualText(face) { return face.kind === 'icon' ? (LEGACY_ICONS[face.value] || String(face.value || '◆')) : String(face.value); }
function numberGlowShadow(glow) {
  if (!glow?.enabled) return 'none';
  const intensity = Number.isFinite(glow.intensity) ? Math.max(0, Math.min(1, glow.intensity)) : 0;
  const blur = Math.round(5 + (13 * intensity));
  return `0 0 ${blur}px ${glow.color}, 0 0 ${Math.max(2, Math.round(blur / 2))}px ${glow.color}`;
}
function makeSetCard(set, selectedId, onSelect, subtitle) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = `studio-set-card${set.id === selectedId ? ' active' : ''}`;
  button.innerHTML = '<strong></strong><span></span>';
  button.querySelector('strong').textContent = set.name; button.querySelector('span').textContent = subtitle;
  button.addEventListener('click', () => onSelect(set)); return button;
}
export function renderStorageMode(cloudEnabled, importableCount = 0) {
  try {
    const status = q('storage-mode'); const button = q('import-browser-sets');
    if (!status || !button) return;
    button.hidden = !cloudEnabled || importableCount === 0;
    button.textContent = `Import ${importableCount} Browser Set${importableCount === 1 ? '' : 's'}`;
    status.textContent = cloudEnabled
      ? (importableCount ? `Signed in • ${importableCount} browser set${importableCount === 1 ? '' : 's'} ready to import` : 'Signed in • sets sync to your account')
      : 'Guest • sets stay in this browser';
  } catch (error) {
    console.error('Failed to render Dice Studio storage mode:', error);
  }
}
export function renderLibrary(sets, selectedId, onSelect) {
  const host = q('studio-library'); if (!host) return;
  host.replaceChildren(...sets.map((set) => makeSetCard(set, selectedId, onSelect, set.systemOwned ? 'Immutable Default' : `${set.locked ? 'Locked' : 'Editable'} • ${set.visibility}`)));
}
export function renderCommunity(sets, selectedId, onSelect) {
  const host = q('community-library'); if (!host) return;
  if (!sets.length) { const empty = document.createElement('p'); empty.className = 'studio-note'; empty.textContent = 'No public locked dice sets yet.'; host.replaceChildren(empty); return; }
  host.replaceChildren(...sets.map((set) => makeSetCard(set, selectedId, onSelect, 'Public • Locked • Read only')));
}
export function renderPreview(set, selectedDie) {
  const plan = buildAppearanceRenderPlan(set);
  const tray = q('studio-preview-tray');
  const image = safeTrayImageUrl(plan.tray.image);
  tray.style.background = image
    ? `linear-gradient(rgba(2,6,23,.34),rgba(2,6,23,.34)),url("${image}") center/cover no-repeat,${plan.tray.color}`
    : plan.tray.color;
  tray.style.boxShadow = plan.tray.glow.enabled ? `inset 0 0 70px #0008, 0 0 28px ${plan.tray.glow.color}` : 'inset 0 0 70px #0008';
  q('studio-preview-dice').replaceChildren(...Object.keys(CANONICAL_DICE).map((type) => {
    const die = document.createElement('button'); const style = plan.dice[type].style;
    die.type = 'button'; die.className = `studio-preview-die${type === selectedDie ? ' active' : ''}`;
    if (FACE_EDITOR_DICE.has(type)) die.dataset.die = type;
    die.dataset.clearResin = style.translucency?.enabled ? 'true' : 'false';
    die.dataset.interiorEffect = style.interior?.enabled ? style.interior.type : 'none';
    die.dataset.surfaceFinish = style.finish?.type || 'standard';
    die.dataset.surfacePattern = style.pattern?.type || 'none';
    die.style.background = buildSurfacePreviewBackground(style);
    die.style.color = style.faceColor;
    die.style.opacity = style.translucency?.enabled ? '1' : String(style.opacity);
    die.style.boxShadow = buildSurfacePreviewShadow(style);
    const results = getCanonicalFaceResults(type); const previewResult = type === 'd100' ? 0 : results.at(-1);
    const face = getVisualFace(set, type, previewResult);
    die.innerHTML = `<span></span><small>${type}</small>`;
    const faceText = die.querySelector('span');
    faceText.textContent = visualText(face); faceText.style.textShadow = numberGlowShadow(style.glow);
    if (FACE_EDITOR_DICE.has(type)) {
      faceText.dataset.previewFace = String(previewResult);
      faceText.title = `Edit face ${getCanonicalFaceLabel(type, previewResult)}`;
    }
    return die;
  }));
}
export function fillEditor(set, selectedDie, activeId, ownerId, cloudEnabled) {
  const system = set.id === SYSTEM_DEFAULT_DICE_SET_ID; const owner = !system && set.ownerId === ownerId; const locked = set.locked;
  const editable = !system && !locked && owner;
  const style = set.appearance.diceSet.defaultStyle; const die = set.appearance.diceSet.dice[selectedDie];
  const dieStyle = buildAppearanceRenderPlan(set).dice[selectedDie].style; const hasDieOverride = Object.keys(die.styleOverrides || {}).length > 0;
  const logicalFace = q('logical-face'); const results = getCanonicalFaceResults(selectedDie);
  const dieChanged = q('face-map').dataset.die && q('face-map').dataset.die !== selectedDie;
  let selectedFace = Number(logicalFace.value); if (dieChanged || !results.includes(selectedFace)) selectedFace = selectedDie === 'd100' ? 0 : results.at(-1);
  q('set-name').value = set.name; q('dice-body-color').value = style.bodyColor; q('dice-face-color').value = style.faceColor;
  q('dice-glow-enabled').checked = style.glow.enabled; q('dice-glow-color').value = style.glow.color;
  q('die-style-enabled').checked = hasDieOverride; q('die-body-color').value = dieStyle.bodyColor; q('die-face-color').value = dieStyle.faceColor;
  q('die-glow-enabled').checked = dieStyle.glow.enabled; q('die-glow-color').value = dieStyle.glow.color;
  q('tray-color').value = set.appearance.tray.color; q('tray-glow-enabled').checked = set.appearance.tray.glow.enabled; q('tray-glow-color').value = set.appearance.tray.glow.color;
  q('face-mode').value = die.faceMode; q('selected-die-label').textContent = selectedDie.toUpperCase(); q('active-badge').textContent = set.id === activeId ? 'ACTIVE' : '';
  document.querySelectorAll('[data-edit-control]').forEach((el) => { el.disabled = !editable; });
  if (editable && !hasDieOverride) document.querySelectorAll('[data-die-style-control]').forEach((el) => { el.disabled = true; });
  fillStudioResinControls({ q, set, selectedDie, editable });
  fillStudioSurfaceControls({ q, set, selectedDie, editable });
  fillStudioPatternControls({ q, set, selectedDie, editable });
  q('remove-tray-image').disabled = !editable || !set.appearance.tray.image;
  q('save-set').disabled = !editable; q('delete-set').disabled = system || !owner; q('lock-set').disabled = system || !owner;
  q('lock-set').textContent = locked ? 'Unlock Set' : 'Lock Set'; q('publish-set').disabled = system || !owner || !locked || !cloudEnabled;
  q('publish-set').textContent = set.visibility === 'public' ? 'Make Private' : 'Publish Set';
  const selectFace = (faceNumber) => {
    selectedFace = faceNumber; logicalFace.value = String(faceNumber); const faceLabel = getCanonicalFaceLabel(selectedDie, faceNumber);
    const face = getVisualFace(set, selectedDie, faceNumber);
    q('logical-face-label').textContent = `Face ${faceLabel}`; q('logical-result-label').textContent = `Always reports ${faceNumber}`;
    q('face-value').value = visualText(face); q('custom-face-color').value = face.color || dieStyle.faceColor;
    document.querySelectorAll('[data-face-edit-control]').forEach((el) => { el.disabled = !editable; }); renderFaceMap(set, selectedDie, faceNumber, selectFace);
  };
  selectFace(selectedFace);
}
export function setStatus(message, kind = '') { const el = q('studio-status'); if (!el) return; el.textContent = message; el.dataset.kind = kind; }
