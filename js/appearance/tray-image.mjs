const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i;
const BLOB_URL = /^\/api\/dice-set-image\?owner=[^&]+&set=[^&]+&token=[a-z0-9]+$/i;
const LEGACY_URL = /^(?:\/api\/theme-image\?owner=[^&]+&theme=[^&]+&token=[a-z0-9]+|\/\.netlify\/blobs\/[a-z0-9/_-]+)$/i;
export const MAX_TRAY_IMAGE_BYTES = 4 * 1024 * 1024;

function base64Bytes(base64) {
  const clean = String(base64 || '').replace(/=+$/, '');
  return Math.floor((clean.length * 3) / 4);
}
export function validateTrayImage(image, { allowDataUrl = true } = {}) {
  if (image == null) return { ok: true, image: null };
  if (!image || typeof image !== 'object' || Array.isArray(image)) return { ok: false, error: 'Tray image must be an object or null.' };
  const url = String(image.url || image.legacyUrl || '');
  const data = url.match(DATA_URL);
  if (data) {
    if (!allowDataUrl) return { ok: false, error: 'Inline tray images are not allowed here.' };
    if (base64Bytes(data[2]) > MAX_TRAY_IMAGE_BYTES) return { ok: false, error: 'Tray image must be 4 MB or smaller.' };
    return { ok: true, image: { kind: 'data', url } };
  }
  if (BLOB_URL.test(url)) return { ok: true, image: { kind: 'blob', url } };
  if (LEGACY_URL.test(url)) return { ok: true, image: { kind: 'legacy', url } };
  return { ok: false, error: 'Tray image URL is not an approved image source.' };
}
export function extractTrayImageDataUrl(image) {
  const validated = validateTrayImage(image);
  return validated.ok && validated.image?.kind === 'data' ? validated.image.url : null;
}
export function safeTrayImageUrl(image, options = {}) {
  const validated = validateTrayImage(image, options);
  return validated.ok ? validated.image?.url || null : null;
}
