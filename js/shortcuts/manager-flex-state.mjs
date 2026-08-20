import {
  BUILTIN_ICON_IDS, ROLLER_DIE_SIDES, SHORTCUT_CATEGORIES, SHORTCUT_SCHEMA_VERSION,
} from './constants.mjs';
import { normalizeShortcutSlots } from './persistence.mjs';
import { createFlexShortcut } from './schema.mjs';
import { assertPhysicalDiceBudget } from './dice-budget.mjs';
import { slugifyShortcutId, uniqueShortcutSlotId } from './manager-ids.mjs';

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
    id, label, kind, repeat,
    terms: [{ count, sides }],
    modifier,
    crit: { policy: 'none' },
  };
  if (kind === 'damage') {
    normalized.damageType = String(group.damageType || '').trim();
    if (!normalized.damageType) throw new Error(`${label}: damage type is required.`);
    if (group.critEligible) {
      const triggerGroupId = String(group.triggerGroupId || '');
      if (!attackIds.has(triggerGroupId)) {
        throw new Error(`${label}: choose the attack group that triggers its critical dice.`);
      }
      normalized.crit = { policy: 'double-dice', triggerGroupId };
    }
  }
  return normalized;
}

export function createFlexManagerSlot(shortcuts, { name, icon, category = 'custom', groups } = {}) {
  if (!Array.isArray(shortcuts) || shortcuts.length >= 24) throw new Error('Toolbar is full (24/24).');
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Give the Homebrew shortcut a name.');
  if (!BUILTIN_ICON_IDS.includes(icon)) throw new Error('Choose a supported shortcut icon.');
  if (!SHORTCUT_CATEGORIES.includes(category)) throw new Error('Choose a supported shortcut category.');
  if (!Array.isArray(groups) || groups.length < 1) throw new Error('Add at least one roll group.');

  const ids = groups.map((group, index) => slugifyShortcutId(group.id || `${group.kind}-${index + 1}`, `group-${index + 1}`));
  if (new Set(ids).size !== ids.length) throw new Error('Homebrew group labels must produce unique group ids.');
  const attackIds = new Set(groups.map((group, index) => ({ group, id: ids[index] }))
    .filter(({ group }) => group.kind === 'attack').map(({ id }) => id));
  const normalizedGroups = groups.map((group, index) => normalizeBuilderGroup({ ...group, id: ids[index] }, index, attackIds));
  assertPhysicalDiceBudget(normalizedGroups);
  const definitionId = slugifyShortcutId(cleanName, 'homebrew');
  const definition = createFlexShortcut({
    schemaVersion: SHORTCUT_SCHEMA_VERSION, source: 'flex', id: definitionId,
    name: cleanName, icon, category,
    variants: [{ id: 'base', label: 'Base', scaleRank: 0, groups: normalizedGroups }],
  });

  return normalizeShortcutSlots([{
    id: uniqueShortcutSlotId(shortcuts, `flex-${definitionId}`),
    source: 'flex', icon, baseVariantId: 'base', definition,
  }])[0];
}

