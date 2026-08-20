export const MAX_FACE_NUMBER_CHARACTERS = 16;
const FACE_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

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
  if (!text) return false;
  if (text.length <= MAX_FACE_NUMBER_CHARACTERS && FACE_NUMBER.test(text)) return true;
  return countFaceDisplayGraphemes(text) === 1;
}
