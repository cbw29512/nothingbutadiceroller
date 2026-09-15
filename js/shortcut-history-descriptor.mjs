const MAX_SHORTCUT_PLAN_BYTES = 100_000;

function normalizeShortcutPlan(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!Array.isArray(value.groups) || value.groups.length < 1) return null;
    const encoded = JSON.stringify(value);
    if (!encoded || encoded.length > MAX_SHORTCUT_PLAN_BYTES) return null;
    const cloned = JSON.parse(encoded);
    if (!cloned || !Array.isArray(cloned.groups)) return null;
    return Object.freeze(cloned);
  } catch (error) {
    console.error('Failed to normalize shortcut history plan:', error);
    return null;
  }
}

export function createShortcutHistoryReroll(plan) {
  try {
    const normalizedPlan = normalizeShortcutPlan(plan);
    if (!normalizedPlan) throw new Error('Shortcut history reroll requires a valid compiled plan.');
    return Object.freeze({ kind: 'shortcut', plan: normalizedPlan });
  } catch (error) {
    console.error('Failed to create shortcut history reroll:', error);
    throw error;
  }
}

export function normalizeShortcutHistoryReroll(value) {
  try {
    if (!value || value.kind !== 'shortcut') return null;
    const plan = normalizeShortcutPlan(value.plan);
    return plan ? Object.freeze({ kind: 'shortcut', plan }) : null;
  } catch (error) {
    console.error('Failed to normalize shortcut history reroll:', error);
    return null;
  }
}
