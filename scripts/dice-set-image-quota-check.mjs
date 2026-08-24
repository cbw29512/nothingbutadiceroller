import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  imageQuotaWouldBeExceeded, MAX_USER_IMAGE_BYTES, recordTrayImageBytes, userImageUsageBytes,
} from '../netlify/functions/dice-set-image-quota.mjs';
import { recordKey } from '../netlify/functions/dice-set-store.mjs';

function memoryStore(records, legacyBlobs = new Map(), metadata = new Map()) {
  const entries = new Map(records.map((record) => [recordKey(record.set.ownerId, record.set.id), record]));
  return {
    async list({ prefix }) {
      return { blobs: [...entries.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
    },
    async get(key, options = {}) {
      if (entries.has(key)) return structuredClone(entries.get(key));
      if (options.type === 'blob' && legacyBlobs.has(key)) return legacyBlobs.get(key);
      return null;
    },
    async getMetadata(key) {
      return metadata.has(key) ? { metadata: metadata.get(key), etag: 'etag' } : null;
    },
  };
}

try {
  assert.equal(MAX_USER_IMAGE_BYTES, 64 * 1024 * 1024, 'Per-account cloud tray image cap must remain 64 MB unless deliberately re-reviewed.');
  assert.equal(imageQuotaWouldBeExceeded(MAX_USER_IMAGE_BYTES - 1, 1), false);
  assert.equal(imageQuotaWouldBeExceeded(MAX_USER_IMAGE_BYTES, 1), true);
  assert.throws(() => imageQuotaWouldBeExceeded(-1, 1), /invalid/i);

  const ownerId = 'quota_owner';
  const records = [
    { set: { id: 'known', ownerId }, trayImageKey: 'img_known', trayImageBytes: 5 * 1024 * 1024 },
    { set: { id: 'metadata', ownerId }, trayImageKey: 'img_metadata' },
    { set: { id: 'legacy', ownerId }, trayImageKey: 'img_legacy' },
    { set: { id: 'none', ownerId }, trayImageKey: null },
  ];
  const legacyBlob = new Blob([new Uint8Array(3 * 1024 * 1024)]);
  const store = memoryStore(
    records,
    new Map([['img_legacy', legacyBlob]]),
    new Map([['img_metadata', { byteLength: 2 * 1024 * 1024, contentType: 'image/png' }]]),
  );

  assert.equal(await recordTrayImageBytes(store, records[0]), 5 * 1024 * 1024);
  assert.equal(await recordTrayImageBytes(store, records[1]), 2 * 1024 * 1024, 'New metadata byte length should avoid downloading the blob.');
  assert.equal(await recordTrayImageBytes(store, records[2]), 3 * 1024 * 1024, 'Legacy images without byte metadata must still be measured safely.');
  assert.equal(await userImageUsageBytes(store, ownerId), 10 * 1024 * 1024);
  assert.equal(await userImageUsageBytes(store, ownerId, { excludeSetId: 'known' }), 5 * 1024 * 1024);

  const saveSource = await readFile(new URL('../netlify/functions/save-dice-set.mjs', import.meta.url), 'utf8');
  for (const text of [
    'MAX_USER_IMAGE_BYTES',
    'userImageUsageBytes',
    'imageQuotaWouldBeExceeded',
    "byteLength: parsedImage.buffer.byteLength",
    'trayImageBytes',
    'Post-save tray image quota verification failed',
    'rollbackCommittedRecord',
  ]) assert.ok(saveSource.includes(text), `Save endpoint quota contract missing: ${text}`);

  console.log('Cloud tray image quota passed: 64 MB aggregate accounting covers new metadata, legacy blobs, replacement exclusion, preflight enforcement, and post-commit rollback wiring.');
} catch (error) {
  console.error('Cloud tray image quota check failed:', error);
  process.exitCode = 1;
}
