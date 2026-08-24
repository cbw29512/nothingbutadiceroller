import { CANONICAL_DICE, CUSTOM_FACE_MODE } from './defaults.mjs';
import { isSupportedFaceFontId } from './face-fonts.mjs';
import { isValidFaceGlyphPosition } from './face-glyph-position.mjs';
import { isValidFaceGlyphScale } from './face-glyph-scale.mjs';
import { getCanonicalFaceLabel, getCanonicalFaceResults } from './face-values.mjs';
import { cloneDiceSet } from './schema.mjs';
import { assertValidDiceSet } from './validation.mjs';

const HEX = /^#[0-9a-f]{6}$/i;

function assertStyle(style) {
  if (!style || typeof style !== 'object' || Array.isArray(style)) throw new Error('Face style is required.');
  if (!HEX.test(String(style.color || ''))) throw new Error('Face style color must be a 6-digit hex color.');
  if (!isSupportedFaceFontId(style.fontId)) throw new Error('Face style font must be supported.');
  if (!isValidFaceGlyphScale(style.scale)) throw new Error('Face style scale must be between 0.6 and 1.2.');
  if (!isValidFaceGlyphPosition(style.position)) throw new Error('Face style position must be a supported bounded face position.');
  return { color: style.color, fontId: style.fontId, scale: style.scale, position: style.position };
}

function displayFace(die, dieType, result) {
  const existing = die.faceMode === CUSTOM_FACE_MODE ? die.faces?.[String(result)] : null;
  if (existing) return structuredClone(existing);
  return { kind: 'text', value: getCanonicalFaceLabel(dieType, result) };
}

export function applyFaceStyleToDie(set, dieType, style) {
  try {
    if (!Object.hasOwn(CANONICAL_DICE, dieType)) throw new Error(`Unsupported die type: ${dieType}`);
    const next = cloneDiceSet(set);
    const die = next.appearance?.diceSet?.dice?.[dieType];
    if (!die) throw new Error(`Missing ${dieType} appearance configuration.`);
    const safeStyle = assertStyle(style);
    die.faceMode = CUSTOM_FACE_MODE;
    die.faces = Object.fromEntries(getCanonicalFaceResults(dieType).map((result) => {
      const face = displayFace(die, dieType, result);
      return [String(result), { ...face, ...safeStyle }];
    }));
    return assertValidDiceSet(next);
  } catch (error) {
    console.error('Failed to apply face style to die:', error);
    throw error;
  }
}
