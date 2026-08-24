export function edgeInlayStrokeWidth(inlay, size) {
  const scale = Number(size) / 1024;
  const width = Math.max(0, Math.min(1, Number(inlay?.width) || 0));
  if (inlay?.type === 'fine') return (1.5 + (2.5 * width)) * scale;
  if (inlay?.type === 'bold') return (4 + (7 * width)) * scale;
  return (2.5 + (5 * width)) * scale;
}

export function edgeInlayInset(inlay, size) {
  return edgeInlayStrokeWidth(inlay, size) * 0.85;
}
