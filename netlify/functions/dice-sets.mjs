import { getUser } from '@netlify/identity';
import {
  listLegacyPublicProjections, listPublicProjections, listUserRecords, openDiceSetStore,
  publicRecordKey, recordKey,
} from './dice-set-store.mjs';

function json(body, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
function publicRecordsFromProjections(current, legacy) {
  try {
    const records = new Map();
    for (const projection of [...legacy, ...current]) {
      const record = projection?.publicRecord;
      if (!record?.set?.locked || record.set.visibility !== 'public') continue;
      records.set(projection.publicAccessId, record);
    }
    return [...records.values()]
      .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
      .slice(0, 500);
  } catch (error) {
    console.error('Failed to render community dice-set projections:', error);
    return [];
  }
}
async function bestEffortDelete(store, key, label) {
  if (!key) return;
  try { await store.delete(key); } catch (error) { console.warn(`Failed to clean up ${label}:`, error); }
}

export default async (request, context) => {
  try {
    const store = openDiceSetStore(context);
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'mine';
    const user = await getUser();
    if (request.method === 'GET' && scope === 'community') {
      const current = await listPublicProjections(store);
      const sources = new Set(current.map((projection) => JSON.stringify([projection?.ownerId, projection?.setId])));
      const legacy = await listLegacyPublicProjections(store, sources);
      return json({ records: publicRecordsFromProjections(current, legacy) });
    }
    if (!user) return json({ error: 'Authentication required.' }, 401);
    if (request.method === 'GET') {
      const setId = url.searchParams.get('id');
      if (setId) {
        const record = await store.get(recordKey(user.id, setId), { type: 'json' }).catch(() => null);
        if (!record) return json({ error: 'Dice set not found.' }, 404);
        return json({ record, userId: user.id });
      }
      return json({ records: await listUserRecords(store, user.id), userId: user.id });
    }
    if (request.method === 'DELETE') {
      const setId = url.searchParams.get('id');
      if (!setId) return json({ error: 'Dice set id is required.' }, 400);
      const key = recordKey(user.id, setId);
      const existing = await store.get(key, { type: 'json' }).catch(() => null);
      if (!existing) return json({ error: 'Dice set not found.' }, 404);
      await store.delete(key);
      if (existing.publicAccessId) await bestEffortDelete(store, publicRecordKey(existing.publicAccessId), 'public projection');
      if (existing.trayImageKey) await bestEffortDelete(store, existing.trayImageKey, 'tray image');
      return json({ success: true });
    }
    return json({ error: 'Method Not Allowed' }, 405);
  } catch (error) {
    console.error('V2 dice-set API failed:', error);
    return json({ error: error?.message || 'Dice-set request failed.' }, 500);
  }
};
export const config = { path: '/api/dice-sets' };
