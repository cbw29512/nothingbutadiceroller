import { normalizeEdgeInlay } from './inlay-style.mjs';

function rgba(hex, alpha) {
  const safe = String(hex || '#ffffff').replace('#', '');
  const red = Number.parseInt(safe.slice(0, 2), 16);
  const green = Number.parseInt(safe.slice(2, 4), 16);
  const blue = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function buildInlayPreviewShadow(value) {
  try {
    const inlay = normalizeEdgeInlay(value);
    if (inlay.type === 'none') return '';
    const base = inlay.type === 'fine' ? 1.5 : inlay.type === 'bold' ? 4 : 2.5;
    const width = Math.max(1, Math.round(base + (inlay.width * (inlay.type === 'bold' ? 5 : 3))));
    const alpha = 0.26 + (inlay.intensity * 0.58);
    return `inset 0 0 0 ${width}px ${rgba(inlay.color, alpha)}`;
  } catch (error) {
    console.error('Failed to build edge-inlay preview shadow:', error);
    return '';
  }
}
