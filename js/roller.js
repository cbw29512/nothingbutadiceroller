import { state, savePreferences } from './state.js';
import { playDiceSound, playNat20Fanfare, playNat1DoomSound } from './audio.js';
import { buildPhysicsNotation, countDice, getSkinColor } from './utils.js';
import { clearPhysics, rollPhysics } from './physics.js';
import { renderHistory, renderPool, renderResults, setStatus, showCrit } from './ui.js';

function normalizeSides(rawSides) {
  try {
    if (typeof rawSides === 'number') return rawSides;
    const normalized = String(rawSides ?? '').toLowerCase().replace(/^d/, '').replace('%', '100');
    return Number(normalized);
  } catch (err) {
    console.error('Failed to normalize die sides:', err);
    return 0;
  }
}

function readGroup(group) {
  try {
    const rolls = Array.isArray(group?.rolls) ? group.rolls : [];
    const values = rolls.map(roll => Number(roll?.value ?? roll?.result)).filter(Number.isFinite);
    const sides = normalizeSides(group?.sides ?? rolls[0]?.sides);
    return { sides, values };
  } catch (err) {
    console.error('Failed to read DiceBox result group:', err);
    return { sides: 0, values: [] };
  }
}

function parseRollResults(groups) {
  try {
    let total = 0;
    const parts = [];
    const keptD20s = [];

    groups.forEach(group => {
      const { sides, values } = readGroup(group);
      if (!values.length) return;

      if (sides === 20 && state.d20Mode !== 'normal' && values.length >= 2) {
        const kept = state.d20Mode === 'advantage' ? Math.max(...values) : Math.min(...values);
        total += kept;
        keptD20s.push(kept);
        parts.push(`d20 ${state.d20Mode}: [${values.join(', ')}] → ${kept}`);
        return;
      }

      values.forEach(value => {
        total += value;
        if (sides === 20) keptD20s.push(value);
      });
      parts.push(`${values.length}d${sides}: [${values.join(', ')}]`);
    });

    return { total, breakdown: parts.join(' | '), keptD20s };
  } catch (err) {
    console.error('Failed to parse DiceBox results:', err);
    return { total: 0, breakdown: 'Unable to parse roll results', keptD20s: [] };
  }
}

function formulaFor(pool) {
  try {
    const formula = Object.entries(countDice(pool)).map(([type, count]) => `${count}${type}`).join(' + ');
    return state.d20Mode === 'normal' ? formula : `${formula} (${state.d20Mode})`;
  } catch (err) {
    console.error('Failed to build history formula:', err);
    return 'Roll';
  }
}

export function addDie(type) {
  try {
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
    state.selectedDice = [];
    state.hasRolled = false;
    renderPool();
    renderResults();
    await clearPhysics();
  } catch (err) {
    console.error('Failed to clear dice pool:', err);
  }
}

export async function performRoll() {
  if (state.rolling) return;

  try {
    if (!state.physicsReady) throw new Error('3D physics is not ready yet.');
    const { pool, notation } = buildPhysicsNotation(state.selectedDice, state.d20Mode);
    if (!notation.length) {
      setStatus('Choose at least one die.', 'error');
      return;
    }

    state.rolling = true;
    setStatus('Rolling…');
    document.getElementById('tray-empty-state')?.classList.add('hidden');
    playDiceSound();

    const groups = await rollPhysics(notation, getSkinColor(state.dieSkin));
    const parsed = parseRollResults(Array.isArray(groups) ? groups : []);
    state.hasRolled = true;
    renderResults(parsed.total, parsed.breakdown || 'Roll complete');

    state.history.unshift({
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      formula: formulaFor(pool),
      breakdown: parsed.breakdown,
      total: String(parsed.total)
    });
    if (state.history.length > 30) state.history.length = 30;
    savePreferences();
    renderHistory();

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
  }
}
