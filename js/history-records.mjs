import { normalizeRollModifier } from './roll-modifier.mjs';
import {
  createShortcutHistoryReroll,
  normalizeShortcutHistoryReroll,
} from './shortcut-history-descriptor.mjs';

export { createShortcutHistoryReroll };
export const HISTORY_SCHEMA_VERSION = 1;

const STANDARD_DICE = new Set(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
const ROLL_MODES = new Set(['normal', 'advantage', 'disadvantage']);
const MAX_CUSTOM_SIDES = 1_000_000;

function normalizeStandardDice(value) {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
    const dice = value.map((entry) => typeof entry === 'string' ? entry : entry?.type);
    if (dice.some((type) => !STANDARD_DICE.has(type))) return null;
    return dice;
  } catch (error) {
    console.error('Failed to normalize standard history dice:', error);
    return null;
  }
}

export function createStandardHistoryReroll(pool, mode = 'normal', quickD20 = false, modifier = 0) {
  try {
    const dice = normalizeStandardDice(pool);
    if (!dice) throw new Error('Standard history reroll requires a valid canonical dice pool.');
    if (!ROLL_MODES.has(mode)) throw new Error('Standard history reroll has an invalid roll mode.');
    if (quickD20 && (dice.length !== 1 || dice[0] !== 'd20')) {
      throw new Error('Quick D20 history reroll requires exactly one d20.');
    }
    return Object.freeze({
      kind: 'standard',
      dice: Object.freeze([...dice]),
      mode,
      quickD20: Boolean(quickD20),
      modifier: normalizeRollModifier(modifier),
    });
  } catch (error) {
    console.error('Failed to create standard history reroll:', error);
    throw error;
  }
}

export function createCustomHistoryReroll(sides) {
  try {
    const normalized = Number(sides);
    if (!Number.isSafeInteger(normalized) || normalized < 2 || normalized > MAX_CUSTOM_SIDES) {
      throw new Error('Custom history reroll requires a valid custom die size.');
    }
    return Object.freeze({ kind: 'custom', sides: normalized });
  } catch (error) {
    console.error('Failed to create custom history reroll:', error);
    throw error;
  }
}

export function normalizeHistoryReroll(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.kind === 'standard') {
      const dice = normalizeStandardDice(value.dice);
      if (!dice || !ROLL_MODES.has(value.mode)) return null;
      const quickD20 = value.quickD20 === true;
      if (quickD20 && (dice.length !== 1 || dice[0] !== 'd20')) return null;
      return Object.freeze({
        kind: 'standard',
        dice: Object.freeze([...dice]),
        mode: value.mode,
        quickD20,
        modifier: normalizeRollModifier(value.modifier),
      });
    }
    if (value.kind === 'custom') {
      const sides = Number(value.sides);
      if (!Number.isSafeInteger(sides) || sides < 2 || sides > MAX_CUSTOM_SIDES) return null;
      return Object.freeze({ kind: 'custom', sides });
    }
    if (value.kind === 'shortcut') return normalizeShortcutHistoryReroll(value);
    return null;
  } catch (error) {
    console.error('Failed to normalize history reroll descriptor:', error);
    return null;
  }
}

export function canRerollHistoryItem(item) {
  try {
    return Boolean(normalizeHistoryReroll(item?.reroll));
  } catch (error) {
    console.error('Failed to check history reroll availability:', error);
    return false;
  }
}

function cleanLine(value, maxLength = 2_000) {
  try {
    return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength);
  } catch (error) {
    console.error('Failed to normalize history text:', error);
    return '';
  }
}

export function normalizeHistoryRecord(item) {
  try {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const reroll = normalizeHistoryReroll(item.reroll);
    return {
      schemaVersion: HISTORY_SCHEMA_VERSION,
      time: cleanLine(item.time, 80),
      formula: cleanLine(item.formula, 240) || 'Roll',
      breakdown: cleanLine(item.breakdown),
      total: cleanLine(item.total, 120) || '—',
      ...(reroll ? { reroll } : {}),
    };
  } catch (error) {
    console.error('Failed to normalize history record:', error);
    return null;
  }
}

export function formatHistoryItemForCopy(item) {
  try {
    const formula = cleanLine(item?.formula) || 'Roll';
    const total = cleanLine(item?.total) || '—';
    const breakdown = cleanLine(item?.breakdown);
    const time = cleanLine(item?.time);
    return [
      `${formula} → ${total}`,
      breakdown ? `Breakdown: ${breakdown}` : '',
      time ? `Time: ${time}` : '',
    ].filter(Boolean).join('\n');
  } catch (error) {
    console.error('Failed to format history item for copying:', error);
    return 'Roll history unavailable';
  }
}
