import { BUILTIN_ICON_IDS, MAX_SHORTCUTS } from './constants.mjs';
import { normalizeShortcutOptions, normalizeShortcutSlots } from './persistence.mjs';
import { uniqueShortcutSlotId } from './manager-ids.mjs';

function ensureCapacity(shortcuts) {
  if (!Array.isArray(shortcuts)) throw new Error('Shortcut list is required.');
  if (shortcuts.length >= MAX_SHORTCUTS) {
    throw new Error(`Toolbar is full (${MAX_SHORTCUTS}/${MAX_SHORTCUTS}).`);
  }
}

export function appendShortcutSlot(shortcuts, slot) {
  ensureCapacity(shortcuts);
  return normalizeShortcutSlots([...(shortcuts || []), slot]);
}

export function removeShortcutSlot(shortcuts, slotId) {
  return normalizeShortcutSlots((shortcuts || []).filter((slot) => slot.id !== slotId));
}

export function duplicateFlexShortcutSlot(shortcuts, slotId) {
  ensureCapacity(shortcuts);
  const source = normalizeShortcutSlots(shortcuts || []).find((slot) => slot.id === slotId);
  if (!source) throw new Error(`Unknown shortcut slot: ${slotId}`);
  if (source.source !== 'flex') throw new Error('Only custom shortcuts can be duplicated.');
  const definition = structuredClone(source.definition);
  definition.name = `${definition.name} Copy`.slice(0, 80);
  definition.id = uniqueShortcutSlotId([], definition.id).slice(0, 64);
  const copy = {
    ...structuredClone(source),
    id: uniqueShortcutSlotId(shortcuts, `flex-${definition.id}`),
    definition,
  };
  return normalizeShortcutSlots([...(shortcuts || []), copy]);
}

export function moveShortcutSlot(shortcuts, slotId, offset) {
  const normalized = [...normalizeShortcutSlots(shortcuts || [])];
  if (!Number.isInteger(offset) || offset === 0) return Object.freeze(normalized);
  const index = normalized.findIndex((slot) => slot.id === slotId);
  if (index < 0) throw new Error(`Unknown shortcut slot: ${slotId}`);
  const target = Math.max(0, Math.min(normalized.length - 1, index + offset));
  if (target === index) return Object.freeze(normalized);
  const [slot] = normalized.splice(index, 1);
  normalized.splice(target, 0, slot);
  return normalizeShortcutSlots(normalized);
}

export function createRawManagerSlot(shortcuts, entry, {
  variantId,
  icon = entry?.shortcut?.icon,
  toHit,
} = {}) {
  ensureCapacity(shortcuts);
  if (!entry?.spellId || !entry?.ruleset || !entry?.shortcut) {
    throw new Error('Verified RAW catalog entry is required.');
  }
  if (!BUILTIN_ICON_IDS.includes(icon)) throw new Error('Choose a supported shortcut icon.');
  const selectedVariant = variantId || entry.shortcut.variants[0]?.id;
  if (!entry.shortcut.variants.some((variant) => variant.id === selectedVariant)) {
    throw new Error('Choose a valid RAW scaling tier.');
  }

  const inputs = {};
  if (entry.requiredInputs.includes('toHit')) {
    const parsed = Number(toHit);
    if (!Number.isInteger(parsed) || parsed < -100 || parsed > 100) {
      throw new Error('To-hit modifier must be an integer from -100 to 100.');
    }
    inputs.toHit = parsed;
  }

  return normalizeShortcutSlots([{
    id: uniqueShortcutSlotId(shortcuts, `raw-${entry.ruleset.endsWith('2024') ? '24' : '14'}-${entry.spellId}`),
    source: 'raw', ruleset: entry.ruleset, spellId: entry.spellId,
    icon, baseVariantId: selectedVariant, inputs,
  }])[0];
}

export function updateManagerOptions(current, patch) {
  return normalizeShortcutOptions({ ...(current || {}), ...(patch || {}) });
}

