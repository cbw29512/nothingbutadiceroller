import { assertValidShortcut } from './validation.mjs';

function clonePlain(value) {
  return structuredClone(value);
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function defineRawShortcut(definition) {
  assertValidShortcut(definition, { expectedSource: 'raw' });
  return deepFreeze(clonePlain(definition));
}

export function createFlexShortcut(definition) {
  assertValidShortcut(definition, { expectedSource: 'flex' });
  return deepFreeze(clonePlain(definition));
}
