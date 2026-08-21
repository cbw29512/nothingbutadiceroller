import { SYSTEM_DEFAULT_DICE_SET, SYSTEM_DEFAULT_DICE_SET_ID } from './defaults.mjs';
import { assertValidDiceSet, validateDiceSet } from './validation.mjs';

export const LOCAL_SETS_KEY = 'ndr.appearance.savedSets.v2';
export const ACTIVE_SET_KEY = 'ndr.appearance.activeSet.v2';
export const ACTIVE_SNAPSHOT_KEY = 'ndr.appearance.activeSnapshot.v2';
export const LOCAL_OWNER_KEY = 'ndr.appearance.localOwner.v2';

function browserStorageError(error) {
  return error?.name === 'QuotaExceededError'
    ? new Error('Browser storage is full. Delete a browser dice set or sign in to save this set to your account.')
    : error;
}
function parseArray(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse saved dice sets:', error);
    return [];
  }
}
function makeOwnerId() {
  try { return `local_${crypto.randomUUID()}`; }
  catch (error) {
    console.error('Failed to create local owner id:', error);
    return `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
export function getOrCreateLocalOwnerId(storage = localStorage) {
  try {
    const existing = String(storage.getItem(LOCAL_OWNER_KEY) || '').trim();
    if (existing) return existing;
    const ownerId = makeOwnerId();
    storage.setItem(LOCAL_OWNER_KEY, ownerId);
    return ownerId;
  } catch (error) {
    console.error('Failed to resolve local owner id:', error);
    return 'local_guest';
  }
}
export function loadSavedDiceSets(storage = localStorage, ownerId) {
  try {
    return parseArray(storage.getItem(LOCAL_SETS_KEY)).filter((set) => {
      if (!set || set.systemOwned || set.id === SYSTEM_DEFAULT_DICE_SET_ID) return false;
      if (ownerId && set.ownerId !== ownerId) return false;
      return validateDiceSet(set).ok;
    });
  } catch (error) {
    console.error('Failed to load saved dice sets:', error);
    return [];
  }
}
export function saveDiceSetLocal(set, storage = localStorage, ownerId) {
  try {
    assertValidDiceSet(set);
    if (set.systemOwned || set.id === SYSTEM_DEFAULT_DICE_SET_ID) throw new Error('System Default cannot be saved as a user set.');
    if (ownerId && set.ownerId !== ownerId) throw new Error('Cannot save another owner’s dice set.');
    const sets = loadSavedDiceSets(storage, ownerId);
    const index = sets.findIndex((item) => item.id === set.id);
    if (index >= 0) sets[index] = structuredClone(set);
    else sets.push(structuredClone(set));
    storage.setItem(LOCAL_SETS_KEY, JSON.stringify(sets));
    return structuredClone(set);
  } catch (error) {
    console.error('Failed to save dice set locally:', error);
    throw browserStorageError(error);
  }
}
export function deleteDiceSetLocal(setId, storage = localStorage, ownerId) {
  try {
    if (setId === SYSTEM_DEFAULT_DICE_SET_ID) throw new Error('System Default cannot be deleted.');
    const sets = loadSavedDiceSets(storage, ownerId).filter((set) => set.id !== setId);
    storage.setItem(LOCAL_SETS_KEY, JSON.stringify(sets));
    if (getActiveDiceSetId(storage) === setId) resetActiveToDefault(storage);
    return sets;
  } catch (error) {
    console.error('Failed to delete local dice set:', error);
    throw error;
  }
}
export function getActiveDiceSetId(storage = localStorage) {
  try { return String(storage.getItem(ACTIVE_SET_KEY) || SYSTEM_DEFAULT_DICE_SET_ID); }
  catch (error) {
    console.error('Failed to read active dice set:', error);
    return SYSTEM_DEFAULT_DICE_SET_ID;
  }
}
export function getActiveDiceSetSnapshot(storage = localStorage) {
  try {
    const raw = storage.getItem(ACTIVE_SNAPSHOT_KEY);
    if (!raw) return null;
    const set = JSON.parse(raw);
    if (set?.id !== getActiveDiceSetId(storage) || !validateDiceSet(set).ok) return null;
    return set;
  } catch (error) {
    console.error('Failed to read active dice-set snapshot:', error);
    return null;
  }
}
export function setActiveDiceSet(set, storage = localStorage) {
  assertValidDiceSet(set);
  if (set.id === SYSTEM_DEFAULT_DICE_SET_ID) return resetActiveToDefault(storage);
  const previousId = getActiveDiceSetId(storage);
  let previousSnapshot = null;
  try {
    previousSnapshot = storage.getItem(ACTIVE_SNAPSHOT_KEY);
    storage.setItem(ACTIVE_SNAPSHOT_KEY, JSON.stringify(set));
    storage.setItem(ACTIVE_SET_KEY, set.id);
    return set.id;
  } catch (error) {
    try {
      if (previousSnapshot == null) storage.removeItem(ACTIVE_SNAPSHOT_KEY);
      else storage.setItem(ACTIVE_SNAPSHOT_KEY, previousSnapshot);
      storage.setItem(ACTIVE_SET_KEY, previousId);
    } catch (rollbackError) {
      console.error('Failed to roll back active dice-set storage:', rollbackError);
    }
    console.error('Failed to activate dice set:', error);
    throw browserStorageError(error);
  }
}
export function setActiveDiceSetId(setId, storage = localStorage) {
  const id = String(setId || SYSTEM_DEFAULT_DICE_SET_ID);
  storage.setItem(ACTIVE_SET_KEY, id);
  if (id === SYSTEM_DEFAULT_DICE_SET_ID) storage.removeItem(ACTIVE_SNAPSHOT_KEY);
  return id;
}
export function resetActiveToDefault(storage = localStorage) {
  storage.setItem(ACTIVE_SET_KEY, SYSTEM_DEFAULT_DICE_SET.id);
  storage.removeItem(ACTIVE_SNAPSHOT_KEY);
  return SYSTEM_DEFAULT_DICE_SET.id;
}
