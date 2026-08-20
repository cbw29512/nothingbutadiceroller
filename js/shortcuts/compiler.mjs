import { assertValidShortcut, getRollSignature } from './validation.mjs';
import { deepFreeze } from './schema.mjs';

function selectVariant(definition, variantId) {
  if (!variantId) return definition.variants[0];
  const variant = definition.variants.find((candidate) => candidate.id === variantId);
  if (!variant) throw new Error(`Unknown shortcut variant: ${variantId}`);
  return variant;
}

function expandGroup(group, groupsById) {
  const triggerGroup = group.crit.policy === 'double-dice' ? groupsById.get(group.crit.triggerGroupId) : null;
  return {
    id: group.id,
    label: group.label,
    kind: group.kind,
    damageType: group.damageType || null,
    instances: Array.from({ length: group.repeat }, (_, index) => ({
      id: `${group.id}:${index + 1}`,
      groupId: group.id,
      repeatIndex: index,
      kind: group.kind,
      damageType: group.damageType || null,
      terms: group.terms.map((term) => ({ count: term.count, sides: term.sides })),
      modifier: group.modifier,
      crit: {
        policy: group.crit.policy,
        triggerInstanceId: triggerGroup
          ? `${triggerGroup.id}:${triggerGroup.repeat === 1 ? 1 : index + 1}`
          : null,
      },
    })),
  };
}

export function compileShortcut(definition, { variantId } = {}) {
  assertValidShortcut(definition);
  const variant = selectVariant(definition, variantId);
  const groupsById = new Map(variant.groups.map((group) => [group.id, group]));
  const plan = {
    schemaVersion: 1,
    shortcutId: definition.id,
    source: definition.source,
    name: definition.name,
    category: definition.category,
    icon: definition.icon,
    variant: {
      id: variant.id,
      label: variant.label,
      scaleRank: variant.scaleRank,
    },
    groups: variant.groups.map((group) => expandGroup(group, groupsById)),
  };
  return deepFreeze(plan);
}

export function getNextRollChangingVariantId(definition, currentVariantId) {
  assertValidShortcut(definition);
  const index = definition.variants.findIndex((variant) => variant.id === currentVariantId);
  if (index < 0) throw new Error(`Unknown shortcut variant: ${currentVariantId}`);
  const currentSignature = getRollSignature(definition.variants[index]);
  for (let next = index + 1; next < definition.variants.length; next += 1) {
    if (getRollSignature(definition.variants[next]) !== currentSignature) return definition.variants[next].id;
  }
  return currentVariantId;
}
