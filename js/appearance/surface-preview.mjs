import { buildInlayPreviewShadow } from './inlay-preview.mjs';
import { buildPatternPreviewLayers } from './pattern-preview.mjs';
import { buildResinPreviewBackground, buildResinPreviewShadow } from './resin-preview.mjs';
import { normalizeSurfaceFinish } from './surface-style.mjs';

function rgba(hex, alpha) {
  const safe = String(hex || '#ffffff').replace('#', '');
  const red = Number.parseInt(safe.slice(0, 2), 16);
  const green = Number.parseInt(safe.slice(2, 4), 16);
  const blue = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function finishLayers(finish) {
  const strength = finish.intensity;
  const accent = finish.accentColor;
  if (finish.type === 'matte') {
    return [`linear-gradient(${rgba('#000000', 0.04 + (strength * 0.08))}, ${rgba('#000000', 0.08 + (strength * 0.1))})`];
  }
  if (finish.type === 'satin') {
    return [`linear-gradient(145deg, ${rgba('#ffffff', 0.08 + (strength * 0.16))}, transparent 38%, ${rgba(accent, 0.04 + (strength * 0.08))} 62%, transparent)`];
  }
  if (finish.type === 'gloss') {
    return [`linear-gradient(145deg, ${rgba('#ffffff', 0.18 + (strength * 0.28))} 0 12%, transparent 34% 66%, ${rgba('#ffffff', 0.08 + (strength * 0.18))} 86%, transparent)`];
  }
  if (finish.type === 'metallic') {
    return [
      `linear-gradient(115deg, transparent 0 18%, ${rgba('#ffffff', 0.08 + (strength * 0.18))} 32%, transparent 47%, ${rgba(accent, 0.14 + (strength * 0.26))} 62%, transparent 78%)`,
      `linear-gradient(20deg, ${rgba('#000000', 0.08 + (strength * 0.08))}, transparent 42%, ${rgba('#ffffff', 0.06 + (strength * 0.12))})`,
    ];
  }
  if (finish.type === 'pearl') {
    return [
      `radial-gradient(circle at 26% 28%, ${rgba(accent, 0.12 + (strength * 0.26))}, transparent 42%)`,
      `radial-gradient(circle at 76% 72%, ${rgba('#ffffff', 0.08 + (strength * 0.18))}, transparent 38%)`,
      `linear-gradient(130deg, transparent, ${rgba(accent, 0.06 + (strength * 0.12))}, transparent)`,
    ];
  }
  return [];
}

export function buildSurfacePreviewBackground(style = {}) {
  try {
    const finish = normalizeSurfaceFinish(style.finish);
    return [
      ...finishLayers(finish),
      ...buildPatternPreviewLayers(style.pattern),
      buildResinPreviewBackground(style),
    ].filter(Boolean).join(',');
  } catch (error) {
    console.error('Failed to build surface preview background:', error);
    return buildResinPreviewBackground(style);
  }
}

export function buildSurfacePreviewShadow(style = {}) {
  try {
    const finish = normalizeSurfaceFinish(style.finish);
    const resin = buildResinPreviewShadow(style);
    const finishShadow = finish.type === 'standard' || finish.type === 'matte'
      ? ''
      : finish.type === 'gloss'
        ? `inset 0 10px 18px ${rgba('#ffffff', 0.08 + finish.intensity * 0.12)}`
        : `inset 0 0 16px ${rgba(finish.accentColor, 0.05 + finish.intensity * 0.12)}`;
    const inlay = buildInlayPreviewShadow(style.inlay);
    return [resin === 'none' ? '' : resin, finishShadow, inlay].filter(Boolean).join(', ') || 'none';
  } catch (error) {
    console.error('Failed to build surface preview shadow:', error);
    return buildResinPreviewShadow(style);
  }
}
