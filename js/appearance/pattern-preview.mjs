import { normalizeSurfacePattern } from './pattern-style.mjs';

function rgba(hex, alpha) {
  const safe = String(hex || '#ffffff').replace('#', '');
  const red = Number.parseInt(safe.slice(0, 2), 16);
  const green = Number.parseInt(safe.slice(2, 4), 16);
  const blue = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function buildPatternPreviewLayers(value) {
  try {
    const pattern = normalizeSurfacePattern(value);
    if (pattern.type === 'none') return [];
    const strength = pattern.intensity;
    const scale = pattern.scale;
    const primary = pattern.primaryColor;
    const secondary = pattern.secondaryColor;

    if (pattern.type === 'split') {
      const alpha = 0.12 + (strength * 0.48);
      return [`linear-gradient(135deg, ${rgba(primary, alpha)} 0 49.5%, ${rgba(secondary, alpha)} 50.5% 100%)`];
    }
    if (pattern.type === 'marble') {
      const band = Math.round(8 + (scale * 22));
      const alpha = 0.08 + (strength * 0.25);
      return [
        `repeating-linear-gradient(118deg, transparent 0 ${band}px, ${rgba(primary, alpha)} ${band}px ${band + 3}px, transparent ${band + 5}px ${band * 2}px)`,
        `repeating-linear-gradient(62deg, transparent 0 ${band + 4}px, ${rgba(secondary, alpha * 0.8)} ${band + 4}px ${band + 7}px, transparent ${band + 9}px ${band * 2 + 7}px)`,
      ];
    }
    if (pattern.type === 'swirl') {
      const arc = Math.round(7 + (scale * 14));
      const gap = arc + Math.round(12 + (scale * 20));
      const alpha = 0.06 + (strength * 0.22);
      return [
        `repeating-conic-gradient(from 18deg at 50% 50%, ${rgba(primary, alpha)} 0deg ${arc}deg, transparent ${arc}deg ${gap}deg, ${rgba(secondary, alpha * 0.85)} ${gap}deg ${gap + arc}deg, transparent ${gap + arc}deg ${gap * 2}deg)`,
      ];
    }
    if (pattern.type === 'speckle') {
      const radius = (1.5 + (scale * 3.5)).toFixed(1);
      const alpha = 0.12 + (strength * 0.34);
      return [
        `radial-gradient(circle at 18% 22%, ${rgba(primary, alpha)} 0 ${radius}px, transparent ${radius}px)`,
        `radial-gradient(circle at 72% 28%, ${rgba(secondary, alpha)} 0 ${radius}px, transparent ${radius}px)`,
        `radial-gradient(circle at 34% 74%, ${rgba(secondary, alpha * 0.8)} 0 ${radius}px, transparent ${radius}px)`,
        `radial-gradient(circle at 82% 78%, ${rgba(primary, alpha * 0.85)} 0 ${radius}px, transparent ${radius}px)`,
      ];
    }
    return [];
  } catch (error) {
    console.error('Failed to build surface-pattern preview layers:', error);
    return [];
  }
}
