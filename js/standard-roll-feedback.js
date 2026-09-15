import { playNat20Fanfare, playNat1DoomSound } from './audio.js';
import { countDice } from './utils.js';
import { formatRollModifier } from './roll-modifier.mjs';
import { showCrit } from './ui.js';

export function emitRollState() {
  try {
    document.dispatchEvent(new Event('rollstatechange'));
  } catch (error) {
    console.error('Failed to emit roll state:', error);
  }
}

export function setPhysicsBadgeVisible(visible) {
  try {
    const badge = document.querySelector('.roll-trust-badge');
    if (badge) badge.hidden = !visible;
  } catch (error) {
    console.error('Failed to update physics trust badge:', error);
  }
}

export function formulaFor(pool, rollMode, modifier) {
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

export function playCriticalFeedback(kind) {
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
