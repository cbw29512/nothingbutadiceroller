import sharp from 'sharp';
import { assertSafeDimensions, MAX_IMAGE_PIXELS } from './common.mjs';
import { sanitizeTrayImageBytes } from './index.mjs';

const MIME_TO_FORMAT = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpeg'],
  ['image/webp', 'webp'],
]);

function sharpOptions() {
  return {
    animated: false,
    failOn: 'warning',
    limitInputChannels: 4,
    limitInputPixels: MAX_IMAGE_PIXELS,
    sequentialRead: true,
    unlimited: false,
  };
}

function outputPipeline(input, format) {
  const pipeline = sharp(input, sharpOptions()).autoOrient();
  if (format === 'png') return pipeline.png({ adaptiveFiltering: true, compressionLevel: 9 });
  if (format === 'jpeg') return pipeline.jpeg({ chromaSubsampling: '4:4:4', progressive: true, quality: 90 });
  if (format === 'webp') return pipeline.webp({ effort: 4, quality: 90 });
  throw new Error('Tray image decoder selected an unsupported output format.');
}

export async function decodeAndReencodeTrayImage(input, declaredMime = '') {
  const original = Buffer.from(input || []);
  const structural = sanitizeTrayImageBytes(original, declaredMime);
  const expectedFormat = MIME_TO_FORMAT.get(structural.mime);
  if (!expectedFormat) throw new Error('Tray image MIME type is unsupported for decoding.');

  try {
    const metadata = await sharp(original, sharpOptions()).metadata();
    if (metadata.format !== expectedFormat) {
      throw new Error(`Decoded image format ${metadata.format || 'unknown'} does not match ${expectedFormat}.`);
    }
    assertSafeDimensions(metadata.width, metadata.height, `${expectedFormat.toUpperCase()} tray image`);
    if (Number(metadata.pages || 1) !== 1) throw new Error('Animated or multi-page tray images are not supported.');

    const { data, info } = await outputPipeline(original, expectedFormat).toBuffer({ resolveWithObject: true });
    if (info.format !== expectedFormat) throw new Error('Tray image re-encode changed format unexpectedly.');
    assertSafeDimensions(info.width, info.height, `${expectedFormat.toUpperCase()} tray image`);

    return {
      mime: structural.mime,
      buffer: Buffer.from(data),
      width: info.width,
      height: info.height,
      strippedMetadata: true,
      decoded: true,
    };
  } catch (error) {
    console.warn('Tray image pixel decode/re-encode failed:', error);
    throw new Error('Tray image pixel data could not be decoded safely.');
  }
}
