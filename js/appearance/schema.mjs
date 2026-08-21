import {
  APPEARANCE_SCHEMA_VERSION,
  cloneSystemDefaultAppearance,
} from './defaults.mjs';
import { normalizeDiceSetId } from './identifiers.mjs';

function cleanOwnerId(value, fallback) {
  const cleaned = String(value || '').trim().slice(0, 120);
  return cleaned || fallback;
}

export function createUserDiceSet({ id, ownerId, name = 'Untitled Dice Set', appearance } = {}) {
  try {
    const cleanOwnerIdValue = cleanOwnerId(ownerId, '');
    if (!cleanOwnerIdValue) throw new Error('ownerId is required for a user dice set.');

    return {
      schemaVersion: APPEARANCE_SCHEMA_VERSION,
      id: normalizeDiceSetId(id, `set_${Date.now()}`),
      ownerId: cleanOwnerIdValue,
      name: String(name || 'Untitled Dice Set').trim().slice(0, 80) || 'Untitled Dice Set',
      systemOwned: false,
      locked: false,
      visibility: 'private',
      appearance: appearance ? structuredClone(appearance) : cloneSystemDefaultAppearance(),
    };
  } catch (error) {
    console.error('Failed to create user dice set:', error);
    throw error;
  }
}

export function cloneDiceSet(diceSet) {
  try {
    return structuredClone(diceSet);
  } catch (error) {
    console.error('Failed to clone dice set:', error);
    return JSON.parse(JSON.stringify(diceSet));
  }
}
