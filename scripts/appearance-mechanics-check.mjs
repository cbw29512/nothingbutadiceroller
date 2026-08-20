import assert from 'node:assert/strict';
import {
  CANONICAL_DICE,
  RAW_FACE_MODE,
  SYSTEM_DEFAULT_DICE_SET,
  cloneSystemDefaultAppearance,
} from '../js/appearance/defaults.mjs';
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
  const layout = getFaceLayout(type);
  assert.equal(layout.length, CANONICAL_DICE[type], `${type} editor must expose every canonical face.`);
  assert.deepEqual(
    layout.map((face) => face.logicalFace),
    Array.from({ length: CANONICAL_DICE[type] }, (_, index) => index + 1),
    `${type} editor must preserve canonical face numbers.`,
  );
}
assert.throws(() => getFaceLayout('d100'), Error, 'd100 requires a dedicated percentile editor.');

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

const stolenDefaultId = structuredClone(rawStyled);
stolenDefaultId.id = 'system-default';
assert.equal(validateDiceSet(stolenDefaultId).ok, false, 'User sets cannot impersonate the immutable default.');

const illegalRaw = structuredClone(rawStyled);
illegalRaw.appearance.diceSet.dice.d20.faces = { 20: { kind: 'text', value: '☠' } };
assert.equal(validateDiceSet(illegalRaw).ok, false, 'RAW dice cannot replace canonical labels.');

let custom = replaceVisualFace(rawStyled, 'd20', 20, {
  kind: 'text', value: '☠', color: '#a855f7',
});
custom = replaceVisualFace(custom, 'd20', 1, {
  kind: 'text', value: 'A', color: '#ffffff', fontId: 'fantasy',
});
custom = replaceVisualFace(custom, 'd4', 1, {
  kind: 'text', value: 'ᚱ', color: '#ffffff', fontId: 'runic',
});
assert.equal(validateDiceSet(custom).ok, true);
const legacyIcon = replaceVisualFace(custom, 'd6', 6, { kind: 'icon', value: 'skull', color: '#ffffff' });
assert.equal(validateDiceSet(legacyIcon).ok, true, 'Existing built-in icon faces remain readable.');
assert.equal(custom.appearance.diceSet.dice.d20.logicalDie, 'd20');
assert.equal(custom.appearance.diceSet.dice.d20.shapeId, 'canonical:d20');
assert.equal(getVisualFace(custom, 'd20', 20).value, '☠');
assert.equal(getVisualFace(custom, 'd20', 17).value, '17');
assert.equal(getVisualFace(custom, 'd20', 17).canonical, true);

const numericVisual = replaceVisualFace(custom, 'd20', 2, { kind: 'text', value: '20' });
assert.equal(validateDiceSet(numericVisual).ok, true, 'Numeric visual labels may contain multiple digits.');
const emojiVisual = replaceVisualFace(custom, 'd20', 3, { kind: 'text', value: '☠️' });
assert.equal(validateDiceSet(emojiVisual).ok, true, 'One rendered Unicode symbol is allowed.');

for (const badValue of ['CRIT', 'AB', '🔥🔥', '']) {
  assert.throws(
    () => replaceVisualFace(custom, 'd20', 20, { kind: 'text', value: badValue }),
    Error,
    `Custom face value ${JSON.stringify(badValue)} must be rejected.`,
  );
}
assert.throws(
  () => replaceVisualFace(custom, 'd20', 20, { kind: 'image', assetId: 'skull.png' }),
  Error,
  'Image faces are not allowed.',
);

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
assert.throws(() => replaceVisualFace(custom, 'd4', 5, { kind: 'text', value: 'X' }));

const clone = cloneSystemDefaultAppearance();
clone.tray.color = '#123456';
assert.equal(SYSTEM_DEFAULT_DICE_SET.appearance.tray.color, '#000000');
console.log('Appearance mechanics passed: customization is visual-only; canonical RPG dice and results are protected.');
