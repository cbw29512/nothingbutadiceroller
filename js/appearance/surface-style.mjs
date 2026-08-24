const HEX = /^#[0-9a-f]{6}$/i;

export const SURFACE_FINISH_TYPES = Object.freeze([
  'standard',
  'matte',
  'satin',
  'gloss',
  'metallic',
  'pearl',
]);

export const DEFAULT_SURFACE_FINISH = Object.freeze({
  type: 'standard',
  accentColor: '#ffffff',
  intensity: 0.55,
});

function clamp01(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizeHex(value, fallback = '#ffffff') {
  const text = String(value || '').trim();
  return HEX.test(text) ? text.toLowerCase() : fallback.toLowerCase();
}

export function normalizeSurfaceFinish(value) {
  try {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const type = SURFACE_FINISH_TYPES.includes(String(source.type || ''))
      ? String(source.type)
      : DEFAULT_SURFACE_FINISH.type;
    return {
      type,
      accentColor: normalizeHex(source.accentColor, DEFAULT_SURFACE_FINISH.accentColor),
      intensity: clamp01(source.intensity, DEFAULT_SURFACE_FINISH.intensity),
    };
  } catch (error) {
    console.error('Failed to normalize dice surface finish:', error);
    return { ...DEFAULT_SURFACE_FINISH };
  }
}
