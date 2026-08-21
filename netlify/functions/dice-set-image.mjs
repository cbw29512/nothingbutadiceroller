import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';

const STORE_NAME = 'dice-trays-store';
function recordKey(ownerId, setId) { return `users/${ownerId}/dice-sets/${setId}.json`; }

export default async (request) => {
  try {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url);
    const ownerId = String(url.searchParams.get('owner') || '');
    const setId = String(url.searchParams.get('set') || '');
    const token = String(url.searchParams.get('token') || '');
    if (!ownerId || !setId) return new Response('Missing dice set', { status: 400 });

    const store = getStore(STORE_NAME);
    const record = await store.get(recordKey(ownerId, setId), { type: 'json' }).catch(() => null);
    if (!record?.trayImageKey) return new Response('Image not found', { status: 404 });
    const hasCapability = Boolean(record.trayImageAccessToken) && token === record.trayImageAccessToken;
    if (!hasCapability) {
      const user = await getUser();
      if (!user || user.id !== ownerId) return new Response('Unauthorized', { status: 401 });
    }
    const entry = await store.getWithMetadata(record.trayImageKey, { type: 'arrayBuffer' });
    if (!entry?.data) return new Response('Image not found', { status: 404 });
    return new Response(entry.data, {
      headers: {
        'Content-Type': entry.metadata?.contentType || 'image/png',
        'Cache-Control': record.set?.visibility === 'public' && record.set?.locked ? 'public, max-age=86400' : 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Dice-set image request failed:', error);
    return new Response('Unable to load dice-set image', { status: 500 });
  }
};
export const config = { path: '/api/dice-set-image' };
