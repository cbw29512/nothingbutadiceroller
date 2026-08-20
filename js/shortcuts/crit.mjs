import { deepFreeze } from './schema.mjs';

function natural20(instance, resolved) {
  if (instance.kind !== 'attack' || !resolved) return false;
  const d20 = resolved.dice?.find((die) => die.sides === 20);
  return Array.isArray(d20?.values) && d20.values.some((value) => value === 20);
}

export function findCriticalTriggerInstanceIds(plan, resolvedInstances) {
  const resolvedById = new Map((resolvedInstances || []).map((result) => [result.instanceId, result]));
  const criticals = new Set();
  for (const group of plan.groups) {
    for (const instance of group.instances) {
      if (natural20(instance, resolvedById.get(instance.id))) criticals.add(instance.id);
    }
  }
  return criticals;
}

export function applyCriticals(plan, resolvedInstances) {
  const criticalTriggers = findCriticalTriggerInstanceIds(plan, resolvedInstances);
  const next = structuredClone(plan);

  for (const group of next.groups) {
    for (const instance of group.instances) {
      if (instance.crit.policy !== 'double-dice') continue;
      if (!criticalTriggers.has(instance.crit.triggerInstanceId)) continue;
      instance.terms = instance.terms.map((term) => ({ ...term, count: term.count * 2 }));
      instance.critical = true;
    }
  }
  return deepFreeze(next);
}
