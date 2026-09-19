import { state } from './state.js';
import { formatRollModifier } from './roll-modifier.mjs';
import { countDice } from './utils.js';

export function formatRollButtonLabel(selectedDice = state.selectedDice) {
  try {
    const dice = Array.isArray(selectedDice) ? selectedDice : [];
    const entries = Object.entries(countDice(dice));
    if (!entries.length) return 'Roll Dice';

    const formula = entries
      .map(([type, count]) => `${count === 1 ? '' : count}${type}`)
      .join(' + ');
    return `Roll ${formula}${formatRollModifier(state.modifier)}`;
  } catch (error) {
    console.error('Failed to format roll button label:', error);
    return 'Roll Dice';
  }
}

export function formatNaturalRollFeedback(kind) {
  try {
    if (kind === 'nat20') return 'NATURAL 20!';
    if (kind === 'nat1') return 'NATURAL 1!';
    return '';
  } catch (error) {
    console.error('Failed to format natural-roll feedback:', error);
    return '';
  }
}

export function syncRollButtonLabels() {
  try {
    const label = formatRollButtonLabel(state.selectedDice);
    ['roll-btn', 'mobile-roll-btn'].forEach(id => {
      const button = document.getElementById(id);
      if (!button) return;
      button.textContent = label;
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  } catch (error) {
    console.error('Failed to synchronize roll button labels:', error);
  }
}
