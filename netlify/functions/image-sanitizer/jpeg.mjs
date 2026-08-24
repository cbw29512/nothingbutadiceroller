import { assertSafeDimensions, concatBuffers } from './common.mjs';

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const STRIP_MARKERS = new Set([0xe1, 0xed, 0xfe]); // APP1 (EXIF/XMP), APP13 (IPTC), COM
const STANDALONE = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7]);

export function sanitizeJpeg(input) {
  const buffer = Buffer.from(input);
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Tray image bytes do not contain a valid JPEG signature.');
  }
  if (buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) {
    throw new Error('JPEG is missing its end-of-image marker.');
  }

  let offset = 2;
  let width;
  let height;
  let sawScan = false;
  let strippedMetadata = false;
  const output = [buffer.subarray(0, 2)];

  while (offset < buffer.length - 2) {
    if (buffer[offset] !== 0xff) throw new Error('JPEG segment marker is malformed.');
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd9) break;
    if (STANDALONE.has(marker)) {
      output.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (offset + 2 > buffer.length) throw new Error('JPEG segment length is truncated.');
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2) throw new Error('JPEG segment length is invalid.');
    const segmentStart = offset - 2;
    const segmentEnd = offset + segmentLength;
    if (segmentEnd > buffer.length) throw new Error('JPEG segment exceeds the uploaded file.');

    if (SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) throw new Error('JPEG frame header is truncated.');
      height = buffer.readUInt16BE(offset + 3);
      width = buffer.readUInt16BE(offset + 5);
      assertSafeDimensions(width, height, 'JPEG tray image');
    }

    if (marker === 0xda) {
      sawScan = true;
      output.push(buffer.subarray(segmentStart));
      offset = buffer.length;
      break;
    }

    if (STRIP_MARKERS.has(marker)) strippedMetadata = true;
    else output.push(buffer.subarray(segmentStart, segmentEnd));
    offset = segmentEnd;
  }

  if (!width || !height || !sawScan) throw new Error('JPEG is missing required frame or scan data.');
  return {
    mime: 'image/jpeg',
    buffer: concatBuffers(output),
    width,
    height,
    strippedMetadata,
  };
}
