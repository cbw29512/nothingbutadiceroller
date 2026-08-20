import { defineRawShortcut } from '../schema.mjs';
import { defineRawCatalogEntry } from './catalog.mjs';

const noCrit = () => ({ policy: 'none' });
const attackCrit = (triggerGroupId = 'attack') => ({ policy: 'double-dice', triggerGroupId });

export function damageGroup({ id = 'damage', label = 'Damage', damageType, count, sides, modifier = 0, repeat = 1, crit = false, triggerGroupId = 'attack' }) {
  return {
    id,
    label,
    kind: 'damage',
    damageType,
    repeat,
    terms: [{ count, sides }],
    modifier,
    crit: crit ? attackCrit(triggerGroupId) : noCrit(),
  };
}

export function attackGroup({ repeat = 1 }) {
  return {
    id: 'attack',
    label: 'Attack',
    kind: 'attack',
    repeat,
    terms: [{ count: 1, sides: 20 }],
    modifier: 0,
    crit: noCrit(),
  };
}

export function variant(id, label, scaleRank, groups) {
  return { id, label, scaleRank, groups };
}

export function makeRawSpell({
  ruleset,
  srdVersion,
  spellId,
  name,
  spellLevel,
  scalingMode,
  icon,
  sourceLocator,
  variants,
  requiresToHit = false,
}) {
  const shortcut = defineRawShortcut({
    schemaVersion: 1,
    source: 'raw',
    id: spellId,
    name,
    icon,
    category: 'spell',
    ruleset,
    sourceRef: `SRD ${srdVersion}: ${name}`,
    variants,
  });

  return defineRawCatalogEntry({
    catalogSchemaVersion: 1,
    ruleset,
    srdVersion,
    spellId,
    spellLevel,
    scalingMode,
    requiredInputs: requiresToHit ? ['toHit'] : [],
    sourceLocator,
    shortcut,
  });
}

export function cantripDamageVariants({ damageType, sides, crit = false, includeAttack = false }) {
  return [1, 2, 3, 4].map((count, index) => {
    const levelLabel = ['1–4', '5–10', '11–16', '17+'][index];
    const groups = [];
    if (includeAttack) groups.push(attackGroup({ repeat: 1 }));
    groups.push(damageGroup({ damageType, count, sides, crit }));
    return variant(`tier-${index + 1}`, `Levels ${levelLabel}`, index, groups);
  });
}

export function slotDamageVariants({ baseLevel, maxLevel = 9, damageType, baseCount, sides, perSlot = 1, modifier = 0 }) {
  const variants = [];
  for (let slot = baseLevel; slot <= maxLevel; slot += 1) {
    const count = baseCount + ((slot - baseLevel) * perSlot);
    variants.push(variant(`slot-${slot}`, `Level ${slot}`, slot, [
      damageGroup({ damageType, count, sides, modifier }),
    ]));
  }
  return variants;
}
