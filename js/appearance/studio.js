import { SYSTEM_DEFAULT_DICE_SET, SYSTEM_DEFAULT_DICE_SET_ID } from './defaults.mjs';
import { canDeleteDiceSet, canEditDiceSet, canUseDiceSet } from './authorization.mjs';
import { createUserDiceSet, cloneDiceSet } from './schema.mjs';
import { lockDiceSet, makeDiceSetPrivate, publishDiceSet, unlockDiceSet } from './transitions.mjs';
import { assertValidDiceSet } from './validation.mjs';
import { createSecureId } from './secure-id.mjs';
import { deleteCloudDiceSet, loadCloudDiceSets, loadCommunityDiceSets, saveCloudDiceSet } from './studio-cloud.mjs';
import { getImportableBrowserSets, importBrowserSets } from './studio-browser-import.mjs';
import { createStudioDraftGuard } from './studio-draft-guard.mjs';
import { bindStudioControls } from './studio-bindings.mjs';
import {
  deleteDiceSetLocal, getActiveDiceSetId, getActiveDiceSetSnapshot, getOrCreateLocalOwnerId,
  loadSavedDiceSets, resetActiveToDefault, saveDiceSetLocal, setActiveDiceSet,
} from './studio-persistence.mjs';
import { fillEditor, renderCommunity, renderLibrary, renderPreview, renderStorageMode, setStatus } from './studio-render.mjs';
const browserOwnerId = getOrCreateLocalOwnerId();
const browserSavedSets = loadSavedDiceSets(localStorage, browserOwnerId);
let ownerId = browserOwnerId;
let cloudEnabled = false;
let cloudVersions = new Map();
let draftVersion = null;
let savedSets = [...browserSavedSets];
let importableBrowserSets = [];
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
  selectedId = set.id; draft = cloneDiceSet(set); draftVersion = cloudVersions.get(set.id) ?? null;
  draftGuard.markClean(); refresh(); return true;
}
function refresh() {
  renderLibrary([SYSTEM_DEFAULT_DICE_SET, ...savedSets], selectedId, selectSet);
  renderCommunity(communitySets, selectedId, selectSet); renderPreview(draft, selectedDie);
  fillEditor(draft, selectedDie, activeId, ownerId, cloudEnabled); renderStorageMode(cloudEnabled, importableBrowserSets.length);
}
function replaceSaved(set) {
  const index = savedSets.findIndex((item) => item.id === set.id);
  if (index >= 0) savedSets[index] = cloneDiceSet(set); else savedSets.unshift(cloneDiceSet(set));
}
function handleCloudConflict(error, { dirty = false } = {}) {
  if (error?.code !== 'dice-set-version-conflict') return false;
  if (error.record?.set) {
    replaceSaved(error.record.set);
    if (error.version) cloudVersions.set(error.record.set.id, error.version);
  } else {
    savedSets = savedSets.filter((set) => set.id !== draft.id);
    cloudVersions.delete(draft.id);
  }
  if (dirty) draftGuard.markDirty();
  setStatus('This dice set changed in another session. Your current draft is preserved; select the saved set again to reload the latest copy before retrying.', 'error');
  refresh();
  return true;
}
async function persist(set) {
  if (cloudEnabled) {
    const result = await saveCloudDiceSet(set, draftVersion);
    replaceSaved(result.set); cloudVersions.set(result.set.id, result.version); draftVersion = result.version;
    return result;
  }
  saveDiceSetLocal(set, localStorage, ownerId); savedSets = loadSavedDiceSets(localStorage, ownerId);
  return { set, version: null, warning: null };
}
async function saveImportedSet(set) {
  const result = await saveCloudDiceSet(set, null);
  replaceSaved(result.set); cloudVersions.set(result.set.id, result.version);
  return result.set;
}
function updateDraft(mutator) {
  if (!canEditDiceSet(draft, ownerId)) return;
  const next = cloneDiceSet(draft); mutator(next); draft = assertValidDiceSet(next); markDraftDirty(); refresh();
}
function requireCleanDraft(action) { if (draftGuard.isDirty()) throw new Error(`Save this dice set before ${action}.`); }
async function saveDraft() {
  try {
    if (!canEditDiceSet(draft, ownerId)) throw new Error('Unlock this set before editing it.');
    draft.name = q('set-name').value.trim() || 'Untitled Dice Set';
    const result = await persist(assertValidDiceSet(draft)); draft = result.set;
    if (activeId === draft.id) setActiveDiceSet(draft);
    draftGuard.markClean(); setStatus(result.warning || 'Dice set saved.', result.warning ? 'error' : 'ready'); refresh();
  } catch (error) { if (!handleCloudConflict(error, { dirty: true })) setStatus(error.message, 'error'); }
}
function newSet() {
  try {
    if (!confirmDiscardDraft()) return;
    const id = createSecureId('set');
    draft = createUserDiceSet({ id, ownerId, name: 'New Dice Set' }); selectedId = id; draftVersion = null; markDraftDirty();
    setStatus('New set ready. Customize it, then Save Dice Set.'); refresh();
  } catch (error) {
    console.error('Failed to create a new dice set:', error);
    setStatus('Unable to create a secure dice-set id. Reload and try again.', 'error');
  }
}
async function toggleLock() {
  try {
    requireCleanDraft('locking or unlocking it'); draft = draft.locked ? unlockDiceSet(draft, ownerId) : lockDiceSet(draft, ownerId);
    const result = await persist(draft); draft = result.set; draftGuard.markClean();
    setStatus(result.warning || (draft.locked ? 'Set locked.' : 'Set unlocked and private.'), result.warning ? 'error' : 'ready'); refresh();
  } catch (error) { if (!handleCloudConflict(error, { dirty: true })) setStatus(error.message, 'error'); }
}
async function togglePublish() {
  try {
    requireCleanDraft('changing its community visibility');
    if (!cloudEnabled) throw new Error('Sign in to publish community dice sets.');
    draft = draft.visibility === 'public' ? makeDiceSetPrivate(draft, ownerId) : publishDiceSet(draft, ownerId);
    const result = await persist(draft); draft = result.set; draftGuard.markClean(); communitySets = await loadCommunityDiceSets();
    const message = draft.visibility === 'public' ? 'Set published read-only to the community.' : 'Set is private.';
    setStatus(result.warning || message, result.warning ? 'error' : 'ready'); refresh();
  } catch (error) { if (!handleCloudConflict(error, { dirty: true })) setStatus(error.message, 'error'); }
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
    if (cloudEnabled) {
      await deleteCloudDiceSet(draft.id, draftVersion); savedSets = savedSets.filter((set) => set.id !== draft.id); cloudVersions.delete(draft.id);
    } else savedSets = deleteDiceSetLocal(draft.id, localStorage, ownerId);
    if (activeId === draft.id) activeId = resetActiveToDefault();
    draftGuard.markClean(); selectSet(SYSTEM_DEFAULT_DICE_SET, { force: true }); setStatus('Dice set deleted.', 'ready');
  } catch (error) { if (!handleCloudConflict(error)) setStatus(error.message, 'error'); }
}
async function importBrowserCollection() {
  const button = q('import-browser-sets');
  try {
    if (!cloudEnabled) throw new Error('Sign in before importing browser dice sets.');
    if (!importableBrowserSets.length) return setStatus('No browser dice sets need importing.', 'ready');
    if (button) button.disabled = true;
    const result = await importBrowserSets({ browserSets: browserSavedSets, cloudSets: savedSets, userId: ownerId, saveSet: saveImportedSet });
    savedSets = result.cloudSets; importableBrowserSets = result.pending;
    const selected = result.imported.find((item) => item.sourceId === selectedId);
    if (selected) { selectedId = selected.set.id; draft = cloneDiceSet(selected.set); draftVersion = cloudVersions.get(selected.set.id) ?? null; draftGuard.markClean(); }
    const active = result.imported.find((item) => item.sourceId === activeId); if (active) activeId = setActiveDiceSet(active.set);
    const failed = result.failures.length; setStatus(`${result.imported.length} browser set${result.imported.length === 1 ? '' : 's'} imported.${failed ? ` ${failed} failed and can be retried.` : ''}`, failed ? 'error' : 'ready'); refresh();
  } catch (error) { console.error('Failed to import browser dice sets:', error); setStatus(error.message, 'error'); }
  finally { if (button) button.disabled = false; }
}
async function reloadCommunity() { communitySets = await loadCommunityDiceSets(); refresh(); }
function resetDefault() {
  if (!confirmDiscardDraft()) return;
  activeId = resetActiveToDefault(); draftGuard.markClean(); selectSet(SYSTEM_DEFAULT_DICE_SET, { force: true });
  setStatus('Default Dice restored. Saved sets were not deleted.', 'ready');
}
function bind() {
  bindStudioControls({
    q, actions: { newSet, saveDraft, toggleLock, togglePublish, activateDraft, deleteDraft, importBrowserCollection, reloadCommunity, resetDefault },
    draft: { canEdit: () => canEditDiceSet(draft, ownerId), markDirty: markDraftDirty, update: updateDraft, get: () => draft, set: (next) => { draft = next; markDraftDirty(); } },
    dice: { get: () => selectedDie, select: (type) => { selectedDie = type; refresh(); } }, ownerId: () => ownerId,
    refresh, setStatus, draftGuard,
  });
}
async function initialize() {
  try {
    const [cloud, community] = await Promise.all([loadCloudDiceSets(), loadCommunityDiceSets()]); communitySets = community;
    if (cloud.authenticated && cloud.userId) {
      cloudEnabled = true; ownerId = cloud.userId; savedSets = cloud.sets; cloudVersions = new Map(Object.entries(cloud.versions || {}));
      importableBrowserSets = getImportableBrowserSets(browserSavedSets, savedSets);
    }
    const active = findSet(activeId) || getActiveDiceSetSnapshot() || SYSTEM_DEFAULT_DICE_SET;
    selectedId = active.id; draft = cloneDiceSet(active); draftVersion = cloudVersions.get(active.id) ?? null;
    draftGuard.markClean(); bind(); refresh(); setStatus('Dice Studio ready.', 'ready');
  } catch (error) {
    console.error('Dice Studio initialization failed:', error); setStatus('Studio failed to initialize.', 'error');
  }
}
initialize();