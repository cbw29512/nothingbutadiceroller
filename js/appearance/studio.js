import { SYSTEM_DEFAULT_DICE_SET, SYSTEM_DEFAULT_DICE_SET_ID } from './defaults.mjs';
import { canDeleteDiceSet, canEditDiceSet, canUseDiceSet } from './authorization.mjs';
import { createUserDiceSet, cloneDiceSet } from './schema.mjs';
import { lockDiceSet, makeDiceSetPrivate, publishDiceSet, unlockDiceSet } from './transitions.mjs';
import { assertValidDiceSet } from './validation.mjs';
import { deleteCloudDiceSet, loadCloudDiceSets, loadCommunityDiceSets, saveCloudDiceSet } from './studio-cloud.mjs';
import { createStudioDraftGuard } from './studio-draft-guard.mjs';
import { bindStudioControls } from './studio-bindings.mjs';
import {
  deleteDiceSetLocal, getActiveDiceSetId, getActiveDiceSetSnapshot, getOrCreateLocalOwnerId,
  loadSavedDiceSets, resetActiveToDefault, saveDiceSetLocal, setActiveDiceSet,
} from './studio-persistence.mjs';
import { fillEditor, renderCommunity, renderLibrary, renderPreview, setStatus } from './studio-render.mjs';

let ownerId = getOrCreateLocalOwnerId();
let cloudEnabled = false;
let savedSets = loadSavedDiceSets(localStorage, ownerId);
let communitySets = [];
let activeId = getActiveDiceSetId();
let selectedId = SYSTEM_DEFAULT_DICE_SET_ID;
let draft = cloneDiceSet(SYSTEM_DEFAULT_DICE_SET);
let selectedDie = 'd20';
const draftGuard = createStudioDraftGuard();
const q = (id) => document.getElementById(id);

