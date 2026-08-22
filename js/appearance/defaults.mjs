export const APPEARANCE_SCHEMA_VERSION = 2;
export const SYSTEM_DEFAULT_DICE_SET_ID = 'system-default';
export const RAW_FACE_MODE = 'raw';
export const CUSTOM_FACE_MODE = 'custom';

export const CANONICAL_DICE = Object.freeze({
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function canonicalDiceMap() {
  return Object.fromEntries(
    Object.keys(CANONICAL_DICE).map((type) => [type, {
      shapeId: `canonical:${type}`,
      logicalDie: type,
      faceMode: RAW_FACE_MODE,
      styleOverrides: {},
      faces: {},
    }]),
  );
}

const defaultAppearance = {
  diceSet: {
    defaultStyle: {
      bodyColor: '#b91c1c',
      faceColor: '#ffffff',
      opacity: 1,
      glow: { enabled: false, color: '#ffffff', intensity: 0 },
    },
    dice: canonicalDiceMap(),
  },
  tray: {
    color: '#000000',
    image: null,
    glow: { enabled: false, color: '#ffffff', intensity: 0 },
  },
};

export const SYSTEM_DEFAULT_DICE_SET = deepFreeze({
  schemaVersion: APPEARANCE_SCHEMA_VERSION,
  id: SYSTEM_DEFAULT_DICE_SET_ID,
  ownerId: null,
  name: 'Default Dice',
  systemOwned: true,
  locked: true,
  visibility: 'system',
  appearance: defaultAppearance,
});

export function cloneSystemDefaultAppearance() {
  try {
    return structuredClone(SYSTEM_DEFAULT_DICE_SET.appearance);
  } catch (error) {
    console.error('Failed to clone system default appearance:', error);
    return JSON.parse(JSON.stringify(SYSTEM_DEFAULT_DICE_SET.appearance));
  }
}
