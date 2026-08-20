import { CANONICAL_DICE } from './defaults.mjs';

const SUPPORTED_EDITOR_DICE = Object.freeze(['d4', 'd6', 'd8', 'd10', 'd12', 'd20']);

const FACE_SHAPES = Object.freeze({
  d4: 'triangle',
  d6: 'square',
  d8: 'triangle',
  d10: 'kite',
  d12: 'pentagon',
  d20: 'triangle',
});

const FACE_LAYOUTS = Object.freeze({
  d4: [
    [50, 16],
    [32, 52], [68, 52],
    [50, 84],
  ],
  d6: [
    [50, 18],
    [20, 50], [40, 50], [60, 50], [80, 50],
    [50, 82],
  ],
  d8: [
    [50, 12],
    [24, 38], [50, 38], [76, 38],
    [24, 66], [50, 66], [76, 66],
    [50, 90],
  ],
  d10: [
    [50, 10],
    [30, 30], [70, 30],
    [14, 52], [38, 52], [62, 52], [86, 52],
    [30, 74], [70, 74],
    [50, 92],
  ],
  d12: [
    [50, 8],
    [28, 26], [72, 26],
    [18, 48], [50, 44], [82, 48],
    [18, 70], [50, 66], [82, 70],
    [28, 86], [72, 86],
    [50, 96],
  ],
  d20: [
    [50, 7],
    [25, 21], [50, 21], [75, 21],
    [12, 35], [37, 35], [63, 35], [88, 35],
    [12, 50], [37, 50], [63, 50], [88, 50],
    [12, 65], [37, 65], [63, 65], [88, 65],
    [25, 79], [50, 79], [75, 79],
    [50, 93],
  ],
});

function assertEditorDie(dieType) {
  if (!SUPPORTED_EDITOR_DICE.includes(dieType)) {
    throw new Error(`Face editor does not support ${dieType}.`);
  }
  return dieType;
}

export function getFaceLayout(dieType) {
  try {
    const type = assertEditorDie(dieType);
    const expectedFaces = CANONICAL_DICE[type];
    const positions = FACE_LAYOUTS[type];
    if (positions.length !== expectedFaces) {
      throw new Error(`${type} editor layout must expose exactly ${expectedFaces} faces.`);
    }

    return positions.map(([x, y], index) => ({
      logicalFace: index + 1,
      x,
      y,
      shape: FACE_SHAPES[type],
    }));
  } catch (error) {
    console.error('Failed to build die face layout:', error);
    throw error;
  }
}

export function getSupportedFaceEditorDice() {
  return [...SUPPORTED_EDITOR_DICE];
}
