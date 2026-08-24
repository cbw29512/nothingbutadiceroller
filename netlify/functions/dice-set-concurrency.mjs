import { userDiceSetPrefix } from './dice-set-store.mjs';

function isUserRecordKey(key, prefix) {
  return key.endsWith('.json') && key !== `${prefix}index.json`;
}

export async function readVersionedRecord(store, key) {
  try {
    const entry = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (!entry) return null;
    return { record: entry.data, version: entry.etag };
  } catch (error) {
    console.error('Versioned dice-set read failed:', error);
    throw new Error('Unable to read dice-set storage.');
  }
}

export async function listVersionedUserRecords(store, userId) {
  try {
    const prefix = userDiceSetPrefix(userId);
    const { blobs = [] } = await store.list({ prefix });
    const keys = blobs.map((entry) => entry?.key).filter((key) => typeof key === 'string' && isUserRecordKey(key, prefix));
    const entries = await Promise.all(keys.map((key) => readVersionedRecord(store, key)));
    return entries.filter((entry) => entry?.record?.set);
  } catch (error) {
    console.error('Failed to list versioned dice-set records:', error);
    throw new Error('Unable to list dice-set storage.');
  }
}

export function normalizeExpectedVersion(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length < 1 || value.length > 300) {
    throw new Error('Dice-set version must be null or a valid storage version.');
  }
  return value;
}

export function versionConflict(latest) {
  return {
    error: 'This dice set changed in another session. Reload the latest copy before saving again.',
    code: 'dice-set-version-conflict',
    record: latest?.record || null,
    version: latest?.version || null,
  };
}

export async function conditionalRecordWrite(store, key, record, expectedVersion) {
  const current = await readVersionedRecord(store, key);
  const currentVersion = current?.version || null;
  if (expectedVersion !== currentVersion) return { conflict: versionConflict(current) };

  let result;
  try {
    result = currentVersion
      ? await store.setJSON(key, record, { onlyIfMatch: currentVersion })
      : await store.setJSON(key, record, { onlyIfNew: true });
  } catch (error) {
    console.error('Conditional dice-set write failed:', error);
    throw new Error('Unable to write dice-set storage.');
  }

  if (result?.modified && result?.etag) return { version: result.etag };
  return { conflict: versionConflict(await readVersionedRecord(store, key)) };
}
