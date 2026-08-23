export const MIN_FACE_GLYPH_SCALE = 0.6;
export const MAX_FACE_GLYPH_SCALE = 1.2;
export const DEFAULT_FACE_GLYPH_SCALE = 1;

export function isValidFaceGlyphScale(value) {
  return Number.isFinite(value) && value >= MIN_FACE_GLYPH_SCALE && value <= MAX_FACE_GLYPH_SCALE;
}

export function normalizeFaceGlyphScale(value) {
  if (value == null || value === '') return DEFAULT_FACE_GLYPH_SCALE;
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_FACE_GLYPH_SCALE;
  return Math.max(MIN_FACE_GLYPH_SCALE, Math.min(MAX_FACE_GLYPH_SCALE, Math.round(number * 100) / 100));
}

export function faceGlyphScalePercent(value) {
  return Math.round(normalizeFaceGlyphScale(value) * 100);
}
