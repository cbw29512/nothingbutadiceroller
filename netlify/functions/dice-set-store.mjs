import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'dice-trays-store';
export const PUBLIC_DICE_SET_PREFIX = 'community/public-dice-sets/';
export const LEGACY_COMMUNITY_INDEX = 'community/dice-sets/index.json';

function keyPart(value) { return encodeURIComponent(String(value)); }
function legacyPublicAccessId(ownerId, setId) {
  const hash = createHash('sha256').update(`${ownerId}\u0000${setId}`).digest('hex').slice(0, 32);
  return `public_legacy_${hash}`;
}
export function openDiceSetStore() {
  try {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (error) {
    console.error('Failed to open strong-consistency dice-set store:', error);
    throw error;
  }
}
export function userDiceSetPrefix(userId) { return `users/${keyPart(userId)}/dice-sets/`; }
export function recordKey(userId, setId) { return `${userDiceSetPrefix(userId)}${keyPart(setId)}.json`; }
export function imageKey(userId, setId) { return `${userDiceSetPrefix(userId)}${keyPart(setId)}_tray`; }
export function publicRecordKey(publicAccessId) { return `${PUBLIC_DICE_SET_PREFIX}${keyPart(publicAccessId)}.json`; }

function publicSet(record, publicAccessId) {
  const set = structuredClone(record?.set || {});
  set.id = publicAccessId;
  set.ownerId = `community_${publicAccessId}`;
  const image = set?.appearance?.tray?.image;
  if (image && record?.trayImageAccessToken) {
    set.appearance.tray.image = {
      kind: 'blob',
      url: `/api/dice-set-image?public=${encodeURIComponent(publicAccessId)}&token=${record.trayImageAccessToken}`,
    };
  }
  return set;
}
export function toPublicRecord(record, publicAccessId) {
  try {
    return {
      set: publicSet(record, publicAccessId),
      creator: 'Adventurer',
      createdAt: record?.createdAt || null,
      updatedAt: record?.updatedAt || null,
    };
  } catch (error) {
    console.error('Failed to create privacy-safe public dice-set record:', error);
    return null;
  }
}
export function buildPublicProjection(record, publicAccessId, { legacy = false } = {}) {
  try {
    const publicRecord = toPublicRecord(record, publicAccessId);
    if (!publicRecord) throw new Error('Unable to create public dice-set projection.');
    return {
      publicAccessId,
      ownerId: record.set.ownerId,
      setId: record.set.id,
      legacy,
      publicRecord,
    };
  } catch (error) {
    console.error('Failed to build public dice-set projection:', error);
    throw error;
  }
}
async function listRecords(store, prefix, predicate = () => true) {
  try {
    const { blobs = [] } = await store.list({ prefix });
    const keys = blobs.map((entry) => entry?.key).filter((key) => typeof key === 'string' && predicate(key));
    return (await Promise.all(keys.map((key) => store.get(key, { type: 'json' }).catch(() => null)))).filter(Boolean);
  } catch (error) {
    console.error(`Failed to list dice-set records under ${prefix}:`, error);
    throw error;
  }
}
export function listUserRecords(store, userId) {
  const prefix = userDiceSetPrefix(userId);
  return listRecords(store, prefix, (key) => key.endsWith('.json') && key !== `${prefix}index.json`);
}
export function listPublicProjections(store) {
  return listRecords(store, PUBLIC_DICE_SET_PREFIX, (key) => key.endsWith('.json'));
}
async function readLegacyIndex(store) {
  const value = await store.get(LEGACY_COMMUNITY_INDEX, { type: 'json' }).catch(() => []);
  return Array.isArray(value) ? value : [];
}
export async function listLegacyPublicProjections(store, excludedSources = new Set()) {
  try {
    const index = await readLegacyIndex(store);
    const projections = [];
    for (const item of index) {
      const sourceKey = JSON.stringify([item?.ownerId, item?.setId]);
      if (!item?.ownerId || !item?.setId || excludedSources.has(sourceKey)) continue;
      const record = await store.get(recordKey(item.ownerId, item.setId), { type: 'json' }).catch(() => null);
      if (!record?.set?.locked || record.set.visibility !== 'public') continue;
      projections.push(buildPublicProjection(record, legacyPublicAccessId(item.ownerId, item.setId), { legacy: true }));
    }
    return projections;
  } catch (error) {
    console.error('Failed to load legacy public dice-set projections:', error);
    return [];
  }
}
export async function resolvePublicProjection(store, publicAccessId) {
  try {
    const current = await store.get(publicRecordKey(publicAccessId), { type: 'json' }).catch(() => null);
    if (current?.publicAccessId === publicAccessId) return current;
    const legacyIndex = await readLegacyIndex(store);
    const legacy = legacyIndex.find((item) => item?.ownerId && item?.setId && legacyPublicAccessId(item.ownerId, item.setId) === publicAccessId);
    if (!legacy) return null;
    const record = await store.get(recordKey(legacy.ownerId, legacy.setId), { type: 'json' }).catch(() => null);
    if (!record?.set?.locked || record.set.visibility !== 'public') return null;
    return buildPublicProjection(record, publicAccessId, { legacy: true });
  } catch (error) {
    console.error('Failed to resolve public dice-set projection:', error);
    return null;
  }
}
