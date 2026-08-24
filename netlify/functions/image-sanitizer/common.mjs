export const MAX_IMAGE_DIMENSION = 4096;
export const MAX_IMAGE_PIXELS = 16_777_216;

export function assertSafeDimensions(width, height, label = 'Tray image') {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`${label} has invalid dimensions.`);
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error(`${label} dimensions must be ${MAX_IMAGE_DIMENSION}px or smaller per side.`);
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new Error(`${label} has too many decoded pixels.`);
  }
  return { width, height };
}

export function concatBuffers(parts) {
  return Buffer.concat(parts.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(part)));
}
