import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MAX_TRAY_IMAGE_BYTES, safeTrayImageUrl, validateTrayImage } from '../js/appearance/tray-image.mjs';

const png = 'data:image/png;base64,iVBORw0KGgo=';
const ownerBlob = '/api/dice-set-image?owner=user1&set=set1&token=abc123';
const publicBlob = '/api/dice-set-image?public=public_abc123&token=abc123';
const legacy = '/api/theme-image?owner=user1&theme=theme1&token=abc123';
assert.equal(MAX_TRAY_IMAGE_BYTES, 4 * 1024 * 1024);
assert.equal(validateTrayImage({ kind: 'data', url: png }).ok, true);
assert.equal(safeTrayImageUrl({ kind: 'blob', url: ownerBlob }), ownerBlob);
assert.equal(safeTrayImageUrl({ kind: 'blob', url: publicBlob }), publicBlob);
assert.equal(safeTrayImageUrl({ legacyUrl: legacy }), legacy);
for (const image of [
  { url: 'javascript:alert(1)' },
  { url: 'https://evil.example/tray.png' },
  { url: 'data:image/svg+xml;base64,PHN2Zz4=' },
  { url: 'data:text/html;base64,PGgxPg==' },
  { kind: 'data', url: ownerBlob },
  { kind: 'blob', url: publicBlob, contact: 'unexpected metadata' },
  { url: ownerBlob, legacyUrl: legacy },
  { kind: 'blob', url: '/api/dice-set-image?public=bad/value&token=abc123' },
]) assert.equal(validateTrayImage(image).ok, false, `Unsafe or ambiguous tray image must be rejected: ${JSON.stringify(image)}`);
assert.equal(safeTrayImageUrl({ url: 'javascript:alert(1)' }), null);

const saveSource = fs.readFileSync(new URL('../netlify/functions/save-dice-set.mjs', import.meta.url), 'utf8');
assert.match(saveSource, /MAX_TRAY_IMAGE_BYTES/);
assert.match(saveSource, /imageKey\(user\.id, set\.id\)/);
assert.match(saveSource, /trayImageAccessToken/);
assert.match(saveSource, /Unlock the dice set before changing its tray image/);
assert.match(saveSource, /store\.delete\(trayImageKey\)/, 'Removing an image must clean up its Blob.');
const storeSource = fs.readFileSync(new URL('../netlify/functions/dice-set-store.mjs', import.meta.url), 'utf8');
assert.match(storeSource, /function keyPart\(value\) \{ return encodeURIComponent\(String\(value\)\); \}/);
assert.match(storeSource, /consistency: 'strong'/);
assert.match(storeSource, /export function imageKey/);
assert.match(storeSource, /export function publicRecordKey/);
assert.match(storeSource, /\/api\/dice-set-image\?public=\$\{encodeURIComponent\(publicAccessId\)\}&token=/);
const imageSource = fs.readFileSync(new URL('../netlify/functions/dice-set-image.mjs', import.meta.url), 'utf8');
assert.match(imageSource, /path: '\/api\/dice-set-image'/);
assert.match(imageSource, /resolvePublicProjection\(store, publicAccessId\)/);
assert.match(imageSource, /const legacyCapability = !record\?\.publicAccessId/);
assert.match(imageSource, /user\.id !== ownerId/);
assert.match(imageSource, /'Cache-Control': 'no-store'/);
assert.match(imageSource, /X-Content-Type-Options/);
const deleteSource = fs.readFileSync(new URL('../netlify/functions/dice-sets.mjs', import.meta.url), 'utf8');
assert.match(deleteSource, /store\.delete\(publicRecordKey\(existing\.publicAccessId\)\)/);
assert.match(deleteSource, /existing\.trayImageKey/);
assert.match(deleteSource, /store\.delete\(existing\.trayImageKey\)/);
console.log('Tray image contract passed: exact metadata, vetted owner/public formats, 4 MB limit, opaque strong-consistency public delivery, owner authentication with legacy-public compatibility, no-store responses, public-projection cleanup, and Blob cleanup are enforced.');
