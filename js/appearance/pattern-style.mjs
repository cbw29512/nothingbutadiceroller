const HEX = /^#[0-9a-f]{6}$/i;
const PATTERN_KEYS = new Set(['type', 'primaryColor', 'secondaryColor', 'intensity', 'scale']);

export const SURFACE_PATTERN_TYPES = Object.freeze([
  'none',
  'marble',
  'swirl',
  'speckle',
  'split',
]);

export const DEFAULT_SURFACE_PATTERN = Object.freeze({
  type: 'none',
  primaryColor: '#f8fafc',
  secondaryColor: '#64748b',
  intensity: 0.55,
  scale: 0.5,
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

export function normalizeSurfacePattern(value) {
  try {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const type = SURFACE_PATTERN_TYPES.includes(String(source.type || ''))
      ? String(source.type)
      : DEFAULT_SURFACE_PATTERN.type;
    return {
      type,
      primaryColor: normalizeHex(source.primaryColor, DEFAULT_SURFACE_PATTERN.primaryColor),
      secondaryColor: normalizeHex(source.secondaryColor, DEFAULT_SURFACE_PATTERN.secondaryColor),
      intensity: clamp01(source.intensity, DEFAULT_SURFACE_PATTERN.intensity),
      scale: clamp01(source.scale, DEFAULT_SURFACE_PATTERN.scale),
    };
  } catch (error) {
    console.error('Failed to normalize dice surface pattern:', error);
    return { ...DEFAULT_SURFACE_PATTERN };
  }
}

export function validateSurfacePattern(value, path, errors) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path} must be an object.`);
      return;
    }
    const unsupported = Object.keys(value).filter((key) => !PATTERN_KEYS.has(key));
    if (unsupported.length) errors.push(`${path} contains unsupported fields: ${unsupported.join(', ')}.`);
    if (!SURFACE_PATTERN_TYPES.includes(String(value.type || ''))) errors.push(`${path}.type is unsupported.`);
    if (!HEX.test(String(value.primaryColor || ''))) errors.push(`${path}.primaryColor is invalid.`);
    if (!HEX.test(String(value.secondaryColor || ''))) errors.push(`${path}.secondaryColor is invalid.`);
    if (!Number.isFinite(value.intensity) || value.intensity < 0 || value.intensity > 1) errors.push(`${path}.intensity must be between 0 and 1.`);
    if (!Number.isFinite(value.scale) || value.scale < 0 || value.scale > 1) errors.push(`${path}.scale must be between 0 and 1.`);
  } catch (error) {
    console.error('Failed to validate dice surface pattern:', error);
    errors.push(`${path} could not be validated.`);
  }
}
