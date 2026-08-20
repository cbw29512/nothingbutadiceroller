import assert from 'node:assert/strict';
import { SYSTEM_DEFAULT_DICE_SET_ID } from '../js/appearance/defaults.mjs';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import {
  deleteDiceSetLocal, getActiveDiceSetId, loadSavedDiceSets,
  resetActiveToDefault, saveDiceSetLocal, setActiveDiceSetId,
} from '../js/appearance/studio-persistence.mjs';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const storage = memoryStorage();
const ownerId = 'owner_test';
const set = createUserDiceSet({ id: 'set_test', ownerId, name: 'Skull Dice' });
saveDiceSetLocal(set, storage, ownerId);
assert.equal(loadSavedDiceSets(storage, ownerId).length, 1);
setActiveDiceSetId(set.id, storage);
assert.equal(getActiveDiceSetId(storage), set.id);
resetActiveToDefault(storage);
assert.equal(getActiveDiceSetId(storage), SYSTEM_DEFAULT_DICE_SET_ID);
assert.equal(loadSavedDiceSets(storage, ownerId).length, 1, 'Reset must not delete saved sets');
deleteDiceSetLocal(set.id, storage, ownerId);
assert.equal(loadSavedDiceSets(storage, ownerId).length, 0);
assert.throws(() => deleteDiceSetLocal(SYSTEM_DEFAULT_DICE_SET_ID, storage, ownerId));
console.log('Studio persistence passed: save, recall, activate, non-destructive reset, delete protection.');
