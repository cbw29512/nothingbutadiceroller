function clampIntensity(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0;
}

export function numberGlowTextShadow(glow) {
  if (!glow?.enabled) return 'none';
  const intensity = clampIntensity(glow.intensity);
  if (intensity <= 0) return 'none';
  const color = String(glow.color || '#ffffff');
  const tight = Math.round(3 + (5 * intensity));
  const medium = Math.round(7 + (9 * intensity));
  const wide = Math.round(13 + (17 * intensity));
  return `0 0 2px ${color}, 0 0 ${tight}px ${color}, 0 0 ${medium}px ${color}, 0 0 ${wide}px ${color}`;
}
