import { getUser } from '@netlify/identity';
import {
  LEGACY_COMMUNITY_INDEX, listPublicRecords, listUserRecords, openDiceSetStore,
  publicRecordKey, recordKey, toPublicRecord,
} from './dice-set-store.mjs';

function json(body, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
async function readArray(store, key) {
  const value = await store.get(key, { type: 'json' }).catch(() => []);
  return Array.isArray(value) ? value : [];
}
async function loadLegacyCommunityRecords(store) {
  try {
    const index = await readArray(store, LEGACY_COMMUNITY_INDEX);
    return (await Promise.all(index.map((item) => store.get(recordKey(item.ownerId, item.setId), { type: 'json' }).catch(() => null))))
      .filter((record) => record?.set?.locked && record?.set?.visibility === 'public')
      .map(toPublicRecord);
  } catch (error) {
    console.error('Failed to load legacy community dice-set records:', error);
    return [];
  }
}
function mergeCommunityRecords(legacy, current) {
  try {
    const records = new Map();
    for (const record of [...legacy, ...current]) {
      if (!record?.set?.locked || record?.set?.visibility !== 'public') continue;
      const key = JSON.stringify([record.set.ownerId, record.set.id]);
      records.set(key, toPublicRecord(record));
    }
    return [...records.values()]
      .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
      .slice(0, 500);
  } catch (error) {
    console.error('Failed to merge community dice-set records:', error);
    return [];
  }
}

export default async (request) => {
  try {
    const store = openDiceSetStore();
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'mine';
    const user = await getUser();
    if (request.method === 'GET' && scope === 'community') {
      const [current, legacy] = await Promise.all([listPublicRecords(store), loadLegacyCommunityRecords(store)]);
      return json({ records: mergeCommunityRecords(legacy, current) });
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
      return json({ records: await listUserRecords(store, user.id), userId: user.id });
    }
    if (request.method === 'DELETE') {
      const setId = url.searchParams.get('id');
      if (!setId) return json({ error: 'Dice set id is required.' }, 400);
      const key = recordKey(user.id, setId);
      const existing = await store.get(key, { type: 'json' }).catch(() => null);
      if (!existing) return json({ error: 'Dice set not found.' }, 404);
      await store.delete(publicRecordKey(user.id, setId));
      if (existing.trayImageKey) await store.delete(existing.trayImageKey);
      await store.delete(key);
      return json({ success: true });
    }
    return json({ error: 'Method Not Allowed' }, 405);
  } catch (error) {
    console.error('V2 dice-set API failed:', error);
    return json({ error: error?.message || 'Dice-set request failed.' }, 500);
  }
};
export const config = { path: '/api/dice-sets' };
