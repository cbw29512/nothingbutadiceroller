export const DEFAULT_VISIBLE_GLOW_INTENSITY = 0.75;

export function setGlowEnabled(glow, enabled) {
  if (!glow || typeof glow !== 'object') throw new TypeError('Glow settings are required.');
  glow.enabled = Boolean(enabled);
  if (glow.enabled && !(Number(glow.intensity) > 0)) {
    glow.intensity = DEFAULT_VISIBLE_GLOW_INTENSITY;
  }
  return glow;
}
