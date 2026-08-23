import { listUserRecords } from './dice-set-store.mjs';

export const MAX_USER_IMAGE_BYTES = 64 * 1024 * 1024;

function validByteLength(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

async function legacyImageByteLength(store, key) {
  try {
    const metadataEntry = typeof store.getMetadata === 'function'
      ? await store.getMetadata(key).catch(() => null)
      : null;
    const metadataBytes = validByteLength(metadataEntry?.metadata?.byteLength);
    if (metadataBytes != null) return metadataBytes;

    const blob = await store.get(key, { type: 'blob' }).catch(() => null);
    if (blob == null) return 0;
    const blobSize = validByteLength(blob?.size);
    if (blobSize != null) return blobSize;
    if (Buffer.isBuffer(blob)) return blob.byteLength;
    if (blob instanceof ArrayBuffer) return blob.byteLength;
    if (ArrayBuffer.isView(blob)) return blob.byteLength;
    throw new Error('Legacy tray image size could not be measured safely.');
  } catch (error) {
    console.error('Failed to measure legacy tray image bytes:', error);
    throw error;
  }
}

export async function recordTrayImageBytes(store, record) {
  if (!record?.trayImageKey) return 0;
  const recorded = validByteLength(record.trayImageBytes);
  if (recorded != null) return recorded;
  return legacyImageByteLength(store, record.trayImageKey);
}

export async function userImageUsageBytes(store, userId, { excludeSetId = null } = {}) {
  try {
    const records = await listUserRecords(store, userId);
    let total = 0;
    for (const record of records) {
      if (excludeSetId && record?.set?.id === excludeSetId) continue;
      total += await recordTrayImageBytes(store, record);
      if (!Number.isSafeInteger(total)) throw new Error('Cloud tray image usage exceeds the safe accounting range.');
    }
    return total;
  } catch (error) {
    console.error('Failed to calculate account tray image usage:', error);
    throw error;
  }
}

export function imageQuotaWouldBeExceeded(currentBytes, replacementBytes) {
  const current = validByteLength(currentBytes);
  const replacement = validByteLength(replacementBytes);
  if (current == null || replacement == null) throw new Error('Tray image quota input is invalid.');
  return current + replacement > MAX_USER_IMAGE_BYTES;
}
