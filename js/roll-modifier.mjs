export const MIN_ROLL_MODIFIER = -999;
export const MAX_ROLL_MODIFIER = 999;

export function normalizeRollModifier(value, fallback = 0) {
  try {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) return Number(fallback) || 0;
    return Math.min(MAX_ROLL_MODIFIER, Math.max(MIN_ROLL_MODIFIER, numeric));
  } catch (error) {
    console.error('Failed to normalize roll modifier:', error);
    return Number(fallback) || 0;
  }
}

export function formatRollModifier(value) {
  try {
    const modifier = normalizeRollModifier(value);
    if (modifier === 0) return '';
    return modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
  } catch (error) {
    console.error('Failed to format roll modifier:', error);
    return '';
  }
}

export function formatModifierLabel(value) {
  try {
    const modifier = normalizeRollModifier(value);
    return modifier >= 0 ? `+${modifier}` : String(modifier);
  } catch (error) {
    console.error('Failed to format modifier label:', error);
    return '+0';
  }
}

export function applyRollModifier(total, value) {
  try {
    const base = Number(total);
    if (!Number.isFinite(base)) throw new Error('Roll total must be numeric.');
    return base + normalizeRollModifier(value);
  } catch (error) {
    console.error('Failed to apply roll modifier:', error);
    throw error;
  }
}

export function appendModifierBreakdown(breakdown, value) {
  try {
    const modifier = normalizeRollModifier(value);
    if (modifier === 0) return String(breakdown || '');
    return `${String(breakdown || '')} • Modifier ${formatModifierLabel(modifier)}`;
  } catch (error) {
    console.error('Failed to append modifier breakdown:', error);
    return String(breakdown || '');
  }
}
