import { getCanonicalFaceResults } from './face-values.mjs';

function round(value) { return Math.round(Number(value) * 10) / 10; }
function pixelPoint([u, v], size) {
  const point = [Number(u) * size, (1 - Number(v)) * size];
  if (!point.every(Number.isFinite)) throw new Error('Face edge contains invalid UV coordinates.');
  return point;
}
function insetPoint(point, inside, amount) {
  const distance = Math.hypot(inside[0] - point[0], inside[1] - point[1]) || 1;
  const ratio = Math.min(0.2, Math.max(0, Number(amount) || 0) / distance);
  return [point[0] + ((inside[0] - point[0]) * ratio), point[1] + ((inside[1] - point[1]) * ratio)];
}
function pixelSegments(segments, size, insetPx) {
  if (!Array.isArray(segments) || segments.length < 3) throw new Error('A physical face must contain at least three outer edge segments.');
  return segments.flatMap((segment) => {
    if (!Array.isArray(segment) || segment.length !== 3) throw new Error('Face edge segment must contain two endpoints and an interior anchor.');
    const [uvA, uvB, insideUv] = segment;
    const inside = pixelPoint(insideUv, size);
    const a = insetPoint(pixelPoint(uvA, size), inside, insetPx);
    const b = insetPoint(pixelPoint(uvB, size), inside, insetPx);
    return [round(a[0]), round(a[1]), round(b[0]), round(b[1])];
  });
}
function segmentsFromLoop(outline) {
  if (!Array.isArray(outline) || outline.length < 3) throw new Error('d4 face outline must contain at least three UV points.');
  const inside = [
    outline.reduce((sum, point) => sum + Number(point[0]), 0) / outline.length,
    outline.reduce((sum, point) => sum + Number(point[1]), 0) / outline.length,
  ];
  return outline.map((point, index) => [point, outline[(index + 1) % outline.length], inside]);
}

export function buildDiceBoxInlayBoundaries(glyphPlan, dieType, size = 1024, { insetPx = 0 } = {}) {
  try {
    if (!Number.isInteger(size) || size < 256 || size > 2048) throw new Error('Inlay atlas size must be 256-2048 pixels.');
    if (!Number.isFinite(insetPx) || insetPx < 0 || insetPx > 32) throw new Error('Inlay inset must be 0-32 pixels.');
    const commands = glyphPlan?.commands?.filter((command) => command.dieType === dieType) || [];
    if (!commands.length) throw new Error(`No glyph commands found for ${dieType}.`);
    const boundaries = new Map();
    if (dieType === 'd4') {
      for (const command of commands) {
        for (const mark of command.marks || []) {
          if (!Number.isInteger(mark.faceId) || !Array.isArray(mark.region?.outline)) continue;
          boundaries.set(`face:${mark.faceId}`, pixelSegments(segmentsFromLoop(mark.region.outline), size, insetPx));
        }
      }
    } else {
      for (const command of commands) {
        if (!Array.isArray(command.region?.edgeSegments)) throw new Error(`${dieType} face ${command.logicalResult} is missing physical edge segments.`);
        boundaries.set(`result:${command.logicalResult}`, pixelSegments(command.region.edgeSegments, size, insetPx));
      }
    }
    const expected = getCanonicalFaceResults(dieType).length;
    if (boundaries.size !== expected) throw new Error(`${dieType} inlay boundaries must cover ${expected} physical faces; found ${boundaries.size}.`);
    return [...boundaries.values()];
  } catch (error) {
    console.error('Failed to build DiceBox inlay edge segments:', error); throw error;
  }
}
