export const DEFAULT_FACE_GLYPH_POSITION = 'center';
export const FACE_GLYPH_POSITION_OPTIONS = Object.freeze([
  { id: 'center', label: 'Center' },
  { id: 'top', label: 'Top' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'right', label: 'Right' },
  { id: 'bottom-right', label: 'Bottom Right' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'left', label: 'Left' },
  { id: 'top-left', label: 'Top Left' },
]);

const POSITION_IDS = new Set(FACE_GLYPH_POSITION_OPTIONS.map((option) => option.id));
const SHIFT = 0.08;
const OFFSETS = Object.freeze({
  center: { x: 0, y: 0 },
  top: { x: 0, y: -SHIFT },
  'top-right': { x: SHIFT, y: -SHIFT },
  right: { x: SHIFT, y: 0 },
  'bottom-right': { x: SHIFT, y: SHIFT },
  bottom: { x: 0, y: SHIFT },
  'bottom-left': { x: -SHIFT, y: SHIFT },
  left: { x: -SHIFT, y: 0 },
  'top-left': { x: -SHIFT, y: -SHIFT },
});

export function isValidFaceGlyphPosition(value) {
  return typeof value === 'string' && POSITION_IDS.has(value);
}

export function normalizeFaceGlyphPosition(value) {
  return isValidFaceGlyphPosition(value) ? value : DEFAULT_FACE_GLYPH_POSITION;
}

export function faceGlyphPositionOffset(value) {
  return OFFSETS[normalizeFaceGlyphPosition(value)];
}

export function faceGlyphPreviewTransform(value) {
  const offset = faceGlyphPositionOffset(value);
  return `translate(${offset.x * 3}em, ${offset.y * 3}em)`;
}
