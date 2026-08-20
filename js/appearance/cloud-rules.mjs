import { SYSTEM_DEFAULT_DICE_SET_ID } from './defaults.mjs';
import { cloneDiceSet } from './schema.mjs';
import { assertValidDiceSet } from './validation.mjs';

export const MAX_CLOUD_SET_BYTES = 256 * 1024;

function designSignature(set) {
  return JSON.stringify({ name: set?.name, appearance: set?.appearance });
}

export function prepareCloudDiceSet(input, userId) {
  try {
    if (!input || typeof input !== 'object') throw new Error('Dice set payload is required.');
    if (!String(userId || '').trim()) throw new Error('Authenticated user id is required.');
    const set = cloneDiceSet(input);
    if (set.id === SYSTEM_DEFAULT_DICE_SET_ID || set.systemOwned) {
      throw new Error('System Default cannot be saved to a user account.');
    }
    set.ownerId = userId;
    set.systemOwned = false;
    assertValidDiceSet(set);
    const bytes = new TextEncoder().encode(JSON.stringify(set)).byteLength;
    if (bytes > MAX_CLOUD_SET_BYTES) throw new Error('Dice set exceeds the cloud storage limit.');
    return set;
  } catch (error) {
    console.error('Failed to prepare cloud dice set:', error);
    throw error;
  }
}

export function assertLockedUpdateAllowed(existing, incoming) {
  try {
    if (!existing?.locked) return incoming;
    if (designSignature(existing) !== designSignature(incoming)) {
      throw new Error('Unlock the dice set before changing its name or appearance.');
    }
    if (!incoming.locked && incoming.visibility !== 'private') {
      throw new Error('Unlocking a dice set must also make it private.');
    }
    return incoming;
  } catch (error) {
    console.error('Locked dice-set update rejected:', error);
    throw error;
  }
}

export function collectModerationText(set) {
  try {
    const values = [String(set?.name || '')];
    const dice = set?.appearance?.diceSet?.dice || {};
    Object.values(dice).forEach((die) => {
      Object.values(die?.faces || {}).forEach((face) => {
        if (face?.kind === 'text' || face?.kind === 'icon') values.push(String(face.value || ''));
      });
    });
    return values.join(' ');
  } catch (error) {
    console.error('Failed to collect dice-set moderation text:', error);
    return String(set?.name || '');
  }
}
