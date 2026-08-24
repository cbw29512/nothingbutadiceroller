import { DEFAULT_EDGE_INLAY } from './inlay-style.mjs';
import { edgeInlayStrokeWidth } from './inlay-render-metrics.mjs';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
function dashAttributes(type, width) {
  if (type === 'dashed') return ` stroke-dasharray="${(width * 3).toFixed(2)} ${(width * 2).toFixed(2)}" stroke-linecap="round"`;
  if (type === 'dotted') return ` stroke-dasharray="${Math.max(0.4, width * 0.18).toFixed(2)} ${(width * 2.05).toFixed(2)}" stroke-linecap="round"`;
  return ' stroke-linecap="round"';
}
function segmentPaths(faceSegments, color, opacity, width, dash, shadowOpacity) {
  let paths = '';
  for (let index = 0; index < faceSegments.length; index += 4) {
    const [x1, y1, x2, y2] = faceSegments.slice(index, index + 4).map(Number);
    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    const shadowWidth = width + Math.max(1, width * 0.7);
    paths += `<path d="${d}" fill="none" stroke="#000000" stroke-opacity="${shadowOpacity.toFixed(2)}" stroke-width="${shadowWidth.toFixed(2)}"${dash}/>`;
    paths += `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${width.toFixed(2)}"${dash}/>`;
  }
  return paths;
}

export function runtimeInlaySettings(payload) {
  try {
    if (!payload || payload.v < 6 || !Array.isArray(payload.i)) return { ...DEFAULT_EDGE_INLAY, boundaries: [] };
    return {
      type: String(payload.i[0]), color: String(payload.i[1]), intensity: Number(payload.i[2]), width: Number(payload.i[3]),
      boundaries: Array.isArray(payload.i[4]) ? payload.i[4] : [],
    };
  } catch (error) {
    console.error('Failed to read runtime edge-inlay settings:', error);
    return { ...DEFAULT_EDGE_INLAY, boundaries: [] };
  }
}

export function runtimeInlayArtwork(inlay, payload) {
  try {
    if (!inlay || inlay.type === 'none' || !inlay.boundaries.length) return '';
    const width = edgeInlayStrokeWidth(inlay, payload.s);
    const opacity = Math.max(0.12, Math.min(1, 0.28 + (inlay.intensity * 0.72)));
    const shadowOpacity = 0.08 + (inlay.intensity * 0.18);
    const color = escapeXml(inlay.color); const dash = dashAttributes(inlay.type, width);
    const paths = inlay.boundaries.map((faceSegments) => segmentPaths(faceSegments, color, opacity, width, dash, shadowOpacity)).join('');
    return `<g id="edgeInlay" data-inlay-type="${escapeXml(inlay.type)}">${paths}</g>`;
  } catch (error) {
    console.error('Failed to build runtime edge-inlay artwork:', error); return '';
  }
}
