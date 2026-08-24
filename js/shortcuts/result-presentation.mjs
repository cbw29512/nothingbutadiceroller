function hasResultKind(execution, kind) {
  return Array.isArray(execution?.result?.groups)
    && execution.result.groups.some((group) => group?.kind === kind);
}

function formatInstanceRoll(instance, resolved) {
  const values = (resolved?.dice || []).flatMap((die) => (
    die.values.map((value) => `d${die.sides} ${value}`)
  ));
  const rollText = values.join(' + ');
  const modifier = instance.modifier
    ? ` ${instance.modifier > 0 ? '+' : '−'} ${Math.abs(instance.modifier)}`
    : '';
  return `${rollText}${modifier} = ${instance.total}`;
}

export function formatShortcutResult(execution) {
  const resolvedById = new Map(
    (execution?.resolvedInstances || []).map((item) => [item.instanceId, item]),
  );
  const parts = [];
  for (const group of execution?.result?.groups || []) {
    group.instances.forEach((instance, index) => {
      const suffix = group.instances.length > 1 ? ` ${index + 1}` : '';
      const damageType = group.damageType ? ` ${group.damageType.toUpperCase()}` : '';
      parts.push(
        `${group.label.toUpperCase()}${suffix}${damageType}: ${formatInstanceRoll(instance, resolvedById.get(instance.id))}`,
      );
    });
  }
  if (hasResultKind(execution, 'damage')) {
    parts.push(`TOTAL DAMAGE = ${execution.result.damageTotal}`);
  }
  if (hasResultKind(execution, 'healing')) {
    parts.push(`TOTAL HEALING = ${execution.result.healingTotal}`);
  }
  return parts.join(' | ');
}

export function shortcutDisplayTotal(execution) {
  if (hasResultKind(execution, 'damage')) return execution.result.damageTotal;
  if (hasResultKind(execution, 'healing')) return execution.result.healingTotal;
  return '—';
}

export function shortcutHistoryTotal(execution) {
  if (hasResultKind(execution, 'damage')) return `Damage ${execution.result.damageTotal}`;
  if (hasResultKind(execution, 'healing')) return `Healing ${execution.result.healingTotal}`;
  return 'Grouped';
}
