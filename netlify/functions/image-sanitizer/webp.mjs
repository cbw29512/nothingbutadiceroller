import { assertSafeDimensions, concatBuffers } from './common.mjs';

const STRIP_CHUNKS = new Set(['EXIF', 'XMP ']);

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function dimensionsFromChunk(type, payload) {
  if (type === 'VP8X') {
    if (payload.length < 10) throw new Error('WebP VP8X header is truncated.');
    return {
      width: 1 + readUint24LE(payload, 4),
      height: 1 + readUint24LE(payload, 7),
    };
  }
  if (type === 'VP8 ') {
    if (payload.length < 10 || payload[3] !== 0x9d || payload[4] !== 0x01 || payload[5] !== 0x2a) {
      throw new Error('WebP VP8 frame header is invalid.');
    }
    return {
      width: payload.readUInt16LE(6) & 0x3fff,
      height: payload.readUInt16LE(8) & 0x3fff,
    };
  }
  if (type === 'VP8L') {
    if (payload.length < 5 || payload[0] !== 0x2f) throw new Error('WebP VP8L frame header is invalid.');
    return {
      width: 1 + payload[1] + ((payload[2] & 0x3f) << 8),
      height: 1 + (payload[2] >> 6) + (payload[3] << 2) + ((payload[4] & 0x0f) << 10),
    };
  }
  return null;
}

export function sanitizeWebp(input) {
  const buffer = Buffer.from(input);
  if (
    buffer.length < 20
    || buffer.toString('ascii', 0, 4) !== 'RIFF'
    || buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) throw new Error('Tray image bytes do not contain a valid WebP signature.');

  const declaredSize = buffer.readUInt32LE(4) + 8;
  if (declaredSize !== buffer.length) throw new Error('WebP RIFF size does not match the uploaded file.');

  let offset = 12;
  let dimensions = null;
  let sawImagePayload = false;
  let strippedMetadata = false;
  const chunks = [];

  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const paddedSize = size + (size % 2);
    const end = offset + 8 + paddedSize;
    if (end > buffer.length) throw new Error('WebP chunk exceeds the uploaded file.');
    const payload = buffer.subarray(offset + 8, offset + 8 + size);

    if (!dimensions) dimensions = dimensionsFromChunk(type, payload);
    if (type === 'VP8 ' || type === 'VP8L') sawImagePayload = true;
    if (STRIP_CHUNKS.has(type)) strippedMetadata = true;
    else chunks.push(buffer.subarray(offset, end));
    offset = end;
  }

  if (offset !== buffer.length) throw new Error('WebP contains a truncated trailing chunk.');
  if (!dimensions || !sawImagePayload) throw new Error('WebP is missing required image payload data.');
  assertSafeDimensions(dimensions.width, dimensions.height, 'WebP tray image');

  const body = concatBuffers(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return {
    mime: 'image/webp',
    buffer: concatBuffers([header, body]),
    ...dimensions,
    strippedMetadata,
  };
}
