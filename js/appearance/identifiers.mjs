const DICE_SET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export function isValidDiceSetId(value) {
  try {
    return typeof value === 'string' && DICE_SET_ID_RE.test(value);
  } catch (error) {
    console.error('Dice-set id validation failed:', error);
    return false;
  }
}

export function normalizeDiceSetId(value, fallback = '') {
  try {
    const candidate = String(value ?? '').trim() || String(fallback || '').trim();
    if (!isValidDiceSetId(candidate)) {
      throw new Error('Dice set id must be 1-80 letters, numbers, underscores, or hyphens and start with a letter or number.');
    }
    return candidate;
  } catch (error) {
    console.error('Failed to normalize dice-set id:', error);
    throw error;
  }
}
