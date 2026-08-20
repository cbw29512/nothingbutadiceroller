import assert from 'node:assert/strict';
import { SYSTEM_DEFAULT_DICE_SET_ID } from '../js/appearance/defaults.mjs';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { lockDiceSet, publishDiceSet } from '../js/appearance/transitions.mjs';
import {
  deleteDiceSetLocal, getActiveDiceSetId, getActiveDiceSetSnapshot, loadSavedDiceSets,
  resetActiveToDefault, saveDiceSetLocal, setActiveDiceSet,
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

resetActiveToDefault(storage);
assert.equal(getActiveDiceSetId(storage), SYSTEM_DEFAULT_DICE_SET_ID);
assert.equal(getActiveDiceSetSnapshot(storage), null, 'Reset must clear active custom snapshot');
assert.equal(loadSavedDiceSets(storage, ownerId).length, 1, 'Reset must not delete saved sets');
deleteDiceSetLocal(set.id, storage, ownerId);
assert.equal(loadSavedDiceSets(storage, ownerId).length, 0);
assert.throws(() => deleteDiceSetLocal(SYSTEM_DEFAULT_DICE_SET_ID, storage, ownerId));
console.log('Studio persistence passed: save, active snapshots, community ownership, non-destructive reset, delete protection.');
