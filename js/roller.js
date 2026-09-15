import { state, savePreferences } from './state.js';
import { playDiceSound, playNat20Fanfare, playNat1DoomSound } from './audio.js';
import { buildPhysicsNotation, countDice, getSkinColor } from './utils.js';
import { clearPhysics, rollPhysics } from './physics.js';
import { getCriticalOutcome, parseRollResults } from './roll-results.js';
import { createStandardHistoryReroll } from './history-records.mjs';
import {
  applyRollModifier,
  appendModifierBreakdown,
  formatRollModifier,
  normalizeRollModifier,
} from './roll-modifier.mjs';
import { renderHistory, renderPool, renderResults, setStatus, showCrit } from './ui.js';

function emitRollState() {
  try {
    document.dispatchEvent(new Event('rollstatechange'));
  } catch (error) {
    console.error('Failed to emit roll state:', error);
  }
}

function setPhysicsBadgeVisible(visible) {
  try {
    const badge = document.querySelector('.roll-trust-badge');
    if (badge) badge.hidden = !visible;
  } catch (error) {
    console.error('Failed to update physics trust badge:', error);
  }
}

function formulaFor(pool, rollMode, modifier) {
  try {
    const formula = Object.entries(countDice(pool))
      .map(([type, count]) => `${count}${type}`)
      .join(' + ');
    const withModifier = `${formula}${formatRollModifier(modifier)}`;
    return rollMode === 'normal' ? withModifier : `${withModifier} (${rollMode})`;
  } catch (error) {
    console.error('Failed to format roll formula:', error);
    return 'Roll';
  }
}

function playCriticalFeedback(kind) {
  try {
    if (kind === 'nat20') {
      showCrit('nat20');
      playNat20Fanfare();
    } else if (kind === 'nat1') {
      showCrit('nat1');
      playNat1DoomSound();
    }
  } catch (error) {
    console.error('Failed to play critical feedback:', error);
  }
}

export function addDie(type) {
  try {
    if (state.rolling) return;
    if (state.hasRolled && !state.keepDice) state.selectedDice = [];
    state.selectedDice.push({ type });
    state.hasRolled = false;
    renderPool();
    emitRollState();
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
    state.modifier = 0;
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
  const quickD20 = Boolean(options.quickD20);
  const poolOverride = Array.isArray(options.poolOverride)
    ? options.poolOverride.map((die) => ({ type: die?.type }))
    : null;
  const preserveSelection = Boolean(options.preserveSelection);
  const modifier = normalizeRollModifier(
    options.modifierOverride ?? state.modifier,
    state.modifier,
  );
  const previousHasRolled = state.hasRolled;

  state.rolling = true;
  state.d20Mode = rollMode;
  emitRollState();

  try {
    if (!state.physicsReady) throw new Error('3D physics is not ready yet.');

    const sourcePool = quickD20 ? [{ type: 'd20' }] : (poolOverride || state.selectedDice);
    const { pool, notation } = buildPhysicsNotation(sourcePool, rollMode);
    if (!notation.length) {
      setStatus('Choose at least one die.', 'error');
      return;
    }

    const status = quickD20
      ? rollMode === 'normal' ? 'Rolling d20…' : `Rolling d20 with ${rollMode}…`
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
    const adjustedTotal = applyRollModifier(parsed.total, modifier);
    const adjustedBreakdown = appendModifierBreakdown(parsed.breakdown, modifier);

    state.hasRolled = preserveSelection || quickD20 ? previousHasRolled : true;
    renderResults(adjustedTotal, adjustedBreakdown);

    state.history.unshift({
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      formula: formulaFor(pool, rollMode, modifier),
      breakdown: adjustedBreakdown,
      total: String(adjustedTotal),
      reroll: createStandardHistoryReroll(pool, rollMode, quickD20, modifier),
    });
    if (state.history.length > 30) state.history.length = 30;
    savePreferences();
    renderHistory();

    if (!quickD20 && !preserveSelection && !state.keepDice) {
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
