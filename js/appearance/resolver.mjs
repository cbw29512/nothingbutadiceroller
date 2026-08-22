import { SYSTEM_DEFAULT_DICE_SET } from './defaults.mjs';
import { canUseDiceSet } from './authorization.mjs';
import { validateDiceSet } from './validation.mjs';

export function resolveActiveDiceSet(activeId, diceSets = [], userId = null) {
  try {
    if (!activeId || activeId === SYSTEM_DEFAULT_DICE_SET.id) return SYSTEM_DEFAULT_DICE_SET;
    const candidate = Array.isArray(diceSets) ? diceSets.find((set) => set?.id === activeId) : null;
    if (!candidate || !validateDiceSet(candidate).ok || !canUseDiceSet(candidate, userId)) {
      return SYSTEM_DEFAULT_DICE_SET;
    }
    return candidate;
  } catch (error) {
    console.error('Failed to resolve active dice set; using system default:', error);
    return SYSTEM_DEFAULT_DICE_SET;
  }
}

export function resetToSystemDefault() {
  try {
    return SYSTEM_DEFAULT_DICE_SET;
  } catch (error) {
    console.error('Failed to reset dice set:', error);
    return SYSTEM_DEFAULT_DICE_SET;
  }
}
