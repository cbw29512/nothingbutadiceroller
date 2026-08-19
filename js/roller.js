import { state, savePreferences } from './state.js';
import { playDiceSound, playNat20Fanfare, playNat1DoomSound } from './audio.js';
import { buildPhysicsNotation, countDice, getSkinColor } from './utils.js';
import { clearPhysics, rollPhysics } from './physics.js';
import { getCriticalOutcome, parseRollResults } from './roll-results.js';
import { renderHistory, renderPool, renderResults, setStatus, showCrit } from './ui.js';

function emitRollState() {
  document.dispatchEvent(new Event('rollstatechange'));
}

function setPhysicsBadgeVisible(visible) {
  const badge = document.querySelector('.roll-trust-badge');
  if (badge) badge.hidden = !visible;
}

function formulaFor(pool, rollMode) {
  const formula = Object.entries(countDice(pool))
    .map(([type, count]) => `${count}${type}`)
    .join(' + ');
  return rollMode === 'normal' ? formula : `${formula} (${rollMode})`;
}

function playCriticalFeedback(kind) {
  if (kind === 'nat20') {
    showCrit('nat20');
    playNat20Fanfare();
  } else if (kind === 'nat1') {
    showCrit('nat1');
    playNat1DoomSound();
  }
}

export function addDie(type) {
  try {
    if (state.rolling) return;
    if (state.hasRolled && !state.keepDice) state.selectedDice = [];
    state.selectedDice.push({ type });
    state.hasRolled = false;
    renderPool();
  } catch (error) {
    console.error(`Failed to add ${type}:`, error);
  }
}

export async function clearPool() {
  try {
    if (state.rolling) return;
    state.selectedDice = [];
    state.hasRolled = false;
    state.d20Mode = 'normal';
    setPhysicsBadgeVisible(true);
    renderPool();
    renderResults();
    emitRollState();
    await clearPhysics();
  } catch (error) {
    console.error('Failed to clear dice pool:', error);
  }
}

export async function performRoll(requestedMode = 'normal', options = {}) {
  if (state.rolling) return;

  const rollMode = ['advantage', 'disadvantage'].includes(requestedMode)
    ? requestedMode
    : 'normal';
  const quickD20 = Boolean(options.quickD20) && rollMode !== 'normal';
  const previousHasRolled = state.hasRolled;

  state.rolling = true;
  state.d20Mode = rollMode;
  emitRollState();

  try {
    if (!state.physicsReady) throw new Error('3D physics is not ready yet.');

    const sourcePool = quickD20 ? [{ type: 'd20' }] : state.selectedDice;
    const { pool, notation } = buildPhysicsNotation(sourcePool, rollMode);
    if (!notation.length) {
      setStatus('Choose at least one die.', 'error');
      return;
    }

    const status = quickD20
      ? `Rolling d20 with ${rollMode}…`
      : rollMode === 'normal' ? 'Rolling…' : `Rolling ${rollMode}…`;
    setStatus(status);
    setPhysicsBadgeVisible(true);
    document.getElementById('tray-empty-state')?.classList.add('hidden');
    playDiceSound();

    const activeDiceColor = getSkinColor(
      state.dieSkin,
      state.customAppearance?.diceColor,
    );
    const results = await rollPhysics(notation, activeDiceColor);
    const parsed = parseRollResults(results, rollMode);

    state.hasRolled = quickD20 ? previousHasRolled : true;
    renderResults(parsed.total, parsed.breakdown);

    state.history.unshift({
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      formula: formulaFor(pool, rollMode),
      breakdown: parsed.breakdown,
      total: String(parsed.total),
    });
    if (state.history.length > 30) state.history.length = 30;
    savePreferences();
    renderHistory();

    if (!quickD20 && !state.keepDice) {
      state.selectedDice = [];
      renderPool();
    }

    playCriticalFeedback(getCriticalOutcome(pool, rollMode, parsed.keptD20s));
    setStatus(
      `Saved to history • ${state.history.length} roll${state.history.length === 1 ? '' : 's'}`,
      'ready',
    );
  } catch (error) {
    console.error('Roll execution failed:', error);
    setStatus(error.message || 'Roll failed.', 'error');
  } finally {
    state.rolling = false;
    state.d20Mode = 'normal';
    emitRollState();
  }
}
