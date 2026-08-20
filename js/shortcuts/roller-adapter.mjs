import { applyCriticals, findCriticalTriggerInstanceIds } from './crit.mjs';
import { groupResolvedResults } from './results.mjs';
import { deepFreeze } from './schema.mjs';

function assertRollPlan(plan) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.groups)) {
    throw new Error('A compiled shortcut roll plan is required.');
  }
  return plan;
}

function normalizeSides(rawSides) {
  if (typeof rawSides === 'number') return rawSides;
  return Number(String(rawSides ?? '').toLowerCase().replace(/^d/, '').replace('%', '100'));
}

function valueOfRoll(roll) {
  const value = Number(roll?.value ?? roll?.result);
  return Number.isFinite(value) ? value : null;
}

function normalizeGroupedResult(group) {
  const rolls = Array.isArray(group?.rolls) ? group.rolls : [];
  const sides = normalizeSides(group?.sides ?? rolls[0]?.sides);
  return {
    sides,
    values: rolls.map(valueOfRoll).filter(Number.isFinite),
  };
}

function groupFlatResultsById(results) {
  const grouped = new Map();
  for (const die of results) {
    const groupId = die?.groupId;
    if (groupId === undefined || groupId === null) return null;
    if (!grouped.has(groupId)) grouped.set(groupId, []);
    grouped.get(groupId).push(die);
  }
  return [...grouped.values()].map((rolls) => ({
    sides: normalizeSides(rolls[0]?.sides),
    values: rolls.map(valueOfRoll).filter(Number.isFinite),
  }));
}

function consumeFlatResults(request, results) {
  const groups = [];
  let cursor = 0;
  for (const assignment of request.assignments) {
    const values = [];
    for (let index = 0; index < assignment.count; index += 1) {
      const die = results[cursor];
      if (!die) throw new Error(`Missing physical result for ${assignment.requestId}.`);
      const sides = normalizeSides(die.sides);
      const value = valueOfRoll(die);
      if (sides !== assignment.sides) {
        throw new Error(`Physical result mismatch for ${assignment.requestId}: expected d${assignment.sides}, received d${sides}.`);
      }
      if (!Number.isInteger(value) || value < 1 || value > assignment.sides) {
        throw new Error(`Invalid d${assignment.sides} result for ${assignment.requestId}.`);
      }
      values.push(value);
      cursor += 1;
    }
    groups.push({ sides: assignment.sides, values });
  }
  if (cursor !== results.length) throw new Error('Physical roller returned unexpected extra dice.');
  return groups;
}

function normalizePhysicalGroups(request, rawResults) {
  if (!Array.isArray(rawResults)) throw new Error('Physical roller results must be an array.');
  if (rawResults.some((item) => Array.isArray(item?.rolls))) {
    return rawResults.map(normalizeGroupedResult);
  }
  const byGroupId = groupFlatResultsById(rawResults);
  return byGroupId || consumeFlatResults(request, rawResults);
}

function validatePhysicalGroup(assignment, physicalGroup) {
  if (!physicalGroup) throw new Error(`Missing physical result group for ${assignment.requestId}.`);
  if (physicalGroup.sides !== assignment.sides) {
    throw new Error(`Physical result mismatch for ${assignment.requestId}: expected d${assignment.sides}, received d${physicalGroup.sides}.`);
  }
  if (physicalGroup.values.length !== assignment.count) {
    throw new Error(`Physical result count mismatch for ${assignment.requestId}: expected ${assignment.count}d${assignment.sides}, received ${physicalGroup.values.length}.`);
  }
  for (const value of physicalGroup.values) {
    if (!Number.isInteger(value) || value < 1 || value > assignment.sides) {
      throw new Error(`Invalid d${assignment.sides} result for ${assignment.requestId}.`);
    }
  }
}

function buildRequestFromTerms(entries, phase) {
  const notation = [];
  const assignments = [];
  for (const entry of entries) {
    if (!Number.isInteger(entry.count) || entry.count < 1) continue;
    const requestId = `${phase}:${assignments.length + 1}`;
    notation.push({ qty: entry.count, sides: entry.sides });
    assignments.push({
      requestId,
      phase,
      instanceId: entry.instanceId,
      termIndex: entry.termIndex,
      count: entry.count,
      sides: entry.sides,
    });
  }
  return deepFreeze({ phase, notation, assignments });
}

function planTerms(plan) {
  const entries = [];
  for (const group of plan.groups) {
    for (const instance of group.instances) {
      instance.terms.forEach((term, termIndex) => {
        entries.push({
          instanceId: instance.id,
          termIndex,
          count: term.count,
          sides: term.sides,
        });
      });
    }
  }
  return entries;
}

export function buildShortcutPhysicsRequest(plan) {
  assertRollPlan(plan);
  return buildRequestFromTerms(planTerms(plan), 'base');
}

