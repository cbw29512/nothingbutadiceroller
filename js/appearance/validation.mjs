import {
  APPEARANCE_SCHEMA_VERSION,
  CANONICAL_DICE,
  CUSTOM_FACE_MODE,
  RAW_FACE_MODE,
  SYSTEM_DEFAULT_DICE_SET,
  SYSTEM_DEFAULT_DICE_SET_ID,
} from './defaults.mjs';
import { countFaceDisplayGraphemes, isValidFaceDisplayValue } from './face-display.mjs';
import { isCanonicalFaceResult } from './face-values.mjs';
import { isValidDiceSetId } from './identifiers.mjs';
import { INTERIOR_EFFECT_TYPES } from './resin-style.mjs';
import { SURFACE_FINISH_TYPES } from './surface-style.mjs';
import { validateTrayImage } from './tray-image.mjs';

const HEX = /^#[0-9a-f]{6}$/i;
const CONTROL_RE = /[\u0000-\u001F\u007F]/;
const FACE_KINDS = new Set(['text', 'icon']);
const LEGACY_ICON_IDS = new Set(['skull', 'star', 'flame', 'shield', 'heart', 'sword']);
const FACE_MODES = new Set([RAW_FACE_MODE, CUSTOM_FACE_MODE]);
const VISIBILITIES = new Set(['private', 'public', 'system']);
const INTERIOR_TYPES = new Set(INTERIOR_EFFECT_TYPES);
const FINISH_TYPES = new Set(SURFACE_FINISH_TYPES);
const SET_KEYS = new Set(['schemaVersion', 'id', 'ownerId', 'name', 'systemOwned', 'locked', 'visibility', 'appearance']);
const APPEARANCE_KEYS = new Set(['diceSet', 'tray']);
const DICE_SET_KEYS = new Set(['defaultStyle', 'dice']);
const BASE_STYLE_KEYS = new Set(['bodyColor', 'faceColor', 'opacity', 'glow', 'translucency', 'interior', 'finish']);
const TRAY_KEYS = new Set(['color', 'image', 'glow']);
const DIE_KEYS = new Set(['shapeId', 'logicalDie', 'faceMode', 'styleOverrides', 'faces']);
const FACE_KEYS = new Set(['kind', 'value', 'color', 'fontId']);
const GLOW_KEYS = new Set(['enabled', 'color', 'intensity']);
const TRANSLUCENCY_KEYS = new Set(['enabled', 'opacity', 'frost', 'tintColor']);
const INTERIOR_KEYS = new Set(['enabled', 'type', 'primaryColor', 'secondaryColor', 'density', 'intensity']);
const FINISH_KEYS = new Set(['type', 'accentColor', 'intensity']);
const STYLE_OVERRIDE_KEYS = new Set(['bodyColor', 'faceColor', 'opacity', 'glow', 'translucency', 'interior', 'finish']);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function rejectUnknownKeys(value, allowed, path, errors) {
  if (!isPlainObject(value)) return;
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
  if (unsupported.length) errors.push(`${path} contains unsupported fields: ${unsupported.join(', ')}.`);
}
function checkGlow(glow, path, errors) {
  if (!isPlainObject(glow)) return errors.push(`${path} must be an object.`);
  rejectUnknownKeys(glow, GLOW_KEYS, path, errors);
  if (typeof glow.enabled !== 'boolean') errors.push(`${path}.enabled must be boolean.`);
  if (!HEX.test(String(glow.color || ''))) errors.push(`${path}.color must be a 6-digit hex color.`);
  if (!Number.isFinite(glow.intensity) || glow.intensity < 0 || glow.intensity > 1) errors.push(`${path}.intensity must be between 0 and 1.`);
}
function checkTranslucency(value, path, errors) {
  if (!isPlainObject(value)) return errors.push(`${path} must be an object.`);
  rejectUnknownKeys(value, TRANSLUCENCY_KEYS, path, errors);
  if (typeof value.enabled !== 'boolean') errors.push(`${path}.enabled must be boolean.`);
  if (!Number.isFinite(value.opacity) || value.opacity < 0.25 || value.opacity > 1) errors.push(`${path}.opacity must be between 0.25 and 1.`);
  if (!Number.isFinite(value.frost) || value.frost < 0 || value.frost > 1) errors.push(`${path}.frost must be between 0 and 1.`);
  if (!HEX.test(String(value.tintColor || ''))) errors.push(`${path}.tintColor is invalid.`);
}
function checkInterior(value, path, errors) {
  if (!isPlainObject(value)) return errors.push(`${path} must be an object.`);
  rejectUnknownKeys(value, INTERIOR_KEYS, path, errors);
  if (typeof value.enabled !== 'boolean') errors.push(`${path}.enabled must be boolean.`);
  if (!INTERIOR_TYPES.has(String(value.type || ''))) errors.push(`${path}.type is unsupported.`);
  if (value.enabled && value.type === 'none') errors.push(`${path}.type cannot be none while enabled.`);
  if (!HEX.test(String(value.primaryColor || ''))) errors.push(`${path}.primaryColor is invalid.`);
  if (!HEX.test(String(value.secondaryColor || ''))) errors.push(`${path}.secondaryColor is invalid.`);
  if (!Number.isFinite(value.density) || value.density < 0 || value.density > 1) errors.push(`${path}.density must be between 0 and 1.`);
  if (!Number.isFinite(value.intensity) || value.intensity < 0 || value.intensity > 1) errors.push(`${path}.intensity must be between 0 and 1.`);
}
function checkFinish(value, path, errors) {
  if (!isPlainObject(value)) return errors.push(`${path} must be an object.`);
  rejectUnknownKeys(value, FINISH_KEYS, path, errors);
  if (!FINISH_TYPES.has(String(value.type || ''))) errors.push(`${path}.type is unsupported.`);
  if (!HEX.test(String(value.accentColor || ''))) errors.push(`${path}.accentColor is invalid.`);
  if (!Number.isFinite(value.intensity) || value.intensity < 0 || value.intensity > 1) errors.push(`${path}.intensity must be between 0 and 1.`);
}
function checkStyleOverrides(overrides, path, errors) {
  if (!isPlainObject(overrides)) return errors.push(`${path} must be an object.`);
  const unsupported = Object.keys(overrides).filter((key) => !STYLE_OVERRIDE_KEYS.has(key));
  if (unsupported.length) errors.push(`${path} contains unsupported fields: ${unsupported.join(', ')}.`);
  if (overrides.bodyColor != null && !HEX.test(String(overrides.bodyColor))) errors.push(`${path}.bodyColor is invalid.`);
  if (overrides.faceColor != null && !HEX.test(String(overrides.faceColor))) errors.push(`${path}.faceColor is invalid.`);
  if (overrides.opacity != null && (!Number.isFinite(overrides.opacity) || overrides.opacity < 0.25 || overrides.opacity > 1)) errors.push(`${path}.opacity must be between 0.25 and 1.`);
  if (overrides.glow != null) checkGlow(overrides.glow, `${path}.glow`, errors);
  if (overrides.translucency != null) checkTranslucency(overrides.translucency, `${path}.translucency`, errors);
  if (overrides.interior != null) checkInterior(overrides.interior, `${path}.interior`, errors);
  if (overrides.finish != null) checkFinish(overrides.finish, `${path}.finish`, errors);
}
function checkFace(face, path, errors) {
  if (!isPlainObject(face)) return errors.push(`${path} must be an object.`);
  rejectUnknownKeys(face, FACE_KEYS, path, errors);
  if (!FACE_KINDS.has(face.kind)) errors.push(`${path}.kind is unsupported.`);
  if (face.color != null && !HEX.test(String(face.color))) errors.push(`${path}.color is invalid.`);
  if (face.fontId != null && (typeof face.fontId !== 'string' || face.fontId.length > 80 || CONTROL_RE.test(face.fontId))) errors.push(`${path}.fontId must reference a supported font.`);
  if (face.kind === 'text' && !isValidFaceDisplayValue(face.value)) errors.push(`${path}.value must be a short visible label.`);
  if (face.kind === 'icon') {
    const value = typeof face.value === 'string' ? face.value.trim() : '';
    if (!LEGACY_ICON_IDS.has(value) && countFaceDisplayGraphemes(value) !== 1) errors.push(`${path}.value must be one visible symbol or a supported built-in icon.`);
  }
}
function checkDie(type, die, errors) {
  if (!isPlainObject(die)) return errors.push(`${type} configuration is required.`);
  rejectUnknownKeys(die, DIE_KEYS, `appearance.diceSet.dice.${type}`, errors);
  if (die.shapeId !== `canonical:${type}`) errors.push(`${type} shapeId must remain canonical:${type}.`);
  if (die.logicalDie !== type) errors.push(`${type} logicalDie must remain ${type}.`);
  if (!FACE_MODES.has(die.faceMode)) errors.push(`${type} faceMode must be raw or custom.`);
  checkStyleOverrides(die.styleOverrides, `appearance.diceSet.dice.${type}.styleOverrides`, errors);
  if (!isPlainObject(die.faces)) return errors.push(`appearance.diceSet.dice.${type}.faces must be an object.`);
  const faceEntries = Object.entries(die.faces);
  if (die.faceMode === RAW_FACE_MODE && faceEntries.length) errors.push(`${type} RAW faces must use standard numbering with no visual replacements.`);
  for (const [logicalFace, face] of faceEntries) {
    if (!isCanonicalFaceResult(type, logicalFace)) errors.push(`${type} custom face ${logicalFace} is not a physical face result for this die.`);
    else if (die.faceMode === CUSTOM_FACE_MODE) checkFace(face, `appearance.diceSet.dice.${type}.faces.${logicalFace}`, errors);
  }
}
function checkAppearance(appearance, errors) {
  if (!isPlainObject(appearance)) return errors.push('appearance must be an object.');
  rejectUnknownKeys(appearance, APPEARANCE_KEYS, 'appearance', errors);
  const diceSet = appearance.diceSet;
  if (!isPlainObject(diceSet)) return errors.push('appearance.diceSet is required.');
  rejectUnknownKeys(diceSet, DICE_SET_KEYS, 'appearance.diceSet', errors);
  const style = diceSet.defaultStyle;
  if (!isPlainObject(style)) return errors.push('appearance.diceSet.defaultStyle is required.');
  rejectUnknownKeys(style, BASE_STYLE_KEYS, 'appearance.diceSet.defaultStyle', errors);
  if (!HEX.test(String(style.bodyColor || ''))) errors.push('Default dice bodyColor is invalid.');
  if (!HEX.test(String(style.faceColor || ''))) errors.push('Default dice faceColor is invalid.');
  if (!Number.isFinite(style.opacity) || style.opacity < 0.25 || style.opacity > 1) errors.push('Default dice opacity must be between 0.25 and 1.');
  checkGlow(style.glow, 'appearance.diceSet.defaultStyle.glow', errors);
  if (style.translucency != null) checkTranslucency(style.translucency, 'appearance.diceSet.defaultStyle.translucency', errors);
  if (style.interior != null) checkInterior(style.interior, 'appearance.diceSet.defaultStyle.interior', errors);
  if (style.finish != null) checkFinish(style.finish, 'appearance.diceSet.defaultStyle.finish', errors);
  const dice = diceSet.dice;
  if (!isPlainObject(dice)) return errors.push('appearance.diceSet.dice is required.');
  const unsupportedDice = Object.keys(dice).filter((type) => !Object.hasOwn(CANONICAL_DICE, type));
  if (unsupportedDice.length) errors.push(`Unsupported dice are not allowed: ${unsupportedDice.join(', ')}.`);
  for (const type of Object.keys(CANONICAL_DICE)) checkDie(type, dice[type], errors);
  const tray = appearance.tray;
  if (!isPlainObject(tray)) return errors.push('appearance.tray is required.');
  rejectUnknownKeys(tray, TRAY_KEYS, 'appearance.tray', errors);
  if (!HEX.test(String(tray.color || ''))) errors.push('Tray color is invalid.');
  checkGlow(tray.glow, 'appearance.tray.glow', errors);
  const trayImage = validateTrayImage(tray.image);
  if (!trayImage.ok) errors.push(trayImage.error);
}

