import { assertSafeDimensions, concatBuffers } from './common.mjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const STRIP_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt']);

export function sanitizePng(input) {
  const buffer = Buffer.from(input);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Tray image bytes do not contain a valid PNG signature.');
  }

  let offset = 8;
  let width;
  let height;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;
  let strippedMetadata = false;
  const output = [buffer.subarray(0, 8)];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error('PNG chunk length exceeds the uploaded file.');
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const chunk = buffer.subarray(offset, end);

    if (!sawIhdr) {
      if (type !== 'IHDR' || length !== 13) throw new Error('PNG must begin with a 13-byte IHDR chunk.');
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      assertSafeDimensions(width, height, 'PNG tray image');
      sawIhdr = true;
    }

    if (type === 'IDAT') sawIdat = true;
    if (type === 'IEND') {
      if (length !== 0) throw new Error('PNG IEND chunk must be empty.');
      sawIend = true;
    }

    if (STRIP_CHUNKS.has(type)) strippedMetadata = true;
    else output.push(chunk);

    offset = end;
    if (type === 'IEND') break;
  }

  if (!sawIhdr || !sawIdat || !sawIend) throw new Error('PNG is missing required image structure.');
  if (offset !== buffer.length) throw new Error('PNG contains trailing bytes after IEND.');

  return {
    mime: 'image/png',
    buffer: concatBuffers(output),
    width,
    height,
    strippedMetadata,
  };
}
