import assert from 'node:assert/strict';
import {
  CANONICAL_DICE,
  RAW_FACE_MODE,
  SYSTEM_DEFAULT_DICE_SET,
  cloneSystemDefaultAppearance,
} from '../js/appearance/defaults.mjs';
import { FACE_FONT_OPTIONS, faceFontStack, isSupportedFaceFontId } from '../js/appearance/face-fonts.mjs';
import {
  DEFAULT_FACE_GLYPH_POSITION,
  FACE_GLYPH_POSITION_OPTIONS,
  faceGlyphPositionOffset,
  isValidFaceGlyphPosition,
  normalizeFaceGlyphPosition,
} from '../js/appearance/face-glyph-position.mjs';
import {
  DEFAULT_FACE_GLYPH_SCALE,
  MAX_FACE_GLYPH_SCALE,
  MIN_FACE_GLYPH_SCALE,
  isValidFaceGlyphScale,
  normalizeFaceGlyphScale,
} from '../js/appearance/face-glyph-scale.mjs';
import { applyFaceStyleToDie } from '../js/appearance/face-style-batch.mjs';
import { getCanonicalFaceLabel, getCanonicalFaceResults } from '../js/appearance/face-values.mjs';
import { getFaceLayout, getSupportedFaceEditorDice } from '../js/appearance/face-layouts.mjs';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';
import { getVisualFace, removeVisualFace, replaceVisualFace, useRawFaces } from '../js/appearance/face-customization.mjs';

