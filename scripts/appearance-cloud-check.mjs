import assert from 'node:assert/strict';
import { createUserDiceSet, cloneDiceSet } from '../js/appearance/schema.mjs';
import { SYSTEM_DEFAULT_DICE_SET } from '../js/appearance/defaults.mjs';
import {
  assertLockedUpdateAllowed,
  collectModerationText,
  prepareCloudDiceSet,
} from '../js/appearance/cloud-rules.mjs';

const base = createUserDiceSet({ id: 'set_cloud', ownerId: 'spoofed', name: 'Cloud Dice' });
const prepared = prepareCloudDiceSet(base, 'real-user');
assert.equal(prepared.ownerId, 'real-user');
assert.throws(() => prepareCloudDiceSet(SYSTEM_DEFAULT_DICE_SET, 'real-user'));

const locked = cloneDiceSet(prepared);
locked.locked = true;
const renamed = cloneDiceSet(locked);
renamed.name = 'Tampered';
assert.throws(() => assertLockedUpdateAllowed(locked, renamed));
const unlock = cloneDiceSet(locked);
unlock.locked = false;
unlock.visibility = 'private';
assert.doesNotThrow(() => assertLockedUpdateAllowed(locked, unlock));

const badPublic = cloneDiceSet(prepared);
badPublic.visibility = 'public';
assert.throws(() => prepareCloudDiceSet(badPublic, 'real-user'));
const textSet = cloneDiceSet(prepared);
textSet.appearance.diceSet.dice.d20.faceMode = 'custom';
textSet.appearance.diceSet.dice.d20.faces = { '20': { kind: 'text', value: 'BOOM', color: '#ffffff' } };
assert.match(collectModerationText(textSet), /BOOM/);
console.log('Cloud rules passed: ownership override, default protection, locked mutation guard, public lock requirement, moderation text.');
