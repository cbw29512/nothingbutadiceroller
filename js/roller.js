import { state, savePreferences } from './state.js';
import { playDiceSound, playNat20Fanfare, playNat1DoomSound } from './audio.js';
import { buildPhysicsNotation, countDice, getSkinColor } from './utils.js';
import { clearPhysics, rollPhysics } from './physics.js';
import { renderHistory, renderPool, renderResults, setStatus, showCrit } from './ui.js';

function emitRollState() {
  document.dispatchEvent(new Event('rollstatechange'));
}

function normalizeSides(rawSides) {
  if (typeof rawSides === 'number') return rawSides;
  const normalized = String(rawSides ?? '').toLowerCase().replace(/^d/, '').replace('%', '100');
  return Number(normalized);
}

function normalizeGroups(results) {
  try {
    if (!Array.isArray(results)) return [];
    if (results.some(item => Array.isArray(item?.rolls))) return results;

    const grouped = new Map();
    results.forEach((die, index) => {
      const groupId = die?.groupId ?? index;
      if (!grouped.has(groupId)) grouped.set(groupId, { sides: die?.sides, rolls: [] });
      grouped.get(groupId).rolls.push(die);
    });
    return [...grouped.values()];
  } catch (err) {
    console.error('Failed to normalize DiceBox result structure:', err);
    return [];
  }
}

function parseRollResults(results, rollMode) {
  try {
    let total = 0;
    const parts = [];
    const keptD20s = [];

    normalizeGroups(results).forEach(group => {
      const rolls = Array.isArray(group?.rolls) ? group.rolls : [];
      const values = rolls.map(roll => Number(roll?.value ?? roll?.result)).filter(Number.isFinite);
      const sides = normalizeSides(group?.sides ?? rolls[0]?.sides);
      if (!values.length) return;

      if (sides === 20 && rollMode !== 'normal' && values.length >= 2) {
        const kept = rollMode === 'advantage' ? Math.max(...values) : Math.min(...values);
        total += kept;
        keptD20s.push(kept);
        parts.push(`d20 = ${values.join(', ')} • ${rollMode === 'advantage' ? 'ADV' : 'DIS'} keeps ${kept}`);
        return;
      }

      values.forEach(value => {
        total += value;
        if (sides === 20) keptD20s.push(value);
      });
      parts.push(values.length === 1 ? `d${sides} = ${values[0]}` : `${values.length}d${sides} = ${values.join(' + ')}`);
    });

    const prefix = parts.length === 1 ? 'Base roll: ' : 'Base rolls: ';
    return {
      total,
      breakdown: parts.length ? `${prefix}${parts.join(' | ')}` : 'No roll result returned',
      keptD20s,
    };
  } catch (err) {
    console.error('Failed to parse DiceBox results:', err);
    return { total: 0, breakdown: 'Unable to parse roll results', keptD20s: [] };
  }
}

function formulaFor(pool, rollMode) {
  const formula = Object.entries(countDice(pool)).map(([type, count]) => `${count}${type}`).join(' + ');
  return rollMode === 'normal' ? formula : `${formula} (${rollMode})`;
}

export function addDie(type) {
  try {
    if (state.rolling) return;
    if (state.hasRolled && !state.keepDice) state.selectedDice = [];
    state.selectedDice.push({ type });
    state.hasRolled = false;
    renderPool();
  } catch (err) {
    console.error(`Failed to add ${type}:`, err);
  }
}

export async function clearPool() {
  try {
    if (state.rolling) return;
    state.selectedDice = [];
    state.hasRolled = false;
    state.d20Mode = 'normal';
    renderPool();
    renderResults();
    emitRollState();
    await clearPhysics();
  } catch (err) {
    console.error('Failed to clear dice pool:', err);
  }
}

export async function performRoll(requestedMode = 'normal') {
  if (state.rolling) return;

  const rollMode = ['advantage', 'disadvantage'].includes(requestedMode)
    ? requestedMode
    : 'normal';

  state.rolling = true;
  state.d20Mode = rollMode;
  emitRollState();

  try {
    if (!state.physicsReady) throw new Error('3D physics is not ready yet.');
    const { pool, notation } = buildPhysicsNotation(state.selectedDice, rollMode);
    if (!notation.length) {
      setStatus('Choose at least one die.', 'error');
      return;
    }

    setStatus(rollMode === 'normal' ? 'Rolling…' : `Rolling ${rollMode}…`);
    document.getElementById('tray-empty-state')?.classList.add('hidden');
    playDiceSound();

    const results = await rollPhysics(notation, getSkinColor(state.dieSkin));
    const parsed = parseRollResults(results, rollMode);
    state.hasRolled = true;
    renderResults(parsed.total, parsed.breakdown);

    state.history.unshift({
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      formula: formulaFor(pool, rollMode),
      breakdown: parsed.breakdown,
      total: String(parsed.total),
    });
    if (state.history.length > 30) state.history.length = 30;
    savePreferences();
    renderHistory();

    // Keep Pool means exactly that: when off, the next pool starts empty.
    if (!state.keepDice) {
      state.selectedDice = [];
      renderPool();
    }

    if (parsed.keptD20s.includes(20)) {
      showCrit('nat20');
      playNat20Fanfare();
    } else if (parsed.keptD20s.includes(1)) {
      showCrit('nat1');
      playNat1DoomSound();
    }
    setStatus(`Saved to history • ${state.history.length} roll${state.history.length === 1 ? '' : 's'}`, 'ready');
  } catch (err) {
    console.error('Roll execution failed:', err);
    setStatus(err.message || 'Roll failed.', 'error');
  } finally {
    state.rolling = false;
    state.d20Mode = 'normal';
    emitRollState();
  }
}