const owner = 'user_owner';
assert.equal(SYSTEM_DEFAULT_DICE_SET.appearance.diceSet.defaultStyle.bodyColor, '#b91c1c');
assert.equal(SYSTEM_DEFAULT_DICE_SET.appearance.diceSet.defaultStyle.faceColor, '#ffffff');
assert.equal(SYSTEM_DEFAULT_DICE_SET.appearance.tray.color, '#000000');
assert.equal(validateDiceSet(SYSTEM_DEFAULT_DICE_SET).ok, true);
assert.deepEqual(FACE_FONT_OPTIONS.map((font) => font.id), ['default', 'fantasy', 'mono'], 'Studio typography must expose three visually distinct safe font choices.');
for (const id of ['', 'default', 'fantasy', 'runic', 'mono']) assert.equal(isSupportedFaceFontId(id), true, `${id || 'empty/default'} must remain runtime-compatible.`);
assert.equal(isSupportedFaceFontId('comic-sans'), false, 'Unknown face font IDs must fail closed.');
assert.equal(faceFontStack('default'), 'Arial, sans-serif');
assert.equal(faceFontStack('fantasy'), 'Georgia, serif');
assert.match(faceFontStack('mono'), /monospace/);
assert.equal(MIN_FACE_GLYPH_SCALE, 0.6); assert.equal(MAX_FACE_GLYPH_SCALE, 1.2); assert.equal(DEFAULT_FACE_GLYPH_SCALE, 1);
assert.equal(isValidFaceGlyphScale(0.6), true); assert.equal(isValidFaceGlyphScale(1), true); assert.equal(isValidFaceGlyphScale(1.2), true);
assert.equal(isValidFaceGlyphScale(0.59), false); assert.equal(isValidFaceGlyphScale(1.21), false); assert.equal(isValidFaceGlyphScale('1'), false);
assert.equal(normalizeFaceGlyphScale(undefined), 1); assert.equal(normalizeFaceGlyphScale(0.2), 0.6); assert.equal(normalizeFaceGlyphScale(3), 1.2);
assert.equal(DEFAULT_FACE_GLYPH_POSITION, 'center');
assert.equal(FACE_GLYPH_POSITION_OPTIONS.length, 9, 'Position control must stay bounded to center plus eight directions.');
for (const option of FACE_GLYPH_POSITION_OPTIONS) assert.equal(isValidFaceGlyphPosition(option.id), true, `${option.id} must be a valid bounded glyph position.`);
assert.equal(isValidFaceGlyphPosition('custom:0.73,-0.42'), false, 'Arbitrary glyph coordinates must fail closed.');
assert.equal(normalizeFaceGlyphPosition(undefined), 'center'); assert.equal(normalizeFaceGlyphPosition('nonsense'), 'center');
assert.deepEqual(faceGlyphPositionOffset('center'), { x: 0, y: 0 });
assert.deepEqual(faceGlyphPositionOffset('top-right'), { x: 0.08, y: -0.08 });
for (const type of Object.keys(CANONICAL_DICE)) {
  const die = SYSTEM_DEFAULT_DICE_SET.appearance.diceSet.dice[type];
  assert.equal(die.shapeId, `canonical:${type}`); assert.equal(die.logicalDie, type);
  assert.equal(die.faceMode, RAW_FACE_MODE); assert.deepEqual(die.faces, {});
}
for (const type of getSupportedFaceEditorDice()) {
  const expected = getCanonicalFaceResults(type); const layout = getFaceLayout(type);
  assert.equal(layout.length, expected.length, `${type} editor must expose every physical face.`);
  assert.deepEqual(layout.map((face) => face.logicalFace), expected, `${type} editor must preserve engine face results.`);
  layout.forEach((face) => { assert.ok(face.x >= 6 && face.x <= 94); assert.ok(face.y >= 6 && face.y <= 94); });
}
assert.equal(getCanonicalFaceLabel('d10', 10), '0');
assert.equal(getCanonicalFaceLabel('d100', 0), '00');
assert.equal(getCanonicalFaceLabel('d100', 90), '90');
assert.deepEqual(getCanonicalFaceResults('d100'), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
assert.throws(() => { SYSTEM_DEFAULT_DICE_SET.appearance.tray.color = '#ffffff'; }, TypeError);

const rawStyled = createUserDiceSet({ id: 'styled_raw', ownerId: owner, name: 'Purple RAW' });
rawStyled.appearance.diceSet.defaultStyle.bodyColor = '#7c3aed';
rawStyled.appearance.diceSet.defaultStyle.faceColor = '#ffd700';
assert.equal(validateDiceSet(rawStyled).ok, true, 'Colors do not stop dice from being RAW.');
const fakeSystem = structuredClone(SYSTEM_DEFAULT_DICE_SET); fakeSystem.appearance.diceSet.defaultStyle.bodyColor = '#0000ff';
assert.equal(validateDiceSet(fakeSystem).ok, false);
const extraDie = structuredClone(rawStyled);
extraDie.appearance.diceSet.dice.d30 = { shapeId: 'canonical:d30', logicalDie: 'd30', faceMode: RAW_FACE_MODE, styleOverrides: {}, faces: {} };
assert.equal(validateDiceSet(extraDie).ok, false);
const illegalRaw = structuredClone(rawStyled); illegalRaw.appearance.diceSet.dice.d20.faces = { 20: { kind: 'text', value: '☠' } };
assert.equal(validateDiceSet(illegalRaw).ok, false);

let custom = replaceVisualFace(rawStyled, 'd20', 20, { kind: 'text', value: '☠', color: '#a855f7', scale: 1.2, position: 'top-right' });
custom = replaceVisualFace(custom, 'd20', 1, { kind: 'text', value: 'CRIT', color: '#ffffff', fontId: 'fantasy', scale: 0.6, position: 'bottom-left' });
custom = replaceVisualFace(custom, 'd4', 1, { kind: 'text', value: 'ᚱ', color: '#ffffff', fontId: 'runic', scale: 1.1, position: 'top' });
custom = replaceVisualFace(custom, 'd8', 8, { kind: 'text', value: '☠️', color: '#ffffff' });
custom = replaceVisualFace(custom, 'd100', 0, { kind: 'text', value: 'BOOM', color: '#ffffff', fontId: 'mono', scale: 1, position: 'right' });
assert.equal(validateDiceSet(custom).ok, true, 'Numbers, symbols, runes, short words, supported fonts, bounded glyph scale, and bounded position are visual-only and valid.');
assert.equal(getVisualFace(custom, 'd20', 20).value, '☠'); assert.equal(getVisualFace(custom, 'd20', 20).scale, 1.2); assert.equal(getVisualFace(custom, 'd20', 20).position, 'top-right');
assert.equal(getVisualFace(custom, 'd20', 1).value, 'CRIT'); assert.equal(getVisualFace(custom, 'd20', 1).fontId, 'fantasy'); assert.equal(getVisualFace(custom, 'd20', 1).scale, 0.6); assert.equal(getVisualFace(custom, 'd20', 1).position, 'bottom-left');
assert.equal(getVisualFace(custom, 'd10', 10).value, '0');
assert.equal(getVisualFace(custom, 'd100', 0).value, 'BOOM'); assert.equal(getVisualFace(custom, 'd100', 0).fontId, 'mono'); assert.equal(getVisualFace(custom, 'd100', 0).position, 'right');
const legacyIcon = replaceVisualFace(custom, 'd6', 6, { kind: 'icon', value: 'skull', color: '#ffffff' });
assert.equal(validateDiceSet(legacyIcon).ok, true);
for (const word of ['FIRE', 'AB', 'MISS', 'ROLL AGAIN']) {
  const candidate = replaceVisualFace(custom, 'd20', 2, { kind: 'text', value: word });
  assert.equal(validateDiceSet(candidate).ok, true, `Short label ${word} must be valid.`);
}
assert.throws(() => replaceVisualFace(custom, 'd4', 5, { kind: 'text', value: 'X' }));
assert.throws(() => replaceVisualFace(custom, 'd100', 100, { kind: 'text', value: 'X' }));
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: '' }));
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: 'THIS LABEL IS FAR TOO LONG' }));
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: 'BAD\nLABEL' }));
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'image', assetId: 'skull.png' }));
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: 'BADFONT', fontId: 'user-font-url' }), /supported font/i);
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: 'SMALL', scale: 0.59 }), /scale must be between 0\.6 and 1\.2/i);
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: 'LARGE', scale: 1.21 }), /scale must be between 0\.6 and 1\.2/i);
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: 'MOVE', position: 'x:999' }), /supported bounded face position/i);

