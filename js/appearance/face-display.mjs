export const MAX_FACE_NUMBER_CHARACTERS = 16;
export const MAX_FACE_LABEL_GRAPHEMES = 12;
const FACE_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const CONTROL_OR_LINEBREAK = /[\u0000-\u001f\u007f\r\n]/;

export function countFaceDisplayGraphemes(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  try {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;
  } catch (error) {
    console.warn('Falling back to code-point face display validation:', error);
    return Array.from(text).length;
  }
}

export function isValidFaceDisplayValue(value) {
  const text = String(value ?? '').trim();
  if (!text || CONTROL_OR_LINEBREAK.test(text)) return false;
  if (text.length <= MAX_FACE_NUMBER_CHARACTERS && FACE_NUMBER.test(text)) return true;
  const graphemes = countFaceDisplayGraphemes(text);
  return graphemes >= 1 && graphemes <= MAX_FACE_LABEL_GRAPHEMES;
}
