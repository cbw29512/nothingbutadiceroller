import { CANONICAL_DICE } from './defaults.mjs';

function shortHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildRuntimeThemeIdentity(dieType, token) {
  try {
    const type = String(dieType || '').trim();
    const value = String(token || '').trim();
    if (!Object.hasOwn(CANONICAL_DICE, type)) throw new Error(`Unsupported runtime theme die type: ${dieType}`);
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Runtime theme token must be URL-path safe.');
    return `ndr_${type}_${shortHash(value)}`;
  } catch (error) {
    console.error('Failed to build runtime theme identity:', error);
    throw error;
  }
}
