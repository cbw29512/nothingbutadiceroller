import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';

const STORE_NAME = 'dice-trays-store';
const COMMUNITY_INDEX = 'community/dice-sets/index.json';
function json(body, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
function keyPart(value) { return encodeURIComponent(String(value)); }
function recordKey(userId, setId) { return `users/${keyPart(userId)}/dice-sets/${keyPart(setId)}.json`; }
function indexKey(userId) { return `users/${keyPart(userId)}/dice-sets/index.json`; }
function publicCreator(value) {
  const text = String(value || '').trim();
  return text && !text.includes('@') ? text : 'Adventurer';
}
function toPublicRecord(record) {
  return {
    set: record?.set || null,
    creator: publicCreator(record?.creator),
    createdAt: record?.createdAt || null,
    updatedAt: record?.updatedAt || null,
  };
}
async function readArray(store, key) {
  const value = await store.get(key, { type: 'json' }).catch(() => []);
  return Array.isArray(value) ? value : [];
}

export default async (request) => {
  try {
    const store = getStore(STORE_NAME);
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'mine';
    const user = await getUser();
    if (request.method === 'GET' && scope === 'community') {
      const index = await readArray(store, COMMUNITY_INDEX);
      const records = (await Promise.all(index.map((item) => store.get(recordKey(item.ownerId, item.setId), { type: 'json' }).catch(() => null))))
        .filter((record) => record?.set?.locked && record?.set?.visibility === 'public')
        .map(toPublicRecord);
      return json({ records });
    }
    if (!user) return json({ error: 'Authentication required.' }, 401);
    if (request.method === 'GET') {
      const setId = url.searchParams.get('id');
      const ownerId = url.searchParams.get('owner') || user.id;
      if (setId) {
        const record = await store.get(recordKey(ownerId, setId), { type: 'json' }).catch(() => null);
        if (!record) return json({ error: 'Dice set not found.' }, 404);
        const publicLocked = record.set?.locked && record.set?.visibility === 'public';
        if (ownerId !== user.id && !publicLocked) return json({ error: 'Dice set is private.' }, 403);
        return json({ record: ownerId === user.id ? record : toPublicRecord(record), userId: user.id });
      }
      const index = await readArray(store, indexKey(user.id));
      const records = (await Promise.all(index.map((item) => store.get(recordKey(user.id, item.setId), { type: 'json' }).catch(() => null))))
        .filter(Boolean);
      return json({ records, userId: user.id });
    }
    if (request.method === 'DELETE') {
      const setId = url.searchParams.get('id');
      if (!setId) return json({ error: 'Dice set id is required.' }, 400);
      const key = recordKey(user.id, setId);
      const existing = await store.get(key, { type: 'json' }).catch(() => null);
      if (!existing) return json({ error: 'Dice set not found.' }, 404);
      if (existing.trayImageKey) await store.delete(existing.trayImageKey).catch((error) => console.warn('Tray image cleanup failed:', error));
      await store.delete(key);
      const mine = await readArray(store, indexKey(user.id));
      await store.setJSON(indexKey(user.id), mine.filter((item) => item.setId !== setId));
      const community = await readArray(store, COMMUNITY_INDEX);
      await store.setJSON(COMMUNITY_INDEX, community.filter((item) => !(item.ownerId === user.id && item.setId === setId)));
      return json({ success: true });
    }
    return json({ error: 'Method Not Allowed' }, 405);
  } catch (error) {
    console.error('V2 dice-set API failed:', error);
    return json({ error: error?.message || 'Dice-set request failed.' }, 500);
  }
};
export const config = { path: '/api/dice-sets' };
