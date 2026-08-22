import { sanitizeJpeg } from './jpeg.mjs';
import { sanitizePng } from './png.mjs';
import { sanitizeWebp } from './webp.mjs';

export function sanitizeTrayImageBytes(input, declaredMime = '') {
  const buffer = Buffer.from(input || []);
  const mime = String(declaredMime || '').toLowerCase();
  let result;

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    result = sanitizePng(buffer);
  } else if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    result = sanitizeJpeg(buffer);
  } else if (
    buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    result = sanitizeWebp(buffer);
  } else {
    throw new Error('Tray image bytes are not a supported PNG, JPEG, or WebP image.');
  }

  if (mime && result.mime !== mime) {
    throw new Error(`Tray image content does not match declared MIME type ${mime}.`);
  }
  return result;
}
