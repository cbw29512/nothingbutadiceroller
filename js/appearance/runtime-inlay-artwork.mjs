import { DEFAULT_EDGE_INLAY } from './inlay-style.mjs';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function strokeWidth(inlay, size) {
  const scale = size / 1024;
  const width = Math.max(0, Math.min(1, Number(inlay.width) || 0));
  if (inlay.type === 'fine') return (1.5 + (2.5 * width)) * scale;
  if (inlay.type === 'bold') return (4 + (7 * width)) * scale;
  return (2.5 + (5 * width)) * scale;
}

function insetLoop(loop, amount) {
  const points = [];
  for (let index = 0; index < loop.length; index += 2) points.push([Number(loop[index]), Number(loop[index + 1])]);
  const centerX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const centerY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  return points.map(([x, y]) => {
    const distance = Math.hypot(centerX - x, centerY - y) || 1;
    const ratio = Math.min(0.14, amount / distance);
    return [x + ((centerX - x) * ratio), y + ((centerY - y) * ratio)];
  });
}

function pathFor(points) {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z';
}

function dashAttributes(type, width) {
  if (type === 'dashed') return ` stroke-dasharray="${(width * 3).toFixed(2)} ${(width * 2).toFixed(2)}"`;
  if (type === 'dotted') return ` stroke-dasharray="${Math.max(0.4, width * 0.18).toFixed(2)} ${(width * 2.05).toFixed(2)}" stroke-linecap="round"`;
  return ' stroke-linejoin="round"';
}

export function runtimeInlaySettings(payload) {
  try {
    if (!payload || payload.v < 6 || !Array.isArray(payload.i)) return { ...DEFAULT_EDGE_INLAY, boundaries: [] };
    return {
      type: String(payload.i[0]),
      color: String(payload.i[1]),
      intensity: Number(payload.i[2]),
      width: Number(payload.i[3]),
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
    const width = strokeWidth(inlay, payload.s);
    const opacity = Math.max(0.12, Math.min(1, 0.28 + (inlay.intensity * 0.72)));
    const color = escapeXml(inlay.color);
    const dash = dashAttributes(inlay.type, width);
    const paths = inlay.boundaries.map((loop) => {
      const points = insetLoop(loop, width * 0.85);
      const path = pathFor(points);
      const shadowWidth = width + Math.max(1, width * 0.7);
      return `<path d="${path}" fill="none" stroke="#000000" stroke-opacity="${(0.08 + inlay.intensity * 0.18).toFixed(2)}" stroke-width="${shadowWidth.toFixed(2)}"${dash}/><path d="${path}" fill="none" stroke="${color}" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${width.toFixed(2)}"${dash}/>`;
    }).join('');
    return `<g id="edgeInlay" data-inlay-type="${escapeXml(inlay.type)}">${paths}</g>`;
  } catch (error) {
    console.error('Failed to build runtime edge-inlay artwork:', error);
    return '';
  }
}
