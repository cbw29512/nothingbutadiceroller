import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const source = resolve(root, 'favicon.svg');
const ICON_SIZES = Object.freeze([192, 512]);
const MASKABLE_BACKGROUND = '#090c12';
const SOURCE_VIEWBOX_SIZE = 64;

async function buildIcon(size) {
  const target = resolve(dist, `pwa-icon-${size}.png`);
  const density = Math.round((72 * size) / SOURCE_VIEWBOX_SIZE);

  try {
    const info = await sharp(source, { density })
      .resize(size, size, { fit: 'fill' })
      .flatten({ background: MASKABLE_BACKGROUND })
      .png({ compressionLevel: 9 })
      .toFile(target);

    if (info.format !== 'png' || info.width !== size || info.height !== size || info.channels !== 3) {
      throw new Error(`Unexpected ${size}px icon output: ${JSON.stringify(info)}`);
    }
    await access(target);
  } catch (error) {
    console.error(`PWA ${size}px icon generation failed:`, error);
    throw error;
  }
}

try {
  await access(source);
  await access(dist);
  for (const size of ICON_SIZES) await buildIcon(size);
  console.log('PWA launcher icons generated: 192px and 512px opaque PNGs.');
} catch (error) {
  console.error('PWA icon build aborted:', error);
  process.exitCode = 1;
}