let batchSource = replaceVisualFace(rawStyled, 'd20', 20, { kind: 'text', value: 'CRIT', color: '#ffffff', fontId: 'default', scale: 1, position: 'center' });
batchSource = replaceVisualFace(batchSource, 'd20', 1, { kind: 'text', value: 'MISS', color: '#00ff00', fontId: 'mono', scale: 0.8, position: 'left' });
const batchStyle = { color: '#ff00ff', fontId: 'fantasy', scale: 1.2, position: 'top-right' };
const batched = applyFaceStyleToDie(batchSource, 'd20', batchStyle);
assert.equal(validateDiceSet(batched).ok, true, 'Batch face styling must produce a valid visual-only dice set.');
assert.equal(getVisualFace(batched, 'd20', 20).value, 'CRIT', 'Batch styling must preserve the selected custom face display.');
assert.equal(getVisualFace(batched, 'd20', 1).value, 'MISS', 'Batch styling must preserve another custom face display.');
assert.equal(getVisualFace(batched, 'd20', 2).value, '2', 'Batch styling must preserve untouched canonical labels.');
for (const result of getCanonicalFaceResults('d20')) {
  const face = getVisualFace(batched, 'd20', result);
  assert.equal(face.color, batchStyle.color); assert.equal(face.fontId, batchStyle.fontId);
  assert.equal(face.scale, batchStyle.scale); assert.equal(face.position, batchStyle.position);
}
assert.equal(getVisualFace(batchSource, 'd20', 1).fontId, 'mono', 'Batch styling must not mutate the source dice set.');
assert.equal(batched.appearance.diceSet.dice.d20.shapeId, 'canonical:d20'); assert.equal(batched.appearance.diceSet.dice.d20.logicalDie, 'd20');
const percentileBatch = applyFaceStyleToDie(rawStyled, 'd100', batchStyle);
assert.equal(getVisualFace(percentileBatch, 'd100', 0).value, '00', 'Batch styling must preserve the d100 zero label.');
assert.equal(getVisualFace(percentileBatch, 'd100', 10).value, '10'); assert.equal(getVisualFace(percentileBatch, 'd100', 90).value, '90');
assert.throws(() => applyFaceStyleToDie(rawStyled, 'd20', { ...batchStyle, position: 'freehand' }), /supported bounded face position/i);
assert.throws(() => applyFaceStyleToDie(rawStyled, 'd20', { ...batchStyle, scale: 2 }), /scale must be between 0\.6 and 1\.2/i);
assert.throws(() => applyFaceStyleToDie(rawStyled, 'd30', batchStyle), /Unsupported die type/i);

custom = removeVisualFace(custom, 'd20', 20); assert.equal(getVisualFace(custom, 'd20', 20).value, '20');
custom = useRawFaces(custom, 'd20'); assert.equal(custom.appearance.diceSet.dice.d20.faceMode, RAW_FACE_MODE); assert.deepEqual(custom.appearance.diceSet.dice.d20.faces, {});
const wrongShape = structuredClone(custom); wrongShape.appearance.diceSet.dice.d20.shapeId = 'custom:d20'; assert.equal(validateDiceSet(wrongShape).ok, false);
const wrongLogic = structuredClone(custom); wrongLogic.appearance.diceSet.dice.d20.logicalDie = 'd6'; assert.equal(validateDiceSet(wrongLogic).ok, false);
const clone = cloneSystemDefaultAppearance(); clone.tray.color = '#123456'; assert.equal(SYSTEM_DEFAULT_DICE_SET.appearance.tray.color, '#000000');
console.log('Appearance mechanics passed: customization is visual-only; canonical RPG dice/results are protected, typography, 60–120% glyph scale, nine bounded positions, and style-only batch editing are enforced.');
