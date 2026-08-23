import { faceFontStack } from './face-fonts.mjs';

function graphemeCount(value) {
  const text = String(value || '');
  try {
    return Math.max(1, [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length);
  } catch {
    return Math.max(1, Array.from(text).length);
  }
}

function fitFont(text, maxWidth, maxHeight) {
  const count = graphemeCount(text);
  const widthLimited = maxWidth / Math.max(0.8, count * 0.62);
  return Math.max(8, Math.min(180, maxHeight * 0.82, widthLimited));
}

function centeredOperation(command, size) {
  const region = command.region;
  const maxWidth = Math.max(8, (region.maxU - region.minU) * size * 0.72);
  const maxHeight = Math.max(8, (region.maxV - region.minV) * size * 0.64);
  return {
    dieType: command.dieType,
    logicalResult: command.logicalResult,
    text: command.text,
    color: command.color,
    fontId: command.fontId,
    x: region.centerU * size,
    y: (1 - region.centerV) * size,
    maxWidth,
    maxHeight,
    fontPx: fitFont(command.text, maxWidth, maxHeight),
    strategy: command.strategy,
  };
}

function d4Operations(command, size) {
  return command.marks.map((mark) => {
    const spanU = mark.region.maxU - mark.region.minU;
    const spanV = mark.region.maxV - mark.region.minV;
    const maxWidth = Math.max(8, spanU * size * 0.25);
    const maxHeight = Math.max(8, spanV * size * 0.22);
    return {
      dieType: command.dieType,
      logicalResult: command.logicalResult,
      text: command.text,
      color: command.color,
      fontId: command.fontId,
      x: mark.u * size,
      y: (1 - mark.v) * size,
      maxWidth,
      maxHeight,
      fontPx: fitFont(command.text, maxWidth, maxHeight),
      strategy: command.strategy,
    };
  });
}

export function buildDiceBoxAtlasDrawOperations(glyphPlan, dieType, size = 1024) {
  try {
    if (!Number.isInteger(size) || size < 256 || size > 4096) throw new Error('Atlas size must be 256-4096 pixels.');
    const commands = glyphPlan?.commands?.filter((command) => command.dieType === dieType) || [];
    if (!commands.length) throw new Error(`No glyph commands found for ${dieType}.`);
    return commands.flatMap((command) => (
      command.strategy === 'tetrahedral-vertex-repeat'
        ? d4Operations(command, size)
        : [centeredOperation(command, size)]
    ));
  } catch (error) {
    console.error('Failed to build DiceBox atlas draw operations:', error);
    throw error;
  }
}

function canvasFor(size, providedCanvas) {
  if (providedCanvas) return providedCanvas;
  if (typeof document === 'undefined') throw new Error('Canvas rendering requires a browser canvas.');
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  return canvas;
}

export function renderDiceBoxAtlas(glyphPlan, dieType, { size = 1024, canvas = null } = {}) {
  try {
    const target = canvasFor(size, canvas);
    target.width = size; target.height = size;
    const context = target.getContext('2d');
    if (!context) throw new Error('2D canvas context is unavailable.');
    context.clearRect(0, 0, size, size);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const operation of buildDiceBoxAtlasDrawOperations(glyphPlan, dieType, size)) {
      context.fillStyle = operation.color;
      context.font = `700 ${operation.fontPx}px ${faceFontStack(operation.fontId)}`;
      context.fillText(operation.text, operation.x, operation.y, operation.maxWidth);
    }
    return target;
  } catch (error) {
    console.error('Failed to render DiceBox atlas:', error);
    throw error;
  }
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas PNG export returned no data.')), 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}