function findSet(id) {
  if (id === SYSTEM_DEFAULT_DICE_SET_ID) return SYSTEM_DEFAULT_DICE_SET;
  return savedSets.find((set) => set.id === id) || communitySets.find((set) => set.id === id) || null;
}
function draftIsPersisted(set = draft) { return set.systemOwned || savedSets.some((item) => item.id === set.id) || communitySets.some((item) => item.id === set.id); }
function markDraftDirty() { draftGuard.markDirty(); setStatus('Unsaved changes. Save Dice Set to keep them.', 'ready'); }
function confirmDiscardDraft() { return draftGuard.confirmDiscard(`Discard unsaved changes to “${draft.name}”?`); }
function selectSet(set, { force = false } = {}) {
  if (!set || (!force && !confirmDiscardDraft())) return false;
  selectedId = set.id; draft = cloneDiceSet(set); draftGuard.markClean(); refresh(); return true;
}
function refresh() {
  renderLibrary([SYSTEM_DEFAULT_DICE_SET, ...savedSets], selectedId, selectSet);
  renderCommunity(communitySets, selectedId, selectSet); renderPreview(draft, selectedDie);
  fillEditor(draft, selectedDie, activeId, ownerId, cloudEnabled);
}
function replaceSaved(set) {
  const index = savedSets.findIndex((item) => item.id === set.id);
  if (index >= 0) savedSets[index] = cloneDiceSet(set); else savedSets.unshift(cloneDiceSet(set));
}
async function persist(set) {
  if (cloudEnabled) { const saved = await saveCloudDiceSet(set); replaceSaved(saved); return saved; }
  saveDiceSetLocal(set, localStorage, ownerId); savedSets = loadSavedDiceSets(localStorage, ownerId); return set;
}
function updateDraft(mutator) {
  if (!canEditDiceSet(draft, ownerId)) return;
  const next = cloneDiceSet(draft); mutator(next); draft = assertValidDiceSet(next); markDraftDirty(); refresh();
}
function requireCleanDraft(action) { if (draftGuard.isDirty()) throw new Error(`Save this dice set before ${action}.`); }
async function saveDraft() {
  try {
    if (!canEditDiceSet(draft, ownerId)) throw new Error('Unlock this set before editing it.');
    draft.name = q('set-name').value.trim() || 'Untitled Dice Set'; draft = await persist(assertValidDiceSet(draft));
    if (activeId === draft.id) setActiveDiceSet(draft);
    draftGuard.markClean(); setStatus('Dice set saved.', 'ready'); refresh();
  } catch (error) { setStatus(error.message, 'error'); }
}
function newSet() {
  if (!confirmDiscardDraft()) return;
  const id = `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  draft = createUserDiceSet({ id, ownerId, name: 'New Dice Set' }); selectedId = id; markDraftDirty();
  setStatus('New set ready. Customize it, then Save Dice Set.'); refresh();
}
async function toggleLock() {
  try {
    requireCleanDraft('locking or unlocking it'); draft = draft.locked ? unlockDiceSet(draft, ownerId) : lockDiceSet(draft, ownerId);
    draft = await persist(draft); draftGuard.markClean();
    setStatus(draft.locked ? 'Set locked.' : 'Set unlocked and private.', 'ready'); refresh();
  } catch (error) { setStatus(error.message, 'error'); }
}
async function togglePublish() {
  try {
    requireCleanDraft('changing its community visibility');
    if (!cloudEnabled) throw new Error('Sign in to publish community dice sets.');
    draft = draft.visibility === 'public' ? makeDiceSetPrivate(draft, ownerId) : publishDiceSet(draft, ownerId);
    draft = await persist(draft); draftGuard.markClean(); communitySets = await loadCommunityDiceSets();
    setStatus(draft.visibility === 'public' ? 'Set published read-only to the community.' : 'Set is private.', 'ready'); refresh();
  } catch (error) { setStatus(error.message, 'error'); }
}
function activateDraft() {
  try {
    requireCleanDraft('using it on the roller');
    if (!draftIsPersisted()) throw new Error('Save this dice set before using it.');
    if (!canUseDiceSet(draft, ownerId)) throw new Error('This dice set is not available to use.');
    activeId = setActiveDiceSet(draft); setStatus('Set marked active for the roller.', 'ready'); refresh();
  } catch (error) { setStatus(error.message, 'error'); }
}
async function deleteDraft() {
  try {
    if (!canDeleteDiceSet(draft, ownerId)) throw new Error('This set cannot be deleted.');
    if (!draftIsPersisted()) {
      draftGuard.markClean(); selectSet(SYSTEM_DEFAULT_DICE_SET, { force: true }); setStatus('Unsaved dice set discarded.', 'ready'); return;
    }
    if (!draftGuard.confirmAction(`Delete “${draft.name}”? This cannot be undone.`)) return;
    if (cloudEnabled) { await deleteCloudDiceSet(draft.id); savedSets = savedSets.filter((set) => set.id !== draft.id); }
    else savedSets = deleteDiceSetLocal(draft.id, localStorage, ownerId);
    if (activeId === draft.id) activeId = resetActiveToDefault();
    draftGuard.markClean(); selectSet(SYSTEM_DEFAULT_DICE_SET, { force: true }); setStatus('Dice set deleted.', 'ready');
  } catch (error) { setStatus(error.message, 'error'); }
}
async function reloadCommunity() { communitySets = await loadCommunityDiceSets(); refresh(); }
function resetDefault() {
  if (!confirmDiscardDraft()) return;
  activeId = resetActiveToDefault(); draftGuard.markClean(); selectSet(SYSTEM_DEFAULT_DICE_SET, { force: true });
  setStatus('Default Dice restored. Saved sets were not deleted.', 'ready');
}
function bind() {
  bindStudioControls({
    q, actions: { newSet, saveDraft, toggleLock, togglePublish, activateDraft, deleteDraft, reloadCommunity, resetDefault },
    draft: { canEdit: () => canEditDiceSet(draft, ownerId), markDirty: markDraftDirty, update: updateDraft, get: () => draft, set: (next) => { draft = next; markDraftDirty(); } },
    dice: { get: () => selectedDie, select: (type) => { selectedDie = type; refresh(); } }, ownerId: () => ownerId,
    refresh, setStatus, draftGuard,
  });
}
async function initialize() {
  try {
    const [cloud, community] = await Promise.all([loadCloudDiceSets(), loadCommunityDiceSets()]); communitySets = community;
    if (cloud.authenticated && cloud.userId) {
      cloudEnabled = true; ownerId = cloud.userId; savedSets = cloud.sets; q('storage-mode').textContent = 'Signed in • sets sync to your account';
    } else q('storage-mode').textContent = 'Guest • sets stay in this browser';
    const active = findSet(activeId) || getActiveDiceSetSnapshot() || SYSTEM_DEFAULT_DICE_SET;
    selectedId = active.id; draft = cloneDiceSet(active); draftGuard.markClean(); bind(); refresh(); setStatus('Dice Studio ready.', 'ready');
  } catch (error) {
    console.error('Dice Studio initialization failed:', error); setStatus('Studio failed to initialize.', 'error');
  }
}
initialize();
