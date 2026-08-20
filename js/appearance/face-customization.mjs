import { CANONICAL_DICE, CUSTOM_FACE_MODE, RAW_FACE_MODE } from './defaults.mjs';
import { getCanonicalFaceLabel, isCanonicalFaceResult } from './face-values.mjs';
import { cloneDiceSet } from './schema.mjs';
import { assertValidDiceSet } from './validation.mjs';

function getDie(set, dieType) {
  if (!Object.hasOwn(CANONICAL_DICE, dieType)) throw new Error(`Unsupported die type: ${dieType}`);
  const die = set?.appearance?.diceSet?.dice?.[dieType];
  if (!die) throw new Error(`Missing ${dieType} appearance configuration.`);
  return die;
}

function assertLogicalFace(dieType, logicalFace) {
  const value = Number(logicalFace);
  if (!isCanonicalFaceResult(dieType, value)) {
    throw new Error(`${logicalFace} is not a physical face result for ${dieType}.`);
  }
  return String(value);
}

export function useRawFaces(set, dieType) {
  try {
    const next = cloneDiceSet(set);
    const die = getDie(next, dieType);
    die.faceMode = RAW_FACE_MODE;
    die.faces = {};
    return assertValidDiceSet(next);
  } catch (error) {
    console.error('Failed to restore RAW die faces:', error);
    throw error;
  }
}

export function replaceVisualFace(set, dieType, logicalFace, visualFace) {
  try {
    const next = cloneDiceSet(set);
    const die = getDie(next, dieType);
    const key = assertLogicalFace(dieType, logicalFace);
    die.faceMode = CUSTOM_FACE_MODE;
    die.faces = { ...(die.faces || {}), [key]: structuredClone(visualFace) };
    return assertValidDiceSet(next);
  } catch (error) {
    console.error('Failed to replace visual die face:', error);
    throw error;
  }
}

export function removeVisualFace(set, dieType, logicalFace) {
  try {
    const next = cloneDiceSet(set);
    const die = getDie(next, dieType);
    const key = assertLogicalFace(dieType, logicalFace);
    const faces = { ...(die.faces || {}) };
    delete faces[key];
    die.faces = faces;
    die.faceMode = Object.keys(faces).length ? CUSTOM_FACE_MODE : RAW_FACE_MODE;
    return assertValidDiceSet(next);
  } catch (error) {
    console.error('Failed to remove visual die face:', error);
    throw error;
  }
}

export function getVisualFace(set, dieType, logicalResult) {
  try {
    const die = getDie(set, dieType);
    const key = assertLogicalFace(dieType, logicalResult);
    if (die.faceMode === CUSTOM_FACE_MODE && die.faces?.[key]) return die.faces[key];
    return { kind: 'number', value: getCanonicalFaceLabel(dieType, logicalResult), canonical: true };
  } catch (error) {
    console.error('Failed to resolve visual die face:', error);
    throw error;
  }
}
