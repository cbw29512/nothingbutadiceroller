import { state, savePreferences } from './state.js';
import { clearPhysics } from './physics.js';
import { renderHistory, renderResults } from './ui.js';

const MAX_CUSTOM_SIDES = 1_000_000;
const UINT32_RANGE = 0x1_0000_0000;

function secureRoll(sides) {
  try {
    if (!globalThis.crypto?.getRandomValues) {
      throw new Error('Web Crypto is unavailable in this browser.');
    }

    const limit = Math.floor(UINT32_RANGE / sides) * sides;
    const sample = new Uint32Array(1);
    let value;

    do {
      globalThis.crypto.getRandomValues(sample);
      value = sample[0];
    } while (value >= limit);

    return (value % sides) + 1;
  } catch (error) {
    console.error('Secure custom die roll failed:', error);
    throw error;
  }
}

export function normalizeCustomSides(rawValue) {
  const sides = Number(rawValue);
  if (!Number.isInteger(sides) || sides < 2 || sides > MAX_CUSTOM_SIDES) {
    throw new Error(`Custom dice must have 2–${MAX_CUSTOM_SIDES.toLocaleString()} sides.`);
  }
  return sides;
}

export async function performCustomRoll(rawSides) {
  if (state.rolling) return;

  state.rolling = true;
  document.dispatchEvent(new Event('rollstatechange'));

  try {
    const sides = normalizeCustomSides(rawSides);
    const result = secureRoll(sides);

    await clearPhysics();
    state.hasRolled = true;

    const breakdown = `Custom d${sides} = ${result} • Web Crypto CSPRNG`;
    renderResults(result, breakdown);

    state.history.unshift({
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      formula: `1d${sides} (CSPRNG)`,
      breakdown,
      total: String(result),
    });

    if (state.history.length > 30) state.history.length = 30;
    savePreferences();
    renderHistory();

    document.dispatchEvent(new CustomEvent('customrollcomplete', {
      detail: { sides, result },
    }));
  } catch (error) {
    console.error('Custom roll execution failed:', error);
    document.dispatchEvent(new CustomEvent('customrollerror', {
      detail: { message: error.message || 'Custom roll failed.' },
    }));
  } finally {
    state.rolling = false;
    document.dispatchEvent(new Event('rollstatechange'));
  }
}
