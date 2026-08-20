export const MAX_SHORTCUT_PHYSICAL_DICE = 40;

export function physicalDieCost(sides) {
  return Number(sides) === 100 ? 2 : 1;
}

function groupDiceCount(group) {
  const repeat = Number(group?.repeat ?? 1);
  const terms = Array.isArray(group?.terms)
    ? group.terms
    : [{ count: group?.count, sides: group?.sides }];
  return terms.reduce((total, term) => (
    total + (Number(term.count) * physicalDieCost(term.sides) * repeat)
  ), 0);
}

export function variantPhysicalDiceBudget(groups) {
  let base = 0;
  let critical = 0;
  for (const group of groups || []) {
    const count = groupDiceCount(group);
    if (Number.isFinite(count)) base += count;
    const critEligible = group?.critEligible || group?.crit?.policy === 'double-dice';
    if (critEligible && Number.isFinite(count)) critical += count;
  }
  return { base, critical, maximum: base + critical };
}

export function assertPhysicalDiceBudget(groups) {
  const budget = variantPhysicalDiceBudget(groups);
  if (budget.maximum > MAX_SHORTCUT_PHYSICAL_DICE) {
    const criticalNote = budget.critical ? ' including possible critical dice' : '';
    throw new Error(`This shortcut needs up to ${budget.maximum} physical dice${criticalNote}. The limit is ${MAX_SHORTCUT_PHYSICAL_DICE}; each d100 counts as two dice.`);
  }
  return budget;
}

