import { getCanonicalFaceResults } from './face-values.mjs';

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function pixelLoop(outline, size) {
  if (!Array.isArray(outline) || outline.length < 3) throw new Error('Face outline must contain at least three UV points.');
  return outline.flatMap(([u, v]) => {
    const x = Number(u) * size;
    const y = (1 - Number(v)) * size;
    if (![x, y].every(Number.isFinite)) throw new Error('Face outline contains invalid UV coordinates.');
    return [round(x), round(y)];
  });
}

export function buildDiceBoxInlayBoundaries(glyphPlan, dieType, size = 1024) {
  try {
    if (!Number.isInteger(size) || size < 256 || size > 2048) throw new Error('Inlay atlas size must be 256-2048 pixels.');
    const commands = glyphPlan?.commands?.filter((command) => command.dieType === dieType) || [];
    if (!commands.length) throw new Error(`No glyph commands found for ${dieType}.`);
    const boundaries = new Map();
    if (dieType === 'd4') {
      for (const command of commands) {
        for (const mark of command.marks || []) {
          if (!Number.isInteger(mark.faceId) || !Array.isArray(mark.region?.outline)) continue;
          boundaries.set(`face:${mark.faceId}`, pixelLoop(mark.region.outline, size));
        }
      }
    } else {
      for (const command of commands) {
        if (!Array.isArray(command.region?.outline)) throw new Error(`${dieType} face ${command.logicalResult} is missing a UV outline.`);
        boundaries.set(`result:${command.logicalResult}`, pixelLoop(command.region.outline, size));
      }
    }
    const expected = getCanonicalFaceResults(dieType).length;
    if (boundaries.size !== expected) {
      throw new Error(`${dieType} inlay boundaries must cover ${expected} physical faces; found ${boundaries.size}.`);
    }
    return [...boundaries.values()];
  } catch (error) {
    console.error('Failed to build DiceBox inlay boundaries:', error);
    throw error;
  }
}
