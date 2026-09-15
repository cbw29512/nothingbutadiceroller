const STANDARD_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);
const MAX_PHYSICAL_DICE = 40;
const MAX_GROUPS = 24;
const MAX_INSTANCES_PER_GROUP = 40;
const MAX_TERMS_PER_INSTANCE = 8;
const MAX_ABS_MODIFIER = 10_000;

function physicalCost(count, sides) {
  try {
    return count * (sides === 100 ? 2 : 1);
  } catch (error) {
    console.error('Failed to calculate compiled-plan physical cost:', error);
    throw error;
  }
}

function assertTerm(term) {
  try {
    const count = Number(term?.count);
    const sides = Number(term?.sides);
    if (!Number.isInteger(count) || count < 1 || count > MAX_PHYSICAL_DICE) {
      throw new Error('Compiled shortcut contains an invalid die count.');
    }
    if (!STANDARD_SIDES.has(sides)) {
      throw new Error(`Compiled shortcut contains unsupported d${sides} dice.`);
    }
    return { count, sides };
  } catch (error) {
    console.error('Compiled shortcut term validation failed:', error);
    throw error;
  }
}

function assertInstance(instance) {
  try {
    if (!instance || typeof instance !== 'object') throw new Error('Compiled shortcut instance is invalid.');
    if (!Array.isArray(instance.terms) || instance.terms.length < 1 || instance.terms.length > MAX_TERMS_PER_INSTANCE) {
      throw new Error('Compiled shortcut instance has an invalid term count.');
    }
    const modifier = Number(instance.modifier || 0);
    if (!Number.isInteger(modifier) || Math.abs(modifier) > MAX_ABS_MODIFIER) {
      throw new Error('Compiled shortcut contains an invalid static modifier.');
    }
    const terms = instance.terms.map(assertTerm);
    const baseCost = terms.reduce((sum, term) => sum + physicalCost(term.count, term.sides), 0);
    const criticalCost = instance.crit?.policy === 'double-dice' ? baseCost : 0;
    return { baseCost, criticalCost };
  } catch (error) {
    console.error('Compiled shortcut instance validation failed:', error);
    throw error;
  }
}

export function assertValidCompiledShortcutPlan(plan) {
  try {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
      throw new Error('A compiled shortcut plan is required.');
    }
    if (Number(plan.schemaVersion) !== 1) throw new Error('Unsupported compiled shortcut schema version.');
    if (typeof plan.name !== 'string' || !plan.name.trim()) throw new Error('Compiled shortcut name is missing.');
    if (!plan.variant || typeof plan.variant !== 'object') throw new Error('Compiled shortcut variant is missing.');
    if (!Array.isArray(plan.groups) || plan.groups.length < 1 || plan.groups.length > MAX_GROUPS) {
      throw new Error('Compiled shortcut has an invalid group count.');
    }

    let base = 0;
    let critical = 0;
    for (const group of plan.groups) {
      if (!Array.isArray(group?.instances) || group.instances.length < 1 || group.instances.length > MAX_INSTANCES_PER_GROUP) {
        throw new Error('Compiled shortcut group has an invalid instance count.');
      }
      for (const instance of group.instances) {
        const cost = assertInstance(instance);
        base += cost.baseCost;
        critical += cost.criticalCost;
      }
    }

    if (base < 1 || base + critical > MAX_PHYSICAL_DICE) {
      throw new Error(`Compiled shortcut may require ${base + critical} physical dice; the limit is ${MAX_PHYSICAL_DICE}.`);
    }
    return plan;
  } catch (error) {
    console.error('Compiled shortcut plan validation failed:', error);
    throw error;
  }
}
