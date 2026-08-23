export async function listAllBlobKeys(store, prefix) {
  try {
    const keys = [];
    for await (const page of store.list({ prefix, paginate: true })) {
      for (const entry of page?.blobs || []) {
        if (typeof entry?.key === 'string') keys.push(entry.key);
      }
    }
    return keys;
  } catch (error) {
    console.error(`Failed to enumerate privacy data under ${prefix}:`, error);
    throw error;
  }
}

export async function readJsonEntries(store, prefix) {
  const keys = await listAllBlobKeys(store, prefix);
  const values = await Promise.all(keys.map(async (key) => ({
    key,
    value: await store.get(key, { type: 'json' }).catch(() => null),
  })));
  return values.filter((entry) => entry.value != null);
}

export async function deleteBlob(store, key, label) {
  if (!key) return false;
  try {
    await store.delete(key);
    return true;
  } catch (error) {
    console.error(`Failed to delete ${label}:`, error);
    throw error;
  }
}
