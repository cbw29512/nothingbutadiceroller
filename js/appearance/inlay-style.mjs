const HEX = /^#[0-9a-f]{6}$/i;
const INLAY_KEYS = new Set(['type', 'color', 'intensity', 'width']);

export const EDGE_INLAY_TYPES = Object.freeze([
  'none',
  'fine',
  'bold',
  'dashed',
  'dotted',
]);

export const DEFAULT_EDGE_INLAY = Object.freeze({
  type: 'none',
  color: '#f8fafc',
  intensity: 0.8,
  width: 0.5,
});

function clamp01(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizeHex(value, fallback) {
  const text = String(value || '').trim();
  return HEX.test(text) ? text.toLowerCase() : fallback.toLowerCase();
}

export function normalizeEdgeInlay(value) {
  try {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const type = EDGE_INLAY_TYPES.includes(String(source.type || ''))
      ? String(source.type)
      : DEFAULT_EDGE_INLAY.type;
    return {
      type,
      color: normalizeHex(source.color, DEFAULT_EDGE_INLAY.color),
      intensity: clamp01(source.intensity, DEFAULT_EDGE_INLAY.intensity),
      width: clamp01(source.width, DEFAULT_EDGE_INLAY.width),
    };
  } catch (error) {
    console.error('Failed to normalize dice edge inlay:', error);
    return { ...DEFAULT_EDGE_INLAY };
  }
}

export function validateEdgeInlay(value, path, errors) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path} must be an object.`);
      return;
    }
    const unsupported = Object.keys(value).filter((key) => !INLAY_KEYS.has(key));
    if (unsupported.length) errors.push(`${path} contains unsupported fields: ${unsupported.join(', ')}.`);
    if (!EDGE_INLAY_TYPES.includes(String(value.type || ''))) errors.push(`${path}.type is unsupported.`);
    if (!HEX.test(String(value.color || ''))) errors.push(`${path}.color is invalid.`);
    if (!Number.isFinite(value.intensity) || value.intensity < 0 || value.intensity > 1) errors.push(`${path}.intensity must be between 0 and 1.`);
    if (!Number.isFinite(value.width) || value.width < 0 || value.width > 1) errors.push(`${path}.width must be between 0 and 1.`);
  } catch (error) {
    console.error('Failed to validate dice edge inlay:', error);
    errors.push(`${path} could not be validated.`);
  }
}