export function mapShortcutPhysicsResults(request, rawResults) {
  if (!request || !Array.isArray(request.assignments) || !Array.isArray(request.notation)) {
    throw new Error('A shortcut physics request is required to map results.');
  }
  const physicalGroups = normalizePhysicalGroups(request, rawResults);
  if (physicalGroups.length !== request.assignments.length) {
    throw new Error(`Physical roller returned ${physicalGroups.length} result groups for ${request.assignments.length} requested groups.`);
  }

  const instances = new Map();
  request.assignments.forEach((assignment, index) => {
    const physical = physicalGroups[index];
    validatePhysicalGroup(assignment, physical);
    if (!instances.has(assignment.instanceId)) {
      instances.set(assignment.instanceId, { instanceId: assignment.instanceId, dice: [] });
    }
    instances.get(assignment.instanceId).dice.push({
      sides: assignment.sides,
      values: [...physical.values],
    });
  });
  return deepFreeze([...instances.values()]);
}

function expandedTermDelta(basePlan, expandedPlan) {
  const baseInstances = new Map();
  for (const group of basePlan.groups) {
    for (const instance of group.instances) baseInstances.set(instance.id, instance);
  }

  const entries = [];
  for (const group of expandedPlan.groups) {
    for (const instance of group.instances) {
      const base = baseInstances.get(instance.id);
      if (!base) throw new Error(`Critical plan introduced unknown instance ${instance.id}.`);
      instance.terms.forEach((term, termIndex) => {
        const baseTerm = base.terms[termIndex];
        if (!baseTerm || baseTerm.sides !== term.sides) {
          throw new Error(`Critical plan changed die structure for ${instance.id}.`);
        }
        const extraCount = term.count - baseTerm.count;
        if (extraCount < 0) throw new Error(`Critical plan removed dice from ${instance.id}.`);
        if (extraCount > 0) {
          entries.push({ instanceId: instance.id, termIndex, count: extraCount, sides: term.sides });
        }
      });
    }
  }
  return entries;
}

export function buildShortcutCriticalRequest(plan, initialResolvedInstances) {
  assertRollPlan(plan);
  const triggerInstanceIds = [...findCriticalTriggerInstanceIds(plan, initialResolvedInstances)];
  if (!triggerInstanceIds.length) {
    return deepFreeze({
      triggerInstanceIds: [],
      expandedPlan: plan,
      request: buildRequestFromTerms([], 'critical'),
    });
  }
  const expandedPlan = applyCriticals(plan, initialResolvedInstances);
  const request = buildRequestFromTerms(expandedTermDelta(plan, expandedPlan), 'critical');
  return deepFreeze({ triggerInstanceIds, expandedPlan, request });
}

export function mergeShortcutResolvedInstances(initialResolvedInstances, criticalResolvedInstances = []) {
  const merged = new Map();
  for (const result of initialResolvedInstances || []) {
    merged.set(result.instanceId, {
      instanceId: result.instanceId,
      dice: (result.dice || []).map((die) => ({ sides: die.sides, values: [...die.values] })),
    });
  }
  for (const result of criticalResolvedInstances || []) {
    if (!merged.has(result.instanceId)) {
      throw new Error(`Critical result referenced unknown instance ${result.instanceId}.`);
    }
    const target = merged.get(result.instanceId);
    for (const die of result.dice || []) {
      const existing = target.dice.find((candidate) => candidate.sides === die.sides);
      if (existing) existing.values.push(...die.values);
      else target.dice.push({ sides: die.sides, values: [...die.values] });
    }
  }
  return deepFreeze([...merged.values()]);
}

export function summarizeShortcutGroupedResult(grouped) {
  return deepFreeze({
    ...structuredClone(grouped),
    attackTotal: grouped.totalsByKind.attack || 0,
    damageTotal: grouped.totalsByKind.damage || 0,
    healingTotal: grouped.totalsByKind.healing || 0,
  });
}

export async function executeShortcutRoll(plan, rollPhysicalDice) {
  assertRollPlan(plan);
  if (typeof rollPhysicalDice !== 'function') throw new Error('A physical dice executor is required.');

  const initialRequest = buildShortcutPhysicsRequest(plan);
  if (!initialRequest.notation.length) throw new Error('Shortcut produced no physical dice.');
  const initialRaw = await rollPhysicalDice(initialRequest.notation, { phase: 'base', request: initialRequest });
  const initialResolved = mapShortcutPhysicsResults(initialRequest, initialRaw);

  const critical = buildShortcutCriticalRequest(plan, initialResolved);
  let criticalResolved = [];
  if (critical.request.notation.length) {
    const criticalRaw = await rollPhysicalDice(critical.request.notation, { phase: 'critical', request: critical.request });
    criticalResolved = mapShortcutPhysicsResults(critical.request, criticalRaw);
  }

  const resolvedInstances = mergeShortcutResolvedInstances(initialResolved, criticalResolved);
  const grouped = groupResolvedResults(critical.expandedPlan, resolvedInstances);
  const result = summarizeShortcutGroupedResult(grouped);

  return deepFreeze({
    initialRequest,
    criticalRequest: critical.request,
    criticalTriggerInstanceIds: critical.triggerInstanceIds,
    resolvedInstances,
    result,
  });
}
