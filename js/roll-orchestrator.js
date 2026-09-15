import { state } from './state.js';
import { performRoll, clearPool } from './roller.js';
import { performCustomRoll } from './custom-roll.js';
import { closeCustomDieControls } from './custom-controls.js';
import { closeDrawers } from './drawer-controls.js';
import { canRollFromTray } from './tray-controls.js';
import {
  canRollPreparedShortcutFromTray,
  clearPreparedShortcut,
  isShortcutPrepared,
  performPreparedShortcutRoll,
  performShortcutHistoryReroll,
} from './shortcuts/runtime.js';

export async function performActiveRoll(requestedMode = 'normal', options = {}) {
  try {
    const shortcutEligible = requestedMode === 'normal' && !options.quickD20 && isShortcutPrepared();
    if (shortcutEligible) return performPreparedShortcutRoll();
    return performRoll(requestedMode, options);
  } catch (error) {
    console.error('Failed to perform active roll:', error);
    throw error;
  }
}

export async function clearActiveRoll() {
  try {
    closeCustomDieControls();
    if (isShortcutPrepared()) await clearPreparedShortcut();
    return clearPool();
  } catch (error) {
    console.error('Failed to clear active roll:', error);
    throw error;
  }
}

export async function rerollHistoryDescriptor(descriptor) {
  try {
    if (state.rolling) return false;
    closeDrawers();
    closeCustomDieControls();
    if (isShortcutPrepared()) await clearPreparedShortcut();

    if (descriptor.kind === 'standard') {
      const poolOverride = descriptor.dice.map((type) => ({ type }));
      return performRoll(descriptor.mode, {
        quickD20: descriptor.quickD20,
        poolOverride,
        preserveSelection: true,
        modifierOverride: descriptor.modifier,
      });
    }
    if (descriptor.kind === 'custom') {
      return performCustomRoll(String(descriptor.sides));
    }
    if (descriptor.kind === 'shortcut') {
      return performShortcutHistoryReroll(descriptor.plan);
    }
    throw new Error('This history entry cannot be rerolled safely.');
  } catch (error) {
    console.error('Failed to reroll history descriptor:', error);
    throw error;
  }
}

export function canRollActiveFromTray() {
  try {
    return isShortcutPrepared() ? canRollPreparedShortcutFromTray() : canRollFromTray();
  } catch (error) {
    console.error('Failed to check tray roll availability:', error);
    return false;
  }
}
