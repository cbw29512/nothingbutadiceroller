const HEX = /^#[0-9a-f]{6}$/i;

export const SURFACE_PATTERN_TYPES = Object.freeze(['solid', 'stripes', 'spots', 'marble', 'gradient']);
export const DEFAULT_SURFACE_PATTERN = Object.freeze({
  type: 'solid',
  primaryColor: '#b91c1c',
  secondaryColor: '#7f1d1d',
  strength: 0.55,
  scale: 0.5,
});

function clamp01(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}
function color(value, fallback) {
  const text = String(value || '').trim();
  return HEX.test(text) ? text.toLowerCase() : fallback.toLowerCase();
}

export function normalizeSurfacePattern(value, bodyColor = '#b91c1c') {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const type = SURFACE_PATTERN_TYPES.includes(String(source.type || '')) ? String(source.type) : 'solid';
  return {
    type,
    primaryColor: color(source.primaryColor, color(bodyColor, DEFAULT_SURFACE_PATTERN.primaryColor)),
    secondaryColor: color(source.secondaryColor, DEFAULT_SURFACE_PATTERN.secondaryColor),
    strength: clamp01(source.strength, DEFAULT_SURFACE_PATTERN.strength),
    scale: clamp01(source.scale, DEFAULT_SURFACE_PATTERN.scale),
  };
}

export function patternIsActive(pattern) {
  return normalizeSurfacePattern(pattern).type !== 'solid';
}
