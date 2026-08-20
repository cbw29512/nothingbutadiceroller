import {
  APPEARANCE_SCHEMA_VERSION,
  CANONICAL_DICE,
  CUSTOM_FACE_MODE,
  RAW_FACE_MODE,
  SYSTEM_DEFAULT_DICE_SET,
  SYSTEM_DEFAULT_DICE_SET_ID,
} from './defaults.mjs';

const HEX = /^#[0-9a-f]{6}$/i;
const FACE_KINDS = new Set(['text', 'icon', 'image']);
const FACE_MODES = new Set([RAW_FACE_MODE, CUSTOM_FACE_MODE]);
const VISIBILITIES = new Set(['private', 'public', 'system']);

function checkGlow(glow, path, errors) {
  if (!glow || typeof glow !== 'object') return errors.push(`${path} must be an object.`);
  if (typeof glow.enabled !== 'boolean') errors.push(`${path}.enabled must be boolean.`);
  if (!HEX.test(String(glow.color || ''))) errors.push(`${path}.color must be a 6-digit hex color.`);
  if (!Number.isFinite(glow.intensity) || glow.intensity < 0 || glow.intensity > 1) {
    errors.push(`${path}.intensity must be between 0 and 1.`);
  }
}

function checkFace(face, path, errors) {
  if (!face || typeof face !== 'object') return errors.push(`${path} must be an object.`);
  if (!FACE_KINDS.has(face.kind)) errors.push(`${path}.kind is unsupported.`);
  if (face.color != null && !HEX.test(String(face.color))) errors.push(`${path}.color is invalid.`);
  if (face.fontId != null && (typeof face.fontId !== 'string' || face.fontId.length > 80)) {
    errors.push(`${path}.fontId must reference a supported font.`);
  }
  if (face.kind === 'text') {
    const value = typeof face.value === 'string' ? face.value : '';
    if (!value.trim() || Array.from(value).length > 12) {
      errors.push(`${path}.value must contain 1-12 characters.`);
    }
  }
  if (face.kind === 'icon' && (typeof face.value !== 'string' || !face.value || face.value.length > 80)) {
    errors.push(`${path}.value must name a built-in icon.`);
  }
  if (face.kind === 'image' && (typeof face.assetId !== 'string' || !face.assetId || face.assetId.length > 160)) {
    errors.push(`${path}.assetId must reference a stored image asset.`);
  }
}

function checkDie(type, sides, die, errors) {
  if (!die) return errors.push(`${type} configuration is required.`);
  if (die.shapeId !== `canonical:${type}`) errors.push(`${type} shapeId must remain canonical:${type}.`);
  if (die.logicalDie !== type) errors.push(`${type} logicalDie must remain ${type}.`);
  if (!FACE_MODES.has(die.faceMode)) errors.push(`${type} faceMode must be raw or custom.`);

  const faces = die.faces && typeof die.faces === 'object' ? die.faces : {};
  const faceEntries = Object.entries(faces);
  if (die.faceMode === RAW_FACE_MODE && faceEntries.length) {
    errors.push(`${type} RAW faces must use standard numbering with no visual replacements.`);
  }

  for (const [logicalFace, face] of faceEntries) {
    const value = Number(logicalFace);
    if (!Number.isInteger(value) || value < 1 || value > sides) {
      errors.push(`${type} custom face ${logicalFace} is outside its logical result range.`);
    } else if (die.faceMode === CUSTOM_FACE_MODE) {
      checkFace(face, `appearance.diceSet.dice.${type}.faces.${logicalFace}`, errors);
    }
  }
}

function checkAppearance(appearance, errors) {
  const style = appearance?.diceSet?.defaultStyle;
  if (!style) return errors.push('appearance.diceSet.defaultStyle is required.');
  if (!HEX.test(String(style.bodyColor || ''))) errors.push('Default dice bodyColor is invalid.');
  if (!HEX.test(String(style.faceColor || ''))) errors.push('Default dice faceColor is invalid.');
  if (!Number.isFinite(style.opacity) || style.opacity < 0.25 || style.opacity > 1) {
    errors.push('Default dice opacity must be between 0.25 and 1.');
  }
  checkGlow(style.glow, 'appearance.diceSet.defaultStyle.glow', errors);

  const dice = appearance?.diceSet?.dice;
  if (!dice || typeof dice !== 'object') return errors.push('appearance.diceSet.dice is required.');
  const unsupportedDice = Object.keys(dice).filter((type) => !Object.hasOwn(CANONICAL_DICE, type));
  if (unsupportedDice.length) errors.push(`Unsupported dice are not allowed: ${unsupportedDice.join(', ')}.`);
  for (const [type, sides] of Object.entries(CANONICAL_DICE)) checkDie(type, sides, dice[type], errors);

  if (!HEX.test(String(appearance?.tray?.color || ''))) errors.push('Tray color is invalid.');
  checkGlow(appearance?.tray?.glow, 'appearance.tray.glow', errors);
}

export function validateDiceSet(set) {
  const errors = [];
  try {
    if (!set || typeof set !== 'object') return { ok: false, errors: ['Dice set must be an object.'] };
    if (set.schemaVersion !== APPEARANCE_SCHEMA_VERSION) errors.push('Unsupported dice-set schemaVersion.');
    if (!String(set.id || '').trim()) errors.push('Dice set id is required.');
    if (!String(set.name || '').trim() || String(set.name).length > 80) errors.push('Dice set name is invalid.');
    if (!VISIBILITIES.has(set.visibility)) errors.push('Dice set visibility is invalid.');
    if (typeof set.systemOwned !== 'boolean') errors.push('systemOwned must be boolean.');
    if (typeof set.locked !== 'boolean') errors.push('locked must be boolean.');
    if (set.visibility === 'public' && !set.locked) errors.push('Public dice sets must be locked.');

    if (set.systemOwned) {
      if (set.id !== SYSTEM_DEFAULT_DICE_SET_ID) errors.push('System dice set id is invalid.');
      if (set.ownerId !== null) errors.push('System dice set cannot have an owner.');
      if (!set.locked || set.visibility !== 'system') errors.push('System dice set must remain locked and system-visible.');
      if (JSON.stringify(set.appearance) !== JSON.stringify(SYSTEM_DEFAULT_DICE_SET.appearance)) {
        errors.push('System Default appearance is immutable.');
      }
    } else {
      if (set.id === SYSTEM_DEFAULT_DICE_SET_ID) errors.push('User dice sets cannot use the System Default id.');
      if (!String(set.ownerId || '').trim()) errors.push('User dice sets require an ownerId.');
      if (set.visibility === 'system') errors.push('User dice sets cannot use system visibility.');
    }

    checkAppearance(set.appearance, errors);
  } catch (error) {
    console.error('Dice-set validation failed unexpectedly:', error);
    errors.push('Dice-set validation failed unexpectedly.');
  }
  return { ok: errors.length === 0, errors };
}

export function assertValidDiceSet(set) {
  const result = validateDiceSet(set);
  if (!result.ok) throw new Error(result.errors.join(' | '));
  return set;
}
