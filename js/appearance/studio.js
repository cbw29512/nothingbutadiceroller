import { SYSTEM_DEFAULT_DICE_SET, SYSTEM_DEFAULT_DICE_SET_ID } from './defaults.mjs';
import { canDeleteDiceSet, canEditDiceSet } from './authorization.mjs';
import { replaceVisualFace, removeVisualFace, useRawFaces } from './face-customization.mjs';
import { createUserDiceSet, cloneDiceSet } from './schema.mjs';
import { lockDiceSet, unlockDiceSet } from './transitions.mjs';
import { assertValidDiceSet } from './validation.mjs';
import {
  deleteDiceSetLocal, getActiveDiceSetId, getOrCreateLocalOwnerId,
  loadSavedDiceSets, resetActiveToDefault, saveDiceSetLocal, setActiveDiceSetId,
} from './studio-persistence.mjs';
import { fillEditor, renderLibrary, renderPreview, setStatus } from './studio-render.mjs';

const ownerId = getOrCreateLocalOwnerId();
let savedSets = loadSavedDiceSets(localStorage, ownerId);
let activeId = getActiveDiceSetId();
let selectedId = [SYSTEM_DEFAULT_DICE_SET, ...savedSets].some((set) => set.id === activeId) ? activeId : SYSTEM_DEFAULT_DICE_SET_ID;
let draft = cloneDiceSet(findSet(selectedId));
let selectedDie = 'd20';

function findSet(id) { return id === SYSTEM_DEFAULT_DICE_SET_ID ? SYSTEM_DEFAULT_DICE_SET : savedSets.find((set) => set.id === id); }
function library() { return [SYSTEM_DEFAULT_DICE_SET, ...savedSets]; }
function q(id) { return document.getElementById(id); }

function refresh() {
  renderLibrary(library(), selectedId, selectSet);
  renderPreview(draft, selectedDie);
  fillEditor(draft, selectedDie, activeId);
}

function selectSet(id) {
  const set = findSet(id);
  if (!set) return;
  selectedId = id;
  draft = cloneDiceSet(set);
  refresh();
}

function updateDraft(mutator) {
  if (!canEditDiceSet(draft, ownerId)) return;
  const next = cloneDiceSet(draft);
  mutator(next);
  draft = assertValidDiceSet(next);
  refresh();
}

function saveDraft() {
  try {
    if (!canEditDiceSet(draft, ownerId)) throw new Error('Unlock this set before editing it.');
    draft.name = q('set-name').value.trim() || 'Untitled Dice Set';
    assertValidDiceSet(draft);
    saveDiceSetLocal(draft, localStorage, ownerId);
    savedSets = loadSavedDiceSets(localStorage, ownerId);
    setStatus('Dice set saved.', 'ready');
    refresh();
  } catch (error) { setStatus(error.message, 'error'); }
}

function newSet() {
  const id = `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  draft = createUserDiceSet({ id, ownerId, name: 'New Dice Set' });
  selectedId = id;
  setStatus('New set ready. Customize it, then Save Dice Set.');
  refresh();
}

function toggleLock() {
  try {
    if (draft.systemOwned) return;
    draft = draft.locked ? unlockDiceSet(draft, ownerId) : lockDiceSet(draft, ownerId);
    saveDiceSetLocal(draft, localStorage, ownerId);
    savedSets = loadSavedDiceSets(localStorage, ownerId);
    setStatus(draft.locked ? 'Set locked.' : 'Set unlocked and private.', 'ready');
    refresh();
  } catch (error) { setStatus(error.message, 'error'); }
}

function applyFace() {
  try {
    const logicalFace = q('logical-face').value;
    if (q('face-mode').value === 'raw') draft = useRawFaces(draft, selectedDie);
    else {
      const kind = q('face-kind').value;
      const value = q('face-value').value.trim();
      draft = replaceVisualFace(draft, selectedDie, logicalFace, { kind, value, color: q('custom-face-color').value });
    }
    setStatus('Face appearance updated. Save the set to keep it.', 'ready');
    refresh();
  } catch (error) { setStatus(error.message, 'error'); }
}

function activateDraft() {
  try {
    const saved = draft.systemOwned || savedSets.some((set) => set.id === draft.id);
    if (!saved) throw new Error('Save this dice set before using it.');
    activeId = setActiveDiceSetId(draft.id);
    setStatus('Set marked active for the roller.', 'ready');
    refresh();
  } catch (error) { setStatus(error.message, 'error'); }
}

function bind() {
  q('new-set').addEventListener('click', newSet);
  q('save-set').addEventListener('click', saveDraft);
  q('lock-set').addEventListener('click', toggleLock);
  q('use-set').addEventListener('click', activateDraft);
  q('reset-default').addEventListener('click', () => { activeId = resetActiveToDefault(); selectSet(SYSTEM_DEFAULT_DICE_SET_ID); setStatus('Default Dice restored. Saved sets were not deleted.', 'ready'); });
  q('delete-set').addEventListener('click', () => {
    try {
      if (!canDeleteDiceSet(draft, ownerId)) throw new Error('This set cannot be deleted.');
      savedSets = deleteDiceSetLocal(draft.id, localStorage, ownerId); activeId = getActiveDiceSetId(); selectSet(activeId);
      setStatus('Dice set deleted.', 'ready');
    } catch (error) { setStatus(error.message, 'error'); }
  });
  document.addEventListener('click', (event) => { const type = event.target.closest('[data-die]')?.dataset.die; if (type) { selectedDie = type; refresh(); } });
  [['dice-body-color','bodyColor'],['dice-face-color','faceColor']].forEach(([id,key]) => q(id).addEventListener('input', () => updateDraft((set) => { set.appearance.diceSet.defaultStyle[key] = q(id).value; })));
  q('dice-glow-enabled').addEventListener('change', () => updateDraft((set) => { set.appearance.diceSet.defaultStyle.glow.enabled = q('dice-glow-enabled').checked; }));
  q('dice-glow-color').addEventListener('input', () => updateDraft((set) => { set.appearance.diceSet.defaultStyle.glow.color = q('dice-glow-color').value; set.appearance.diceSet.defaultStyle.glow.intensity = 0.75; }));
  q('tray-color').addEventListener('input', () => updateDraft((set) => { set.appearance.tray.color = q('tray-color').value; }));
  q('tray-glow-enabled').addEventListener('change', () => updateDraft((set) => { set.appearance.tray.glow.enabled = q('tray-glow-enabled').checked; }));
  q('tray-glow-color').addEventListener('input', () => updateDraft((set) => { set.appearance.tray.glow.color = q('tray-glow-color').value; set.appearance.tray.glow.intensity = 0.75; }));
  q('face-mode').addEventListener('change', () => { if (q('face-mode').value === 'raw') { draft = useRawFaces(draft, selectedDie); refresh(); } });
  q('apply-face').addEventListener('click', applyFace);
  q('remove-face').addEventListener('click', () => { try { draft = removeVisualFace(draft, selectedDie, q('logical-face').value); refresh(); } catch (error) { setStatus(error.message, 'error'); } });
}

try { bind(); refresh(); } catch (error) { console.error('Dice & Tray Studio failed to initialize:', error); setStatus('Studio failed to initialize.', 'error'); }
