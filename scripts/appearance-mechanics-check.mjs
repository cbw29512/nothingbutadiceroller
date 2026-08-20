import assert from 'node:assert/strict';
import {
  CANONICAL_DICE,
  RAW_FACE_MODE,
  SYSTEM_DEFAULT_DICE_SET,
  cloneSystemDefaultAppearance,
} from '../js/appearance/defaults.mjs';
import { getCanonicalFaceLabel, getCanonicalFaceResults } from '../js/appearance/face-values.mjs';
import { getFaceLayout, getSupportedFaceEditorDice } from '../js/appearance/face-layouts.mjs';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';
import {
  getVisualFace,
  removeVisualFace,
  replaceVisualFace,
  useRawFaces,
} from '../js/appearance/face-customization.mjs';

const owner = 'user_owner';
assert.equal(SYSTEM_DEFAULT_DICE_SET.appearance.diceSet.defaultStyle.bodyColor, '#b91c1c');
assert.equal(SYSTEM_DEFAULT_DICE_SET.appearance.diceSet.defaultStyle.faceColor, '#ffffff');
assert.equal(SYSTEM_DEFAULT_DICE_SET.appearance.tray.color, '#000000');
assert.equal(validateDiceSet(SYSTEM_DEFAULT_DICE_SET).ok, true);

for (const type of Object.keys(CANONICAL_DICE)) {
  const die = SYSTEM_DEFAULT_DICE_SET.appearance.diceSet.dice[type];
  assert.equal(die.shapeId, `canonical:${type}`);
  assert.equal(die.logicalDie, type);
  assert.equal(die.faceMode, RAW_FACE_MODE);
  assert.deepEqual(die.faces, {});
}

for (const type of getSupportedFaceEditorDice()) {
  const expected = getCanonicalFaceResults(type);
  const layout = getFaceLayout(type);
  assert.equal(layout.length, expected.length, `${type} editor must expose every physical face.`);
  assert.deepEqual(layout.map((face) => face.logicalFace), expected, `${type} editor must preserve engine face results.`);
}
assert.equal(getCanonicalFaceLabel('d10', 10), '0');
assert.equal(getCanonicalFaceLabel('d100', 0), '00');
assert.equal(getCanonicalFaceLabel('d100', 90), '90');
assert.deepEqual(getCanonicalFaceResults('d100'), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);

assert.throws(() => {
  SYSTEM_DEFAULT_DICE_SET.appearance.tray.color = '#ffffff';
}, TypeError, 'System default must be deeply immutable.');

const rawStyled = createUserDiceSet({ id: 'styled_raw', ownerId: owner, name: 'Purple RAW' });
rawStyled.appearance.diceSet.defaultStyle.bodyColor = '#7c3aed';
rawStyled.appearance.diceSet.defaultStyle.faceColor = '#ffd700';
assert.equal(validateDiceSet(rawStyled).ok, true, 'Colors do not stop dice from being RAW.');

const fakeSystem = structuredClone(SYSTEM_DEFAULT_DICE_SET);
fakeSystem.appearance.diceSet.defaultStyle.bodyColor = '#0000ff';
assert.equal(validateDiceSet(fakeSystem).ok, false, 'A forged system-default appearance must be rejected.');

const extraDie = structuredClone(rawStyled);
extraDie.appearance.diceSet.dice.d30 = {
  shapeId: 'canonical:d30', logicalDie: 'd30', faceMode: RAW_FACE_MODE, styleOverrides: {}, faces: {},
};
assert.equal(validateDiceSet(extraDie).ok, false, 'Only supported standard RPG dice may exist in a set.');

const illegalRaw = structuredClone(rawStyled);
illegalRaw.appearance.diceSet.dice.d20.faces = { 20: { kind: 'text', value: '☠' } };
assert.equal(validateDiceSet(illegalRaw).ok, false, 'RAW dice cannot replace canonical labels.');

let custom = replaceVisualFace(rawStyled, 'd20', 20, { kind: 'text', value: '☠', color: '#a855f7' });
custom = replaceVisualFace(custom, 'd20', 1, { kind: 'text', value: 'FIRE', color: '#ffffff', fontId: 'fantasy' });
custom = replaceVisualFace(custom, 'd4', 1, { kind: 'text', value: 'ᚱ', color: '#ffffff', fontId: 'runic' });
custom = replaceVisualFace(custom, 'd100', 0, { kind: 'text', value: 'BOOM', color: '#ffffff' });
assert.equal(validateDiceSet(custom).ok, true, 'Symbols and short words are visual-only and valid.');
assert.equal(getVisualFace(custom, 'd20', 17).value, '17');
assert.equal(getVisualFace(custom, 'd10', 10).value, '0');
assert.equal(getVisualFace(custom, 'd100', 0).value, 'BOOM');
assert.equal(getVisualFace(custom, 'd100', 10).value, '10');

const legacyIcon = replaceVisualFace(custom, 'd6', 6, { kind: 'icon', value: 'skull', color: '#ffffff' });
assert.equal(validateDiceSet(legacyIcon).ok, true, 'Built-in icon faces remain readable.');
assert.throws(() => replaceVisualFace(custom, 'd4', 5, { kind: 'text', value: 'X' }));
assert.throws(() => replaceVisualFace(custom, 'd100', 100, { kind: 'text', value: 'X' }));
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: '' }));
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: 'ABCDEFGHIJKLM' }));
assert.throws(() => replaceVisualFace(custom, 'd20', 20, { kind: 'image', assetId: 'skull.png' }));

custom = removeVisualFace(custom, 'd20', 20);
assert.equal(getVisualFace(custom, 'd20', 20).value, '20');
custom = useRawFaces(custom, 'd20');
assert.equal(custom.appearance.diceSet.dice.d20.faceMode, RAW_FACE_MODE);
assert.deepEqual(custom.appearance.diceSet.dice.d20.faces, {});

const wrongShape = structuredClone(custom);
wrongShape.appearance.diceSet.dice.d20.shapeId = 'custom:d20';
assert.equal(validateDiceSet(wrongShape).ok, false);
const wrongLogic = structuredClone(custom);
wrongLogic.appearance.diceSet.dice.d20.logicalDie = 'd6';
assert.equal(validateDiceSet(wrongLogic).ok, false);

const clone = cloneSystemDefaultAppearance();
clone.tray.color = '#123456';
assert.equal(SYSTEM_DEFAULT_DICE_SET.appearance.tray.color, '#000000');
console.log('Appearance mechanics passed: visual customization preserves canonical RPG geometry and engine results.');
