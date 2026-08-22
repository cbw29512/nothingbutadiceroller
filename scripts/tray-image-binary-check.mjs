import assert from 'node:assert/strict';
import { sanitizeTrayImageBytes } from '../netlify/functions/image-sanitizer/index.mjs';
import { MAX_IMAGE_DIMENSION } from '../netlify/functions/image-sanitizer/common.mjs';

function pngChunk(type, data = Buffer.alloc(0)) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 'ascii');
  return Buffer.concat([header, data, Buffer.alloc(4)]);
}

function makePng(width = 64, height = 64, metadata = true) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    ...(metadata ? [pngChunk('tEXt', Buffer.from('GPS=secret', 'utf8'))] : []),
    pngChunk('IDAT', Buffer.from([0x78, 0x9c, 0x00])),
    pngChunk('IEND'),
  ]);
}

function jpegSegment(marker, payload) {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, payload]);
}

function makeJpeg(width = 64, height = 64) {
  const sof = Buffer.alloc(15);
  sof[0] = 8;
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof[5] = 3;
  sof.set([1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0], 6);
  const sos = Buffer.from([3, 1, 0, 2, 0, 3, 0, 0, 63, 0]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe1, Buffer.from('Exif\0\0GPS=secret', 'binary')),
    jpegSegment(0xed, Buffer.from('IPTC secret', 'utf8')),
    jpegSegment(0xfe, Buffer.from('camera comment', 'utf8')),
    jpegSegment(0xc0, sof),
    jpegSegment(0xda, sos),
    Buffer.from([0x00, 0x11, 0x22, 0xff, 0xd9]),
  ]);
}

function webpChunk(type, payload) {
  const header = Buffer.alloc(8);
  header.write(type, 0, 'ascii');
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload, payload.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

function makeWebp(width = 64, height = 64) {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x0c;
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);
  const vp8 = Buffer.alloc(10);
  vp8.set([0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a]);
  vp8.writeUInt16LE(width, 6);
  vp8.writeUInt16LE(height, 8);
  const body = Buffer.concat([
    webpChunk('VP8X', vp8x),
    webpChunk('EXIF', Buffer.from('GPS=secret')),
    webpChunk('XMP ', Buffer.from('<xmp>secret</xmp>')),
    webpChunk('VP8 ', vp8),
  ]);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}

const png = sanitizeTrayImageBytes(makePng(), 'image/png');
assert.deepEqual([png.width, png.height], [64, 64]);
assert.equal(png.strippedMetadata, true);
assert.equal(png.buffer.includes(Buffer.from('GPS=secret')), false);
assert.equal(png.buffer.includes(Buffer.from('tEXt')), false);

const jpeg = sanitizeTrayImageBytes(makeJpeg(), 'image/jpeg');
assert.deepEqual([jpeg.width, jpeg.height], [64, 64]);
assert.equal(jpeg.strippedMetadata, true);
assert.equal(jpeg.buffer.includes(Buffer.from('Exif')), false);
assert.equal(jpeg.buffer.includes(Buffer.from('IPTC secret')), false);
assert.equal(jpeg.buffer.includes(Buffer.from('camera comment')), false);

const webp = sanitizeTrayImageBytes(makeWebp(), 'image/webp');
assert.deepEqual([webp.width, webp.height], [64, 64]);
assert.equal(webp.strippedMetadata, true);
assert.equal(webp.buffer.includes(Buffer.from('GPS=secret')), false);
assert.equal(webp.buffer.includes(Buffer.from('<xmp>')), false);
const vp8xOffset = webp.buffer.indexOf(Buffer.from('VP8X'));
assert.ok(vp8xOffset >= 0);
assert.equal(webp.buffer[vp8xOffset + 8] & 0x0c, 0, 'WebP metadata flags must clear after metadata chunks are removed.');

assert.throws(
  () => sanitizeTrayImageBytes(Buffer.from('<script>alert(1)</script>'), 'image/png'),
  /not a supported PNG, JPEG, or WebP/,
);
assert.throws(
  () => sanitizeTrayImageBytes(makePng(), 'image/jpeg'),
  /does not match declared MIME type/,
);
assert.throws(
  () => sanitizeTrayImageBytes(makePng(MAX_IMAGE_DIMENSION + 1, 64), 'image/png'),
  /dimensions must be/,
);
assert.throws(
  () => sanitizeTrayImageBytes(makeJpeg(64, MAX_IMAGE_DIMENSION + 1), 'image/jpeg'),
  /dimensions must be/,
);
assert.throws(
  () => sanitizeTrayImageBytes(makeWebp(MAX_IMAGE_DIMENSION + 1, 64), 'image/webp'),
  /dimensions must be/,
);

console.log('Tray image binary hardening passed: signatures/MIME, structural dimensions, metadata stripping, and WebP metadata flags are enforced.');
