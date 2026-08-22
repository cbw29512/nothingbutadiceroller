import { getStore } from '@netlify/blobs';

export function scopedStoreName(baseName, context) {
  const name = String(baseName || '').trim();
  if (!name) throw new Error('Blob store name is required.');
  return String(context?.deploy?.context || 'dev') === 'production' ? name : `${name}-nonprod`;
}

export function openScopedStore(baseName, context, { consistency = 'strong' } = {}) {
  try {
    return getStore({ name: scopedStoreName(baseName, context), consistency });
  } catch (error) {
    console.error(`Failed to open scoped Blob store ${baseName}:`, error);
    throw error;
  }
}
