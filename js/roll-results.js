function normalizeSides(rawSides) {
  if (typeof rawSides === 'number') return rawSides;
  const normalized = String(rawSides ?? '')
    .toLowerCase()
    .replace(/^d/, '')
    .replace('%', '100');
  return Number(normalized);
}

function normalizeGroups(results) {
  try {
    if (!Array.isArray(results)) return [];
    if (results.some(item => Array.isArray(item?.rolls))) return results;

    const grouped = new Map();
    results.forEach((die, index) => {
      const groupId = die?.groupId ?? index;
      if (!grouped.has(groupId)) {
        grouped.set(groupId, { sides: die?.sides, rolls: [] });
      }
      grouped.get(groupId).rolls.push(die);
    });
    return [...grouped.values()];
  } catch (error) {
    console.error('Failed to normalize DiceBox result structure:', error);
    return [];
  }
}

export function parseRollResults(results, rollMode = 'normal') {
  try {
    let total = 0;
    const parts = [];
    const keptD20s = [];

    normalizeGroups(results).forEach(group => {
      const rolls = Array.isArray(group?.rolls) ? group.rolls : [];
      const values = rolls
        .map(roll => Number(roll?.value ?? roll?.result))
        .filter(Number.isFinite);
      const sides = normalizeSides(group?.sides ?? rolls[0]?.sides);
      if (!values.length) return;

      if (sides === 20 && rollMode !== 'normal' && values.length >= 2) {
        const kept = rollMode === 'advantage'
          ? Math.max(...values)
          : Math.min(...values);
        total += kept;
        keptD20s.push(kept);
        parts.push(`d20 = ${values.join(', ')} • ${rollMode === 'advantage' ? 'ADV' : 'DIS'} keeps ${kept}`);
        return;
      }

      values.forEach(value => {
        total += value;
        if (sides === 20) keptD20s.push(value);
      });
      parts.push(values.length === 1
        ? `d${sides} = ${values[0]}`
        : `${values.length}d${sides} = ${values.join(' + ')}`);
    });

    return {
      total,
      breakdown: parts.length
        ? `${parts.length === 1 ? 'Base roll: ' : 'Base rolls: '}${parts.join(' | ')}`
        : 'No roll result returned',
      keptD20s,
    };
  } catch (error) {
    console.error('Failed to parse DiceBox results:', error);
    return { total: 0, breakdown: 'Unable to parse roll results', keptD20s: [] };
  }
}

export function getCriticalOutcome(pool, rollMode, keptD20s) {
  try {
    if (!Array.isArray(pool) || !Array.isArray(keptD20s)) return null;
    const d20Count = pool.filter(die => die?.type === 'd20').length;
    const singleNormalD20 = rollMode === 'normal'
      && pool.length === 1
      && d20Count === 1;
    const singleAdvDisD20 = ['advantage', 'disadvantage'].includes(rollMode)
      && d20Count === 1;

    if ((!singleNormalD20 && !singleAdvDisD20) || keptD20s.length !== 1) {
      return null;
    }

    if (keptD20s[0] === 20) return 'nat20';
    if (keptD20s[0] === 1) return 'nat1';
    return null;
  } catch (error) {
    console.error('Failed to evaluate critical d20 outcome:', error);
    return null;
  }
}
