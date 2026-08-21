import assert from 'node:assert/strict';
import { SYSTEM_DEFAULT_DICE_SET_ID } from '../js/appearance/defaults.mjs';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { lockDiceSet, publishDiceSet } from '../js/appearance/transitions.mjs';
import {
  ACTIVE_SET_KEY, ACTIVE_SNAPSHOT_KEY, deleteDiceSetLocal, getActiveDiceSetId, getActiveDiceSetSnapshot,
  loadSavedDiceSets, resetActiveToDefault, saveDiceSetLocal, setActiveDiceSet,
} from '../js/appearance/studio-persistence.mjs';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}
function failOnceStorage(base, failKey, error) {
  let failed = false;
  return {
    getItem: base.getItem, removeItem: base.removeItem,
    setItem(key, value) {
      if (!failed && key === failKey) { failed = true; throw error; }
      base.setItem(key, value);
    },
  };
}

const storage = memoryStorage();
const ownerId = 'owner_test';
const set = createUserDiceSet({ id: 'set_test', ownerId, name: 'Skull Dice' });
saveDiceSetLocal(set, storage, ownerId);
assert.equal(loadSavedDiceSets(storage, ownerId).length, 1);
setActiveDiceSet(set, storage);
assert.equal(getActiveDiceSetId(storage), set.id);
assert.equal(getActiveDiceSetSnapshot(storage)?.ownerId, ownerId);

const communityOwner = 'other_creator';
let community = createUserDiceSet({ id: 'community_set', ownerId: communityOwner, name: 'Community Skull Dice' });
community = lockDiceSet(community, communityOwner);
community = publishDiceSet(community, communityOwner);
setActiveDiceSet(community, storage);
assert.equal(getActiveDiceSetSnapshot(storage)?.ownerId, communityOwner, 'Using a public set must preserve original ownership');
assert.equal(loadSavedDiceSets(storage, ownerId).some((item) => item.id === community.id), false, 'Using a community set must not copy it into My Sets');

const atomicStorage = memoryStorage();
setActiveDiceSet(set, atomicStorage);
const alternate = createUserDiceSet({ id: 'set_alternate', ownerId, name: 'Alternate Dice' });
const quotaError = new Error('full'); quotaError.name = 'QuotaExceededError';
assert.throws(
  () => setActiveDiceSet(alternate, failOnceStorage(atomicStorage, ACTIVE_SNAPSHOT_KEY, quotaError)),
  /Browser storage is full/,
);
assert.equal(getActiveDiceSetId(atomicStorage), set.id, 'Snapshot quota failure must preserve the previous active id.');
assert.equal(getActiveDiceSetSnapshot(atomicStorage)?.id, set.id, 'Snapshot quota failure must preserve the previous snapshot.');
assert.throws(
  () => setActiveDiceSet(alternate, failOnceStorage(atomicStorage, ACTIVE_SET_KEY, new Error('active id write failed'))),
  /active id write failed/,
);
assert.equal(getActiveDiceSetId(atomicStorage), set.id, 'Active-id failure must roll the previous id back.');
assert.equal(getActiveDiceSetSnapshot(atomicStorage)?.id, set.id, 'Active-id failure must roll the previous snapshot back.');

resetActiveToDefault(storage);
assert.equal(getActiveDiceSetId(storage), SYSTEM_DEFAULT_DICE_SET_ID);
assert.equal(getActiveDiceSetSnapshot(storage), null, 'Reset must clear active custom snapshot');
assert.equal(loadSavedDiceSets(storage, ownerId).length, 1, 'Reset must not delete saved sets');
deleteDiceSetLocal(set.id, storage, ownerId);
assert.equal(loadSavedDiceSets(storage, ownerId).length, 0);
assert.throws(() => deleteDiceSetLocal(SYSTEM_DEFAULT_DICE_SET_ID, storage, ownerId));

const quotaStorage = memoryStorage();
quotaStorage.setItem = () => { const error = new Error('full'); error.name = 'QuotaExceededError'; throw error; };
assert.throws(
  () => saveDiceSetLocal(set, quotaStorage, ownerId),
  /Browser storage is full\. Delete a browser dice set or sign in to save this set to your account\./,
);
console.log('Studio persistence passed: save, atomic active snapshots, community ownership, non-destructive reset, delete protection, and clear browser-quota errors.');
