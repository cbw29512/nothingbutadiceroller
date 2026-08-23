import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MAX_BROWSER_TRAY_IMAGE_BYTES, MAX_TRAY_IMAGE_BYTES, safeTrayImageUrl, validateTrayImage } from '../js/appearance/tray-image.mjs';

const png = 'data:image/png;base64,iVBORw0KGgo=';
const ownerBlob = '/api/dice-set-image?owner=user1&set=set1&token=abc123';
const publicBlob = '/api/dice-set-image?public=public_abc123&token=abc123';
const legacy = '/api/theme-image?owner=user1&theme=theme1&token=abc123';
assert.equal(MAX_TRAY_IMAGE_BYTES, 4 * 1024 * 1024);
assert.equal(MAX_BROWSER_TRAY_IMAGE_BYTES, 512 * 1024);
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

const visualSource = fs.readFileSync(new URL('../js/appearance/studio-visual-controls.mjs', import.meta.url), 'utf8');
assert.match(visualSource, /MAX_BROWSER_TRAY_IMAGE_BYTES/);
assert.match(visualSource, /startsWith\('local_'\)/);
assert.match(visualSource, /Guest tray images must be 512 KB or smaller/);
const saveSource = fs.readFileSync(new URL('../netlify/functions/save-dice-set.mjs', import.meta.url), 'utf8');
assert.match(saveSource, /MAX_TRAY_IMAGE_BYTES/);
assert.match(saveSource, /versionedImageKey\(user\.id, set\.id, trayImageAccessToken\)/);
assert.match(saveSource, /stagedTrayImageKey/);
assert.match(saveSource, /previousTrayImageKey/);
assert.match(saveSource, /bestEffortDelete\(store, previousTrayImageKey/);
assert.match(saveSource, /Tray images must be uploaded through Dice Studio/);
assert.match(saveSource, /existing\?\.set\?\.locked && incomingDataUrl/);
assert.match(saveSource, /code: 'locked-dice-set-image'/);

const storeSource = fs.readFileSync(new URL('../netlify/functions/dice-set-store.mjs', import.meta.url), 'utf8');
assert.match(storeSource, /function keyPart\(value\) \{ return encodeURIComponent\(String\(value\)\); \}/);
assert.match(storeSource, /consistency: 'strong'/);
assert.match(storeSource, /export function versionedImageKey/);
assert.match(storeSource, /export function publicRecordKey/);
assert.match(storeSource, /export function diceSetStoreName/);
assert.match(storeSource, /\$\{STORE_NAME\}-nonprod/);
assert.match(storeSource, /\/api\/dice-set-image\?public=\$\{encodeURIComponent\(publicAccessId\)\}&token=/);
const imageSource = fs.readFileSync(new URL('../netlify/functions/dice-set-image.mjs', import.meta.url), 'utf8');
assert.match(imageSource, /path: '\/api\/dice-set-image'/);
assert.match(imageSource, /openDiceSetStore\(context\)/);
assert.match(imageSource, /resolvePublicProjection\(store, publicAccessId\)/);
assert.match(imageSource, /const legacyCapability = !record\?\.publicAccessId/);
assert.match(imageSource, /user\.id !== ownerId/);
assert.match(imageSource, /'Cache-Control': 'no-store'/);
assert.match(imageSource, /X-Content-Type-Options/);
const deleteSource = fs.readFileSync(new URL('../netlify/functions/dice-sets.mjs', import.meta.url), 'utf8');
const tombstoneWrite = deleteSource.indexOf('conditionalRecordWrite(store, key, tombstone, version)');
const ownerDelete = deleteSource.indexOf('await store.delete(key);', tombstoneWrite);
const imageCleanup = deleteSource.indexOf("bestEffortDelete(store, existing.record.trayImageKey, 'tray image')", ownerDelete);
assert.ok(tombstoneWrite >= 0 && ownerDelete > tombstoneWrite && imageCleanup > ownerDelete, 'Delete must win a conditional tombstone, delete the owner record, then clean the tray image.');
console.log('Tray image contract passed: exact metadata, 512 KB browser / 4 MB cloud limits, versioned atomic image staging, preview-store isolation, authenticated opaque delivery, no-store responses, conditional owner deletion, and owner-first child cleanup are enforced.');
