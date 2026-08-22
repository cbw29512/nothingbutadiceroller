import {
  canLockDiceSet,
  canPublishDiceSet,
  canUnlockDiceSet,
} from './authorization.mjs';
import { cloneDiceSet } from './schema.mjs';
import { assertValidDiceSet } from './validation.mjs';

function denied(message) {
  throw new Error(message);
}

export function lockDiceSet(set, userId) {
  try {
    if (!canLockDiceSet(set, userId)) denied('Only the owner can lock an unlocked user dice set.');
    const next = cloneDiceSet(set);
    next.locked = true;
    return assertValidDiceSet(next);
  } catch (error) {
    console.error('Failed to lock dice set:', error);
    throw error;
  }
}

export function unlockDiceSet(set, userId) {
  try {
    if (!canUnlockDiceSet(set, userId)) denied('Only the owner can unlock a locked user dice set.');
    const next = cloneDiceSet(set);
    next.locked = false;
    next.visibility = 'private';
    return assertValidDiceSet(next);
  } catch (error) {
    console.error('Failed to unlock dice set:', error);
    throw error;
  }
}

export function publishDiceSet(set, userId) {
  try {
    if (!canPublishDiceSet(set, userId)) denied('A dice set must be owner-controlled and locked before publishing.');
    const next = cloneDiceSet(set);
    next.visibility = 'public';
    return assertValidDiceSet(next);
  } catch (error) {
    console.error('Failed to publish dice set:', error);
    throw error;
  }
}

export function makeDiceSetPrivate(set, userId) {
  try {
    if (!set || set.systemOwned || set.ownerId !== userId) denied('Only the owner can make this dice set private.');
    const next = cloneDiceSet(set);
    next.visibility = 'private';
    return assertValidDiceSet(next);
  } catch (error) {
    console.error('Failed to make dice set private:', error);
    throw error;
  }
}
