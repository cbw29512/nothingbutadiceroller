import { getUser, verifyRequestOrigin } from '@netlify/identity';
import {
  conditionalRecordWrite, listVersionedUserRecords, normalizeExpectedVersion,
  readVersionedRecord, versionConflict,
} from './dice-set-concurrency.mjs';
import {
  listLegacyPublicProjections, listPublicProjections, openDiceSetStore,
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
function versionMap(entries) {
  return Object.fromEntries(entries.map((entry) => [entry.record.set.id, entry.version]));
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
        const entry = await readVersionedRecord(store, recordKey(user.id, setId));
        if (!entry?.record?.set) return json({ error: 'Dice set not found.' }, 404);
        return json({ record: entry.record, version: entry.version, userId: user.id });
      }
      const entries = await listVersionedUserRecords(store, user.id);
      return json({ records: entries.map((entry) => entry.record), versions: versionMap(entries), userId: user.id });
    }
    if (request.method === 'DELETE') {
      verifyRequestOrigin(request);
      const setId = url.searchParams.get('id');
      if (!setId) return json({ error: 'Dice set id is required.' }, 400);
      const expectedVersion = normalizeExpectedVersion(request.headers.get('If-Match'));
      const key = recordKey(user.id, setId);
      const existing = await readVersionedRecord(store, key);
      if (!existing?.record?.set) return json({ error: 'Dice set not found.' }, 404);
      if (expectedVersion !== existing.version) return json(versionConflict(existing), 409);

      const tombstone = { deletionMarker: true, deletedAt: new Date().toISOString() };
      const marked = await conditionalRecordWrite(store, key, tombstone, expectedVersion);
      if (marked.conflict) return json(marked.conflict, 409);
      await store.delete(key);
      if (existing.record.publicAccessId) await bestEffortDelete(store, publicRecordKey(existing.record.publicAccessId), 'public projection');
      if (existing.record.trayImageKey) await bestEffortDelete(store, existing.record.trayImageKey, 'tray image');
      return json({ success: true });
    }
    return json({ error: 'Method Not Allowed' }, 405);
  } catch (error) {
    const status = Number(error?.status || error?.statusCode) || 500;
    if (status === 403) return json({ error: 'Request origin is not allowed.' }, 403);
    console.error('V2 dice-set API failed:', error);
    return json({ error: error?.message || 'Dice-set request failed.' }, status >= 400 && status < 600 ? status : 500);
  }
};
export const config = { path: '/api/dice-sets' };
