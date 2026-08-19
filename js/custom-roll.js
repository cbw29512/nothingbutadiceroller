import { state, savePreferences } from './state.js';
import { clearPhysics } from './physics.js';
import { renderHistory, renderResults } from './ui.js';
import { getSkinColor } from './utils.js';

const MAX_CUSTOM_SIDES = 1_000_000;
const UINT32_RANGE = 0x1_0000_0000;

export function secureCustomRoll(sides) {
  try {
    if (!globalThis.crypto?.getRandomValues) {
      throw new Error('Web Crypto is unavailable in this browser.');
    }

    // Rejection sampling prevents modulo bias when 2^32 is not evenly divisible
    // by the requested number of sides. Every integer from 1 through N therefore
    // has the same probability of being returned.
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
  const normalized = String(rawValue ?? '').trim().toLowerCase();
  const match = normalized.match(/^d?([0-9]+)$/);
  const sides = match ? Number(match[1]) : Number.NaN;

  if (!Number.isSafeInteger(sides) || sides < 2 || sides > MAX_CUSTOM_SIDES) {
    throw new Error(
      `Enter a custom die from d2 through d${MAX_CUSTOM_SIDES.toLocaleString()} (or just the number).`,
    );
  }
  return sides;
}

function setPhysicsBadgeVisible(visible) {
  const badge = document.querySelector('.roll-trust-badge');
  if (badge) badge.hidden = !visible;
}

function showCustomTrayResult(sides, result) {
  const trayMessage = document.getElementById('tray-empty-state');
  if (!trayMessage) return;

  const display = document.createElement('div');
  display.className = 'custom-roll-display';
  display.setAttribute(
    'aria-label',
    `Custom d${sides} result ${result}. Random range 1 through ${sides}.`,
  );
  display.style.setProperty(
    '--custom-result-die-color',
    getSkinColor(state.dieSkin, state.customAppearance?.diceColor),
  );

  const die = document.createElement('div');
  die.className = 'custom-result-d20';
  die.setAttribute('aria-hidden', 'true');

  const type = document.createElement('span');
  type.className = 'custom-result-type';
  type.textContent = `d${sides}`;

  const value = document.createElement('strong');
  value.className = 'custom-result-value';
  value.textContent = result.toLocaleString();

  const caption = document.createElement('span');
  caption.className = 'custom-result-caption';
  caption.textContent = `SECURE CUSTOM ROLL • RANGE 1–${sides.toLocaleString()}`;

  die.append(type, value);
  display.append(die, caption);
  trayMessage.replaceChildren(display);
  trayMessage.classList.remove('hidden');
}

export async function performCustomRoll(rawSides) {
  if (state.rolling) return;

  state.rolling = true;
  document.dispatchEvent(new Event('rollstatechange'));

  try {
    const sides = normalizeCustomSides(rawSides);
    const result = secureCustomRoll(sides);

    await clearPhysics();
    setPhysicsBadgeVisible(false);
    state.hasRolled = true;

    const breakdown = `Custom d${sides} = ${result} • Web Crypto CSPRNG • range 1–${sides}`;
    renderResults(result, breakdown);
    showCustomTrayResult(sides, result);

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
