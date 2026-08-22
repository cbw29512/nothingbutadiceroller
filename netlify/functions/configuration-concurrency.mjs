import { publicError } from './api-errors.mjs';

export function normalizeConfigurationVersion(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length < 1 || value.length > 300) {
    throw publicError('Saved-configuration version is invalid. Reload your account data.', {
      status: 400,
      code: 'invalid-configuration-version',
    });
  }
  return value;
}

export async function readVersionedConfigurations(store, key) {
  try {
    const entry = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (!entry) return { configurations: [], version: null };
    return {
      configurations: Array.isArray(entry.data) ? entry.data : [],
      version: entry.etag || null,
    };
  } catch (error) {
    console.error('Failed to read versioned saved configurations:', error);
    throw new Error('Saved-configuration storage read failed.');
  }
}

export function configurationConflict(latest) {
  return publicError('Saved configurations changed in another session. Reload the latest list before trying again.', {
    status: 409,
    code: 'configuration-version-conflict',
    details: {
      configurations: latest.configurations,
      version: latest.version,
    },
  });
}

export async function writeVersionedConfigurations(store, key, configurations, expectedVersion) {
  const current = await readVersionedConfigurations(store, key);
  if (current.version !== expectedVersion) throw configurationConflict(current);

  let result;
  try {
    result = current.version
      ? await store.setJSON(key, configurations, { onlyIfMatch: current.version })
      : await store.setJSON(key, configurations, { onlyIfNew: true });
  } catch (error) {
    console.error('Failed to conditionally write saved configurations:', error);
    throw new Error('Saved-configuration storage write failed.');
  }

  if (result?.modified && result?.etag) return result.etag;
  throw configurationConflict(await readVersionedConfigurations(store, key));
}
