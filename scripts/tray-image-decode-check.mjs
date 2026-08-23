import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { decodeAndReencodeTrayImage } from '../netlify/functions/image-sanitizer/reencode.mjs';

const XMP = `<?xml version="1.0"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:creator><rdf:Seq><rdf:li>PRIVATE TEST METADATA</rdf:li></rdf:Seq></dc:creator>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;

function sourceImage() {
  return sharp({
    create: {
      width: 16,
      height: 12,
      channels: 4,
      background: { r: 40, g: 120, b: 220, alpha: 0.85 },
    },
  });
}

async function fixture(format) {
  let pipeline = sourceImage();
  if (format === 'png') pipeline = pipeline.png().withXmp(XMP);
  else if (format === 'jpeg') {
    pipeline = pipeline
      .jpeg({ quality: 92 })
      .withExif({
        IFD0: { Copyright: 'PRIVATE TEST METADATA', Orientation: '6' },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '34/1 11/1 0/100',
          GPSLongitudeRef: 'W',
          GPSLongitude: '79/1 46/1 0/100',
        },
      })
      .withXmp(XMP);
  } else if (format === 'webp') pipeline = pipeline.webp({ quality: 92 }).withXmp(XMP);
  else throw new Error(`Unsupported fixture format ${format}.`);
  return pipeline.toBuffer();
}

function corruptPngPixels(input) {
  const output = Buffer.from(input);
  const marker = output.indexOf(Buffer.from('IDAT'));
  assert.ok(marker >= 0, 'PNG fixture must contain IDAT.');
  const dataOffset = marker + 4;
  assert.ok(dataOffset < output.length - 4, 'PNG fixture must contain IDAT payload bytes.');
  output[dataOffset] ^= 0xff;
  return output;
}

try {
  const cases = [
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ];

  for (const [format, mime] of cases) {
    const input = await fixture(format);
    const inputMetadata = await sharp(input).metadata();
    if (format === 'jpeg') assert.ok(inputMetadata.exif, 'JPEG fixture must contain EXIF metadata before sanitization.');
    assert.ok(inputMetadata.xmp, `${format} fixture must contain XMP metadata before sanitization.`);

    const result = await decodeAndReencodeTrayImage(input, mime);
    assert.equal(result.mime, mime);
    assert.equal(result.decoded, true);
    assert.equal(result.strippedMetadata, true);
    assert.ok(result.buffer.byteLength > 0);

    const outputMetadata = await sharp(result.buffer).metadata();
    assert.equal(outputMetadata.format, format);
    assert.equal(outputMetadata.pages ?? 1, 1);
    assert.equal(outputMetadata.exif, undefined, `${format} output must not retain EXIF.`);
    assert.equal(outputMetadata.xmp, undefined, `${format} output must not retain XMP.`);
    assert.equal(outputMetadata.iptc, undefined, `${format} output must not retain IPTC.`);
    assert.equal(outputMetadata.icc, undefined, `${format} output must not retain ICC metadata.`);
    if (format === 'jpeg') {
      assert.equal(outputMetadata.orientation, undefined, 'JPEG orientation tag must be removed after auto-orient.');
      assert.deepEqual([outputMetadata.width, outputMetadata.height], [12, 16], 'EXIF orientation must be applied to pixels before metadata removal.');
    } else {
      assert.deepEqual([outputMetadata.width, outputMetadata.height], [16, 12]);
    }
  }

  const png = await fixture('png');
  const corrupt = corruptPngPixels(png);
  await assert.rejects(
    () => decodeAndReencodeTrayImage(corrupt, 'image/png'),
    /pixel data could not be decoded safely/i,
    'A structurally plausible PNG with corrupted compressed pixels must fail the real decoder.',
  );
  await assert.rejects(
    () => decodeAndReencodeTrayImage(png, 'image/jpeg'),
    /declared MIME/i,
    'Declared MIME must still match the actual image type.',
  );

  const saveSource = await readFile(new URL('../netlify/functions/save-dice-set.mjs', import.meta.url), 'utf8');
  const netlifyConfig = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  for (const text of [
    "decodeAndReencodeTrayImage",
    'const decoded = await decodeAndReencodeTrayImage',
    'const parsedImage = await parseImage',
    'decoded.buffer.byteLength > MAX_TRAY_IMAGE_BYTES',
  ]) assert.ok(saveSource.includes(text), `Save path decode contract missing: ${text}`);
  assert.ok(!saveSource.includes("from './image-sanitizer/index.mjs'"), 'Save path must not store structural-only sanitizer output.');
  assert.match(netlifyConfig, /external_node_modules = \["sharp"\]/, 'Netlify must package the native Sharp dependency as an external module.');

  console.log('Tray image decode/re-encode passed: PNG/JPEG/WebP pixels decode, metadata is stripped, EXIF orientation is baked into pixels, corrupt pixel streams fail closed, MIME is enforced, and only re-encoded bytes reach storage.');
} catch (error) {
  console.error('Tray image decode/re-encode check failed:', error);
  process.exitCode = 1;
}
