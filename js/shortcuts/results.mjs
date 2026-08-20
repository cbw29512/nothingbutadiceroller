function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function resolveInstance(instance, result) {
  if (!result) throw new Error(`Missing resolved result for ${instance.id}`);
  if (!Array.isArray(result.dice)) throw new Error(`Resolved result for ${instance.id} must include dice`);

  const expected = new Map();
  for (const term of instance.terms) expected.set(term.sides, (expected.get(term.sides) || 0) + term.count);
  const actual = new Map();
  for (const die of result.dice) {
    if (!Number.isInteger(die.sides) || !Array.isArray(die.values)) throw new Error(`Invalid resolved dice for ${instance.id}`);
    for (const value of die.values) {
      if (!Number.isInteger(value) || value < 1 || value > die.sides) throw new Error(`Invalid d${die.sides} result for ${instance.id}`);
    }
    actual.set(die.sides, (actual.get(die.sides) || 0) + die.values.length);
  }
  for (const [sides, count] of expected.entries()) {
    if (actual.get(sides) !== count) throw new Error(`Resolved dice count mismatch for ${instance.id} d${sides}`);
  }
  for (const sides of actual.keys()) {
    if (!expected.has(sides)) throw new Error(`Unexpected d${sides} result for ${instance.id}`);
  }

  const diceTotal = sum(result.dice.flatMap((die) => die.values));
  return {
    id: instance.id,
    repeatIndex: instance.repeatIndex,
    diceTotal,
    modifier: instance.modifier,
    total: diceTotal + instance.modifier,
    critical: Boolean(instance.critical),
  };
}

export function groupResolvedResults(plan, resolvedInstances) {
  const resultById = new Map((resolvedInstances || []).map((result) => [result.instanceId, result]));
  const totalsByKind = {};

  const groups = plan.groups.map((group) => {
    const instances = group.instances.map((instance) => resolveInstance(instance, resultById.get(instance.id)));
    const subtotal = sum(instances.map((instance) => instance.total));
    totalsByKind[group.kind] = (totalsByKind[group.kind] || 0) + subtotal;
    return {
      id: group.id,
      label: group.label,
      kind: group.kind,
      damageType: group.damageType,
      instances,
      subtotal,
    };
  });

  return {
    shortcutId: plan.shortcutId,
    variantId: plan.variant.id,
    groups,
    totalsByKind,
  };
}