export function validateDiceSet(set) {
  const errors = [];
  try {
    if (!isPlainObject(set)) return { ok: false, errors: ['Dice set must be an object.'] };
    rejectUnknownKeys(set, SET_KEYS, 'diceSet', errors);
    if (set.schemaVersion !== APPEARANCE_SCHEMA_VERSION) errors.push('Unsupported dice-set schemaVersion.');
    if (!isValidDiceSetId(set.id)) errors.push('Dice set id must be 1-80 letters, numbers, underscores, or hyphens and start with a letter or number.');
    const name = typeof set.name === 'string' ? set.name : '';
    if (!name.trim() || name.length > 80 || CONTROL_RE.test(name)) errors.push('Dice set name is invalid.');
    if (!VISIBILITIES.has(set.visibility)) errors.push('Dice set visibility is invalid.');
    if (typeof set.systemOwned !== 'boolean') errors.push('systemOwned must be boolean.');
    if (typeof set.locked !== 'boolean') errors.push('locked must be boolean.');
    if (set.visibility === 'public' && !set.locked) errors.push('Public dice sets must be locked.');
    if (set.systemOwned) {
      if (set.id !== SYSTEM_DEFAULT_DICE_SET_ID) errors.push('System dice set id is invalid.');
      if (set.ownerId !== null) errors.push('System dice set cannot have an owner.');
      if (!set.locked || set.visibility !== 'system') errors.push('System dice set must remain locked and system-visible.');
      if (JSON.stringify(set.appearance) !== JSON.stringify(SYSTEM_DEFAULT_DICE_SET.appearance)) errors.push('System Default appearance is immutable.');
    } else {
      if (set.id === SYSTEM_DEFAULT_DICE_SET_ID) errors.push('User dice sets cannot use the System Default id.');
      if (typeof set.ownerId !== 'string' || !set.ownerId.trim() || set.ownerId.length > 160 || CONTROL_RE.test(set.ownerId)) errors.push('User dice sets require a valid ownerId.');
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
