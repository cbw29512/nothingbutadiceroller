import { getUser } from '@netlify/identity';
import { openDiceSetStore, recordKey, resolvePublicProjection } from './dice-set-store.mjs';

export default async (request, context) => {
  try {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url);
    const publicAccessId = String(url.searchParams.get('public') || '');
    const ownerId = String(url.searchParams.get('owner') || '');
    const setId = String(url.searchParams.get('set') || '');
    const token = String(url.searchParams.get('token') || '');
    const store = openDiceSetStore(context);

    let record = null;
    if (publicAccessId) {
      const projection = await resolvePublicProjection(store, publicAccessId);
      if (!projection) return new Response('Image not found', { status: 404 });
      record = await store.get(recordKey(projection.ownerId, projection.setId), { type: 'json' }).catch(() => null);
      const publicLocked = record?.set?.visibility === 'public' && record?.set?.locked;
      const currentAccess = record?.publicAccessId === publicAccessId;
      const legacyAccess = projection.legacy === true && !record?.publicAccessId;
      const hasCapability = publicLocked && (currentAccess || legacyAccess)
        && Boolean(record?.trayImageAccessToken) && token === record.trayImageAccessToken;
      if (!hasCapability) return new Response('Unauthorized', { status: 401 });
    } else {
      if (!ownerId || !setId) return new Response('Missing dice set', { status: 400 });
      record = await store.get(recordKey(ownerId, setId), { type: 'json' }).catch(() => null);
      const legacyCapability = !record?.publicAccessId
        && record?.set?.visibility === 'public' && record?.set?.locked
        && Boolean(record?.trayImageAccessToken) && token === record.trayImageAccessToken;
      if (!legacyCapability) {
        const user = await getUser();
        if (!user || user.id !== ownerId) return new Response('Unauthorized', { status: 401 });
      }
    }

    if (!record?.trayImageKey) return new Response('Image not found', { status: 404 });
    const entry = await store.getWithMetadata(record.trayImageKey, { type: 'arrayBuffer' });
    if (!entry?.data) return new Response('Image not found', { status: 404 });
    return new Response(entry.data, {
      headers: {
        'Content-Type': entry.metadata?.contentType || 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Dice-set image request failed:', error);
    return new Response('Unable to load dice-set image', { status: 500 });
  }
};
export const config = { path: '/api/dice-set-image' };
