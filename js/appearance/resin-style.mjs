const HEX = /^#[0-9a-f]{6}$/i;

export const INTERIOR_EFFECT_TYPES = Object.freeze([
  'none',
  'glitter',
  'flakes',
  'smoke',
  'nebula',
  'bubbles',
]);

export const DEFAULT_TRANSLUCENCY = Object.freeze({
  enabled: false,
  opacity: 0.72,
  frost: 0.08,
  tintColor: '#b91c1c',
});

export const DEFAULT_INTERIOR = Object.freeze({
  enabled: false,
  type: 'none',
  primaryColor: '#f8fafc',
  secondaryColor: '#7dd3fc',
  density: 0.45,
  intensity: 0.7,
});

export function clamp01(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

export function normalizeHex(value, fallback = '#ffffff') {
  const text = String(value || '').trim();
  return HEX.test(text) ? text.toLowerCase() : fallback.toLowerCase();
}

export function normalizeTranslucency(value, bodyColor = '#b91c1c') {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    enabled: source.enabled === true,
    opacity: clamp01(source.opacity, DEFAULT_TRANSLUCENCY.opacity),
    frost: clamp01(source.frost, DEFAULT_TRANSLUCENCY.frost),
    tintColor: normalizeHex(source.tintColor, normalizeHex(bodyColor, DEFAULT_TRANSLUCENCY.tintColor)),
  };
}

export function normalizeInterior(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const type = INTERIOR_EFFECT_TYPES.includes(String(source.type || '')) ? String(source.type) : 'none';
  return {
    enabled: source.enabled === true && type !== 'none',
    type,
    primaryColor: normalizeHex(source.primaryColor, DEFAULT_INTERIOR.primaryColor),
    secondaryColor: normalizeHex(source.secondaryColor, DEFAULT_INTERIOR.secondaryColor),
    density: clamp01(source.density, DEFAULT_INTERIOR.density),
    intensity: clamp01(source.intensity, DEFAULT_INTERIOR.intensity),
  };
}

export function normalizeResinStyle(style = {}) {
  const bodyColor = normalizeHex(style.bodyColor, '#b91c1c');
  return {
    translucency: normalizeTranslucency(style.translucency, bodyColor),
    interior: normalizeInterior(style.interior),
  };
}

function parseHex(hex) {
  const safe = normalizeHex(hex);
  return [1, 3, 5].map((start) => Number.parseInt(safe.slice(start, start + 2), 16));
}

export function rgba(hex, alpha = 1) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha, 1)})`;
}

export function blendHex(from, to, amount = 0.5) {
  const first = parseHex(from);
  const second = parseHex(to);
  const ratio = clamp01(amount, 0.5);
  const values = first.map((channel, index) => Math.round(channel + ((second[index] - channel) * ratio)));
  return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function simulatedResinBodyColor(style = {}) {
  const body = normalizeHex(style.bodyColor, '#b91c1c');
  const { translucency } = normalizeResinStyle(style);
  if (!translucency.enabled) return body;
  const tint = blendHex(body, translucency.tintColor, 0.45);
  return blendHex(tint, '#ffffff', Math.max(0.08, (1 - translucency.opacity) * 0.55));
}
