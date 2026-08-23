const FACE_FONT_ORDER = Object.freeze(['', 'default', 'fantasy', 'runic', 'mono']);
const FACE_FONT_STACKS = Object.freeze({
  '': 'Arial, sans-serif',
  default: 'Arial, sans-serif',
  fantasy: 'Georgia, serif',
  runic: 'Georgia, serif',
  mono: '"Courier New", monospace',
});

export const FACE_FONT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'default', label: 'Default' }),
  Object.freeze({ id: 'fantasy', label: 'Fantasy / Serif' }),
  Object.freeze({ id: 'mono', label: 'Mono / Arcane Tech' }),
]);

export function isSupportedFaceFontId(value) {
  return typeof value === 'string' && FACE_FONT_ORDER.includes(value);
}

export function normalizeFaceFontId(value) {
  const id = String(value ?? '').trim();
  return isSupportedFaceFontId(id) && id ? id : 'default';
}

export function faceFontStack(value) {
  const id = String(value ?? '');
  return FACE_FONT_STACKS[id] || FACE_FONT_STACKS.default;
}

export function faceFontWireCode(value) {
  const id = String(value ?? '');
  const index = FACE_FONT_ORDER.indexOf(id);
  if (index < 0) throw new Error('Unsupported face font id.');
  return index;
}

export function faceFontIdFromWireCode(value) {
  const code = Number(value);
  if (!Number.isInteger(code) || code < 0 || code >= FACE_FONT_ORDER.length) throw new Error('Unsupported face font wire code.');
  return FACE_FONT_ORDER[code];
}

export const SUPPORTED_FACE_FONT_IDS = FACE_FONT_ORDER;
