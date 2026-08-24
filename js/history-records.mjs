const STANDARD_DICE = new Set(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
const ROLL_MODES = new Set(['normal', 'advantage', 'disadvantage']);
const MAX_CUSTOM_SIDES = 1_000_000;

function normalizeStandardDice(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const dice = value.map((entry) => typeof entry === 'string' ? entry : entry?.type);
  if (dice.some((type) => !STANDARD_DICE.has(type))) return null;
  return dice;
}

export function createStandardHistoryReroll(pool, mode = 'normal', quickD20 = false) {
  const dice = normalizeStandardDice(pool);
  if (!dice) throw new Error('Standard history reroll requires a valid canonical dice pool.');
  if (!ROLL_MODES.has(mode)) throw new Error('Standard history reroll has an invalid roll mode.');
  return Object.freeze({
    kind: 'standard',
    dice: Object.freeze([...dice]),
    mode,
    quickD20: Boolean(quickD20),
  });
}

export function createCustomHistoryReroll(sides) {
  const normalized = Number(sides);
  if (!Number.isSafeInteger(normalized) || normalized < 2 || normalized > MAX_CUSTOM_SIDES) {
    throw new Error('Custom history reroll requires a valid custom die size.');
  }
  return Object.freeze({ kind: 'custom', sides: normalized });
}

export function normalizeHistoryReroll(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.kind === 'standard') {
      const dice = normalizeStandardDice(value.dice);
      if (!dice || !ROLL_MODES.has(value.mode)) return null;
      const quickD20 = value.quickD20 === true;
      if (quickD20 && (value.mode === 'normal' || dice.length !== 1 || dice[0] !== 'd20')) return null;
      return Object.freeze({ kind: 'standard', dice: Object.freeze([...dice]), mode: value.mode, quickD20 });
    }
    if (value.kind === 'custom') {
      const sides = Number(value.sides);
      if (!Number.isSafeInteger(sides) || sides < 2 || sides > MAX_CUSTOM_SIDES) return null;
      return Object.freeze({ kind: 'custom', sides });
    }
    return null;
  } catch {
    return null;
  }
}

export function canRerollHistoryItem(item) {
  return Boolean(normalizeHistoryReroll(item?.reroll));
}

function cleanLine(value) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
}

export function formatHistoryItemForCopy(item) {
  const formula = cleanLine(item?.formula) || 'Roll';
  const total = cleanLine(item?.total) || '—';
  const breakdown = cleanLine(item?.breakdown);
  const time = cleanLine(item?.time);
  return [
    `${formula} → ${total}`,
    breakdown ? `Breakdown: ${breakdown}` : '',
    time ? `Time: ${time}` : '',
  ].filter(Boolean).join('\n');
}
