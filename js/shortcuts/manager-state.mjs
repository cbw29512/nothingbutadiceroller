import {
  BUILTIN_ICON_IDS,
  MAX_SHORTCUTS,
  ROLLER_DIE_SIDES,
  SHORTCUT_CATEGORIES,
  SHORTCUT_SCHEMA_VERSION,
} from './constants.mjs';
import { createFlexShortcut } from './schema.mjs';
import { normalizeShortcutOptions, normalizeShortcutSlots } from './persistence.mjs';

const ID_RE = /[^a-z0-9]+/g;

export function slugifyShortcutId(value, fallback = 'shortcut') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(ID_RE, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

export function uniqueShortcutSlotId(shortcuts, baseId) {
  const base = slugifyShortcutId(baseId, 'shortcut');
  const used = new Set((shortcuts || []).map((slot) => slot.id));
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base.slice(0, 58)}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('Unable to generate a unique shortcut id.');
}

function ensureCapacity(shortcuts) {
  if (!Array.isArray(shortcuts)) throw new Error('Shortcut list is required.');
  if (shortcuts.length >= MAX_SHORTCUTS) throw new Error(`Toolbar is full (${MAX_SHORTCUTS}/${MAX_SHORTCUTS}).`);
}

export function appendShortcutSlot(shortcuts, slot) {
  ensureCapacity(shortcuts);
  return normalizeShortcutSlots([...(shortcuts || []), slot]);
}

export function removeShortcutSlot(shortcuts, slotId) {
  return normalizeShortcutSlots((shortcuts || []).filter((slot) => slot.id !== slotId));
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
  if (!entry?.spellId || !entry?.ruleset || !entry?.shortcut) throw new Error('Verified RAW catalog entry is required.');
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
    source: 'raw',
    ruleset: entry.ruleset,
    spellId: entry.spellId,
    icon,
    baseVariantId: selectedVariant,
    inputs,
  }])[0];
}

function normalizeBuilderGroup(group, index, attackIds) {
  const kind = group.kind;
  const label = String(group.label || '').trim() || `${kind || 'Group'} ${index + 1}`;
  const count = Number(group.count);
  const sides = Number(group.sides);
  const repeat = Number(group.repeat);
  const modifier = Number(group.modifier);

  if (!Number.isInteger(count) || count < 1) throw new Error(`${label}: dice count must be a positive integer.`);
  if (!ROLLER_DIE_SIDES.includes(sides)) throw new Error(`${label}: choose a supported die.`);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 24) throw new Error(`${label}: repeat must be 1-24.`);
  if (!Number.isInteger(modifier) || modifier < -1000 || modifier > 1000) throw new Error(`${label}: modifier must be -1000 to 1000.`);

  const id = slugifyShortcutId(group.id || `${kind}-${index + 1}`, `group-${index + 1}`);
  const normalized = {
    id,
    label,
    kind,
    repeat,
    terms: [{ count, sides }],
    modifier,
    crit: { policy: 'none' },
  };

  if (kind === 'damage') {
    normalized.damageType = String(group.damageType || '').trim();
    if (!normalized.damageType) throw new Error(`${label}: damage type is required.`);
    if (group.critEligible) {
      const triggerGroupId = String(group.triggerGroupId || '');
      if (!attackIds.has(triggerGroupId)) throw new Error(`${label}: choose the attack group that triggers its critical dice.`);
      normalized.crit = { policy: 'double-dice', triggerGroupId };
    }
  }
  return normalized;
}

export function createFlexManagerSlot(shortcuts, {
  name,
  icon,
  category = 'custom',
  groups,
} = {}) {
  ensureCapacity(shortcuts);
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Give the Homebrew shortcut a name.');
  if (!BUILTIN_ICON_IDS.includes(icon)) throw new Error('Choose a supported shortcut icon.');
  if (!SHORTCUT_CATEGORIES.includes(category)) throw new Error('Choose a supported shortcut category.');
  if (!Array.isArray(groups) || groups.length < 1) throw new Error('Add at least one roll group.');

  const provisionalIds = groups.map((group, index) => slugifyShortcutId(group.id || `${group.kind}-${index + 1}`, `group-${index + 1}`));
  if (new Set(provisionalIds).size !== provisionalIds.length) throw new Error('Homebrew group labels must produce unique group ids.');
  const attackIds = new Set(groups
    .map((group, index) => ({ group, id: provisionalIds[index] }))
    .filter(({ group }) => group.kind === 'attack')
    .map(({ id }) => id));

  const normalizedGroups = groups.map((group, index) => normalizeBuilderGroup({
    ...group,
    id: provisionalIds[index],
  }, index, attackIds));

  const definitionId = slugifyShortcutId(cleanName, 'homebrew');
  const definition = createFlexShortcut({
    schemaVersion: SHORTCUT_SCHEMA_VERSION,
    source: 'flex',
    id: definitionId,
    name: cleanName,
    icon,
    category,
    variants: [{
      id: 'base',
      label: 'Base',
      scaleRank: 0,
      groups: normalizedGroups,
    }],
  });

  return normalizeShortcutSlots([{
    id: uniqueShortcutSlotId(shortcuts, `flex-${definitionId}`),
    source: 'flex',
    icon,
    baseVariantId: 'base',
    definition,
  }])[0];
}

export function updateManagerOptions(current, patch) {
  return normalizeShortcutOptions({ ...(current || {}), ...(patch || {}) });
}
